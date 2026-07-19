require('dotenv').config();
const { Pool } = require('pg');
async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  const taskRes = await pool.query("SELECT * FROM tasks");
  console.log("Tasks:", taskRes.rows);
  process.exit(0);
}
run();
