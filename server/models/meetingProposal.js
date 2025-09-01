const mongoose = require('mongoose');

const MeetingProposalSchema = new mongoose.Schema({
  initiatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: String,
  duration: Number,
  preferredTimeRanges: [{
    start: Date,
    end: Date,
  }],
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  externalParticipants: [{
    email: String,
    name: String,
  }],
  status: String, // e.g., 'pending', 'finalized', 'cancelled'
  suggestedTimes: [{
    startTime: Date,
    score: Number,
    conflicts: [{
      userId: mongoose.Schema.Types.ObjectId,
      eventId: mongoose.Schema.Types.ObjectId,
    }],
  }],
  finalizedTime: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('MeetingProposal', MeetingProposalSchema);