const Booking = require('../models/Booking');
const FoodOrder = require('../models/FoodOrder');
const Review = require('../models/Review');

exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ customerId: req.user.id }).populate('roomId');
    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createBooking = async (req, res) => {
  try {
    const booking = await Booking.create({
      ...req.body,
      customerId: req.user.id,
      // Map checkIn/checkOut from frontend to checkInDate/checkOutDate to satisfy Mongoose validation if it exists
      checkInDate: req.body.checkIn || req.body.checkInDate,
      checkOutDate: req.body.checkOut || req.body.checkOutDate,
    });
    res.status(201).json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

exports.updateBooking = async (req, res) => {
  try {
    let booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    
    if (booking.customerId.toString() !== req.user.id) {
      return res.status(401).json({ error: 'Not authorized' });
    }

    booking = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.status(200).json(booking);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    let booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    
    if (booking.customerId.toString() !== req.user.id) {
      return res.status(401).json({ error: 'Not authorized' });
    }

    booking = await Booking.findByIdAndDelete(req.params.id);
    res.status(200).json({});
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createFoodOrder = async (req, res) => {
  try {
    const order = await FoodOrder.create({
      ...req.body,
      customerId: req.user.id,
      items: req.body.items || req.body.lines,
    });
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

exports.createReview = async (req, res) => {
  try {
    const { rating, comment, text, reviewerName } = req.body;
    const review = await Review.create({
      ...req.body,
      customerId: req.user.id,
      rating,
      comment: comment || text,
      text: text || comment,
      reviewerName,
    });
    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ error: 'Review not found' });
    
    if (review.customerId.toString() !== req.user.id) {
      return res.status(401).json({ error: 'Not authorized' });
    }

    await review.deleteOne();
    res.status(200).json({});
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// @route   PATCH /api/customer-auth/reviews/:id
exports.updateReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    if (review.customerId.toString() !== req.user.id) {
      return res.status(401).json({ error: 'Not authorized' });
    }

    const allowed = {};
    if (req.body.rating !== undefined) allowed.rating = req.body.rating;
    if (req.body.comment !== undefined) {
      allowed.comment = req.body.comment;
      allowed.text = req.body.comment;
    }
    if (req.body.text !== undefined) {
      allowed.text = req.body.text;
      allowed.comment = req.body.text;
    }
    if (req.body.reviewerName !== undefined) allowed.reviewerName = req.body.reviewerName;

    const updated = await Review.findByIdAndUpdate(req.params.id, allowed, {
      new: true,
      runValidators: true,
    });
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Compatibility endpoints used by some frontend screens
exports.updateBookingCompat = (req, res) => exports.updateBooking(req, res);
