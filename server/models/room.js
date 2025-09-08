const mongoose = require('mongoose');

const TimeSlotSchema = new mongoose.Schema({
  day: {
    type: String,
    required: true,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['confirmed', 'pending', 'conflict'],
    default: 'confirmed'
  }
});

const RequestSchema = new mongoose.Schema({
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['time_request', 'time_change', 'time_swap'],
    required: true
  },
  timeSlot: {
    day: String,
    startTime: String,
    endTime: String,
    subject: String
  },
  targetSlot: TimeSlotSchema, // For swap requests
  message: String,
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const RoomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    color: {
      type: String,
      default: function() {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
        return colors[Math.floor(Math.random() * colors.length)];
      }
    }
  }],
  inviteCode: {
    type: String,
    unique: true,
    required: true
  },
  maxMembers: {
    type: Number,
    default: 10,
    min: 2,
    max: 20
  },
  timeSlots: [TimeSlotSchema],
  requests: [RequestSchema],
  settings: {
    startHour: {
      type: Number,
      default: 9,
      min: 0,
      max: 23
    },
    endHour: {
      type: Number,
      default: 18,
      min: 1,
      max: 24
    },
    blockedTimes: [{
      name: {
        type: String,
        required: true
      },
      startTime: {
        type: String,
        required: true
      },
      endTime: {
        type: String,
        required: true
      }
    }],
    // Legacy support - keep lunchBreak for backward compatibility
    lunchBreak: {
      enabled: {
        type: Boolean,
        default: false
      },
      startTime: {
        type: String,
        default: '12:00'
      },
      endTime: {
        type: String,
        default: '13:00'
      }
    }
  }
}, {
  timestamps: true
});

// Generate unique invite code before saving
RoomSchema.pre('save', function(next) {
  if (!this.inviteCode) {
    this.inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  next();
});

// Add owner as first member when room is created
RoomSchema.pre('save', function(next) {
  if (this.isNew && this.members.length === 0) {
    this.members.push({ user: this.owner });
  }
  next();
});

// Virtual for member count
RoomSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

// Check if user is room owner
RoomSchema.methods.isOwner = function(userId) {
  return this.owner.toString() === userId.toString();
};

// Check if user is room member
RoomSchema.methods.isMember = function(userId) {
  return this.members.some(member => member.user.toString() === userId.toString());
};

// Get user's color in the room
RoomSchema.methods.getUserColor = function(userId) {
  const member = this.members.find(member => member.user.toString() === userId.toString());
  return member ? member.color : null;
};

module.exports = mongoose.model('Room', RoomSchema);