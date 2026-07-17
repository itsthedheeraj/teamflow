-- =============================================================
-- Migration 001 — Initial Schema
-- Run as superuser (DATABASE_SUPERUSER_URL) so we can create
-- the app_user role and grant privileges.
-- =============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- Application role (NON-SUPERUSER)
--
-- WHY: Postgres Row-Level Security is bypassed for superusers.
-- The application server must connect as a non-superuser or
-- RLS policies are silently ignored.
--
-- LOCAL POSTGRES: this script creates the role automatically.
-- SUPABASE/NEON: do NOT run this block — those providers
--   already have a non-superuser role. Use their provided
--   connection string (NOT the postgres/superuser one) in
--   DATABASE_URL. See README for provider-specific notes.
-- =============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'changeme_in_production';
  END IF;
END
$$;

-- =============================================================
-- Tables
-- =============================================================

CREATE TABLE IF NOT EXISTS organizations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  subscription_tier TEXT NOT NULL DEFAULT 'free'
                      CHECK (subscription_tier IN ('free', 'pro')),
  stripe_customer_id TEXT UNIQUE,
  stripe_sub_id      TEXT UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member'
               CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

CREATE TABLE IF NOT EXISTS invite_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_by  UUID NOT NULL REFERENCES users(id),
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member'
                CHECK (role IN ('admin', 'member')),
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'todo'
                CHECK (status IN ('todo', 'in_progress', 'done')),
  assigned_to UUID REFERENCES users(id),
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- Stripe event idempotency table
--
-- WHY Postgres (not Redis): Stripe webhooks must be processed
-- exactly once. Redis is ephemeral — a restart clears it,
-- which would allow duplicate billing events to reprocess.
-- Postgres gives us a durable, auditable record of every
-- processed event. The UNIQUE constraint on stripe_event_id
-- is the actual idempotency guard.
-- =============================================================
CREATE TABLE IF NOT EXISTS stripe_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  org_id          UUID REFERENCES organizations(id),
  event_type      TEXT NOT NULL,
  payload         JSONB,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- Row-Level Security
--
-- WHY SET LOCAL (transaction-local): connection pools reuse
-- connections across requests. A session-level SET would leak
-- org A's context into org B's next request on the same
-- connection. Transaction-local scope clears automatically
-- when the transaction ends.
--
-- WHY current_setting(..., TRUE): the second arg makes it
-- return NULL instead of raising an error when the variable
-- isn't set (e.g., during migrations run as superuser).
-- NULL::UUID never matches any org_id — fail-closed, not
-- fail-open.
--
-- WHY only projects/tasks (not org_members): protecting
-- org_members with RLS creates a bootstrap paradox — you need
-- to read org_members to know what org to set before RLS is
-- active. The verifyOrgMembership middleware closes this gap
-- at the application layer instead.
-- =============================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON projects;
CREATE POLICY tenant_isolation ON projects
  USING (org_id = current_setting('app.current_org_id', TRUE)::UUID);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tasks;
CREATE POLICY tenant_isolation ON tasks
  USING (org_id = current_setting('app.current_org_id', TRUE)::UUID);

-- =============================================================
-- Grants for app_user
-- =============================================================
GRANT CONNECT ON DATABASE teamflow TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- =============================================================
-- Indexes
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON projects(org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org_id ON tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_token ON invite_tokens(token);
CREATE INDEX IF NOT EXISTS idx_stripe_events_stripe_event_id ON stripe_events(stripe_event_id);
