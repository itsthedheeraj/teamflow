/**
 * Global Express error handler (4-argument signature required).
 *
 * CRITICAL ORDERING:
 * req.dbError must be set to true BEFORE res.json() is called,
 * because res.json() triggers the 'finish' event, which fires
 * the cleanup listener in releaseDbClient. If the flag is set
 * after the response is sent, cleanup has already run with
 * req.dbError === false and committed the transaction.
 *
 * Flag first → send response → cleanup sees flag → ROLLBACK.
 */
function errorHandler(err, req, res, next) {
  // 1. Flip the rollback flag BEFORE sending any response
  req.dbError = true;

  // 2. Log with context for debugging
  console.error({
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    userId: req.user?.userId,
    orgId: req.user?.orgId,
    path: req.path,
    method: req.method,
  });

  // 3. Determine status code
  const status = err.status || err.statusCode || 500;

  // 4. Send response — this triggers 'finish' → cleanup → ROLLBACK
  res.status(status).json({
    error: err.expose || status < 500 ? err.message : 'Internal server error',
  });
}

module.exports = { errorHandler };
