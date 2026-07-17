const pool = require('../db/pool');

/**
 * Step 3 of the auth chain — runs AFTER verifyOrgMembership confirms
 * the user legitimately belongs to this org.
 *
 * Acquires a dedicated DB client for this request (not a one-off
 * pool.query) so we can open a transaction and hold it across all
 * queries in the handler.
 *
 * WHY set_config with TRUE (transaction-local):
 * Connection pools reuse connections across requests. A session-level
 * SET would leak org A's context into org B's next request on the same
 * connection. Setting transaction_local=TRUE scopes the variable to
 * the current transaction only — it is automatically cleared when the
 * transaction ends. No manual cleanup needed.
 *
 * WHY BEGIN here:
 * set_config with transaction_local=TRUE only has effect inside a
 * transaction. We open one here and commit/rollback in the
 * releaseDbClient cleanup listener.
 *
 * ERROR SAFETY:
 * req.dbClient is initialized to null before pool.connect() so the
 * cleanup guard (!req.dbClient) in releaseDbClient safely no-ops if
 * this function never successfully acquires a connection.
 */
async function setOrgContext(req, res, next) {
  // Initialize to null so cleanup guard works even if connect() throws
  req.dbClient = null;
  req.dbError = false;

  let client;
  try {
    client = await pool.connect();
    req.dbClient = client; // assign after successful acquisition

    await client.query('BEGIN');
    await client.query(
      'SELECT set_config($1, $2, TRUE)',
      ['app.current_org_id', req.user.orgId]
    );

    next();
  } catch (err) {
    if (client) {
      // connect() succeeded but BEGIN or set_config failed
      client.release();
      req.dbClient = null;
    }
    next(err);
  }
}

module.exports = { setOrgContext };
