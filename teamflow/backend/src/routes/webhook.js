/**
 * Stripe Webhook Route — isolated in its own file deliberately.
 *
 * This router MUST be its own separate instance from the billing API
 * router (routes/billing.js). If the same router object is mounted at
 * both /webhook and /api/billing, Express gets confused about which
 * mount prefix to strip when matching /stripe, and req.body can arrive
 * as a parsed object instead of a raw Buffer — breaking signature
 * verification.
 *
 * Mounting order in app.js:
 *   1. app.use('/webhook', webhookRoutes)   ← this file, BEFORE express.json()
 *   2. app.use(express.json())
 *   3. app.use('/api/billing', billingRoutes)
 *
 * express.raw({ type: 'application/json' }) is applied inline on the
 * /stripe POST route only. It buffers the raw request bytes into
 * req.body as a Node.js Buffer before the handler runs.
 * constructEvent() requires a Buffer or string — never a parsed object.
 */
const { Router } = require('express');
const express = require('express');
const { handleWebhookEvent } = require('../services/billingService');

const router = Router();

router.post(
  '/stripe',
  // express.raw() must be registered as route-level middleware here,
  // BEFORE any body has been touched. It reads the raw bytes and sets
  // req.body = Buffer. The global express.json() in app.js never runs
  // for this route because this router is matched first.
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    // Defensive check: if req.body is not a Buffer, express.raw() did not
    // run or was bypassed. Log and reject rather than silently failing.
    if (!Buffer.isBuffer(req.body)) {
      console.error(
        'Webhook error: req.body is not a Buffer (got %s). ' +
        'Check that this route is mounted before express.json() in app.js ' +
        'and that no other body-parsing middleware ran first.',
        typeof req.body
      );
      return res.status(400).json({
        error: 'Raw body not available. Signature verification cannot proceed.',
      });
    }

    try {
      const result = await handleWebhookEvent(req.body, signature);

      if (result.alreadyProcessed) {
        // Duplicate event — return 200 so Stripe does not retry.
        return res.status(200).json({ received: true, duplicate: true });
      }

      res.status(200).json({ received: true });
    } catch (err) {
      // Do NOT use next(err) — the global error handler sets req.dbError
      // which triggers a ROLLBACK on a dbClient that doesn't exist here.
      console.error('Webhook handler error:', err.message);
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

module.exports = router;
