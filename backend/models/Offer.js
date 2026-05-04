const mongoose = require('mongoose');

const OfferSchema = new mongoose.Schema({
  title: {
    type: String,
    
  },
  description: {
    type: String,
    
  },
  discountPercentage: {
    type: Number,
  },
  validFrom: {
    type: Date,
  },
  validUntil: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { strict: false });

module.exports = mongoose.model('Offer', OfferSchema);
