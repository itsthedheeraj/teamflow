require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_SUPERUSER_URL });
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
