const Room = require('../models/Room');
const FoodItem = require('../models/FoodItem');
const Review = require('../models/Review');
const Offer = require('../models/Offer');

exports.getRooms = async (req, res) => {
  try {
    const rooms = await Room.find();
    res.status(200).json(rooms);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getFoodItems = async (req, res) => {
  try {
    const foodItems = await FoodItem.find();
    res.status(200).json(foodItems);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getReviews = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const reviews = await Review.find({ status: { $ne: 'removed' } }).populate('customerId', 'name').limit(limit).sort('-createdAt');
    
    const formattedReviews = reviews.map(r => ({
      ...r._doc,
      id: r._id,
      customerName: r.customerId ? r.customerId.name : 'Anonymous'
    }));

    res.status(200).json(formattedReviews);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getOffers = async (req, res) => {
  try {
    const offers = await Offer.find({ $nor: [{ isActive: false }, { active: false }] });
    const formatted = offers.map(o => {
      const doc = o.toObject ? o.toObject() : o;
      return {
        ...doc,
        rooms: doc.rooms || doc.roomIds || []
      };
    });
    res.status(200).json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
