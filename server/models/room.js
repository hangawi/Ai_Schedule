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
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  assignedAt: {
    type: Date,
    required: false
  },
  priority: {
    type: Number,
    default: 3
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
    enum: ['time_request', 'time_change', 'time_swap', 'slot_swap', 'slot_release', 'exchange_request', 'chain_exchange_request', 'chain_request'],
    required: true
  },
  timeSlot: {
    day: String,
    date: Date,
    startTime: String,
    endTime: String,
    subject: String,
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  targetSlot: TimeSlotSchema, // For swap requests
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  // Exchange request specific fields
  requesterSlots: [TimeSlotSchema], // A's current slots (block)
  desiredDay: String, // e.g., 'wednesday'
  desiredTime: String, // e.g., '14:00' (optional)
  message: String,
  // Chain exchange request fields (A → B → C)
  chainData: {
    originalRequestId: { type: mongoose.Schema.Types.ObjectId }, // 원본 요청 ID
    originalRequester: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // A
    intermediateUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // B
    chainUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // C (현재 요청 대상)
    intermediateSlot: TimeSlotSchema, // B의 원래 자리 (A가 원하는 자리)
    chainSlot: TimeSlotSchema, // C의 자리 (B가 이동할 자리)
    rejectedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // 거절한 사용자들
    candidateUsers: [{ // 아직 요청하지 않은 후보들
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      slot: TimeSlotSchema,
      date: Date
    }],
    // 🆕 needs_chain_confirmation 상태에서 사용 (요청자에게 연쇄 조정 확인용)
    firstCandidate: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      userName: String,
      slot: TimeSlotSchema
    },
    // ★ C의 원래 슬롯 저장 (chain 실패 시 복원용)
    requesterOriginalSlots: [TimeSlotSchema],
    // ★ B의 원래 슬롯 저장 (chain 성공 시 삭제용)
    intermediateOriginalSlots: [TimeSlotSchema],
    // 🆕 chain_request 타입에서 사용
    originalRequest: { type: mongoose.Schema.Types.ObjectId }
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled', 'needs_chain_confirmation', 'waiting_for_chain', 'chain_request'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  respondedAt: {
    type: Date
  },
  respondedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  response: {
    type: String
  }
});;

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
    default: 100,
    min: 2,
    max: 100
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
    },
    minHoursPerWeek: {
      type: Number,
      default: 3,
      min: 1,
      max: 10
    }
  },
  // 로그 초기화 시점 - 방장과 관리자 각각 저장
  logsClearedAt: {
    owner: {
      type: Date,
      default: null
    },
    admin: {
      type: Date,
      default: null
    }
  },
  // 멤버별 로그 초기화 시점 - 방장과 관리자 각각 저장
  memberLogsClearedAt: {
    owner: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    admin: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
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
  try {
    if (this.isNew && this.members.length === 0) {
      const { OWNER_COLOR } = require('../utils/colorUtils');
      this.members.push({
        user: this.owner,
        color: OWNER_COLOR // 방장은 항상 고정된 색상으로 구분
      });
    }
    next();
  } catch (error) {
    next(error);
  }
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

module.exports = mongoose.models.Room || mongoose.model('Room', RoomSchema);