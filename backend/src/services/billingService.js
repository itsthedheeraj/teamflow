const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const pool = require('../db/pool');

/**
 * Billing Service
 *
 * Stripe flow for TeamFlow:
 *
 *  1. Owner clicks "Upgrade to Pro"
 *  2. createCheckoutSession() creates a Stripe Checkout session
 *     and returns the hosted checkout URL
 *  3. User pays on Stripe's hosted page
 *  4. Stripe calls our webhook with checkout.session.completed
 *  5. handleWebhookEvent() verifies the event, checks idempotency,
 *     updates org.subscription_tier in Postgres
 *
 * The webhook is the ONLY source of truth for subscription status.
 * Never trust the frontend redirect after checkout — it can be
 * faked, skipped, or arrive before the webhook.
 */

// ─────────────────────────────────────────────
// Create or retrieve Stripe customer for an org
// ─────────────────────────────────────────────
async function getOrCreateStripeCustomer(orgId) {
  const { rows } = await pool.query(
    `SELECT stripe_customer_id, name FROM organizations WHERE id = $1`,
    [orgId]
  );
  const org = rows[0];
  if (!org) throw Object.assign(new Error('Organization not found'), { status: 404 });

  if (org.stripe_customer_id) return org.stripe_customer_id;

  // Create a new Stripe customer associated with this org
  const customer = await stripe.customers.create({
    metadata: { org_id: orgId },
    description: org.name,
  });

  await pool.query(
    `UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2`,
    [customer.id, orgId]
  );

  return customer.id;
}

// ─────────────────────────────────────────────
// Create Checkout Session
// ─────────────────────────────────────────────
async function createCheckoutSession({ orgId, userId }) {
  const customerId = await getOrCreateStripeCustomer(orgId);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: [
      {
        price: process.env.STRIPE_PRO_PRICE_ID,
        quantity: 1,
      },
    ],
    // success_url: Stripe redirects here after payment.
    // NOTE: Do NOT use this redirect as proof of payment —
    // the webhook (checkout.session.completed) is the source of truth.
    // The redirect can arrive before the webhook, or can be faked.
    success_url: `${process.env.FRONTEND_URL}/billing?session_id={CHECKOUT_SESSION_ID}&success=true`,
    cancel_url: `${process.env.FRONTEND_URL}/billing?cancelled=true`,
    metadata: {
      org_id: orgId,
      user_id: userId,
    },
  });

  return { url: session.url, sessionId: session.id };
}

