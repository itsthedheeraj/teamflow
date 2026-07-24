/**
 * Migration runner.
 * Connects as superuser (DATABASE_SUPERUSER_URL) so it can
 * create roles, enable RLS, and grant privileges.
 * The app server itself NEVER uses this connection string.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function getAppDatabaseName() {
  const databaseUrl = new URL(process.env.DATABASE_URL);
  return quoteIdentifier(databaseUrl.pathname.replace(/^\//, ''));
}

function getAppDatabaseUser() {
  const databaseUrl = new URL(process.env.DATABASE_URL);
  return quoteIdentifier(databaseUrl.username);
}

function renderMigration(sql) {
  return sql
    .replace(/__APP_DATABASE_NAME__/g, getAppDatabaseName())
    .replace(/__APP_DATABASE_USER__/g, getAppDatabaseUser());
}

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_SUPERUSER_URL,
  });

  await client.connect();
  console.log('Connected to database as superuser for migration.');

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  for (const file of files) {
    if (!file.endsWith('.sql')) continue;
    console.log(`Running migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await client.query(renderMigration(sql));
    console.log(`  ✓ ${file}`);
  }

  await client.end();
  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
