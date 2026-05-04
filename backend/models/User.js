const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    
  },
  username: {
    type: String,
    unique: true,
    sparse: true,
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email',
    ],
  },
  password: {
    type: String,
    
    select: false,
  },
  role: {
    type: String,
    
    default: 'customer',
  },
  // Staff specific
  roleName: {
    type: String, // e.g., 'Room Manager', 'Kitchen Manager', etc.
  },
  // Customer specific
  loyaltyPoints: {
    type: Number,
    default: 0,
  },
  preferences: {
    type: [String],
    default: [],
  },
  phone: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { strict: false });

// Encrypt password using bcrypt
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
