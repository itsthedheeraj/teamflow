require('dotenv').config();
const { Pool } = require('pg');
const { buildPgConfig } = require('./src/db/connection');
const fs = require('fs');

async function run() {
  const pool = new Pool(buildPgConfig(process.env.DATABASE_SUPERUSER_URL || process.env.DATABASE_URL));
  try {
    const sql = fs.readFileSync('src/db/migrations/004_add_user_name.sql', 'utf8');
    await pool.query(sql);
    console.log('Migration 004 completed');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
