const pool = require('../db/pool');
const crypto = require('crypto');
const { sendInviteEmail } = require('../lib/email');
const { decrementMembers, incrementMembers } = require('./meteringService');

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
            u.id AS user_id, u.email, u.name
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

async function requestOrgTransfer({ orgId, fromUserId, email }) {
  // Verify fromUser is owner
  const { rows: fromUserRows } = await pool.query(
    `SELECT om.role, u.name as inviter_name 
     FROM org_members om 
     JOIN users u ON u.id = om.user_id 
     WHERE om.org_id = $1 AND om.user_id = $2`,
    [orgId, fromUserId]
  );
  if (fromUserRows.length === 0 || fromUserRows[0].role !== 'owner') {
    const e = new Error('Only the owner can transfer the organization');
    e.status = 403;
    throw e;
  }
  const inviterName = fromUserRows[0].inviter_name;

  const token = crypto.randomBytes(32).toString('hex');

  // Clear any existing pending requests for this org
  await pool.query(
    `UPDATE org_transfer_requests SET status = 'declined' WHERE org_id = $1 AND status = 'pending'`,
    [orgId]
  );

  await pool.query(
    `INSERT INTO org_transfer_requests (org_id, from_user_id, to_email, token)
     VALUES ($1, $2, $3, $4)`,
    [orgId, fromUserId, email, token]
  );

  const orgRes = await pool.query(`SELECT name FROM organizations WHERE id = $1`, [orgId]);
  const orgName = orgRes.rows[0].name;

  // Check if target user exists in our system
  const { rows: targetUserRows } = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
  const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/transfer-org/${token}`;

  if (targetUserRows.length > 0) {
    const toUserId = targetUserRows[0].id;
    // Send a notification to the target user
    await pool.query(
      `INSERT INTO notifications (user_id, org_id, message, link)
       VALUES ($1, $2, $3, $4)`,
      [toUserId, orgId, `You have been requested to take ownership of ${orgName}`, `/transfer-org/${token}`]
    );
  }

  // Send email to the user (whether they exist or not)
  await sendInviteEmail({
    toEmail: email,
    inviterName: inviterName || 'Workspace Owner',
    orgName,
    inviteUrl,
    role: 'owner'
  });

  return { success: true };
}

async function acceptOrgTransfer({ token, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: requestRows } = await client.query(
      `SELECT id, org_id, from_user_id, to_email, status FROM org_transfer_requests WHERE token = $1`,
      [token]
    );

    if (requestRows.length === 0) {
      const e = new Error('Invalid or expired transfer request');
      e.status = 400;
      throw e;
    }

    const req = requestRows[0];

    if (req.status !== 'pending') {
      const e = new Error('This transfer request has already been processed');
      e.status = 400;
      throw e;
    }

    // Verify the logged-in user matches the target email
    const { rows: userRows } = await client.query(`SELECT email FROM users WHERE id = $1`, [userId]);
    if (userRows.length === 0 || userRows[0].email !== req.to_email) {
      const e = new Error('You are not authorized to accept this transfer request');
      e.status = 403;
      throw e;
    }

    // Demote old owner to member
    await client.query(
      `UPDATE org_members SET role = 'member' WHERE org_id = $1 AND user_id = $2`,
      [req.org_id, req.from_user_id]
    );

    // Promote new owner (insert if they aren't in the org yet)
    const insertResult = await client.query(
      `INSERT INTO org_members (org_id, user_id, role)
       VALUES ($1, $2, 'owner')
       ON CONFLICT (org_id, user_id)
       DO UPDATE SET role = 'owner'
       RETURNING xmax`, // PostgreSQL system column, 0 for insert, non-zero for update
      [req.org_id, userId]
    );
    
    const wasInserted = insertResult.rows.length > 0 && insertResult.rows[0].xmax == 0;

    // Mark request as accepted
    await client.query(
      `UPDATE org_transfer_requests SET status = 'accepted' WHERE id = $1`,
      [req.id]
    );

    // Send a notification to the old owner
    const orgRes = await client.query(`SELECT name FROM organizations WHERE id = $1`, [req.org_id]);
    const orgName = orgRes.rows[0].name;

    await client.query(
      `INSERT INTO notifications (user_id, org_id, message)
       VALUES ($1, $2, $3)`,
      [req.from_user_id, req.org_id, `Ownership of ${orgName} has been successfully transferred to ${req.to_email}.`]
    );

    // Revoke token for the old owner only to force re-login
    await client.query(
      `INSERT INTO token_revocations (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET revoked_at = NOW()`,
      [req.from_user_id]
    );

    await client.query('COMMIT');
    
    // Redis operations must run after DB commit to prevent race conditions
    // where the counter increments but the DB transaction rolls back.
    if (wasInserted) {
      await incrementMembers(req.org_id);
    }
    
    return { success: true, orgId: req.org_id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { listMembers, updateMemberRole, removeMember, requestOrgTransfer, acceptOrgTransfer };
