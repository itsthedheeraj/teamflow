-- Migration 007: Token revocations table
--
-- Tracks users who must re-authenticate on their next request.
-- When an org transfer completes, the old owner and all demoted admins
-- are inserted here. verifyJWT checks this table on every request:
-- if the token's iat (issued-at) is BEFORE revoked_at, the token is
-- rejected with 401 and the frontend logs the user out automatically.
-- On successful login, the row is deleted — clean slate.

CREATE TABLE IF NOT EXISTS token_revocations (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_revocations_user_id ON token_revocations(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON token_revocations TO app_user;
