const mongoose = require('mongoose');

const TimeSlotSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CoordinationRoom',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
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

// Ensure a user cannot have overlapping slots in the same room
TimeSlotSchema.index({ roomId: 1, userId: 1, startTime: 1, endTime: 1 });

module.exports = mongoose.model('TimeSlot', TimeSlotSchema);
