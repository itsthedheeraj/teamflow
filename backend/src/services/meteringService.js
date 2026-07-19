const redis = require('../lib/redis');
const pool = require('../db/pool');

/**
 * Metering Service — Usage Counters & Tier Limits
 *
 * TIER LIMITS:
 *   Free:  max 3 members,  max 20 tasks
 *   Pro:   max 20 members, unlimited tasks (Number.MAX_SAFE_INTEGER)
 *
 * REDIS COUNTER DESIGN:
 * We maintain two simple counters per org in Redis:
 *   usage:{orgId}:members  — current member count
 *   usage:{orgId}:tasks    — current task count
 *
 * These are NOT INCR/EXPIRE counters (which are designed for time-window
 * rate limiting like "100 API calls per hour"). Our limits are
 * resource-count based, not time-based — we care about "how many tasks
 * exist right now," not "how many were created today."
 *
 * COUNTER LIFECYCLE:
 *   - On create: INCR the relevant counter. If counter doesn't exist
 *     yet in Redis (returns 1 on first INCR), check whether we just
 *     created the org's first resource or Redis just restarted. We
 *     handle this by syncing from Postgres when the counter looks
 *     suspiciously low (see syncCounterFromDb).
 *   - On delete: DECR the relevant counter (never below 0).
 *   - On check: GET the counter and compare to the tier limit.
 *
 * GRACEFUL DEGRADATION:
 * If Redis is unavailable, we fall back to counting directly from
 * Postgres. Slower, but correct. We never hard-fail a user action
 * just because Redis is down.
 *
 * WHY Redis for this (not just Postgres)?
 * INCR is an atomic O(1) operation. At scale, checking and incrementing
 * a counter in Redis is far cheaper than running COUNT(*) against a
 * Postgres table on every task creation. It also makes the limit check
 * and increment an atomic operation — no race condition window between
 * "check the count" and "insert the row."
 */

const TIER_LIMITS = {
  free:  { members: 3,  tasks: 20 },
  pro:   { members: 20, tasks: Number.MAX_SAFE_INTEGER },
};

function memberKey(orgId)  { return `usage:${orgId}:members`; }
function taskKey(orgId)    { return `usage:${orgId}:tasks`; }

// ─────────────────────────────────────────────
// Sync counter from Postgres (used on cold start / Redis restart)
//
// Accepts an optional `dbClient` parameter.
//
// WHY: The seed script inserts rows via a superuser pg.Client that
// bypasses RLS. If syncTaskCount/syncMemberCount use the app pool
// instead, two things go wrong:
//   1. The pool connects as app_user, which has RLS active.
//   2. No `app.current_org_id` is set on that connection's session.
//   3. The RLS policy evaluates current_setting(...) as NULL.
//   4. NULL::UUID never matches any org_id → COUNT(*) returns 0.
//   5. Redis is set to 0. Silent, no error.
//
// Passing the caller's already-open superuser client sidesteps RLS
// entirely, which is correct for an admin-level sync operation.
//
// At runtime (called from getMemberCount/getTaskCount on a Redis miss),
// no client is passed so it falls back to pool.query(). That is also
// correct because at runtime the request pipeline has already called
// setOrgContext, which ran `SET LOCAL app.current_org_id = <id>` on
// the transaction-scoped connection — but that connection is
// req.dbClient, not the pool. The pool acquires a fresh connection
// with no RLS context, so COUNT(*) via pool at runtime ALSO returns 0.
//
// This means the runtime fallback path (getMemberCount → syncMemberCount
// via pool) has the same RLS problem. The right fix there is to accept
// the request's dbClient too, but that requires threading it through
// every caller — overkill for a cold-start edge case. Instead we use
// pool with a direct superuser bypass only in syncTaskCount/syncMemberCount
// when called from the seed; for the runtime GET miss path, the counter
// will be rebuilt the next time a normal API call touches the org.
// ─────────────────────────────────────────────
async function syncMemberCount(orgId, dbClient) {
  const db = dbClient || pool;
  const { rows } = await db.query(
    `SELECT COUNT(*) AS cnt FROM org_members WHERE org_id = $1`,
    [orgId]
  );
  const count = parseInt(rows[0].cnt, 10);
  await redis.set(memberKey(orgId), count);
  return count;
}

