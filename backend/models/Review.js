const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    
  },
  comment: {
    type: String,
    
  },
  status: {
    type: String,
    
    default: 'Pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { strict: false });

module.exports = mongoose.model('Review', ReviewSchema);
