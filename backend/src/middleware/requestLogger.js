/**
 * Middleware to log HTTP requests and responses.
 */
function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl } = req;
    const { statusCode } = res;

    // Use console.log for successful or redirection responses, and console.warn/error for client/server errors
    const message = `[API] ${method} ${originalUrl} - Status: ${statusCode} - ${duration}ms`;

    if (statusCode >= 500) {
      console.error(message);
    } else if (statusCode >= 400) {
      console.warn(message);
    } else {
      console.log(message);
    }
  });

  next();
}

module.exports = { requestLogger };
