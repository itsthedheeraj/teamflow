# Row-Level Security Setup Guide

This document explains how to configure the database correctly for RLS
to actually work — and why most tutorials get this wrong.

---

## The Critical Requirement: Non-Superuser Role

PostgreSQL Row-Level Security has one silent footgun:

> **RLS is completely bypassed for superusers.**

This means if your Node.js app connects to Postgres as the `postgres`
superuser (the default in most local dev setups), every single RLS
policy is silently ignored. Your `SELECT * FROM projects` returns
every project from every org. There is no error, no warning. It just
doesn't work.

The fix: create a non-superuser role (`app_user`) and use that in
`DATABASE_URL`. The migration script does this automatically locally.

---

## Local Postgres Setup

Run migrations once as superuser — this creates `app_user` and all
policies:

```bash
# Copy and fill in your .env
cp backend/.env.example backend/.env

# Edit DATABASE_SUPERUSER_URL to your postgres superuser connection
# Then run migrations
cd backend && npm run db:migrate
```

The migration script creates the `app_user` role with this SQL:

```sql
CREATE ROLE app_user LOGIN PASSWORD 'changeme_in_production';
GRANT CONNECT ON DATABASE teamflow TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
```

Then set `DATABASE_URL` to use `app_user`:

```
DATABASE_URL=postgres://app_user:changeme_in_production@localhost:5432/teamflow
```

To verify it's working, run the RLS isolation tests:

```bash
cd backend && npm run test:rls
```

If the "confirms the pool connects as app_user" test passes, you're good.

---

## Supabase

Supabase gives you two connection strings:

| String | Role | RLS |
|--------|------|-----|
| `postgresql://postgres:...` | Superuser | **BYPASSED** |
| `postgresql://[user].[project]:...` (connection pooler or direct) | `authenticated` / non-super | **ENFORCED** |

**Use the second one** in `DATABASE_URL`. Never use the `postgres`
superuser string for your app server.

In Supabase's SQL editor, you still need to create the policies:

```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON projects
  USING (org_id = current_setting('app.current_org_id', TRUE)::UUID);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tasks
  USING (org_id = current_setting('app.current_org_id', TRUE)::UUID);
```

Supabase has its own RLS system (based on `auth.uid()`), but we
are **not** using that — we use our own JWT + Express middleware +
`set_config` pattern so the logic lives in our app, not locked into
Supabase-specific SQL functions.

---

## Neon

Neon's default connection string uses a non-superuser role automatically.
Run the migration SQL manually in Neon's SQL editor (skip the
`CREATE ROLE` block — Neon manages roles separately):

```sql
-- Run everything in 001_initial_schema.sql EXCEPT:
-- DO $$ ... CREATE ROLE app_user ... $$;
-- GRANT CONNECT ON DATABASE ...
-- (Neon handles these via their dashboard)
```

Set `DATABASE_URL` to Neon's provided connection string — it's
already non-superuser.

## Aiven

Aiven gives you a PostgreSQL URI with the host, port, database, user,
and password already bundled together. Use that URI for `DATABASE_URL`
and make sure `sslmode=require` is present.

If Aiven only gives you one connection string, reuse it for
`DATABASE_SUPERUSER_URL` as well so the migration runner can use the
same connection.

---

## How the Middleware Chain Sets the Context

Every authenticated request runs this sequence:

```
verifyJWT              → decode token, get userId + orgId
verifyOrgMembership    → confirm (userId, orgId) exists in org_members
                         re-read role from DB (never trust JWT role)
setOrgContext          → BEGIN transaction
                         SELECT set_config('app.current_org_id', orgId, TRUE)
                         (TRUE = transaction-local, clears on COMMIT/ROLLBACK)
[route handler]        → all queries via req.dbClient
                         RLS policies read app.current_org_id
releaseDbClient        → COMMIT or ROLLBACK, release connection
```

The key design decision is **transaction-local** (`TRUE`) vs session-level.
Connection pools reuse the same underlying connection for multiple requests.
A session-level `SET` would leak Org A's context into Org B's next request
on the same connection. `TRUE` scopes it to the transaction only.

---

## Testing That RLS Actually Works

```bash
cd backend && npm run test:rls
```

The test suite proves four things:

1. A raw query with Org A's context cannot see Org B's rows.
2. The same raw query with Org A's context CAN see Org A's rows.
3. A valid JWT with a tampered org_id is rejected by `verifyOrgMembership` before any data query runs.
4. When `app.current_org_id` is not set (NULL), zero rows are returned — fail-closed, not fail-open.
