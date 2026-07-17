const { Pool } = require('pg');

/**
 * Application database pool.
 *
 * IMPORTANT: This connects as app_user (a non-superuser role).
 * Superuser connections bypass Row-Level Security entirely —
 * if you accidentally use the postgres superuser here, RLS
 * policies on projects/tasks silently stop working and every
 * org can see every other org's data.
 *
 * See .env.example for the distinction between DATABASE_URL
 * (app_user, used here) and DATABASE_SUPERUSER_URL (used only
 * in migration scripts).
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle DB client', err);
});

module.exports = pool;