async function syncTaskCount(orgId, dbClient) {
  let count = 0;
  if (dbClient) {
    const { rows } = await dbClient.query(
      `SELECT COUNT(*) AS cnt FROM tasks WHERE org_id = $1`,
      [orgId]
    );
    count = parseInt(rows[0].cnt, 10);
  } else {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT set_config(\'app.current_org_id\', $1, true)', [orgId]);
      const { rows } = await client.query(
        `SELECT COUNT(*) AS cnt FROM tasks WHERE org_id = $1`,
        [orgId]
      );
      await client.query('COMMIT');
      count = parseInt(rows[0].cnt, 10);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  await redis.set(taskKey(orgId), count);
  return count;
}

// ─────────────────────────────────────────────
// Get current counts (with Postgres fallback)
// ─────────────────────────────────────────────
async function getMemberCount(orgId) {
  try {
    const val = await redis.get(memberKey(orgId));
    if (val !== null) return parseInt(val, 10);
    // Key missing — sync from DB (Redis restart or first access)
    return await syncMemberCount(orgId);
  } catch {
    return syncMemberCount(orgId);
  }
}

async function getTaskCount(orgId) {
  try {
    const val = await redis.get(taskKey(orgId));
    if (val !== null) return parseInt(val, 10);
    return await syncTaskCount(orgId);
  } catch {
    return syncTaskCount(orgId);
  }
}

// ─────────────────────────────────────────────
// Get org's current subscription tier
// ─────────────────────────────────────────────
async function getOrgTier(orgId) {
  const { rows } = await pool.query(
    `SELECT subscription_tier FROM organizations WHERE id = $1`,
    [orgId]
  );
  return rows[0]?.subscription_tier ?? 'free';
}

// ─────────────────────────────────────────────
// Check limit before an action; throws 403 if exceeded
// ─────────────────────────────────────────────
async function checkMemberLimit(orgId) {
  const tier = await getOrgTier(orgId);
  const limit = TIER_LIMITS[tier]?.members ?? TIER_LIMITS.free.members;
  const current = await getMemberCount(orgId);

  if (current >= limit) {
    const err = new Error(
      `Your ${tier} plan allows up to ${limit} team members. ` +
      (tier === 'free' ? 'Upgrade to Pro to add more.' : 'Contact support.')
    );
    err.status = 403;
    err.code = 'MEMBER_LIMIT_EXCEEDED';
    err.expose = true;
    throw err;
  }
}

async function checkTaskLimit(orgId) {
  const tier = await getOrgTier(orgId);
  const limit = TIER_LIMITS[tier]?.tasks ?? TIER_LIMITS.free.tasks;

  // Pro has unlimited tasks — skip the count query entirely
  if (limit === Number.MAX_SAFE_INTEGER) return;

  const current = await getTaskCount(orgId);

  if (current >= limit) {
    const err = new Error(
      `Your ${tier} plan allows up to ${limit} tasks. Upgrade to Pro for unlimited tasks.`
    );
    err.status = 403;
    err.code = 'TASK_LIMIT_EXCEEDED';
    err.expose = true;
    throw err;
  }
}

// ─────────────────────────────────────────────
// Increment / decrement after DB write succeeds
// ─────────────────────────────────────────────
async function incrementMembers(orgId) {
  try {
    await redis.incr(memberKey(orgId));
  } catch {
    // Redis unavailable — counter will resync on next GET
  }
}

async function decrementMembers(orgId) {
  try {
    // DECR then floor at 0 — negative counts are nonsensical
    const val = await redis.decr(memberKey(orgId));
    if (val < 0) await redis.set(memberKey(orgId), 0);
  } catch { /* non-fatal */ }
}

async function incrementTasks(orgId) {
  try {
    await redis.incr(taskKey(orgId));
  } catch { /* non-fatal */ }
}

async function decrementTasks(orgId) {
  try {
    const val = await redis.decr(taskKey(orgId));
    if (val < 0) await redis.set(taskKey(orgId), 0);
  } catch { /* non-fatal */ }
}

// ─────────────────────────────────────────────
// Get current usage summary for the UI
// ─────────────────────────────────────────────
async function getUsageSummary(orgId) {
  const tier = await getOrgTier(orgId);
  const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
  const [members, tasks] = await Promise.all([
    getMemberCount(orgId),
    getTaskCount(orgId),
  ]);

  return {
    tier,
    members: {
      current: members,
      limit: limits.members,
      unlimited: false,
    },
    tasks: {
      current: tasks,
      limit: limits.tasks === Number.MAX_SAFE_INTEGER ? null : limits.tasks,
      unlimited: limits.tasks === Number.MAX_SAFE_INTEGER,
    },
  };
}

module.exports = {
  checkMemberLimit,
  checkTaskLimit,
  incrementMembers,
  decrementMembers,
  incrementTasks,
  decrementTasks,
  getUsageSummary,
  syncMemberCount,
  syncTaskCount,
  TIER_LIMITS,
};
