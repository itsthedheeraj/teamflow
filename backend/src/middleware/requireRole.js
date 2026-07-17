/**
 * Role-based access control middleware.
 *
 * Usage: router.post('/invite', verifyJWT, verifyOrgMembership,
 *          setOrgContext, requireRole('admin'), handler)
 *
 * Role hierarchy (higher index = more privileged):
 *   member (0) < admin (1) < owner (2)
 *
 * requireRole('admin') allows admins AND owners.
 * requireRole('owner') allows only owners.
 *
 * The role on req.user was re-read from the DB in
 * verifyOrgMembership — it is always current, never stale.
 */
const ROLE_RANK = { member: 0, admin: 1, owner: 2 };

function requireRole(minRole) {
  return (req, res, next) => {
    const userRank = ROLE_RANK[req.user?.role] ?? -1;
    const requiredRank = ROLE_RANK[minRole] ?? 99;

    if (userRank < requiredRank) {
      return res.status(403).json({
        error: `This action requires the '${minRole}' role or higher`,
      });
    }

    next();
  };
}

module.exports = { requireRole, ROLE_RANK };
