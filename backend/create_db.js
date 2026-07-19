const { Client } = require('pg');

async function createDb() {
  const client = new Client({
    connectionString: 'postgres://postgres:root@localhost:5432/postgres'
  });

  try {
    await client.connect();
    await client.query('CREATE DATABASE teamflow');
    console.log('Database teamflow created successfully');
  } catch (err) {
    console.error('Error creating database:', err);
  } finally {
    await client.end();
  }
}

createDb();
