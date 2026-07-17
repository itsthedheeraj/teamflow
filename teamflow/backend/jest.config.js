module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  // Run tests serially — they share a real Postgres instance
  // and parallel runs would cause race conditions on shared tables.
  maxWorkers: 1,
};
