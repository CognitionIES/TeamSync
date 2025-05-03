const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'TeamSync',
  user: 'postgres',
  password: 'hello554',
});

const users = [
  { name: 'Admi', password: 'admin123' },
  { name: 'Project manager', password: 'pm@234' },
  { name: 'Utsav', password: 'utsav#456' },
  { name: 'name1', password: 'password123' },
  { name: 'name2', password: 'password123' },
  { name: 'name3', password: 'password123' },
  { name: 'name4', password: 'password123' },
  { name: 'name5', password: 'password123' },
  { name: 'DataEntryUser', password: 'dataentry789' },
];

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

const updatePasswords = async () => {
  try {
    for (const user of users) {
      const hashedPassword = await hashPassword(user.password);
      await pool.query(
        'UPDATE users SET password = $1 WHERE name = $2',
        [hashedPassword, user.name]
      );
      console.log(`Updated password for ${user.name}`);
    }
    console.log('All passwords updated successfully');
  } catch (error) {
    console.error('Error updating passwords:', error);
  } finally {
    await pool.end();
  }
};

updatePasswords();