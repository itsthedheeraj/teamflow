const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { signup, login, switchOrg, getMyOrgs, createOrg } = require('../services/authService');
const { acceptInvite, getMyPendingInvites, declinePendingInvite } = require('../services/inviteService');
const { verifyJWT } = require('../middleware/verifyJWT');

const router = Router();

// Helper: run express-validator checks and short-circuit on errors
function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// POST /api/auth/signup
// Creates a new user + organization in one transaction.
// The user becomes the 'owner' of the new org.
// ─────────────────────────────────────────────
router.post(
  '/signup',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const { token, user, org } = await signup(req.body);
      res.status(201).json({ token, user, org });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const result = await login(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────
// POST /api/auth/switch-org
// Issues a new JWT with a different active org.
// Requires a valid JWT (any org) — just proves the user is authenticated.
// ─────────────────────────────────────────────
router.post(
  '/switch-org',
  verifyJWT,
  [body('orgId').isUUID().withMessage('Valid orgId is required')],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const result = await switchOrg({
        userId: req.user.userId,
        targetOrgId: req.body.orgId,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────
// GET /api/auth/me/orgs
// Returns all orgs the authenticated user belongs to.
// Used by the org switcher dropdown in the UI.
// ─────────────────────────────────────────────
router.get('/me/orgs', verifyJWT, async (req, res, next) => {
  try {
    const orgs = await getMyOrgs(req.user.userId);
    res.json({ orgs });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/me/orgs
// Creates a new organization for the authenticated user
// ─────────────────────────────────────────────
router.post(
  '/me/orgs',
  verifyJWT,
  [
    body('orgName')
      .trim()
      .isLength({ min: 2, max: 80 })
      .withMessage('Organization name must be 2–80 characters'),
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const result = await createOrg({
        userId: req.user.userId,
        orgName: req.body.orgName,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────
// GET /api/auth/me/invites
// Returns pending invites sent to the authenticated user's email.
// ─────────────────────────────────────────────
router.get('/me/invites', verifyJWT, async (req, res, next) => {
  try {
    const invites = await getMyPendingInvites(req.user.userId);
    res.json({ invites });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────
// DELETE /api/auth/me/invites/:token
// Declines a pending invite.
// ─────────────────────────────────────────────
router.delete('/me/invites/:token', verifyJWT, async (req, res, next) => {
  try {
    await declinePendingInvite(req.user.userId, req.params.token);
    res.json({ message: 'Invite declined' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

// ─────────────────────────────────────────────
// POST /api/auth/accept-invite
// Invitee submits their password to claim the invite.
// If they already have an account, password is optional
// (they're just being added to a new org).
// ─────────────────────────────────────────────
router.post(
  '/accept-invite',
  [
    body('token').notEmpty().withMessage('Invite token is required'),
    body('name').optional().trim(),
    body('password')
      .optional()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const result = await acceptInvite({
        token: req.body.token,
        name: req.body.name,
        password: req.body.password,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);
