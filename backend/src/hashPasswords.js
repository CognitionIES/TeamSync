// const bcrypt = require("bcryptjs");
// const { Pool } = require("pg");
// require("dotenv").config(); // .env file

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: {
//     rejectUnauthorized: false, // Required for Neon
//   },
// });

// const users = [
//   { name: "Admi", password: "admin123" },
//   { name: "Project manager", password: "pm@234" },
//   { name: "Utsav", password: "utsav#456" },
//   { name: "name1", password: "password123" },
//   { name: "name2", password: "password123" },
//   { name: "name3", password: "password123" },
//   { name: "name4", password: "password123" },
//   { name: "name5", password: "password123" },
//   { name: "DataEntryUser", password: "dataentry789" },
// ];

// const hashPassword = async (password) => {
//   const salt = await bcrypt.genSalt(10);
//   return await bcrypt.hash(password, salt);
// };

// const updatePasswords = async () => {
//   try {
//     // Test database connection
//     await pool.connect();
//     console.log("Connected to Neon database");

//     for (const user of users) {
//       const hashedPassword = await hashPassword(user.password);
//       const result = await pool.query(
//         "UPDATE users SET password = $1 WHERE name = $2 RETURNING *",
//         [hashedPassword, user.name]
//       );
//       if (result.rows.length > 0) {
//         console.log(`Updated password for ${user.name}`);
//       } else {
//         console.log(`User ${user.name} not found in database`);
//       }
//     }
//     console.log("All passwords updated successfully");
//   } catch (error) {
//     console.error("Error updating passwords:", error.stack);
//   } finally {
//     await pool.end();
//   }
// };

// updatePasswords();

const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Updated users array - add your new member names here
const newUsers = [
  // Add your new member names here with password "password123"
  { name: "Dhruvil Shah", password: "password123" },
  { name: "Dhrumil", password: "password123" },
  { name: "Shivam Makwana", password: "password123" },
  { name: "Dhruvil", password: "password123" },
  { name: "Meet Sura", password: "password123" },
  { name: "Dhruval", password: "password123" },
  { name: "Rudra Rana", password: "password123" },
  { name: "Yash Kharva", password: "password123" },
  { name: "Jaynil Nakkum", password: "password123" },
];

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

const insertNewUsers = async () => {
  try {
    await pool.connect();
    console.log("Connected to Neon database");

    for (const user of newUsers) {
      const hashedPassword = await hashPassword(user.password);

      // Check if user already exists
      const existingUser = await pool.query(
        "SELECT id FROM users WHERE name = $1",
        [user.name]
      );

      if (existingUser.rows.length === 0) {
        const result = await pool.query(
          "INSERT INTO users (name, password, role, is_active) VALUES ($1, $2, $3, $4) RETURNING *",
          [user.name, hashedPassword, 'Team Member', true]
        );
        console.log(`Added new user: ${user.name} (ID: ${result.rows[0].id})`);
      } else {
        console.log(`User ${user.name} already exists (ID: ${existingUser.rows[0].id})`);
      }
    }
    console.log("All new users processed successfully");
  } catch (error) {
    console.error("Error processing users:", error.stack);
  } finally {
    await pool.end();
  }
};

insertNewUsers();