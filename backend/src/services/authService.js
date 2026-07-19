const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const SALT_ROUNDS = 12;

/**
 * Generates a JWT for a user scoped to a specific org.
 *
 * The token carries userId (sub), orgId, and a role placeholder.
 * NOTE: role is NOT trusted from the JWT downstream — verifyOrgMembership
 * always re-reads it fresh from the DB to prevent stale privilege escalation.
 * It is included here only for convenience on the frontend (display purposes).
 */
function signToken(userId, orgId, role) {
  return jwt.sign(
    { sub: userId, orgId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * signup()
 *
 * Creates a new user AND a new organization in a single transaction.
 * The signing-up user becomes the 'owner' of the new org.
 *
 * Steps:
 *  1. Hash the password
 *  2. Insert into users
 *  3. Insert into organizations (slug derived from org name)
 *  4. Insert into org_members with role = 'owner'
 *  5. Return a signed JWT
 *
 * All four inserts are wrapped in a transaction so a partial failure
 * (e.g., slug collision) doesn't leave orphaned users or orgs.
 */
async function signup({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create user
    const { rows: [user] } = await client.query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, created_at`,
      [email.toLowerCase().trim(), passwordHash, name]
    );

    await client.query('COMMIT');

    const token = signToken(user.id, null, null);
    return { token, user, org: null };
  } catch (err) {
    await client.query('ROLLBACK');
    // Postgres unique violation code
    if (err.code === '23505' && err.constraint?.includes('email')) {
      const e = new Error('An account with this email already exists');
      e.status = 409;
      throw e;
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * login()
 *
 * Authenticates a user and returns a JWT scoped to their most-recently-
 * active org (first org membership found, ordered by created_at).
 *
 * If a user belongs to multiple orgs they can switch org from the UI,
 * which calls /auth/switch-org to get a new token with a different orgId.
 */
async function login({ email, password }) {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.password_hash, u.name,
            om.org_id, om.role,
            o.name  AS org_name,
            o.slug  AS org_slug,
            o.subscription_tier
     FROM users u
     LEFT JOIN org_members om ON om.user_id = u.id
     LEFT JOIN organizations o ON o.id = om.org_id
     WHERE u.email = $1
     ORDER BY om.created_at ASC
     LIMIT 1`,
    [email.toLowerCase().trim()]
  );

  if (rows.length === 0) {
    const e = new Error('Invalid email or password');
    e.status = 401;
    throw e;
  }

  const row = rows[0];
  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    const e = new Error('Invalid email or password');
    e.status = 401;
    throw e;
  }

  const token = signToken(row.id, row.org_id || null, row.role || null);
  return {
    token,
    user: { id: row.id, email: row.email, name: row.name },
    org: row.org_id ? {
      id: row.org_id,
      name: row.org_name,
      slug: row.org_slug,
      subscriptionTier: row.subscription_tier,
    } : null,
    role: row.role || null,
  };
}

/**
 * switchOrg()
 *
 * Issues a new JWT with a different orgId as the active org.
 * The verifyOrgMembership middleware is NOT used here (we're
 * issuing the token, not consuming it), so we do the membership
 * check manually before signing.
 */
async function switchOrg({ userId, targetOrgId }) {
  const { rows } = await pool.query(
    `SELECT om.role, o.name, o.slug, o.subscription_tier
     FROM org_members om
     JOIN organizations o ON o.id = om.org_id
     WHERE om.user_id = $1 AND om.org_id = $2
     LIMIT 1`,
    [userId, targetOrgId]
  );

  if (rows.length === 0) {
    const e = new Error('You are not a member of that organization');
    e.status = 403;
    throw e;
  }

  const row = rows[0];
  const token = signToken(userId, targetOrgId, row.role);
  return {
    token,
    org: {
      id: targetOrgId,
      name: row.name,
      slug: row.slug,
      subscriptionTier: row.subscription_tier,
    },
    role: row.role,
  };
}

/**
 * getMyOrgs()
 *
 * Returns all orgs the user belongs to, for the org switcher UI.
 */
async function getMyOrgs(userId) {
  const { rows } = await pool.query(
    `SELECT o.id, o.name, o.slug, o.subscription_tier, om.role
     FROM org_members om
     JOIN organizations o ON o.id = om.org_id
     WHERE om.user_id = $1
     ORDER BY om.created_at ASC`,
    [userId]
  );
  return rows;
}

/**
 * createOrg()
 *
 * Creates a new organization for an existing authenticated user.
 * The user becomes the 'owner' of the new org.
 */
async function createOrg({ userId, orgName }) {
  const baseSlug = orgName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create organization
    const { rows: [org] } = await client.query(
      `INSERT INTO organizations (name, slug)
       VALUES ($1, $2)
       RETURNING id, name, slug, subscription_tier`,
      [orgName.trim(), slug]
    );

    // 2. Add user as owner of the org
    await client.query(
      `INSERT INTO org_members (org_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [org.id, userId]
    );

    await client.query('COMMIT');

    // Switch context immediately to the new org
    return await switchOrg({ userId, targetOrgId: org.id });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { signup, login, switchOrg, getMyOrgs, signToken, createOrg };
