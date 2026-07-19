/**
 * Auth & Organizations integration tests.
 * Hits the real Express app against a real test database.
 *
 * Prerequisites:
 *  - DATABASE_URL in .env points to a test DB (or use a separate
 *    DATABASE_TEST_URL env var)
 *  - Migrations have been run: npm run db:migrate
 */
require('dotenv').config();
const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
async function cleanupEmail(email) {
  // Delete user by email; CASCADE removes org_members too.
  // Orgs created in tests are also removed via the user delete
  // only if no other members exist — for test isolation we clean
  // up explicitly.
  await pool.query(`DELETE FROM users WHERE email = $1`, [email]);
}

// ─────────────────────────────────────────────
// Signup
// ─────────────────────────────────────────────
describe('POST /api/auth/signup', () => {
  const email = `test-signup-${Date.now()}@example.com`;

  afterAll(() => cleanupEmail(email));

  it('creates a user, returns a JWT, and allows org creation', async () => {
    // 1. Signup
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email, password: 'password123', name: 'Test User' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(email);
    expect(res.body.org).toBeNull();
    
    // 2. Create Org
    const orgRes = await request(app)
      .post('/api/auth/me/orgs')
      .set('Authorization', `Bearer ${res.body.token}`)
      .send({ orgName: 'Test Corp' });
      
    expect(orgRes.status).toBe(201);
    expect(orgRes.body.org.name).toBe('Test Corp');
    expect(orgRes.body.org.subscriptionTier).toBe('free');
  });

  it('rejects duplicate email with 409', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email, password: 'password123', orgName: 'Another Corp' });

    expect(res.status).toBe(409);
  });

  it('rejects short password with 400', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'new@example.com', password: 'short', orgName: 'Corp' });

    expect(res.status).toBe(400);
  });

  it('rejects missing orgName with 400', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'new2@example.com', password: 'password123' });

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  const email = `test-login-${Date.now()}@example.com`;
  const password = 'logintest123';

  beforeAll(async () => {
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({ email, password, name: 'Login Test' });
    
    await request(app)
      .post('/api/auth/me/orgs')
      .set('Authorization', `Bearer ${signupRes.body.token}`)
      .send({ orgName: 'Login Test Org' });
  });
  afterAll(() => cleanupEmail(email));

  it('returns a JWT on correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.org).toBeTruthy();
    expect(res.body.role).toBe('owner');
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  it('returns 401 on unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password });

    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────
// Protected routes — JWT required
// ─────────────────────────────────────────────
describe('GET /api/auth/me/orgs', () => {
  const email = `test-meorgs-${Date.now()}@example.com`;
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email, password: 'password123', name: 'My Orgs Test' });
    token = res.body.token;
    
    await request(app)
      .post('/api/auth/me/orgs')
      .set('Authorization', `Bearer ${token}`)
      .send({ orgName: 'My Orgs Test' });
  });
  afterAll(() => cleanupEmail(email));

  it('returns the list of orgs for the authenticated user', async () => {
    const res = await request(app)
      .get('/api/auth/me/orgs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.orgs).toHaveLength(1);
    expect(res.body.orgs[0].name).toBe('My Orgs Test');
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/auth/me/orgs');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me/orgs')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });
});

afterAll(() => pool.end());
