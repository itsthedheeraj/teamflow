const pool = require('../db/pool');
const { decrementMembers } = require('./meteringService');

/**
 * Team Service — org member management.
 * All operations work directly via pool (no RLS context needed —
 * org_members is not RLS-protected; access is controlled at the
 * application layer by requireRole middleware on the routes).
 */

/**
 * listMembers()
 * Returns all members of an org with their roles and join date.
 */
async function listMembers(orgId) {
  const { rows } = await pool.query(
    `SELECT om.id, om.role, om.created_at,
            u.id AS user_id, u.email
     FROM org_members om
     JOIN users u ON u.id = om.user_id
     WHERE om.org_id = $1
     ORDER BY om.created_at ASC`,
    [orgId]
  );
  return rows;
}

/**
 * updateMemberRole()
 * Allows owner to change a member's role.
 *
 * Constraints:
 * - Cannot change your own role (owner must transfer ownership explicitly)
 * - Cannot demote/remove the last owner
 */
async function updateMemberRole({ orgId, targetUserId, newRole, requestingUserId }) {
  if (targetUserId === requestingUserId) {
    const e = new Error('You cannot change your own role');
    e.status = 400;
    throw e;
  }

  // Guard: don't leave the org without an owner
  if (newRole !== 'owner') {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS owner_count
       FROM org_members
       WHERE org_id = $1 AND role = 'owner'`,
      [orgId]
    );
    const ownerCount = parseInt(rows[0].owner_count, 10);
    const { rows: target } = await pool.query(
      `SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2`,
      [orgId, targetUserId]
    );
    if (target[0]?.role === 'owner' && ownerCount === 1) {
      const e = new Error('Cannot demote the last owner. Transfer ownership first.');
      e.status = 400;
      throw e;
    }
  }

  const { rows } = await pool.query(
    `UPDATE org_members
     SET role = $3
     WHERE org_id = $1 AND user_id = $2
     RETURNING id, role, user_id, org_id`,
    [orgId, targetUserId, newRole]
  );

  if (rows.length === 0) {
    const e = new Error('Member not found in this organization');
    e.status = 404;
    throw e;
  }

  return rows[0];
}

/**
 * removeMember()
 * Removes a member from the org.
 * Owner role required; cannot remove yourself.
 * Cannot remove the last owner.
 */
async function removeMember({ orgId, targetUserId, requestingUserId }) {
  if (targetUserId === requestingUserId) {
    const e = new Error('You cannot remove yourself from the organization');
    e.status = 400;
    throw e;
  }

  const { rows: target } = await pool.query(
    `SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2`,
    [orgId, targetUserId]
  );

  if (target.length === 0) {
    const e = new Error('Member not found');
    e.status = 404;
    throw e;
  }

  if (target[0].role === 'owner') {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM org_members WHERE org_id = $1 AND role = 'owner'`,
      [orgId]
    );
    if (parseInt(rows[0].cnt, 10) <= 1) {
      const e = new Error('Cannot remove the last owner');
      e.status = 400;
      throw e;
    }
  }

  await pool.query(
    `DELETE FROM org_members WHERE org_id = $1 AND user_id = $2`,
    [orgId, targetUserId]
  );

  // Decrement the Redis member counter after the DB delete
  await decrementMembers(orgId);
}

module.exports = { listMembers, updateMemberRole, removeMember };
