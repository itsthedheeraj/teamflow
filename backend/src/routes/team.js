const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const { verifyJWT } = require('../middleware/verifyJWT');
const { verifyOrgMembership } = require('../middleware/verifyOrgMembership');
const { setOrgContext } = require('../middleware/setOrgContext');
const { requireRole } = require('../middleware/requireRole');
const { createInvite, acceptInvite, listInvites, revokeInvite } = require('../services/inviteService');
const {
  listMembers,
  updateMemberRole,
  removeMember,
  requestOrgTransfer,
  acceptOrgTransfer,
} = require('../services/teamService');

const router = Router();

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg });
    return false;
  }
  return true;
}

// Auth chain for all team routes
const authChain = [verifyJWT, verifyOrgMembership, setOrgContext];

// ─────────────────────────────────────────────
// GET /api/team/members
// All members can view the team list
// ─────────────────────────────────────────────
router.get('/members', authChain, async (req, res, next) => {
  try {
    const members = await listMembers(req.user.orgId);
    res.json({ members });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────
// POST /api/team/invite
// Admin or Owner can invite teammates
// ─────────────────────────────────────────────
router.post(
  '/invite',
  authChain,
  requireRole('admin'),
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('role')
      .optional()
      .isIn(['admin', 'member'])
      .withMessage('Role must be admin or member'),
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const { inviteUrl, inviterName, orgName, email } = await createInvite({
        orgId: req.user.orgId,
        invitedBy: req.user.userId,
        email: req.body.email,
        role: req.body.role || 'member',
      });
      // Return the invite data so the frontend can send the email via EmailJS.
      // The invite link is only revealed here — the frontend is responsible
      // for calling EmailJS and should not display the raw link on success.
      res.status(201).json({
        message: `Invite created for ${req.body.email}`,
        inviteUrl,
        inviterName,
        orgName,
        email,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────
// GET /api/team/invites
// Admin or Owner can see pending invites
// ─────────────────────────────────────────────
router.get('/invites', authChain, requireRole('admin'), async (req, res, next) => {
  try {
    const invites = await listInvites(req.user.orgId);
    res.json({ invites });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────
// DELETE /api/team/invites/:id
// Admin or Owner can revoke a pending invite
// ─────────────────────────────────────────────
router.delete(
  '/invites/:id',
  authChain,
  requireRole('admin'),
  [param('id').isUUID().withMessage('Invalid invite ID')],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      await revokeInvite({ orgId: req.user.orgId, inviteId: req.params.id });
      res.json({ message: 'Invite revoked' });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────
// PATCH /api/team/members/:userId/role
// Owner only can change roles
// ─────────────────────────────────────────────
router.patch(
  '/members/:userId/role',
  authChain,
  requireRole('owner'),
  [
    param('userId').isUUID().withMessage('Invalid user ID'),
    body('role')
      .isIn(['owner', 'admin', 'member'])
      .withMessage('Role must be owner, admin, or member'),
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const updated = await updateMemberRole({
        orgId: req.user.orgId,
        targetUserId: req.params.userId,
        newRole: req.body.role,
        requestingUserId: req.user.userId,
      });
      res.json({ member: updated });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────
// DELETE /api/team/members/:userId
// Owner can remove members; Admin can remove members (not owners)
// ─────────────────────────────────────────────
router.delete(
  '/members/:userId',
  authChain,
  requireRole('admin'),
  [param('userId').isUUID().withMessage('Invalid user ID')],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      await removeMember({
        orgId: req.user.orgId,
        targetUserId: req.params.userId,
        requestingUserId: req.user.userId,
      });
      res.json({ message: 'Member removed' });
    } catch (err) {
      next(err);
    }
  }
);
// ─────────────────────────────────────────────
// POST /api/team/transfer/request
// Owner requests to transfer ownership
// ─────────────────────────────────────────────
router.post(
  '/transfer/request',
  authChain,
  requireRole('owner'),
  [body('email').isEmail().withMessage('Invalid target email address')],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const { transferUrl, orgName, toEmail, ownerName } = await requestOrgTransfer({
        orgId: req.user.orgId,
        fromUserId: req.user.userId,
        email: req.body.email,
      });
      // Return transfer data so the frontend can send the email via EmailJS.
      res.json({
        message: 'Transfer request created',
        transferUrl,
        orgName,
        toEmail,
        ownerName,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────
// POST /api/team/transfer/accept
// User accepts transfer request via token
// ─────────────────────────────────────────────
router.post(
  '/transfer/accept',
  verifyJWT,
  [body('token').isString().notEmpty().withMessage('Token is required')],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const result = await acceptOrgTransfer({
        token: req.body.token,
        userId: req.user.userId,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
