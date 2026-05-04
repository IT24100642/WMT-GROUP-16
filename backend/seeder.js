const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const importData = async () => {
  try {
    await User.deleteMany();

    const admin = await User.create({
      name: 'Admin User',
      username: 'admin',
      email: 'admin@hotel.com',
      password: 'password123',
      role: 'admin',
    });

    const staff1 = await User.create({
      name: 'John Receptionist',
      username: 'john_reception',
      email: 'john@hotel.com',
      password: 'password123',
      role: 'staff',
      roleName: 'Receptionist',
    });

    const staff2 = await User.create({
      name: 'Jane Manager',
      username: 'jane_kitchen',
      email: 'jane@hotel.com',
      password: 'password123',
      role: 'staff',
      roleName: 'Kitchen Manager',
    });

    console.log('Data Imported!');
    process.exit();
  } catch (error) {
    console.error(`Error with data import: ${error}`);
    process.exit(1);
  }
};

importData();
