const Room = require('../models/Room');
const Offer = require('../models/Offer');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const FoodItem = require('../models/FoodItem');
const FoodOrder = require('../models/FoodOrder');
const User = require('../models/User');

// Rooms
exports.getRooms = async (req, res) => {
  try {
    const rooms = await Room.find();
    res.status(200).json(rooms);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.getRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.status(200).json(room);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.addRoomPhoto = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    room.photos.push(req.body.url);
    await room.save();
    res.status(200).json(room);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.updateRoom = async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.status(200).json(room);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Offers
exports.getOffers = async (req, res) => {
  try {
    const offers = await Offer.find();
    res.status(200).json(offers);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.createOffer = async (req, res) => {
  try {
    const offer = await Offer.create(req.body);
    res.status(201).json(offer);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.updateOffer = async (req, res) => {
  try {
    const offer = await Offer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!offer) return res.status(404).json({ error: 'Offer not found' });
    res.status(200).json(offer);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteOffer = async (req, res) => {
  try {
    await Offer.findByIdAndDelete(req.params.id);
    res.status(200).json({});
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

// Reviews
exports.getReviews = async (req, res) => {
  try {
    const reviews = await Review.find().populate('customerId', 'name');
    res.status(200).json(reviews);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.getReviewAnalytics = async (req, res) => {
  try {
    // Simple analytics placeholder
    const total = await Review.countDocuments();
    res.status(200).json({ totalReviews: total });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.deleteReview = async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.status(200).json({});
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.updateReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.status(200).json(review);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Bookings
exports.getBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('customerId', 'name')
      .populate('roomId', 'roomNumber')
      .populate('offerId', 'title');
    res.status(200).json(bookings);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.rejectCancellation = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status: 'Confirmed' }, { new: true });
    res.status(200).json(booking);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.approveCancellation = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    res.status(200).json({});
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

// Kitchen
exports.getFoodItems = async (req, res) => {
  try {
    const foodItems = await FoodItem.find();
    res.status(200).json(foodItems);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.createFoodItem = async (req, res) => {
  try {
    const foodItem = await FoodItem.create(req.body);
    res.status(201).json(foodItem);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.deleteFoodItem = async (req, res) => {
  try {
    await FoodItem.findByIdAndDelete(req.params.id);
    res.status(200).json({});
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.updateFoodItem = async (req, res) => {
  try {
    const foodItem = await FoodItem.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!foodItem) return res.status(404).json({ error: 'Food item not found' });
    res.status(200).json(foodItem);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getFoodOrders = async (req, res) => {
  try {
    const foodOrders = await FoodOrder.find().populate('customerId', 'name').populate('roomId', 'roomNumber');
    res.status(200).json(foodOrders);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.updateFoodOrder = async (req, res) => {
  try {
    const foodOrder = await FoodOrder.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!foodOrder) return res.status(404).json({ error: 'Food order not found' });
    res.status(200).json(foodOrder);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Customers
exports.getCustomers = async (req, res) => {
  try {
    const customers = await User.find({ role: 'customer' });
    res.status(200).json(customers);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.getCustomerDetails = async (req, res) => {
  try {
    const customer = await User.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    
    // Fetch bookings associated with the customer
    const bookings = await Booking.find({ customerId: req.params.id }).populate('roomId', 'roomNumber');
    
    // As Issue and Invoice models don't exist yet, we mock them as empty arrays
    res.status(200).json({
      customer,
      bookings,
      issues: [],
      notifications: [],
      invoices: { grandTotal: 0 }
    });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.addLoyaltyPoints = async (req, res) => {
  try {
    const customer = await User.findById(req.params.id);
    customer.loyaltyPoints = (customer.loyaltyPoints || 0) + (req.body.pointsDelta || req.body.points || 0);
    await customer.save();
    res.status(200).json(customer);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.deletePreferences = async (req, res) => {
  try {
    const customer = await User.findByIdAndUpdate(req.params.id, { 
      preferences: [],
      preferredRoomType: '',
      preferredFood: ''
    }, { new: true });
    res.status(200).json(customer);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.deleteCustomer = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({});
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.updateCustomer = async (req, res) => {
  try {
    const update = { ...req.body };
    delete update.password;
    delete update.role;
    const customer = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'customer' },
      update,
      { new: true, runValidators: true }
    );
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.status(200).json(customer);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
