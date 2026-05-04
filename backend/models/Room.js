const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    
    unique: true,
  },
  type: {
    type: String,
    
    
  },
  price: {
    type: Number,
    
  },
  status: {
    type: String,
    
    default: 'Available',
  },
  description: String,
  amenities: [String],
  photos: [String],
  capacity: {
    type: Number,
    default: 2,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { strict: false });

module.exports = mongoose.model('Room', RoomSchema);
