const jwt = require('jsonwebtoken');

/**
 * Step 1 of the auth chain.
 * Verifies the JWT signature and decodes the payload.
 * Attaches req.user = { userId, orgId, role } for downstream middleware.
 *
 * Does NOT verify org membership — that's verifyOrgMembership's job.
 * The role in the token is NOT trusted for authorization — it is
 * re-read from the DB in verifyOrgMembership to prevent stale
 * privilege escalation after a role change.
 */
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      userId: payload.sub,
      orgId: payload.orgId,
      // role is intentionally not trusted from JWT — re-read in verifyOrgMembership
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { verifyJWT };
