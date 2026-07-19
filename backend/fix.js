require('dotenv').config();
const { Pool } = require('pg');
const redis = require('./src/lib/redis');
const { syncTaskCount } = require('./src/services/meteringService');

async function fix() {
  await new Promise(r => setTimeout(r, 1000)); // wait for redis to connect
  const pool = new Pool({ connectionString: process.env.DATABASE_SUPERUSER_URL });
  try {
    const { rows } = await pool.query('SELECT id FROM organizations');
    for (const row of rows) {
      const orgId = row.id;
      const count = await syncTaskCount(orgId);
      console.log(`Org ${orgId} tasks: ${count}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
    redis.quit();
    process.exit(0);
  }
}

fix();
