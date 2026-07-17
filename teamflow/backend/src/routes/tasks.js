const { Router } = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { verifyJWT } = require('../middleware/verifyJWT');
const { verifyOrgMembership } = require('../middleware/verifyOrgMembership');
const { setOrgContext } = require('../middleware/setOrgContext');
const { requireRole } = require('../middleware/requireRole');
const {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
} = require('../services/taskService');

const router = Router();

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg });
    return false;
  }
  return true;
}

const authChain = [verifyJWT, verifyOrgMembership, setOrgContext];

// ─────────────────────────────────────────────
// GET /api/tasks?projectId=<uuid>
// ─────────────────────────────────────────────
router.get(
  '/',
  authChain,
  [query('projectId').optional().isUUID().withMessage('Invalid projectId')],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const tasks = await listTasks(req.dbClient, {
        projectId: req.query.projectId || null,
      });
      res.json({ tasks });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────
// GET /api/tasks/:id
// ─────────────────────────────────────────────
router.get(
  '/:id',
  authChain,
  [param('id').isUUID().withMessage('Invalid task ID')],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const task = await getTask(req.dbClient, req.params.id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      res.json({ task });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────
// POST /api/tasks
// ─────────────────────────────────────────────
router.post(
  '/',
  authChain,
  [
    body('projectId').isUUID().withMessage('Valid projectId is required'),
    body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required'),
    body('assignedTo').optional().isUUID().withMessage('Invalid assignedTo user ID'),
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const task = await createTask(req.dbClient, {
        orgId: req.user.orgId,
        projectId: req.body.projectId,
        title: req.body.title,
        description: req.body.description,
        assignedTo: req.body.assignedTo,
        createdBy: req.user.userId,
      });
      res.status(201).json({ task });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────
// PATCH /api/tasks/:id
// ─────────────────────────────────────────────
router.patch(
  '/:id',
  authChain,
  [
    param('id').isUUID().withMessage('Invalid task ID'),
    body('status')
      .optional()
      .isIn(['todo', 'in_progress', 'done'])
      .withMessage('Status must be todo, in_progress, or done'),
    body('assignedTo').optional().isUUID().withMessage('Invalid assignedTo user ID'),
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const task = await updateTask(req.dbClient, req.params.id, req.body);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      res.json({ task });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────
// DELETE /api/tasks/:id — admin or owner only
// ─────────────────────────────────────────────
router.delete(
  '/:id',
  authChain,
  requireRole('admin'),
  [param('id').isUUID().withMessage('Invalid task ID')],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const deleted = await deleteTask(req.dbClient, req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Task not found' });
      res.json({ message: 'Task deleted' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