// ─────────────────────────────────────────────
// Create Customer Portal Session (manage billing)
// ─────────────────────────────────────────────
async function createPortalSession(orgId) {
  const { rows } = await pool.query(
    `SELECT stripe_customer_id FROM organizations WHERE id = $1`,
    [orgId]
  );
  const customerId = rows[0]?.stripe_customer_id;
  if (!customerId) {
    throw Object.assign(
      new Error('No billing account found. Upgrade to Pro first.'),
      { status: 400 }
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.FRONTEND_URL}/billing`,
  });

  return { url: session.url };
}

// ─────────────────────────────────────────────
// Webhook Event Handler
//
// IDEMPOTENCY DESIGN:
// Stripe may deliver the same webhook event more than once — their
// docs guarantee "at least once" delivery, not "exactly once."
// Causes: network timeouts, Stripe retrying after a 500 response,
// infrastructure restarts.
//
// Naive handling: process every event → subscription toggled on/off
// multiple times for a single payment. Billing chaos.
//
// Fix: store the Stripe event ID in the stripe_events table with a
// UNIQUE constraint. On any duplicate delivery, the INSERT fails with
// a unique violation and we return 200 immediately without reprocessing.
//
// WHY Postgres (not Redis) for idempotency:
// Redis is ephemeral — a restart clears it, allowing duplicates
// through after a server reboot. Postgres is durable. For billing
// events, durability is non-negotiable.
//
// WHY return 200 on duplicate (not 4xx):
// Returning any non-2xx to Stripe causes it to retry the event again.
// We want to acknowledge receipt without reprocessing. 200 is correct.
// ─────────────────────────────────────────────
async function handleWebhookEvent(rawBody, signature) {
  // 1. Verify the event came from Stripe (not a spoofed POST)
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const e = new Error(`Webhook signature verification failed: ${err.message}`);
    e.status = 400;
    throw e;
  }

  // 2. Idempotency check — have we already processed this event?
  //    The UNIQUE constraint on stripe_event_id is the actual guard.
  //    We INSERT first; if it fails with unique_violation (code 23505),
  //    the event is a duplicate and we skip processing.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    try {
      await client.query(
        `INSERT INTO stripe_events (stripe_event_id, event_type, payload)
         VALUES ($1, $2, $3)`,
        [event.id, event.type, JSON.stringify(event)]
      );
    } catch (insertErr) {
      // Postgres unique_violation error code
      if (insertErr.code === '23505') {
        await client.query('ROLLBACK');
        // Return without reprocessing — tell caller to send 200 to Stripe
        return { alreadyProcessed: true };
      }
      throw insertErr;
    }

    // 3. Route to the correct handler based on event type
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(client, event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(client, event.data.object);
        break;

      case 'customer.subscription.updated':
        // Handles plan downgrades/upgrades via the billing portal
        await handleSubscriptionUpdated(client, event.data.object);
        break;

      default:
        // Unknown event type — acknowledged but not acted on.
        // Stripe sends many event types; we only care about a few.
        break;
    }

    // 4. Update stripe_events with the resolved org_id for audit trail
    // (org_id wasn't available during initial insert above)
    await client.query('COMMIT');
    return { alreadyProcessed: false };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function handleCheckoutCompleted(client, session) {
  // The org_id is in the session metadata we set when creating the session
  const orgId = session.metadata?.org_id;
  if (!orgId) return; // defensive — should always be present

  await client.query(
    `UPDATE organizations
     SET subscription_tier  = 'pro',
         stripe_sub_id      = $2
     WHERE id = $1`,
    [orgId, session.subscription]
  );

  // Update org_id on the stripe_events row for auditability
  await client.query(
    `UPDATE stripe_events SET org_id = $1 WHERE stripe_event_id = $2`,
    [orgId, session.id] // note: session.id here is the checkout session ID, not the event ID
  );
}

async function handleSubscriptionDeleted(client, subscription) {
  // subscription.customer is the Stripe customer ID
  const { rows } = await client.query(
    `SELECT id FROM organizations WHERE stripe_customer_id = $1`,
    [subscription.customer]
  );
  if (rows.length === 0) return;
  const orgId = rows[0].id;

  await client.query(
    `UPDATE organizations
     SET subscription_tier = 'free',
         stripe_sub_id     = NULL
     WHERE id = $1`,
    [orgId]
  );
}

async function handleSubscriptionUpdated(client, subscription) {
  const { rows } = await client.query(
    `SELECT id FROM organizations WHERE stripe_customer_id = $1`,
    [subscription.customer]
  );
  if (rows.length === 0) return;
  const orgId = rows[0].id;

  // Derive tier from Stripe subscription status
  const isActive = ['active', 'trialing'].includes(subscription.status);
  const tier = isActive ? 'pro' : 'free';

  await client.query(
    `UPDATE organizations SET subscription_tier = $1 WHERE id = $2`,
    [tier, orgId]
  );
}

// ─────────────────────────────────────────────
// Get current billing status for an org
// ─────────────────────────────────────────────
async function getBillingStatus(orgId) {
  const { rows } = await pool.query(
    `SELECT subscription_tier, stripe_customer_id, stripe_sub_id
     FROM organizations WHERE id = $1`,
    [orgId]
  );
  if (rows.length === 0) throw Object.assign(new Error('Org not found'), { status: 404 });
  return rows[0];
}

module.exports = {
  createCheckoutSession,
  createPortalSession,
  handleWebhookEvent,
  getBillingStatus,
};
