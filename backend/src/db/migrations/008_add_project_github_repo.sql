-- =============================================================
-- Migration 008 — Add Github Repo to Projects
-- =============================================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_repo TEXT;
