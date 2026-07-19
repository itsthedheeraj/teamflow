const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

/**
 * Step 1 of the auth chain.
 * Verifies the JWT signature and decodes the payload.
 * Attaches req.user = { userId, orgId, role } for downstream middleware.
 *
 * Does NOT verify org membership — that's verifyOrgMembership's job.
 * The role in the token is NOT trusted for authorization — it is
 * re-read from the DB in verifyOrgMembership to prevent stale
 * privilege escalation after a role change.
 *
 * TOKEN REVOCATION CHECK:
 * After an org transfer, affected users are inserted into the
 * token_revocations table with a revoked_at timestamp. If this
 * token's iat (issued-at) is before revoked_at, the token is rejected
 * with 401 — the frontend's api.js intercepts this and forces logout.
 * On next login, the row is removed from token_revocations.
 */
async function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.slice(7);

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Check token revocation table
  try {
    const { rows } = await pool.query(
      `SELECT revoked_at FROM token_revocations WHERE user_id = $1`,
      [payload.sub]
    );

    if (rows.length > 0) {
      // Token's issued-at (iat) is in seconds; revoked_at is a Date
      const tokenIssuedAtMs = payload.iat * 1000;
      const revokedAtMs = new Date(rows[0].revoked_at).getTime();

      if (tokenIssuedAtMs < revokedAtMs) {
        return res.status(401).json({
          error: 'Your session has been invalidated due to a role change. Please log in again.',
        });
      }
    }
  } catch (err) {
    // Non-fatal: if the revocation check fails (e.g. DB down), let the
    // request through rather than blocking all traffic. Log for visibility.
    console.error('Token revocation check failed:', err.message);
  }

  req.user = {
    userId: payload.sub,
    orgId: payload.orgId,
    // role is intentionally not trusted from JWT — re-read in verifyOrgMembership
  };
  next();
}

module.exports = { verifyJWT };
