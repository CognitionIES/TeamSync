const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
require("dotenv").config(); // .env file

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Neon
  },
});

const users = [
  { name: "Admi", password: "admin123" },
  { name: "Project manager", password: "pm@234" },
  { name: "Utsav", password: "utsav#456" },
  { name: "name1", password: "password123" },
  { name: "name2", password: "password123" },
  { name: "name3", password: "password123" },
  { name: "name4", password: "password123" },
  { name: "name5", password: "password123" },
  { name: "DataEntryUser", password: "dataentry789" },
];

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

const updatePasswords = async () => {
  try {
    // Test database connection
    await pool.connect();
    console.log("Connected to Neon database");

    for (const user of users) {
      const hashedPassword = await hashPassword(user.password);
      const result = await pool.query(
        "UPDATE users SET password = $1 WHERE name = $2 RETURNING *",
        [hashedPassword, user.name]
      );
      if (result.rows.length > 0) {
        console.log(`Updated password for ${user.name}`);
      } else {
        console.log(`User ${user.name} not found in database`);
      }
    }
    console.log("All passwords updated successfully");
  } catch (error) {
    console.error("Error updating passwords:", error.stack);
  } finally {
    await pool.end();
  }
};

updatePasswords();
