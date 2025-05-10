// test-db.js - Simple database connection test for troubleshooting
require('dotenv').config({ path: __dirname + '/.env' });
const mysql = require('mysql2/promise');

async function testDBConnection() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      port: process.env.DB_PORT || 3306
    });
    console.log('✅ Successfully connected to database:', process.env.DB_DATABASE);
    const [rows] = await connection.query('SELECT NOW() as now');
    console.log('Sample query result:', rows);
    await connection.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    console.error('Connection details:', {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      database: process.env.DB_DATABASE,
      port: process.env.DB_PORT,
      password: process.env.DB_PASSWORD
    });
    process.exit(1);
  }
}

testDBConnection();
