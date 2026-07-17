# Multi-Tenant SaaS Billing Platform — Project Documentation

## 1. Project Overview

A boilerplate multi-tenant SaaS platform demonstrating production-grade backend architecture: organization-based accounts, role-based access control, Stripe subscription billing, and Redis-based usage metering. A lightweight product layer (team task tracker or team notes app) sits on top to make the demo tangible — but the core engineering value is in the SaaS infrastructure itself.

**Goal:** Build something that maps directly to real, interview-relevant backend concepts — multi-tenancy, data isolation, idempotent event processing, and rate limiting — rather than another CRUD app.

---

## 2. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React | Component-based UI, dashboards for org/billing/usage |
| Backend | Node.js + Express | REST API layer |
| Database | PostgreSQL | Relational integrity for orgs/billing/roles; supports Row-Level Security (RLS) |
| Caching / Metering | Redis | Fast counters for usage metering, rate limiting, idempotency keys |
| Payments | Stripe API (Test Mode) | Subscription billing, webhooks |
| Auth | JWT | Stateless auth carrying `user_id` + `org_id` |
| Deployment | Vercel (frontend) + Render/Railway (backend) + Supabase/Neon (Postgres) | Free-tier friendly, live demo link for resume |

---

## 3. Core Features

### 3.1 Organizations (Tenants) & Team Accounts
- Users belong to an **Organization**, not just an individual account.
- First user to sign up creates the org and becomes **Owner**.
- Owner/Admins can invite teammates via email.
- **Schema anchor:** every table that holds tenant data includes an `org_id` foreign key.

### 3.2 Multi-Tenant Data Isolation (core backend challenge)
Two approaches — understand both, implement the second:

**A. Application-level filtering** (baseline, fragile)
Every query manually filters `WHERE org_id = current_org_id`. Risk: one missed filter = cross-tenant data leak.

**B. Row-Level Security (RLS) — the standout implementation**
Postgres enforces tenant isolation at the database layer, so even a buggy query can't leak another org's rows.

```sql
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tasks
  USING (org_id = current_setting('app.current_org_id')::uuid);
```

Backend middleware sets the session variable per request based on the authenticated user's org:

```sql
SET app.current_org_id = '<org-id-from-jwt>';
```

### 3.3 Role-Based Access Control (RBAC)
Roles within an org: **Owner, Admin, Member**.
- Owner: manage billing, delete org, remove anyone
- Admin: invite/remove members, manage settings
- Member: use product features only

Implemented via a `role` column on the `org_members` join table (users ↔ organizations, many-to-many in case a user belongs to multiple orgs), enforced with middleware:

```js
function requireRole(minRole) {
  return (req, res, next) => {
    if (roleRank(req.user.role) < roleRank(minRole)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}
```

### 3.4 Stripe Subscription Billing
Subscriptions belong to the **Org**, not individual users. Tiers: Free / Pro / Enterprise.

**Flow:**
1. Owner clicks "Upgrade" → backend creates a Stripe Checkout session → user pays on Stripe's hosted page.
2. Stripe sends a **webhook** (`checkout.session.completed`) to your backend — this is the source of truth, never the frontend redirect.
3. Backend updates the org's `subscription_tier` in Postgres based on the webhook.

### 3.5 Webhook Idempotency (second standout feature)
Stripe may send the same webhook event more than once (retries, timeouts). Naively reprocessing an event can double-apply billing effects.

**Fix:** track processed event IDs; skip duplicates.

```js
app.post('/webhook/stripe', async (req, res) => {
  const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);

  const alreadyProcessed = await redis.sismember('processed_events', event.id);
  if (alreadyProcessed) return res.status(200).send('Already processed');

  // handle event: update subscription tier, log billing history, etc.

  await redis.sadd('processed_events', event.id);
  res.status(200).send('OK');
});
```

### 3.6 Usage-Based Metering & Rate Limiting
Each tier has a usage cap (e.g., Free = 100 calls/day, Pro = 10,000/day), tracked per org using Redis counters with daily expiry:

```js
const key = `usage:${orgId}:${today}`;
const count = await redis.incr(key);
await redis.expire(key, 86400);

if (count > tierLimits[org.tier]) {
  return res.status(429).json({ error: "Usage limit exceeded" });
}
```

### 3.7 Invite Flow
Owner enters teammate email → backend generates a signed, expiring JWT invite token → emailed as a link → recipient signs up and is auto-added to the org with the intended role.

