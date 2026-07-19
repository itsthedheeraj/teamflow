-- =============================================================
-- Migration 002 — Add Team Lead to Projects
-- =============================================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS team_lead_id UUID REFERENCES users(id);

-- Add an index for faster lookups when checking project access
CREATE INDEX IF NOT EXISTS idx_projects_team_lead_id ON projects(team_lead_id);
