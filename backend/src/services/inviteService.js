const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { incrementMembers, checkMemberLimit } = require('./meteringService');
const { sendInviteEmail } = require('../lib/email');

/**
 * Invite Service
 *
 * Invite flow:
 *  1. Owner/Admin calls POST /api/team/invite with an email + role.
 *  2. We generate a signed JWT invite token (not stored as a secret —
 *     it's signed so we can verify it hasn't been tampered with).
 *  3. The token is also stored in the invite_tokens table so it can
 *     be revoked (e.g., if the invitee's role changes before they
 *     accept, or the owner wants to cancel).
 *  4. The invite link is emailed to the invitee via Resend. The console.log
 *     is kept alongside it as a dev convenience and fallback audit trail.
 *     If RESEND_API_KEY is not set, email is skipped silently and the link
 *     is only logged — invite creation is never blocked by email failure.
 *  5. The invitee visits /accept-invite?token=... and POSTs to
 *     /api/auth/accept-invite to create their account + join the org.
 *
 * WHY store the token in the DB if it's a signed JWT?
 * A JWT is self-verifying (signature check), but you can't revoke it
 * without a blocklist. Storing it lets us mark it accepted (accepted_at)
 * and lets owners see/cancel pending invites. The DB row is the source
 * of truth for validity; the JWT just carries the payload conveniently.
 */

const INVITE_EXPIRES_IN = process.env.JWT_INVITE_EXPIRES_IN || '48h';

function signInviteToken({ orgId, email, role, invitedBy }) {
  return jwt.sign(
    { orgId, email, role, invitedBy, type: 'invite' },
    process.env.JWT_SECRET,
    { expiresIn: INVITE_EXPIRES_IN }
  );
}

/**
 * createInvite()
 * Called by an owner/admin. Generates a signed invite token,
 * stores it, and returns the invite link for logging/display.
 */
async function createInvite({ orgId, invitedBy, email, role = 'member' }) {
  // Check member limit before even creating the invite
  await checkMemberLimit(orgId);

  // Prevent duplicate pending invites for the same email+org
  const { rows: existing } = await pool.query(
    `SELECT id FROM invite_tokens
     WHERE org_id = $1
       AND email  = $2
       AND accepted_at IS NULL
       AND expires_at > NOW()`,
    [orgId, email.toLowerCase()]
  );
  if (existing.length > 0) {
    const e = new Error('A pending invite already exists for this email');
    e.status = 409;
    throw e;
  }

  // Also check if they're already a member
  const { rows: members } = await pool.query(
    `SELECT id FROM org_members
     WHERE org_id  = $1
       AND user_id = (SELECT id FROM users WHERE email = $2 LIMIT 1)`,
    [orgId, email.toLowerCase()]
  );
  if (members.length > 0) {
    const e = new Error('This user is already a member of the organization');
    e.status = 409;
    throw e;
  }

  const token = signInviteToken({ orgId, email, role, invitedBy });

  // Store the raw token for revocation / acceptance tracking
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO invite_tokens (org_id, invited_by, email, role, token, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [orgId, invitedBy, email.toLowerCase(), role, token, expiresAt]
  );

  const inviteUrl = `${process.env.FRONTEND_URL}/accept-invite?token=${token}`;

  // [DEV ONLY] Log the invite link to the console — useful for local
  // testing without checking email. Never shown in the UI response.
  console.log(`\n[DEV ONLY] Invite link for ${email}:\n${inviteUrl}\n`);

  // Fetch the inviter's email and the org name so the email reads naturally.
  // These are two tiny indexed lookups — acceptable cost for an invite flow
  // that runs at human speed, never in a hot loop.
  const [inviterResult, orgResult] = await Promise.all([
    pool.query(`SELECT email FROM users WHERE id = $1`, [invitedBy]),
    pool.query(`SELECT name FROM organizations WHERE id = $1`, [orgId]),
  ]);
  const inviterName = inviterResult.rows[0]?.email ?? 'A teammate';
  const orgName     = orgResult.rows[0]?.name    ?? 'your organization';

  // Send the invite email. sendInviteEmail() never throws — if Resend
  // fails (bad key, rate limit, network error) it logs the error and
  // returns false. The invite is already committed to the DB at this
  // point so the failure only affects delivery, not invite creation.
  await sendInviteEmail({ toEmail: email, inviterName, orgName, inviteUrl, role });

  return { inviteUrl, token };
}

/**
 * acceptInvite()
 * Called when an invitee clicks the link and submits their name/password.
 * Creates their account if new, or just adds them to the org if they
 * already have an account.
 */
