/**
 * Usage Metering & Rate Limiting Tests
 *
 * Verifies that:
 *  1. Free tier task limit is enforced (max 20)
 *  2. Free tier member limit is enforced (max 3)
 *  3. Redis counter increments on create
 *  4. Redis counter decrements on delete (not just always-increasing)
 *  5. Project cascade-delete resyncs the task counter
 *  6. Pro tier has unlimited tasks
 *  7. Counter survives a Redis key flush (falls back to Postgres resync)
 */
require('dotenv').config();
const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');
const redis = require('../lib/redis');
const {
  syncTaskCount,
  syncMemberCount,
  getUsageSummary,
  TIER_LIMITS,
} = require('../services/meteringService');

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
async function signup(suffix) {
  const res = await request(app)
    .post('/api/auth/signup')
    .send({
      email: `meter-${suffix}-${Date.now()}@example.com`,
      password: 'password123',
      orgName: `Meter Org ${suffix}`,
    });
  return res.body; // { token, user, org }
}

async function createProject(token) {
  const res = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Project ${Date.now()}` });
  return res.body.project;
}

async function createTask(token, projectId) {
  return request(app)
    .post('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send({ projectId, title: `Task ${Date.now()}` });
}

async function deleteTask(token, taskId) {
  return request(app)
    .delete(`/api/tasks/${taskId}`)
    .set('Authorization', `Bearer ${token}`);
}

async function deleteProject(token, projectId) {
  return request(app)
    .delete(`/api/projects/${projectId}`)
    .set('Authorization', `Bearer ${token}`);
}

// Force an org to Pro tier directly in the DB (bypasses Stripe)
async function setTier(orgId, tier) {
  await pool.query(
    `UPDATE organizations SET subscription_tier = $1 WHERE id = $2`,
    [tier, orgId]
  );
}

// ─────────────────────────────────────────────
// Setup / teardown
// ─────────────────────────────────────────────
afterAll(async () => {
  await pool.query(`DELETE FROM users WHERE email LIKE 'meter-%'`);
  await pool.end();
  await redis.quit();
});

// ─────────────────────────────────────────────
// Task limit — Free tier
// ─────────────────────────────────────────────
describe('Free tier task limit (max 20)', () => {
  let token, orgId, projectId;

  beforeAll(async () => {
    const { token: t, org } = await signup('tasklimit');
    token = t; orgId = org.id;
    const project = await createProject(token);
    projectId = project.id;

    // Seed 20 tasks directly in DB to avoid 20 slow HTTP calls
    for (let i = 0; i < 20; i++) {
      await pool.query(
        `INSERT INTO tasks (org_id, project_id, title, created_by)
         VALUES ($1, $2, $3, (SELECT user_id FROM org_members WHERE org_id = $1 LIMIT 1))`,
        [orgId, projectId, `Seeded task ${i}`]
      );
    }
    // Resync the Redis counter to match the seeded DB state
    await syncTaskCount(orgId);
  });

  it('returns 403 when the 21st task is attempted', async () => {
    const res = await createTask(token, projectId);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/20 tasks/i);
    expect(res.body.error).toMatch(/upgrade/i);
  });

  it('allows task creation after upgrading to Pro', async () => {
    await setTier(orgId, 'pro');
    const res = await createTask(token, projectId);
    expect(res.status).toBe(201);
    await setTier(orgId, 'free'); // restore
  });
});

// ─────────────────────────────────────────────
// Counter accuracy — increment then decrement
// ─────────────────────────────────────────────
describe('Task counter stays accurate across create and delete', () => {
  let token, orgId, projectId;

  beforeAll(async () => {
    const { token: t, org } = await signup('counterdrift');
    token = t; orgId = org.id;
    // Seed as admin for delete permission
    const project = await createProject(token);
    projectId = project.id;
    await syncTaskCount(orgId); // start from clean Postgres count
  });

  it('increments counter on task create', async () => {
    const before = (await getUsageSummary(orgId)).tasks.current;
    const res = await createTask(token, projectId);
    expect(res.status).toBe(201);
    const after = (await getUsageSummary(orgId)).tasks.current;
    expect(after).toBe(before + 1);
  });

  it('decrements counter on task delete (not permanently increasing)', async () => {
    // Create a task, record the count, delete it, confirm count goes back down
    const createRes = await createTask(token, projectId);
    const taskId = createRes.body.task.id;
    const afterCreate = (await getUsageSummary(orgId)).tasks.current;

    const delRes = await deleteTask(token, taskId);
    expect(delRes.status).toBe(200);

    const afterDelete = (await getUsageSummary(orgId)).tasks.current;
    expect(afterDelete).toBe(afterCreate - 1);
  });
});

// ─────────────────────────────────────────────
// Project cascade delete resyncs task counter
// ─────────────────────────────────────────────
describe('Deleting a project resyncs the task counter', () => {
  let token, orgId, projectId;

  beforeAll(async () => {
    const { token: t, org } = await signup('cascade');
    token = t; orgId = org.id;
    const project = await createProject(token);
    projectId = project.id;

    // Create 3 tasks in this project
    for (let i = 0; i < 3; i++) {
      await createTask(token, projectId);
    }
  });

  it('task counter drops after project is deleted', async () => {
    const before = (await getUsageSummary(orgId)).tasks.current;
    expect(before).toBeGreaterThanOrEqual(3);

    const res = await deleteProject(token, projectId);
    expect(res.status).toBe(200);

    // Give the async syncTaskCount (fire-and-forget) time to complete
    await new Promise((r) => setTimeout(r, 200));

    const after = (await getUsageSummary(orgId)).tasks.current;
    expect(after).toBe(before - 3);
  });
});

// ─────────────────────────────────────────────
// Counter resync from Postgres after Redis key eviction
// ─────────────────────────────────────────────
describe('Counter falls back to Postgres when Redis key is missing', () => {
  let token, orgId;

  beforeAll(async () => {
    const { token: t, org } = await signup('resync');
    token = t; orgId = org.id;
    const project = await createProject(token);
    // Create 2 tasks via API so DB and counter are in sync
    await createTask(token, project.id);
    await createTask(token, project.id);
  });

  it('returns correct count after Redis key is manually deleted', async () => {
    // Simulate Redis restart by deleting the key
    await redis.del(`usage:${orgId}:tasks`);

    // Next GET call should resync from Postgres
    const usage = await getUsageSummary(orgId);
    expect(usage.tasks.current).toBe(2);

    // And the key should be re-populated in Redis
    const redisVal = await redis.get(`usage:${orgId}:tasks`);
    expect(parseInt(redisVal, 10)).toBe(2);
  });
});

// ─────────────────────────────────────────────
// Member limit — Free tier
// ─────────────────────────────────────────────
describe('Free tier member limit (max 3)', () => {
  let ownerToken, orgId;

  beforeAll(async () => {
    const { token: t, org } = await signup('memberlimit');
    ownerToken = t; orgId = org.id;

    // Add 2 more members directly (owner = 1, so total = 3 = limit)
    for (let i = 0; i < 2; i++) {
      const { user: u } = await signup(`extra-${i}`);
      await pool.query(
        `INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'member')`,
        [orgId, u.id]
      );
    }
    await syncMemberCount(orgId); // sync Redis to match DB
  });

  it('returns 403 when trying to invite a 4th member', async () => {
    const res = await request(app)
      .post('/api/team/invite')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: `meter-4th-${Date.now()}@example.com`, role: 'member' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/3 team members/i);
    expect(res.body.error).toMatch(/upgrade/i);
  });
});

// ─────────────────────────────────────────────
// Tier limit constants sanity check
// ─────────────────────────────────────────────
describe('TIER_LIMITS constants', () => {
  it('free tier has correct limits', () => {
    expect(TIER_LIMITS.free.members).toBe(3);
    expect(TIER_LIMITS.free.tasks).toBe(20);
  });

  it('pro tier has unlimited tasks', () => {
    expect(TIER_LIMITS.pro.tasks).toBe(Number.MAX_SAFE_INTEGER);
  });
});
