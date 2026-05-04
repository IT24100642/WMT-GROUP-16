const User = require('../models/User');
const jwt = require('jsonwebtoken');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const FoodOrder = require('../models/FoodOrder');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

exports.registerCustomer = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: 'customer',
    });

    res.status(201).json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        loyaltyPoints: user.loyaltyPoints,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.loginCustomer = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    const user = await User.findOne({ email, role: 'customer' }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.status(200).json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        loyaltyPoints: user.loyaltyPoints,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const allowed = {};
    if (req.body?.name !== undefined) allowed.name = String(req.body.name || '').trim();
    if (req.body?.phone !== undefined) allowed.phone = String(req.body.phone || '').trim();
    if (req.body?.email !== undefined) allowed.email = String(req.body.email || '').trim().toLowerCase();

    if (allowed.email) {
      const exists = await User.findOne({ email: allowed.email, _id: { $ne: req.user.id } });
      if (exists) {
        return res.status(400).json({ error: 'Email already in use' });
      }
    }

    const user = await User.findByIdAndUpdate(req.user.id, allowed, {
      new: true,
      runValidators: true,
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteMe = async (req, res) => {
  try {
    const userId = req.user.id;

    await Promise.all([
      Booking.deleteMany({ customerId: userId }),
      Review.deleteMany({ customerId: userId }),
      FoodOrder.deleteMany({ customerId: userId }),
      User.findByIdAndDelete(userId),
    ]);

    res.status(200).json({});
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
