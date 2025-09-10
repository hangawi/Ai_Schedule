const mongoose = require('mongoose');

const CoordinationRequestSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CoordinationRoom',
    required: true,
    index: true
  },
  requesterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Type of request: 'conflict' for resolving a double-booking, 'booking' for requesting master's time
  requestType: {
    type: String,
    enum: ['conflict', 'booking'],
    required: true
  },
  // The slot being requested
  requestedSlot: {
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true }
  },
  // For conflict requests, this is the user who already has the slot
  conflictingUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  // Message from the requester
  message: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

module.exports = mongoose.model('CoordinationRequest', CoordinationRequestSchema);
