/**
 * Task Service
 *
 * All queries use `client` (req.dbClient) — the transaction-scoped
 * connection with app.current_org_id already set. RLS on the tasks
 * table enforces tenant isolation automatically on every query here.
 *
 * Never use pool.query() in this service — it would acquire a fresh
 * connection with no org context and RLS would return 0 rows.
 */
const {
  checkTaskLimit,
  incrementTasks,
  decrementTasks,
} = require('./meteringService');

async function listTasks(client, { projectId } = {}) {
  const { rows } = await client.query(
    `SELECT t.id, t.org_id, t.project_id, t.title, t.description,
            t.status, t.created_at, t.updated_at,
            t.assigned_to,
            u_assigned.email AS assigned_to_email,
            u_assigned.name  AS assigned_to_name,
            u_created.email  AS created_by_email,
            u_created.name   AS created_by_name,
            t.created_by
     FROM tasks t
     LEFT JOIN users u_assigned ON u_assigned.id = t.assigned_to
     LEFT JOIN users u_created  ON u_created.id  = t.created_by
     WHERE ($1::uuid IS NULL OR t.project_id = $1)
     ORDER BY t.created_at DESC`,
    [projectId || null]
  );
  return rows;
}

async function getTask(client, taskId) {
  const { rows } = await client.query(
    `SELECT t.id, t.org_id, t.project_id, t.title, t.description,
            t.status, t.created_at, t.updated_at,
            t.assigned_to,
            u_assigned.email AS assigned_to_email,
            u_assigned.name  AS assigned_to_name,
            u_created.email  AS created_by_email,
            u_created.name   AS created_by_name,
            t.created_by
     FROM tasks t
     LEFT JOIN users u_assigned ON u_assigned.id = t.assigned_to
     LEFT JOIN users u_created  ON u_created.id  = t.created_by
     WHERE t.id = $1`,
    [taskId]
  );
  return rows[0] || null;
}

async function createTask(client, { orgId, projectId, title, description, assignedTo, createdBy }) {
  // Check task limit before inserting
  await checkTaskLimit(orgId);

  const { rows } = await client.query(
    `INSERT INTO tasks (org_id, project_id, title, description, assigned_to, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, org_id, project_id, title, description, status,
               assigned_to, created_by, created_at, updated_at`,
    [orgId, projectId, title, description || null, assignedTo || null, createdBy]
  );

  // Increment the counter AFTER the DB write succeeds
  await incrementTasks(orgId);

  return rows[0];
}

async function updateTask(client, taskId, { title, description, status, assignedTo }) {
  const { rows } = await client.query(
    `UPDATE tasks
     SET title       = COALESCE($2, title),
         description = COALESCE($3, description),
         status      = COALESCE($4, status),
         assigned_to = CASE WHEN $5::boolean THEN $6::uuid ELSE assigned_to END,
         updated_at  = NOW()
     WHERE id = $1
     RETURNING id, org_id, project_id, title, description, status,
               assigned_to, created_by, created_at, updated_at`,
    [
      taskId,
      title || null,
      description !== undefined ? description : null,
      status || null,
      // $5: whether to update assigned_to (allows setting it to NULL explicitly)
      assignedTo !== undefined,
      assignedTo || null,
    ]
  );
  return rows[0] || null;
}

async function deleteTask(client, taskId) {
  const { rows } = await client.query(
    `DELETE FROM tasks WHERE id = $1 RETURNING id, org_id`,
    [taskId]
  );
  if (rows[0]) {
    await decrementTasks(rows[0].org_id);
  }
  return rows[0] || null;
}

/**
 * countTasksForOrg()
 * Used by usage metering (Feature 6) to check against the Free tier limit.
 * Uses pool directly (no RLS context needed — this is a system-level count).
 */
async function countTasksForOrg(pool, orgId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM tasks WHERE org_id = $1`,
    [orgId]
  );
  return parseInt(rows[0].cnt, 10);
}

module.exports = { listTasks, getTask, createTask, updateTask, deleteTask, countTasksForOrg };
