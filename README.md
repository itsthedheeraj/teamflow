# TeamFlow

A multi-tenant SaaS starter application demonstrating production-grade backend
architecture: organization-based accounts, role-based access control, Stripe
subscription billing, and Redis-based usage metering. A lightweight task tracker
sits on top to make the demo tangible — but the core value is in the
SaaS infrastructure underneath.

**Built as a portfolio project to demonstrate real, interview-relevant backend concepts:**
multi-tenancy with database-layer isolation, idempotent event processing, and
resource-based rate limiting.

---

## Live Demo

> Add your deployed URLs here after deployment.

- Frontend: `https://teamflow.vercel.app`
- API: `https://teamflow-api.onrender.com`

Demo logins (seeded automatically):

| Email | Password | Org | Role | Tier |
|---|---|---|---|---|
| alice@acme.example | Seedpass1! | Acme Corp | Owner | Free (near limits) |
| carol@beta.example | Seedpass1! | Beta Labs | Owner | Pro |
| grace@solo.example | Seedpass1! | Solo Studio | Owner | Free (light usage) |

---

## What it does

Users don't sign up individually — they sign up as part of an **Organization**
(think Slack or Trello). The first person to sign up creates the org and becomes
the Owner. Owners invite teammates via a signed, expiring link. Everyone in an
org shares the same project and task board, scoped entirely to that org.

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (React)                      │
│   Signup → creates user + org in one transaction       │
│   Login  → JWT: { userId, orgId, role }                │
│   Org Switcher → re-issues JWT with new active orgId   │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS / JWT
┌────────────────────▼────────────────────────────────────┐
│                  Express API                            │
│                                                         │
│  verifyJWT → verifyOrgMembership → setOrgContext        │
│      │              │                    │              │
│   decode          DB check           BEGIN txn +        │
│   token        (org_members)         SET LOCAL          │
│                                     app.current_org_id  │
│                                                         │
│  requireRole → route handler → service → DB client     │
│      │                             │           │        │
│  403 if role              check Redis      RLS enforced │
│  insufficient             counter          on every     │
│                                            query        │
└──────────────┬──────────────────┬──────────────────────┘
               │                  │
