const { Router } = require('express');
const { verifyJWT } = require('../middleware/verifyJWT');
const { verifyOrgMembership } = require('../middleware/verifyOrgMembership');
const { setOrgContext } = require('../middleware/setOrgContext');
const { requireRole } = require('../middleware/requireRole');
const {
  createCheckoutSession,
  createPortalSession,
  getBillingStatus,
} = require('../services/billingService');

const router = Router();

// Auth chain for all billing routes that need org context
const authChain = [verifyJWT, verifyOrgMembership, setOrgContext];

// ─────────────────────────────────────────────
// GET /api/billing/status
// Returns the org's current subscription tier.
// Any authenticated member can view billing status.
// ─────────────────────────────────────────────
router.get('/status', authChain, async (req, res, next) => {
  try {
    const status = await getBillingStatus(req.user.orgId);
    res.json({ billing: status });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────
// POST /api/billing/checkout
// Creates a Stripe Checkout session for the org.
// Owner only — billing is an org-level, owner-only action.
// ─────────────────────────────────────────────
router.post('/checkout', authChain, requireRole('owner'), async (req, res, next) => {
  try {
    const { url, sessionId } = await createCheckoutSession({
      orgId: req.user.orgId,
      userId: req.user.userId,
    });
    res.json({ url, sessionId });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────
// POST /api/billing/portal
// Opens the Stripe Customer Portal for subscription management
// (cancel, update payment method, view invoices).
// Owner only.
// ─────────────────────────────────────────────
router.post('/portal', authChain, requireRole('owner'), async (req, res, next) => {
  try {
    const { url } = await createPortalSession(req.user.orgId);
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
