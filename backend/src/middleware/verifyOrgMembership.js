const pool = require('../db/pool');

/**
 * Step 2 of the auth chain — runs AFTER verifyJWT, BEFORE setOrgContext.
 *
 * WHY THIS EXISTS:
 * org_members is not RLS-protected at the database layer (doing so
 * creates a bootstrap paradox — you need to read org_members to know
 * what org_id to set before RLS activates). That means a user with a
 * tampered JWT claiming a foreign org_id would pass JWT signature
 * verification (the signature is valid, the claim is just wrong) and
 * RLS would then open up that org's data.
 *
 * This middleware closes the gap with a direct DB check:
 * "does a real row exist in org_members for (user_id, org_id)?"
 * If not → 403 before any RLS-protected query ever runs.
 *
 * This query runs WITHOUT any RLS context (app.current_org_id is not
 * set yet). That is intentional — this is the pre-condition check
 * that makes it safe to set that variable.
 *
 * ROLE FRESHNESS:
 * We also re-read the role from the DB here (not from the JWT). If an
 * owner demoted a user after their token was issued, the old token
 * still has the old role — trusting it would be a privilege escalation
 * window. Reading from DB is one extra query but closes a real hole.
 */
async function verifyOrgMembership(req, res, next) {
  const { userId, orgId } = req.user;

  if (!orgId) {
    return res.status(400).json({ error: 'No active org in token. Please switch org.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT role
       FROM org_members
       WHERE user_id = $1
         AND org_id  = $2
       LIMIT 1`,
      [userId, orgId]
    );

    if (rows.length === 0) {
      return res.status(403).json({
        error: 'You are not a member of this organization',
      });
    }

    // Overwrite any role claim from the JWT with the DB-verified value
    req.user.role = rows[0].role;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { verifyOrgMembership };
