const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const { verifyJWT } = require('../middleware/verifyJWT');
const { verifyOrgMembership } = require('../middleware/verifyOrgMembership');
const { setOrgContext } = require('../middleware/setOrgContext');
const { requireRole } = require('../middleware/requireRole');
const {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
} = require('../services/projectService');
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

// All project routes require:
//  1. Valid JWT         (verifyJWT)
//  2. Membership check  (verifyOrgMembership) — closes the gap since org_members isn't RLS-protected
//  3. Org context set   (setOrgContext)        — BEGIN txn + SET LOCAL app.current_org_id
// Then RLS enforces tenant isolation on every query that follows.
const authChain = [verifyJWT, verifyOrgMembership, setOrgContext];

// ─────────────────────────────────────────────
// GET /api/projects
// ─────────────────────────────────────────────
router.get('/', authChain, async (req, res, next) => {
  try {
    const projects = await listProjects(req.dbClient, req.user.userId, req.user.role);
    res.json({ projects });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────
// GET /api/projects/:id
// ─────────────────────────────────────────────
router.get(
  '/:id',
  authChain,
  [param('id').isUUID().withMessage('Invalid project ID')],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const project = await getProject(req.dbClient, req.params.id);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      res.json({ project });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────
// POST /api/projects
// ─────────────────────────────────────────────
router.post(
  '/',
  authChain,
  requireRole('admin'), // Workspace Admin only
  [body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Project name is required')],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const project = await createProject(req.dbClient, {
        orgId: req.user.orgId,
        name: req.body.name,
        description: req.body.description,
        teamLeadId: req.body.team_lead_id || null,
        createdBy: req.user.userId,
      });
      res.status(201).json({ project });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────
// PATCH /api/projects/:id
// ─────────────────────────────────────────────
router.patch(
  '/:id',
  authChain,
  [param('id').isUUID().withMessage('Invalid project ID')],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      // Must fetch project first to verify if user is Team Lead
      const existingProject = await getProject(req.dbClient, req.params.id);
      if (!existingProject) return res.status(404).json({ error: 'Project not found' });
      
      const isAdmin = req.user.role === 'admin' || req.user.role === 'owner';
      const isTeamLead = existingProject.team_lead_id === req.user.userId;
      
      if (!isAdmin && !isTeamLead) {
        return res.status(403).json({ error: 'You do not have permission to edit this project' });
      }

      const project = await updateProject(req.dbClient, req.params.id, {
        name: req.body.name,
        description: req.body.description,
        teamLeadId: req.body.team_lead_id,
      });

      if (req.body.team_lead_id && req.body.team_lead_id !== existingProject.team_lead_id) {
        await createNotification(req.dbClient, {
          userId: req.body.team_lead_id,
          orgId: req.user.orgId,
          message: `You have been made the team lead of project: ${project.name}`,
          link: `/projects/${project.id}`
        });
      }

      res.json({ project });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────
// DELETE /api/projects/:id
// Requires admin or owner role
// ─────────────────────────────────────────────
router.delete(
  '/:id',
  authChain,
  requireRole('admin'),
  [param('id').isUUID().withMessage('Invalid project ID')],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const deleted = await deleteProject(req.dbClient, req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Project not found' });
      res.json({ message: 'Project deleted' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
