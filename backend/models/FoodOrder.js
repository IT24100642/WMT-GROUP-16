const mongoose = require('mongoose');

const FoodOrderSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
  },
  items: [
    {
      foodItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FoodItem',
        
      },
      quantity: {
        type: Number,
        
        min: 1,
      },
      price: {
        type: Number,
        
      },
    },
  ],
  totalPrice: {
    type: Number,
    
  },
  status: {
    type: String,
    
    default: 'Pending',
  },
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { strict: false });

module.exports = mongoose.model('FoodOrder', FoodOrderSchema);
