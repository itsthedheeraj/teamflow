function shouldRelaxSslVerification(connectionString) {
  try {
    const url = new URL(connectionString);
    return url.hostname.endsWith('.aivencloud.com');
  } catch {
    return false;
  }
}

function normalizeConnectionString(connectionString) {
  if (!connectionString || !shouldRelaxSslVerification(connectionString)) {
    return connectionString;
  }

  const url = new URL(connectionString);
  url.searchParams.delete('sslmode');
  return url.toString();
}

function buildPgConfig(connectionString, extraOptions = {}) {
  const config = {
    connectionString: normalizeConnectionString(connectionString),
    ...extraOptions,
  };

  if (connectionString && shouldRelaxSslVerification(connectionString)) {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}

module.exports = { buildPgConfig };