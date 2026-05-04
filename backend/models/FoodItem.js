const mongoose = require('mongoose');

const FoodItemSchema = new mongoose.Schema({
  name: {
    type: String,
    
  },
  description: String,
  price: {
    type: Number,
    
  },
  category: {
    type: String,
    
  },
  available: {
    type: Boolean,
    default: true,
  },
  image: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { strict: false });

module.exports = mongoose.model('FoodItem', FoodItemSchema);
