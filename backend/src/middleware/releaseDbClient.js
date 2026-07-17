/**
 * Transaction cleanup middleware.
 *
 * Registered ONCE at the app level, BEFORE routes and BEFORE
 * setOrgContext, so the res.on('finish') listener is in place
 * before any transaction is opened.
 *
 * HOW IT WORKS:
 * Express doesn't give cleanup middleware a chance to run "after"
 * a route — once next() is called the stack unwinds. Instead, we
 * attach an event listener to the response object that fires when
 * the response is fully sent ('finish') or the client disconnects
 * ('close'). At that point we know whether an error occurred.
 *
 * WHY req.dbError must be set BEFORE res.send():
 * errorHandler sets req.dbError = true, then calls res.json().
 * res.json() triggers 'finish'. If the flag were set after the
 * response send, cleanup would have already run and committed.
 * The flag must be set first — see errorHandler.js.
 *
 * NULL GUARD:
 * If verifyOrgMembership throws before setOrgContext runs,
 * req.dbClient is never assigned (stays null/undefined). The
 * !req.dbClient guard catches both null (explicitly set by
 * setOrgContext) and undefined (setOrgContext never ran at all).
 *
 * DOUBLE-FIRE GUARD:
 * Both 'finish' and 'close' can fire on the same request.
 * Setting req.dbClient = null after the first cleanup makes
 * subsequent calls safe no-ops.
 */
function releaseDbClient(req, res, next) {
  const cleanup = async (shouldRollback) => {
    // Guard: no connection was ever acquired, nothing to clean up
    if (!req.dbClient) return;

    const client = req.dbClient;
    req.dbClient = null; // prevent double-release if both events fire

    try {
      if (shouldRollback || req.dbError) {
        await client.query('ROLLBACK');
      } else {
        await client.query('COMMIT');
      }
    } catch (cleanupErr) {
      // COMMIT or ROLLBACK itself failed — connection is broken.
      // Pass the error to release() so pg-pool destroys this
      // connection rather than returning it to the pool poisoned.
      client.release(cleanupErr);
      return;
    }

    client.release();
  };

  // Normal path: response fully sent
  res.on('finish', () => cleanup(false));

  // Abnormal path: client disconnected before response completed
  res.on('close', () => cleanup(true));

  next();
}

module.exports = { releaseDbClient };
