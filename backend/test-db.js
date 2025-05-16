require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
async function testConnection() {
  try {
    const result = await sql`SELECT version()`;
    console.log('Connected to Neon:', result[0]);
  } catch (error) {
    console.error('Connection error:', error);
  }
}
testConnection();