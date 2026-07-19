const { Router } = require('express');
const { param, validationResult } = require('express-validator');
const { verifyJWT } = require('../middleware/verifyJWT');
const { verifyOrgMembership } = require('../middleware/verifyOrgMembership');
const { setOrgContext } = require('../middleware/setOrgContext');
const { listUnreadNotifications, markNotificationAsRead, deleteNotification } = require('../services/notificationService');

const router = Router();
const authChain = [verifyJWT];

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg });
    return false;
  }
  return true;
}

// GET /api/notifications
router.get('/', authChain, async (req, res, next) => {
  try {
    const notifications = await listUnreadNotifications(req.dbClient, req.user.userId);
    res.json({ notifications });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read
router.patch(
  '/:id/read',
  authChain,
  [param('id').isUUID().withMessage('Invalid notification ID')],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const notification = await markNotificationAsRead(
        req.dbClient,
        req.params.id,
        req.user.userId
      );
      if (!notification) return res.status(404).json({ error: 'Notification not found' });
      res.json({ notification });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/notifications/:id
router.delete('/:id', authChain, async (req, res, next) => {
  try {
    await deleteNotification(req.dbClient, req.params.id, req.user.userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
