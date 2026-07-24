# TeamFlow — Setup Checklist

Every value you need to replace before running locally or deploying.
Nothing should be left as a placeholder after you finish this list.

---

## How to use this checklist

1. Copy `backend/.env.example` → `backend/.env`
2. Copy `frontend/.env.example` → `frontend/.env`
3. Work through each section below and fill in the real values.
4. Run migrations, then the seed script, then start both servers.

---

## Backend variables (`backend/.env`)

### Database

| Variable | Where to get it | Required locally | Required for deploy |
|---|---|---|---|
| `DATABASE_URL` | See below | ✅ Yes | ✅ Yes |
| `DATABASE_SUPERUSER_URL` | See below | ✅ Yes (migrations only) | ✅ Yes (first deploy migration) |

**Local Postgres:**
```
DATABASE_URL=postgres://app_user:yourpassword@localhost:5432/teamflow
DATABASE_SUPERUSER_URL=postgres://postgres:yourpassword@localhost:5432/teamflow
```
The migration script creates `app_user` automatically when run as superuser.
Change `yourpassword` to whatever you set for those roles in psql.

**Neon (hosted):**
- Dashboard → your project → Connection Details
- Use the **non-pooled** connection string for `DATABASE_URL` (the
  "Direct connection" tab). Copy it directly — it's already a non-superuser.
- For `DATABASE_SUPERUSER_URL` on Neon: use the same string — Neon's
  default user has the necessary privileges without being a true superuser.

**Aiven (hosted):**
- Dashboard → your service → PostgreSQL connection details
- Copy the PostgreSQL URI and make sure it includes `sslmode=require`.
- Use that URI for `DATABASE_URL`.
- If Aiven gives you a second admin-capable URI, put it in `DATABASE_SUPERUSER_URL`.
- If you only have one URI, reuse it for `DATABASE_SUPERUSER_URL` too.

**Supabase (hosted):**
- Dashboard → Project Settings → Database → Connection String
- For `DATABASE_URL`: use the **"URI"** format under the "Transaction
  pooler" section — this is the non-superuser connection.
- For `DATABASE_SUPERUSER_URL`: use the direct connection URI from the
  same page (labelled "Direct connection"). Do NOT use the `postgres`
  superuser string for `DATABASE_URL` — it bypasses RLS.

---

### Redis

| Variable | Where to get it | Required locally | Required for deploy |
|---|---|---|---|
| `REDIS_URL` | See below | ✅ Yes | ✅ Yes |

**Local:**
```
REDIS_URL=redis://localhost:6379
```
Start Redis: `redis-server` (Mac: `brew services start redis`,
Windows: run `redis-server.exe` or use Docker: `docker run -p 6379:6379 redis`).