---

## 4. Request Lifecycle (End-to-End)

1. User logs in → JWT issued containing `user_id` and `org_id`.
2. Request hits Express API → middleware verifies JWT, sets `app.current_org_id` in the Postgres session.
3. Middleware checks role (RBAC) if the endpoint requires elevated permissions.
4. Middleware checks Redis usage counter — rejects with `429` if over the tier limit.
5. Query executes — Postgres RLS enforces tenant isolation regardless of application-layer bugs.
6. Billing-related actions are kept in sync separately via idempotency-checked Stripe webhooks.

---

## 5. Database Schema (Starting Point)

```
organizations
  id (uuid, pk)
  name
  subscription_tier   (free | pro | enterprise)
  stripe_customer_id
  created_at

users
  id (uuid, pk)
  email
  password_hash
  created_at

org_members
  id (uuid, pk)
  org_id (fk -> organizations.id)
  user_id (fk -> users.id)
  role     (owner | admin | member)
  created_at

tasks   (example product-layer table; every tenant table follows this pattern)
  id (uuid, pk)
  org_id (fk -> organizations.id)
  title
  status
  created_by (fk -> users.id)
  created_at

billing_events   (for auditing webhook processing / idempotency history)
  id (uuid, pk)
  stripe_event_id (unique)
  org_id (fk -> organizations.id)
  event_type
  processed_at
```

---

## 6. Stripe Setup Notes (Free, Test Mode)

- Stripe provides **test mode** with no real money movement and no credit card required to activate.
- Test card: `4242 4242 4242 4242`, any future expiry, any CVC — simulates a successful payment.
- Other test card numbers simulate declines, expired cards, insufficient funds — useful for demonstrating edge-case handling.
- **Local webhook testing:** use the **Stripe CLI**:
  ```
  stripe listen --forward-to localhost:3000/webhook/stripe
  stripe trigger checkout.session.completed
  ```
- Only switch to live keys if actually deploying for real payments — not necessary for a resume project.
- Capture screenshots/screen recording of test-mode checkout + webhook logs succeeding for your README/demo video, since recruiters can't test your Stripe integration themselves.

---

## 7. Suggested Build Order (Week-by-Week)

**Week 1 — Foundation**
- Postgres schema (organizations, users, org_members)
- JWT auth (signup/login) with `org_id` embedded
- Basic Express API skeleton + middleware structure

**Week 2 — Multi-Tenancy & RBAC**
- Implement RLS policies on tenant tables
- Middleware to set `app.current_org_id` per request
- Role-based middleware (`requireRole`)
- Invite flow (signed token + email link)

**Week 3 — Billing**
- Stripe Checkout integration (test mode)
- Webhook endpoint + idempotency handling via Redis
- Subscription tier sync to `organizations` table

**Week 4 — Metering, Rate Limiting & Product Layer**
- Redis usage counters per org, tier-based limits
- Build the thin product feature (task tracker / notes) on top, scoped to `org_id`
- Frontend: org switcher, billing page, usage dashboard, RBAC-aware UI

**Week 5 — Polish & Deploy**
- Deploy frontend (Vercel), backend (Render/Railway), DB (Supabase/Neon)
- Write README with architecture diagram, screenshots, and setup instructions
- Record a short demo video/GIF for LinkedIn + resume link

---

## 8. Resume Bullet Points (Draft)

- Designed a multi-tenant SaaS platform with organization-based accounts, role-based access control, and Stripe subscription billing
- Implemented multi-tenant data isolation using PostgreSQL Row-Level Security, enforcing tenant boundaries at the database layer independent of application code
- Built idempotent Stripe webhook processing using Redis to prevent duplicate billing events on retried delivery
- Designed Redis-based usage metering and rate limiting per tenant, enforcing tiered API limits with daily-expiring counters
- Built RBAC middleware supporting Owner/Admin/Member roles with granular permission checks across API endpoints

*(Replace with real measured numbers once load-tested — e.g., requests/sec handled, webhook processing latency, concurrent org support.)*

---

## 9. Interview Talking Points

