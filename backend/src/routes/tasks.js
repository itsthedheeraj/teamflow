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
const { getProject } = require('../services/projectService');
const { sendTaskAssignedEmail } = require('../lib/email');
const { createNotification } = require('../services/notificationService');

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
      const project = await getProject(req.dbClient, req.body.projectId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const isAdmin = req.user.role === 'admin' || req.user.role === 'owner';
      const isTeamLead = project.team_lead_id === req.user.userId;

      if (!isAdmin && !isTeamLead) {
        return res.status(403).json({ error: 'Only Workspace Admins or Team Leads can create tasks' });
      }

      const task = await createTask(req.dbClient, {
        orgId: req.user.orgId,
        projectId: req.body.projectId,
        title: req.body.title,
        description: req.body.description,
        assignedTo: req.body.assignedTo,
        createdBy: req.user.userId,
      });

      if (req.body.assignedTo && req.body.assignedTo !== req.user.userId) {
        const hydratedTask = await getTask(req.dbClient, task.id);
        if (hydratedTask && hydratedTask.assigned_to_email) {
          const { rows: orgRows } = await req.dbClient.query(
            'SELECT name FROM organizations WHERE id = $1',
            [req.user.orgId]
          );
          const orgName = orgRows[0]?.name || 'TeamFlow Workspace';
          const taskUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/projects/${project.id}`;
          
          sendTaskAssignedEmail({
            toEmail: hydratedTask.assigned_to_email,
            taskTitle: hydratedTask.title,
            projectName: project.name,
            orgName,
            taskUrl,
            assignerEmail: hydratedTask.created_by_email || 'A team member',
          }).catch(console.error);

          await createNotification(req.dbClient, {
            userId: hydratedTask.assigned_to,
            orgId: req.user.orgId,
            message: `${hydratedTask.created_by_email || 'A team member'} assigned you a task in ${project.name}: ${hydratedTask.title}`,
            link: `/projects/${project.id}`
          }).catch(console.error);
        }
      }

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
      const existingTask = await getTask(req.dbClient, req.params.id);
      if (!existingTask) return res.status(404).json({ error: 'Task not found' });

      const project = await getProject(req.dbClient, existingTask.project_id);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const isAdmin = req.user.role === 'admin' || req.user.role === 'owner';
      const isTeamLead = project.team_lead_id === req.user.userId;
      const isAssigned = existingTask.assigned_to === req.user.userId;

      if (!isAdmin && !isTeamLead) {
        // Members can only edit status of tasks assigned to them
        if (!isAssigned) {
          return res.status(403).json({ error: 'You do not have permission to edit this task' });
        }
        
        // Members cannot change title, description, or assignedTo
        if (req.body.title !== undefined || req.body.description !== undefined || req.body.assignedTo !== undefined) {
          return res.status(403).json({ error: 'Members can only update the status of their assigned tasks' });
        }
      }

      const task = await updateTask(req.dbClient, req.params.id, req.body);
      if (!task) return res.status(404).json({ error: 'Task not found' });

      if (
        req.body.assignedTo !== undefined && 
        req.body.assignedTo !== null &&
        req.body.assignedTo !== existingTask.assigned_to &&
        req.body.assignedTo !== req.user.userId
      ) {
        const hydratedTask = await getTask(req.dbClient, task.id);
        if (hydratedTask && hydratedTask.assigned_to_email) {
          const { rows: orgRows } = await req.dbClient.query(
            'SELECT name FROM organizations WHERE id = $1',
            [req.user.orgId]
          );
          const orgName = orgRows[0]?.name || 'TeamFlow Workspace';
          const { rows: userRows } = await req.dbClient.query(
            'SELECT email FROM users WHERE id = $1',
            [req.user.userId]
          );
          const assignerEmail = userRows[0]?.email || 'A team member';
          const taskUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/projects/${project.id}`;
          
          sendTaskAssignedEmail({
            toEmail: hydratedTask.assigned_to_email,
            taskTitle: hydratedTask.title,
            projectName: project.name,
            orgName,
            taskUrl,
            assignerEmail,
          }).catch(console.error);

          await createNotification(req.dbClient, {
            userId: hydratedTask.assigned_to,
            orgId: req.user.orgId,
            message: `${assignerEmail} assigned you a task in ${project.name}: ${hydratedTask.title}`,
            link: `/projects/${project.id}`
          }).catch(console.error);
        }
      }

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
  [param('id').isUUID().withMessage('Invalid task ID')],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const existingTask = await getTask(req.dbClient, req.params.id);
      if (!existingTask) return res.status(404).json({ error: 'Task not found' });

      const project = await getProject(req.dbClient, existingTask.project_id);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const isAdmin = req.user.role === 'admin' || req.user.role === 'owner';
      const isTeamLead = project.team_lead_id === req.user.userId;

      if (!isAdmin && !isTeamLead) {
        return res.status(403).json({ error: 'Only Workspace Admins or Team Leads can delete tasks' });
      }

      const deleted = await deleteTask(req.dbClient, req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Task not found' });
      res.json({ message: 'Task deleted' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
