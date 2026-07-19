/**
 * Row-Level Security Isolation Tests
 *
 * THE GOAL OF THIS TEST FILE:
 * Prove that RLS actually works — that a user from Org A cannot see
 * Org B's data even if they craft a query directly or tamper with
 * their JWT to claim a different org_id.
 *
 * These tests are the proof that RLS is the last line of defense.
 * If application-level checks fail (a bug in verifyOrgMembership,
 * a missed WHERE clause), RLS still blocks the data.
 *
 * Prerequisites:
 *  - DATABASE_URL points to a non-superuser role (app_user).
 *    If it points to the postgres superuser, RLS is bypassed and
 *    these tests will fail.
 *  - Migrations have been run (RLS policies exist).
 */
require('dotenv').config();
const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');
const { signToken } = require('../services/authService');

// ─────────────────────────────────────────────
// Setup: create two orgs with users + projects
// ─────────────────────────────────────────────
let orgA, orgB, userA, userB, projectA, projectB;

beforeAll(async () => {
  // Clean slate
  await pool.query(`DELETE FROM users WHERE email LIKE 'rls-test-%'`);

  // Org A + User A
  const signupA = await request(app)
    .post('/api/auth/signup')
    .send({
      email: `rls-test-a-${Date.now()}@example.com`,
      password: 'password123',
      name: 'RLS User A',
    });
  userA = signupA.body.user;
  const tokenA = signupA.body.token;

  const orgResA = await request(app)
    .post('/api/auth/me/orgs')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ orgName: 'RLS Test Org A' });
  orgA = orgResA.body.org;

  // Create a project in Org A (will be used to test isolation)
  // We need the projects route — stub it inline for now or add routes.
  // For this test, insert directly via pool (simpler).
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_org_id', $1, true)`, [orgA.id]);
    const { rows: [pA] } = await client.query(
      `INSERT INTO projects (org_id, name, created_by)
       VALUES ($1, 'Project Alpha', $2)
       RETURNING id, org_id, name`,
      [orgA.id, userA.id]
    );
    projectA = pA;
    await client.query('COMMIT');
  } finally {
    client.release();
  }

  // Org B + User B
  const signupB = await request(app)
    .post('/api/auth/signup')
    .send({
      email: `rls-test-b-${Date.now()}@example.com`,
      password: 'password123',
      name: 'RLS User B',
    });
  userB = signupB.body.user;
  const tokenB = signupB.body.token;

  const orgResB = await request(app)
    .post('/api/auth/me/orgs')
    .set('Authorization', `Bearer ${tokenB}`)
    .send({ orgName: 'RLS Test Org B' });
  orgB = orgResB.body.org;

  const client2 = await pool.connect();
  try {
    await client2.query('BEGIN');
    await client2.query(`SELECT set_config('app.current_org_id', $1, true)`, [orgB.id]);
    const { rows: [pB] } = await client2.query(
      `INSERT INTO projects (org_id, name, created_by)
       VALUES ($1, 'Project Beta', $2)
       RETURNING id, org_id, name`,
      [orgB.id, userB.id]
    );
    projectB = pB;
    await client2.query('COMMIT');
  } finally {
    client2.release();
  }
});

afterAll(async () => {
  await pool.query(`DELETE FROM users WHERE email LIKE 'rls-test-%'`);
  await pool.end();
});

// ─────────────────────────────────────────────
// Test 1: Raw query isolation (bypass app layer entirely)
// ─────────────────────────────────────────────
describe('RLS enforces tenant isolation at the database layer', () => {
  it('blocks cross-tenant reads even with a raw query after SET app.current_org_id', async () => {
    // This test proves RLS works even if the application code is buggy.
    // We manually set the org context to Org A, then try to SELECT
    // Org B's project. RLS should return 0 rows.

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `SELECT set_config('app.current_org_id', $1, TRUE)`,
        [orgA.id]
      );

      // Now attempt to read projectB (which belongs to orgB, not orgA)
      const { rows } = await client.query(
        `SELECT * FROM projects WHERE id = $1`,
        [projectB.id]
      );

      // RLS policy blocks it — 0 rows returned
      expect(rows.length).toBe(0);

      await client.query('COMMIT');
    } finally {
      client.release();
    }
  });

  it('allows reads within the same org', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `SELECT set_config('app.current_org_id', $1, TRUE)`,
        [orgA.id]
      );

      const { rows } = await client.query(
        `SELECT * FROM projects WHERE id = $1`,
        [projectA.id]
      );

      // Same org → RLS allows it
      expect(rows.length).toBe(1);
      expect(rows[0].name).toBe('Project Alpha');

      await client.query('COMMIT');
    } finally {
      client.release();
    }
  });
});

// ─────────────────────────────────────────────
// Test 2: Tampered JWT (wrong org_id claim)
// ─────────────────────────────────────────────
describe('verifyOrgMembership blocks tampered JWTs before RLS even runs', () => {
  it('rejects a valid JWT with a foreign org_id before any data query', async () => {
    // User A crafts a JWT claiming they belong to Org B.
    // The signature is valid (we sign it with the real secret),
    // but they aren't actually a member of Org B.
    // verifyOrgMembership should 403 before setOrgContext runs.

    const tamperedToken = signToken(userA.id, orgB.id, 'owner');

    // Hit a fully-chained route: verifyJWT → verifyOrgMembership → setOrgContext.
    // verifyOrgMembership must 403 before setOrgContext ever runs.
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${tamperedToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not a member/i);
  });
});

// ─────────────────────────────────────────────
// Test 3: No org context set → queries return nothing
// ─────────────────────────────────────────────
describe('RLS fails closed when app.current_org_id is not set', () => {
  it('returns 0 rows if app.current_org_id is NULL', async () => {
    // Simulate a bug: the middleware forgot to set app.current_org_id.
    // current_setting(..., TRUE) returns NULL, NULL::UUID never matches
    // any row → fail-closed, not fail-open.

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Intentionally do NOT set app.current_org_id
      const { rows } = await client.query(`SELECT * FROM projects`);
      // RLS blocks all rows
      expect(rows.length).toBe(0);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });
});

// ─────────────────────────────────────────────
// Test 4: Confirm app_user role, not superuser
// ─────────────────────────────────────────────
describe('Database connection role check', () => {
  it('confirms the pool connects as app_user (non-superuser)', async () => {
    const { rows } = await pool.query(`SELECT current_user, usesuper FROM pg_user WHERE usename = current_user`);
    const role = rows[0];

    // If this fails, DATABASE_URL is pointing to postgres superuser.
    // RLS does NOT work for superusers — fix your .env.
    expect(role.current_user).not.toBe('postgres');
    expect(role.usesuper).toBe(false);
  });
});
