const http = require('http');
const { buildPgConfig } = require('./src/db/connection');

async function run() {
  const email = 'forgotemail169@gmail.com';
  
  // Connect to DB directly to get a valid user token if we don't know password
  // Actually let's just query the DB for the task
  const { Pool } = require('pg');
  const pool = new Pool(buildPgConfig('postgresql://postgres:postgres@localhost:5432/teamflow'));
  
  const userRes = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  if (userRes.rows.length === 0) {
    console.log("User not found");
    return;
  }
  const user = userRes.rows[0];
  console.log("User:", user.id, user.email);
  
  const taskRes = await pool.query("SELECT * FROM tasks WHERE title = 'asdf'");
  const task = taskRes.rows[0];
  console.log("Task:", task.id, "Assigned to:", task.assigned_to);
  
  console.log("Is Assigned?", task.assigned_to === user.id);
  process.exit(0);
}
run();