**Upstash (hosted, free tier):**
- [upstash.com](https://upstash.com) → Create Database → Copy the
  "Redis URL" (format: `rediss://default:<token>@<host>:<port>`).
- Upstash free tier is sufficient for a portfolio project.

---

### JWT

| Variable | Where to get it | Required locally | Required for deploy |
|---|---|---|---|
| `JWT_SECRET` | Generate it yourself | ✅ Yes | ✅ Yes |
| `JWT_EXPIRES_IN` | Set to `7d` | ✅ Yes | ✅ Yes |
| `JWT_INVITE_EXPIRES_IN` | Set to `48h` | ✅ Yes | ✅ Yes |

**Generate a secret:**
```bash
openssl rand -base64 32
```
Paste the output as the value of `JWT_SECRET`. It must be the same value
across all backend instances — changing it invalidates all existing tokens.

---

### Stripe

| Variable | Where to get it | Required locally | Required for deploy |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe Dashboard | ✅ Yes | ✅ Yes |
| `STRIPE_WEBHOOK_SECRET` | Stripe CLI (local) / Stripe Dashboard (deployed) | ✅ Yes | ✅ Yes |
| `STRIPE_PRO_PRICE_ID` | Stripe Dashboard | ✅ Yes | ✅ Yes |

**Step-by-step Stripe setup:**

1. Create a free account at [stripe.com](https://stripe.com).
   You do NOT need to activate live mode or enter business details.

2. Toggle **Test mode** on (top right of the dashboard).

3. **Secret key** → Developers → API Keys → Secret key (`sk_test_...`).
   Copy it into `STRIPE_SECRET_KEY`.

4. **Create the Pro product:**
   - Products → Add product
   - Name: `TeamFlow Pro`
   - Pricing: Recurring, Monthly, amount of your choice (e.g. $29)
   - Save → copy the **Price ID** (`price_...`) into `STRIPE_PRO_PRICE_ID`

5. **Webhook secret for local testing:**
   ```bash
   # Install Stripe CLI: https://stripe.com/docs/stripe-cli
   stripe login
   stripe listen --forward-to localhost:3001/webhook/stripe
   ```
   The CLI prints a webhook signing secret (`whsec_...`). Copy it
   into `STRIPE_WEBHOOK_SECRET`. Keep this terminal tab open while
   developing — it forwards Stripe events to your local server.

   To simulate events manually:
   ```bash
   stripe trigger checkout.session.completed
   stripe trigger customer.subscription.deleted
   ```

6. **Webhook secret for deployed backend:**
   - Stripe Dashboard → Developers → Webhooks → Add endpoint
   - URL: `https://your-render-url.onrender.com/webhook/stripe`
   - Events to listen for: `checkout.session.completed`,
     `customer.subscription.deleted`, `customer.subscription.updated`
   - Save → Signing secret → copy `whsec_...` into the deployed env var.

---

### App

| Variable | Value | Required locally | Required for deploy |
|---|---|---|---|
| `PORT` | `3001` | ✅ Yes | Set by platform automatically |
| `NODE_ENV` | `development` locally, `production` on deploy | ✅ Yes | ✅ Yes |
| `FRONTEND_URL` | `http://localhost:5173` locally | ✅ Yes | Your Vercel URL |

`FRONTEND_URL` is used for:
- CORS — only requests from this origin are allowed
- Invite link generation — the link sent to invitees
- Stripe redirect URLs after checkout

---

## Frontend variables (`frontend/.env`)

| Variable | Where to get it | Required locally | Required for deploy |
|---|---|---|---|
| `VITE_API_BASE_URL` | Your deployed backend URL | ❌ Not needed locally | ✅ Yes |

**Locally:** The Vite dev server proxies `/api` → `http://localhost:3001`
automatically (configured in `vite.config.js`). You do NOT need
`VITE_API_BASE_URL` during local development.

**On Vercel:** Set `VITE_API_BASE_URL` to your Render/Railway backend URL,
e.g. `https://teamflow-api.onrender.com`. Vercel also needs it set as an
environment variable in the Vercel dashboard (Settings → Environment Variables)
so the build picks it up.

---

## Running locally (full checklist)

```bash
# 1. Clone and install
git clone <your-repo>
cd teamflow
npm install          # installs both workspaces

# 2. Set up backend env
cp backend/.env.example backend/.env
# → edit backend/.env with real values from the checklist above

# 3. Set up frontend env (optional for local dev)
cp frontend/.env.example frontend/.env

# 4. Create the Postgres database
psql -U postgres -c "CREATE DATABASE teamflow;"

# 5. Run migrations (creates tables, RLS policies, app_user role)
cd backend && npm run db:migrate

# 6. Seed demo data (creates 3 orgs, 7 users, projects, tasks)
npm run db:seed

# 7. Start Redis (in a separate terminal)
redis-server

# 8. Start the Stripe CLI webhook forwarder (in a separate terminal)
stripe listen --forward-to localhost:3001/webhook/stripe
# Copy the whsec_... it prints into backend/.env as STRIPE_WEBHOOK_SECRET

# 9. Start the backend (in a separate terminal)
npm run dev

# 10. Start the frontend (in a separate terminal)
cd ../frontend && npm run dev

# 11. Open http://localhost:5173
#     Demo login: alice@acme.example / Seedpass1!
```

---

## Deploying (Vercel + Render)

### Backend on Render

1. Push to GitHub.
2. Render Dashboard → New → Web Service → Connect repo.
3. Root Directory: `backend`
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Add all backend env vars from the checklist above
   in Render's **Environment** tab.
7. After first deploy, run migrations once:
   - Render Dashboard → your service → Shell tab
   - `node src/db/migrate.js`
   - `node src/db/seed.js` (optional — for demo data)
8. Note your service URL: `https://teamflow-api.onrender.com`

### Frontend on Vercel

1. Vercel Dashboard → Add New Project → Import your GitHub repo.
2. Framework Preset: Vite
3. Root Directory: `frontend`
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Environment Variables:
   - `VITE_API_BASE_URL` = `https://teamflow-api.onrender.com`
7. Deploy.
8. After deploy, go back to Render and update `FRONTEND_URL` to your
   Vercel URL (e.g. `https://teamflow.vercel.app`). Redeploy the
   backend for CORS to update.

### Backend on Railway (alternative to Render)

```bash
npm install -g @railway/cli
railway login
railway link          # link or create a project
cd backend
railway variables set DATABASE_URL="..."
railway variables set REDIS_URL="..."
railway variables set JWT_SECRET="..."
railway variables set STRIPE_SECRET_KEY="..."
railway variables set STRIPE_WEBHOOK_SECRET="..."
railway variables set STRIPE_PRO_PRICE_ID="..."
railway variables set FRONTEND_URL="https://your-vercel-url.vercel.app"
railway variables set NODE_ENV="production"
railway up
```

---

## Quick variable reference card

| Variable | File | Get from |
|---|---|---|
| `DATABASE_URL` | `backend/.env` | Neon/Supabase/local psql |
| `DATABASE_SUPERUSER_URL` | `backend/.env` | Same host, superuser creds |
| `REDIS_URL` | `backend/.env` | Upstash / local `redis://localhost:6379` |
| `JWT_SECRET` | `backend/.env` | `openssl rand -base64 32` |
| `JWT_EXPIRES_IN` | `backend/.env` | Set to `7d` |
| `JWT_INVITE_EXPIRES_IN` | `backend/.env` | Set to `48h` |
| `STRIPE_SECRET_KEY` | `backend/.env` | Stripe Dashboard → Developers → API Keys |
| `STRIPE_WEBHOOK_SECRET` | `backend/.env` | `stripe listen` output (local) or Stripe Dashboard (deployed) |
| `STRIPE_PRO_PRICE_ID` | `backend/.env` | Stripe Dashboard → Products |
| `PORT` | `backend/.env` | Set to `3001` |
| `NODE_ENV` | `backend/.env` | `development` or `production` |
| `FRONTEND_URL` | `backend/.env` | `http://localhost:5173` (local) or Vercel URL (deployed) |
| `VITE_API_BASE_URL` | `frontend/.env` | Not needed locally; Render/Railway URL on deploy |
