const mongoose = require('mongoose');

const ShiftSchema = new mongoose.Schema({
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  roleName: {
    type: String,
    
  },
  startAt: {
    type: Date,
    
  },
  endAt: {
    type: Date,
    
  },
  label: {
    type: String,
    default: '',
  },
  notes: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { strict: false });

module.exports = mongoose.model('Shift', ShiftSchema);
