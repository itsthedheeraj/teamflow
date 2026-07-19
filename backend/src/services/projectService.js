/**
 * Project service.
 *
 * All queries use req.dbClient (the transaction-scoped connection),
 * NOT pool directly. This is critical:
 *
 * - req.dbClient has app.current_org_id set (via SET LOCAL in
 *   setOrgContext), so RLS policies on the projects table are active.
 * - Using pool.query() here would acquire a fresh connection from the
 *   pool that has NO org context set — RLS would block all rows.
 *
 * Pattern: services receive `client` as a parameter rather than
 * importing pool, which makes it explicit that a transaction-scoped
 * connection is required and prevents accidental pool usage.
 */
const { syncTaskCount } = require('./meteringService');

async function listProjects(client, userId, role) {
  // Owners see all projects in the org (RLS already scopes to org).
  // Admins and members only see projects they are directly connected to:
  // - they are the team lead
  // - they created the project
  // - they have at least one task assigned to them in that project
  const isOwner = role === 'owner';
  const { rows } = await client.query(
    `SELECT p.id, p.org_id, p.name, p.description, p.team_lead_id, p.created_by, p.created_at,
            EXISTS(SELECT 1 FROM tasks t WHERE t.project_id = p.id AND t.assigned_to = $1) as has_assigned_tasks
     FROM projects p
     WHERE $2 = TRUE
        OR p.team_lead_id = $1
        OR p.created_by   = $1
        OR EXISTS(SELECT 1 FROM tasks t WHERE t.project_id = p.id AND t.assigned_to = $1)
     ORDER BY p.created_at DESC`,
    [userId, isOwner]
  );
  return rows;
}

async function getProject(client, projectId) {
  const { rows } = await client.query(
    `SELECT id, org_id, name, description, team_lead_id, created_by, created_at
     FROM projects
     WHERE id = $1`,
    [projectId]
  );
  // RLS means this returns nothing (not an error) if the project
  // belongs to a different org — same as if it doesn't exist.
  return rows[0] || null;
}

async function createProject(client, { orgId, name, description, teamLeadId, createdBy }) {
  const { rows } = await client.query(
    `INSERT INTO projects (org_id, name, description, team_lead_id, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, org_id, name, description, team_lead_id, created_by, created_at`,
    [orgId, name, description || null, teamLeadId, createdBy]
  );
  return rows[0];
}

async function updateProject(client, projectId, { name, description, teamLeadId }) {
  const { rows } = await client.query(
    `UPDATE projects
     SET name         = COALESCE($2, name),
         description  = COALESCE($3, description),
         team_lead_id = COALESCE($4, team_lead_id)
     WHERE id = $1
     RETURNING id, org_id, name, description, team_lead_id, created_at`,
    [
      projectId,
      name || null,
      description !== undefined ? description : null,
      teamLeadId !== undefined ? teamLeadId : null
    ]
  );
  return rows[0] || null;
}

async function deleteProject(client, projectId) {
  // COUNT the project's tasks before deleting, so we can sync the Redis
  // counter afterward. We can't use decrementTasks in a loop because the
  // cascade DELETE removes all child tasks in a single SQL statement —
  // none of them pass through deleteTask(), so their counter decrements
  // would never fire.
  //
  // Instead we:
  //  1. Count how many tasks this project has (using the RLS-scoped client,
  //     so we only see tasks belonging to the current org).
  //  2. DELETE the project (CASCADE removes its tasks in Postgres).
  //  3. Resync the Redis task counter from Postgres — this is the safest
  //     approach because it reflects the true DB state regardless of any
  //     prior counter drift.
  const { rows: [taskCount] } = await client.query(
    `SELECT COUNT(*) AS cnt, org_id FROM tasks WHERE project_id = $1 GROUP BY org_id`,
    [projectId]
  );

  const { rows } = await client.query(
    `DELETE FROM projects WHERE id = $1 RETURNING id, org_id`,
    [projectId]
  );

  if (rows[0] && taskCount && parseInt(taskCount.cnt, 10) > 0) {
    // Pass the RLS-scoped client so the COUNT(*) query runs on a
    // connection that already has app.current_org_id set. Using pool
    // here would get a fresh connection with no context — RLS would
    // return 0 and the Redis counter would be silently zeroed.
    // Fire-and-forget — non-fatal if Redis is unavailable.
    syncTaskCount(rows[0].org_id, client).catch(() => {});
  }

  return rows[0] || null;
}

module.exports = { listProjects, getProject, createProject, updateProject, deleteProject };
