require("dotenv").config(); // <-- Add this line
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: String(process.env.DB_PASSWORD), // Explicitly cast to string
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
