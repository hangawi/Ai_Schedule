const mongoose = require('mongoose');

const TimeSlotSchema = new mongoose.Schema({
  day: {
    type: String,
    required: true,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  },
  date: {
    type: Date,
    required: true
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
    enum: ['time_request', 'time_change', 'time_swap', 'slot_swap', 'slot_release'],
    required: true
  },
  timeSlot: {
    day: String,
    startTime: String,
    endTime: String,
    subject: String
  },
  targetSlot: TimeSlotSchema, // For swap requests
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
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
      default: '#6B7280' // 기본 회색, 실제 색상은 방에 참가할 때 동적으로 할당
    },
    carryOver: {
      type: Number,
      default: 0
    },
    carryOverHistory: [{
      week: Date,
      amount: Number,
      reason: String, // 'unassigned', 'negotiation_rejected', etc.
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    totalProgressTime: {
      type: Number,
      default: 0
    },
    priority: {
      type: Number,
      default: 3,
      min: 1,
      max: 5
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
  negotiations: [{
    slotInfo: {
      day: String,
      startTime: String,
      endTime: String,
      date: Date
    },
    conflictingMembers: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      priority: Number
    }],
    messages: [{
      from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      message: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    status: {
      type: String,
      enum: ['active', 'resolved'],
      default: 'active'
    },
    resolution: {
      assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      resolvedAt: Date
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
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
    blockedTimes: [{ // For daily recurring blocked times (e.g., lunch break)
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
    roomExceptions: [{ // New field for owner-synced or other specific exceptions
      type: { type: String, enum: ['daily_recurring', 'date_specific'], required: true },
      name: { type: String, required: true },
      // For daily_recurring (from defaultSchedule)
      dayOfWeek: { type: Number, min: 0, max: 6 }, // 0: Sunday, ..., 6: Saturday
      startTime: { type: String, required: true }, // HH:MM
      endTime: { type: String, required: true },   // HH:MM
      // For date_specific (from scheduleExceptions)
      startDate: { type: Date },
      endDate: { type: Date }
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
    },
    ownerPreferences: {
      focusTimeType: {
        type: String,
        enum: ['morning', 'lunch', 'afternoon', 'evening', 'none'],
        default: 'none'
      },
      description: {
        type: String,
        default: ''
      },
      preferredStartTime: {
        type: String,
        default: null
      },
      preferredEndTime: {
        type: String,
        default: null
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
    this.members.push({ 
      user: this.owner,
      color: '#DC2626' // 방장은 항상 진한 빨간색으로 구분
    });
  }
  next();
});

// Virtual for member count
RoomSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

// Check if user is room owner
RoomSchema.methods.isOwner = function(userId) {
  if (!userId) return false;
  // Handle both populated and non-populated owner field
  const ownerId = this.owner._id ? this.owner._id.toString() : this.owner.toString();
  return ownerId === userId.toString();
};

// Check if user is room member
RoomSchema.methods.isMember = function(userId) {
  return this.members.some(member => {
    const memberUserId = member.user._id ? member.user._id.toString() : member.user.toString();
    return memberUserId === userId.toString();
  });
};

// Get user's color in the room
RoomSchema.methods.getUserColor = function(userId) {
  const member = this.members.find(member => member.user.toString() === userId.toString());
  return member ? member.color : null;
};

module.exports = mongoose.model('Room', RoomSchema);