require('dotenv').config();
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { buildPgConfig } = require('./src/db/connection');

async function run() {
  const pool = new Pool(buildPgConfig(process.env.DATABASE_SUPERUSER_URL || process.env.DATABASE_URL));
  
  const email = 'forgotemail169@gmail.com';
  const userRes = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  const user = userRes.rows[0];
  
  const taskRes = await pool.query("SELECT * FROM tasks WHERE title = 'asdf' LIMIT 1");
  const task = taskRes.rows[0];
  
  console.log("User:", user.id);
  console.log("Task:", task.id, "org_id:", task.org_id);
  
  // Create JWT with the task's orgId directly
  const token = jwt.sign({ sub: user.id, orgId: task.org_id }, process.env.JWT_SECRET);
  
  // Hit the patch endpoint
  const patchRes = await fetch(`http://localhost:3001/api/tasks/${task.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status: 'done' })
  });
  
  const patchData = await patchRes.json();
  console.log('Status:', patchRes.status, 'Response:', patchData);
  
  process.exit(0);
}
run();
