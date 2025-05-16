require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Neon
  },
  max: 5, // Limit connections for Vercel's serverless environment
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 2000, // Timeout for acquiring connections
});

const connectDB = async () => {
  try {
    await pool.connect();
    console.log("Database connected successfully");
    return true;
  } catch (error) {
    console.error("Database connection error:", error);
    throw error;
  }
};

module.exports = {
  pool,
  connectDB,
  query: (text, params) => pool.query(text, params),
};
