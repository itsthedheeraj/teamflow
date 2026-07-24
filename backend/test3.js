require('dotenv').config();
const { Pool } = require('pg');
const { buildPgConfig } = require('./src/db/connection');
async function run() {
  const pool = new Pool(buildPgConfig(process.env.DATABASE_URL));
  const taskRes = await pool.query("SELECT * FROM tasks");
  console.log("Tasks:", taskRes.rows);
  process.exit(0);
}
run();