| Question | Your Answer Source |
|---|---|
| "How would you design a multi-tenant system?" | RLS-based isolation at the DB layer |
| "How do you handle unreliable external events?" | Idempotent Stripe webhook processing via Redis |
| "How would you rate-limit an API?" | Redis counters with daily expiry, per-tenant |
| "Why Postgres over MongoDB here?" | Relational integrity for orgs/billing/roles + RLS is a Postgres-native feature |
| "How do you handle authorization vs authentication?" | JWT for authentication, RBAC middleware for authorization |
| "What happens if two webhook events arrive simultaneously?" | Discuss idempotency key check via Redis SET, atomicity considerations |

---

## 10. Deliverables Checklist

- [ ] Live deployed demo link
- [ ] Public GitHub repo with clean README (architecture diagram, setup steps, screenshots)
- [ ] Demo video/GIF (checkout flow + webhook logs)
- [ ] Resume bullets updated with real, measured numbers
- [ ] LinkedIn post write-up (optional but recommended for recruiter visibility)




project overview

The basic idea
Think of tools like Slack, Notion, or Trello. You don't sign up as "just yourself" — your whole company/team signs up together, and everyone pays for and uses the same shared workspace. That's what this app is: a team workspace with a task tracker inside it, plus the business side (accounts, teams, payments) that makes it a real "product" instead of a toy.
Walkthrough: what a user actually experiences
Step 1 — Signing up creates a "company," not just a user
When the very first person signs up, they're not just creating "an account" — they're creating an Organization (think: "Acme Corp"). This person automatically becomes the Owner of that org.
Zomato analogy: this is like picking "Dine-in" vs "Delivery" — the very first choice shapes everything that follows. Here, the first choice is "you're creating a new company workspace."
Step 2 — Owner invites teammates
The Owner goes to a "Team" page, types in teammates' email addresses, and sends invites. Each invited person gets an email link, clicks it, sets a password, and lands inside the same company workspace — they now see the same tasks/projects as everyone else on their team.
Step 3 — Not everyone has the same power (roles)
Once inside, people have different levels of access:

Owner — can do everything, including cancel the subscription or delete the whole company account
Admin — can invite/remove teammates, change settings, but can't touch billing
Member — can only use the actual product (create tasks, view the board) — no admin powers

Zomato analogy: this is like how a restaurant owner vs. a delivery rider vs. a customer all see different screens in the same app — same platform, different permissions.
Step 4 — The actual product feature (the "food" part)
Once inside their workspace, the team uses a simple task tracker — create tasks, assign them to teammates, mark them done, see a shared board. This is the "everyday use" part of the app, similar to how ordering food is the everyday use of Zomato — everything else (accounts, delivery zones, payments) exists to support this core action.
Step 5 — Free vs Paid plans (this is the "delivery vs dine-in" style fork)
Every company starts on a Free plan with limits — say, only 3 team members and 50 tasks per month. If they want more, the Owner clicks "Upgrade to Pro" and pays through the app (via Stripe, like a payment gateway — similar to how Zomato uses a payment gateway when you check out).
Zomato analogy: Free vs Pro plans are like Zomato's "basic" vs "Zomato Gold" — same app, but paying unlocks more.
Step 6 — Usage limits get enforced automatically
If a company is on the Free plan and tries to go over their limit (e.g., adding a 4th team member), the app blocks the action and shows "Upgrade to add more members." This happens automatically — the system is constantly checking "how much has this company used this month?" against "how much are they allowed?"
Zomato analogy: like how a delivery order gets blocked if you're outside the restaurant's delivery radius — the system checks a rule before letting the action happen.
Step 7 — Billing runs quietly in the background
Once a company upgrades, Stripe (the payment processor) handles the actual charging every month. Your app doesn't touch card details directly — it just gets notified by Stripe whenever a payment succeeds or fails, and updates that company's plan status accordingly (e.g., unlocking more seats, or downgrading back to Free if a payment fails).
Putting it together as one story

A company signs up → the person who signs up becomes the Owner → they invite their team → each teammate gets a role (Owner/Admin/Member) that decides what they can click → everyone uses the shared task tracker day-to-day → if they outgrow the free limits, the Owner upgrades and pays → the system automatically unlocks higher limits and keeps billing running in the background every month.

That's the whole product. The "hard engineering" parts I mentioned earlier (data isolation, webhooks, rate limiting) are all just the invisible plumbing that makes steps 5-7 actually reliable and secure — the user never sees them, but they're why the app works correctly at scale.
Want me to also sketch this out as a simple visual flow diagram so it's even easier to hold in your head?