┌──────────────▼──────┐  ┌────────▼────────────────────┐
│    PostgreSQL        │  │         Redis               │
│                      │  │                             │
│  RLS policies on     │  │  usage:{orgId}:members      │
│  projects + tasks    │  │  usage:{orgId}:tasks        │
│                      │  │                             │
│  stripe_events table │  │  Counters sync from PG on   │
│  (idempotency)       │  │  Redis restart              │
└──────────────────────┘  └─────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│                Stripe (external)                     │
│                                                      │
│  Checkout session → hosted payment page              │
│  Webhook → /webhook/stripe                           │
│    1. Verify signature (raw body required)           │
│    2. Idempotency check (stripe_events table)        │
│    3. Update org.subscription_tier                   │
└──────────────────────────────────────────────────────┘
```

---

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 18 + Vite + Tailwind CSS | Component UI, fast dev server |
| Backend | Node.js + Express | REST API |
| Database | PostgreSQL | RLS, relational integrity for billing/roles |
| Cache / Metering | Redis (ioredis) | Atomic counters, fast limit checks |
| Payments | Stripe API (test mode) | Subscription billing, webhooks |
| Auth | JWT (jsonwebtoken) | Stateless, carries userId + orgId + role |

---

## Features

### Feature 1 — Auth & Organizations
Signup creates a user **and** an organization in a single database transaction
(atomicity: all-or-nothing). JWT carries `userId`, `orgId`, and `role`. Users
can belong to multiple orgs and switch active org from the UI.

→ [Detailed design notes + quiz](docs/feature-01-auth-and-organizations.md)

### Feature 2 — Multi-Tenant Data Isolation (RLS)
Every tenant-scoped table (`projects`, `tasks`) has Row-Level Security enabled.
A Postgres policy enforces that queries only return rows matching the session's
`app.current_org_id`. The app connects as a **non-superuser role** (`app_user`)
— critical because superusers bypass RLS silently.

The middleware chain sets this context per-request using `SET LOCAL`
(transaction-scoped, not session-scoped) to prevent connection-pool bleed.

→ [Detailed design notes + quiz](docs/feature-02-multi-tenant-rls.md)
→ [RLS local vs Supabase/Neon setup](docs/rls-setup.md)

### Feature 3 — Role-Based Access Control + Invites
Three roles: Owner > Admin > Member. Role is re-read from the database on every
request (never trusted from the JWT) to prevent stale privilege escalation.
Invite tokens are JWTs **and** stored in the database — the DB record enables
revocation, which pure JWTs cannot provide.

→ [Detailed design notes + quiz](docs/feature-03-role-based-access-control.md)

### Feature 4 — Task Tracker
Projects and Tasks scoped to `org_id`. All service functions receive the
transaction-scoped DB client (`req.dbClient`) rather than importing the pool
directly — this ensures RLS is always active and all queries are part of the
same transaction.

→ [Detailed design notes + quiz](docs/feature-04-task-tracker.md)

### Feature 5 — Stripe Subscription Billing
Stripe Checkout creates a hosted payment page (TeamFlow never sees card details).
The backend listens for `checkout.session.completed` and
`customer.subscription.deleted` webhooks to update `subscription_tier`.

**Idempotency:** duplicate webhook deliveries are detected by attempting to
INSERT the Stripe event ID (UNIQUE constraint). If the INSERT fails with a
unique violation (`23505`), the event has already been processed — skip and
return 200. Stored in Postgres (not Redis) for durability.

**Middleware ordering:** the webhook route is mounted **before** `express.json()`
so the raw body bytes are preserved for signature verification.

→ [Detailed design notes + quiz](docs/feature-05-stripe-billing.md)

### Feature 6 — Usage Metering & Rate Limiting (Redis)
Free tier: 3 members, 20 tasks. Pro: 20 members, unlimited tasks.

Redis counters (`INCR`/`DECR`) track current usage per org. Counters are:
- Incremented only after the DB write succeeds
- Decremented on delete (including cascade-delete resync for project deletion)
- Floored at 0 to prevent negative counts
- Resynced from Postgres on Redis restart (graceful degradation)

→ [Detailed design notes + quiz](docs/feature-06-usage-metering.md)

---

## Project structure

```
teamflow/
├── backend/
│   ├── src/
│   │   ├── app.js                  # Express app setup, route mounting
│   │   ├── index.js                # Server entry point
│   │   ├── db/
│   │   │   ├── pool.js             # pg Pool (connects as app_user)
│   │   │   ├── migrate.js          # Migration runner (superuser)
│   │   │   ├── seed.js             # Demo data seed script
│   │   │   └── migrations/
│   │   │       └── 001_initial_schema.sql
│   │   ├── middleware/
│   │   │   ├── verifyJWT.js        # Step 1: decode + verify token
│   │   │   ├── verifyOrgMembership.js  # Step 2: DB membership check
│   │   │   ├── setOrgContext.js    # Step 3: BEGIN + SET LOCAL
│   │   │   ├── releaseDbClient.js  # Cleanup: COMMIT/ROLLBACK on res.finish
│   │   │   ├── requireRole.js      # RBAC guard
│   │   │   └── errorHandler.js     # Global error handler
│   │   ├── routes/
│   │   │   ├── auth.js             # /api/auth/*
│   │   │   ├── projects.js         # /api/projects/*
│   │   │   ├── tasks.js            # /api/tasks/*
│   │   │   ├── team.js             # /api/team/*
│   │   │   ├── billing.js          # /api/billing/* + /webhook/stripe
│   │   │   └── usage.js            # /api/usage
│   │   ├── services/
│   │   │   ├── authService.js
│   │   │   ├── inviteService.js
│   │   │   ├── teamService.js
│   │   │   ├── projectService.js
│   │   │   ├── taskService.js
│   │   │   ├── billingService.js
│   │   │   └── meteringService.js
│   │   ├── lib/
│   │   │   └── redis.js            # ioredis client singleton
│   │   └── tests/
│   │       ├── auth.test.js
│   │       ├── rls-isolation.test.js   # proves cross-tenant isolation
│   │       ├── rbac.test.js
│   │       └── metering.test.js
│   ├── .env.example
│   ├── render.yaml                 # Render deployment config
│   └── railway.toml                # Railway deployment config (alternative)
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx     # JWT storage, org switching
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   ├── OrgSwitcher.jsx
│   │   │   ├── ProtectedRoute.jsx
│   │   │   └── UsageBar.jsx        # Live member/task usage meters
│   │   ├── pages/
│   │   │   ├── SignupPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── AcceptInvitePage.jsx
│   │   │   ├── ProjectsPage.jsx
│   │   │   ├── TaskBoardPage.jsx   # 3-column status board
│   │   │   ├── TeamPage.jsx
│   │   │   └── BillingPage.jsx
│   │   └── lib/
│   │       └── api.js              # Central fetch client
│   ├── .env.example
│   └── vercel.json                 # Vercel deployment config
├── docs/
│   ├── feature-01-auth-and-organizations.md
│   ├── feature-02-multi-tenant-rls.md
│   ├── feature-03-role-based-access-control.md
│   ├── feature-04-task-tracker.md
│   ├── feature-05-stripe-billing.md
│   ├── feature-06-usage-metering.md
│   └── rls-setup.md
├── SETUP.md                        # Complete setup checklist
└── README.md                       # This file
```

---

## Design decisions worth knowing for interviews

### Why RLS instead of application-level `WHERE org_id = ?`

Application-level filtering relies on every developer remembering to add the
filter to every query, forever. One missed WHERE clause is a cross-tenant data
leak with no error and no warning. RLS enforces isolation at the database engine
level — even a query with no WHERE clause returns only the current org's rows.

The critical implementation detail: the app connects as a **non-superuser role**
(`app_user`). Superusers bypass RLS silently. Most tutorials skip this and their
RLS is a silent no-op.

### Why webhook idempotency lives in Postgres, not Redis

Redis is ephemeral — a server restart wipes it. For usage counters (metering),
ephemerality is acceptable: a counter resync from Postgres is a minor
inconvenience. For billing events, reprocessing a `checkout.session.completed`
event because Redis forgot it would double-apply a subscription upgrade. Postgres
gives durability and an audit trail. The UNIQUE constraint on `stripe_event_id`
is the actual guard — it's atomic even under concurrent delivery.

### Why `SET LOCAL` instead of `SET` for the org context

Connection pools reuse the same TCP connection across multiple requests.
`SET app.current_org_id = X` at session level would persist on the connection
after the request ends. The next request (from a different org) reusing that
connection would inherit the wrong org context. `SET LOCAL` (via
`set_config($1, $2, TRUE)`) scopes the variable to the current transaction only,
clearing automatically on `COMMIT` or `ROLLBACK`.

### Why the invite token is stored in the database even though it's a JWT

A JWT is self-verifying but not revocable. Without the DB record, a fired
employee who received an invite link could use it until it expires (48 hours).
Storing the token gives us `accepted_at` (prevents reuse) and lets owners
cancel pending invites by deleting the row — making the token invalid immediately
regardless of its JWT expiry.

---

## Running the tests

```bash
cd backend

# All tests (requires running Postgres + Redis)
npm test

# RLS isolation tests only (the most important ones to demo)
npm run test:rls
```

Tests hit a real Postgres instance and a real Redis instance. They clean up
after themselves using `DELETE FROM users WHERE email LIKE 'test-%'`.

---

## Setup

See **[SETUP.md](SETUP.md)** for the complete step-by-step setup checklist,
including every environment variable, where to get it, and deployment
instructions for Vercel + Render/Railway.
