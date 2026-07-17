const { Router } = require('express');
const { verifyJWT } = require('../middleware/verifyJWT');
const { verifyOrgMembership } = require('../middleware/verifyOrgMembership');
const { setOrgContext } = require('../middleware/setOrgContext');
const { getUsageSummary } = require('../services/meteringService');

const router = Router();

const authChain = [verifyJWT, verifyOrgMembership, setOrgContext];

/**
 * GET /api/usage
 *
 * Returns the org's current usage counts and tier limits.
 * Any authenticated member can view this — it drives the usage
 * bar shown in the UI and the "upgrade" nudge messages.
 *
 * Response shape:
 * {
 *   usage: {
 *     tier: 'free' | 'pro',
 *     members: { current: 2, limit: 3, unlimited: false },
 *     tasks:   { current: 18, limit: 20, unlimited: false }
 *   }
 * }
 */
router.get('/', authChain, async (req, res, next) => {
  try {
    const usage = await getUsageSummary(req.user.orgId);
    res.json({ usage });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
