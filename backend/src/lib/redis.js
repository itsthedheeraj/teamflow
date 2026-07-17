const Redis = require('ioredis');

/**
 * Redis client singleton.
 *
 * Used exclusively for usage counters and rate limiting — NOT for
 * billing idempotency (that lives in Postgres for durability).
 *
 * Usage counters are ephemeral by design: if Redis restarts, counters
 * reset to 0. That's acceptable because:
 *  - Counters are recalculated from Postgres on the next write attempt
 *    (see meteringService.js — we fall back to a COUNT query when Redis
 *    is unavailable or returns 0 unexpectedly).
 *  - The worst case of a Redis restart is that a few extra tasks/members
 *    slip through before the counter rebuilds — a minor overage, not a
 *    billing or security issue.
 *
 * Redis IS the wrong tool for webhook idempotency (Feature 5) precisely
 * because this ephemerality is unacceptable for billing events.
 */
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false, // fail fast if Redis goes down mid-run
  // lazyConnect is intentionally NOT set here.
  // lazyConnect: true combined with enableOfflineQueue: false creates a
  // race: the client never auto-connects, so the first command always
  // arrives before the stream is open, and ioredis throws
  // "Stream isn't writeable" immediately instead of queuing.
  // Without lazyConnect, ioredis connects at startup — by the time the
  // first request arrives the stream is ready.
});

redis.on('error', (err) => {
  // Log but don't crash — usage metering degrades gracefully if Redis is down
  console.error('Redis error:', err.message);
});

module.exports = redis;
