const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    
  },
  checkInDate: {
    type: Date,
    
  },
  checkOutDate: {
    type: Date,
    
  },
  totalPrice: {
    type: Number,
    
  },
  status: {
    type: String,
    
    default: 'Pending',
  },
  paymentStatus: {
    type: String,
    
    default: 'Pending',
  },
  specialRequests: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { strict: false });

module.exports = mongoose.model('Booking', BookingSchema);