async function acceptInvite({ token, password, name }) {
  // 1. Verify JWT signature and expiry
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    const e = new Error('Invite link is invalid or has expired');
    e.status = 400;
    throw e;
  }

  if (payload.type !== 'invite') {
    const e = new Error('Invalid token type');
    e.status = 400;
    throw e;
  }

  // 2. Check the DB record: not accepted, not expired
  const { rows } = await pool.query(
    `SELECT id, org_id, email, role, accepted_at, expires_at
     FROM invite_tokens
     WHERE token = $1`,
    [token]
  );

  if (rows.length === 0) {
    const e = new Error('Invite not found');
    e.status = 404;
    throw e;
  }

  const invite = rows[0];

  if (invite.accepted_at) {
    const e = new Error('This invite has already been accepted');
    e.status = 409;
    throw e;
  }

  if (new Date(invite.expires_at) < new Date()) {
    const e = new Error('This invite has expired');
    e.status = 400;
    throw e;
  }

  const bcrypt = require('bcryptjs');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 3. Find or create the user
    let { rows: [user] } = await client.query(
      `SELECT id, email FROM users WHERE email = $1`,
      [invite.email]
    );

    if (!user) {
      if (!password) {
        const e = new Error('Password is required for new accounts');
        e.status = 400;
        throw e;
      }
      if (!name) {
        const e = new Error('Name is required for new accounts');
        e.status = 400;
        throw e;
      }
      const hash = await bcrypt.hash(password, 12);
      const { rows: [newUser] } = await client.query(
        `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name`,
        [invite.email, hash, name]
      );
      user = newUser;
    }

    // 4. Add to org_members.
    // ON CONFLICT DO NOTHING handles the edge case where the user was
    // somehow already added between invite creation and acceptance.
    // We check rowCount to know whether an actual INSERT happened —
    // if it was a no-op (conflict), we must NOT increment the Redis
    // counter or the count will drift above the real value.
    const insertResult = await client.query(
      `INSERT INTO org_members (org_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (org_id, user_id) DO NOTHING`,
      [invite.org_id, user.id, invite.role]
    );
    const memberActuallyAdded = insertResult.rowCount === 1;

    // 5. Mark invite as accepted
    await client.query(
      `UPDATE invite_tokens SET accepted_at = NOW() WHERE id = $1`,
      [invite.id]
    );

    await client.query('COMMIT');

    // Only increment the Redis counter if the INSERT actually added a row.
    // If the conflict fired (user was already a member), skip the increment
    // to prevent counter drift.
    if (memberActuallyAdded) {
      await incrementMembers(invite.org_id);
    }

    // Fetch org info to build the JWT
    const { rows: [org] } = await pool.query(
      `SELECT id, name, slug, subscription_tier FROM organizations WHERE id = $1`,
      [invite.org_id]
    );

    const { signToken } = require('./authService');
    const jwtToken = signToken(user.id, org.id, invite.role);

    return { token: jwtToken, user, org, role: invite.role };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * listInvites()
 * Returns all pending invites for an org (for the Team management page).
 */
async function listInvites(orgId) {
  const { rows } = await pool.query(
    `SELECT it.id, it.email, it.role, it.created_at, it.expires_at, it.accepted_at,
            u.email AS invited_by_email
     FROM invite_tokens it
     JOIN users u ON u.id = it.invited_by
     WHERE it.org_id = $1
     ORDER BY it.created_at DESC`,
    [orgId]
  );
  return rows;
}

/**
 * revokeInvite()
 * Deletes a pending invite — owner/admin only.
 */
async function revokeInvite({ orgId, inviteId }) {
  const { rows } = await pool.query(
    `DELETE FROM invite_tokens
     WHERE id = $1 AND org_id = $2 AND accepted_at IS NULL
     RETURNING id`,
    [inviteId, orgId]
  );
  if (rows.length === 0) {
    const e = new Error('Invite not found or already accepted');
    e.status = 404;
    throw e;
  }
  return rows[0];
}

/**
 * getMyPendingInvites()
 * Returns all pending invites sent to the user's email.
 */
async function getMyPendingInvites(userId) {
  const { rows } = await pool.query(
    `SELECT it.id, it.token, it.role, it.expires_at, o.name AS org_name, u.email AS inviter_email
     FROM invite_tokens it
     JOIN organizations o ON o.id = it.org_id
     JOIN users u ON u.id = it.invited_by
     WHERE it.email = (SELECT email FROM users WHERE id = $1)
       AND it.accepted_at IS NULL
       AND it.expires_at > NOW()
     ORDER BY it.created_at DESC`,
    [userId]
  );
  return rows;
}

/**
 * declinePendingInvite()
 * Declines (deletes) an invite using its token, ensuring the token belongs to the user.
 */
async function declinePendingInvite(userId, token) {
  const { rows } = await pool.query(
    `DELETE FROM invite_tokens
     WHERE token = $1 
       AND email = (SELECT email FROM users WHERE id = $2)
       AND accepted_at IS NULL
     RETURNING id`,
    [token, userId]
  );
  if (rows.length === 0) {
    const e = new Error('Invite not found or already accepted/declined');
    e.status = 404;
    throw e;
  }
  return rows[0];
}

module.exports = { createInvite, acceptInvite, listInvites, revokeInvite, getMyPendingInvites, declinePendingInvite };
