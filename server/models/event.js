const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true, // 검색 성능 향상을 위한 인덱스
  },
  title: {
    type: String,
    required: [true, '일정 제목은 필수입니다.'],
    trim: true,
    maxlength: [200, '제목은 200자를 초과할 수 없습니다.']
  },
  description: {
    type: String,
    default: '',
    trim: true,
    maxlength: [1000, '설명은 1000자를 초과할 수 없습니다.']
  },
  color: {
    type: String,
    default: 'blue',
    trim: true
  },
  startTime: {
    type: Date,
    required: [true, '시작 시간은 필수입니다.'],
    index: true, // 날짜 기반 검색을 위한 인덱스
  },
  endTime: {
    type: Date,
    required: [true, '종료 시간은 필수입니다.'],
    validate: {
      validator: function(endTime) {
        return endTime > this.startTime;
      },
      message: '종료 시간은 시작 시간보다 늦어야 합니다.'
    }
  },
  priority: {
    type: Number,
    default: 3,
    min: [1, '우선순위는 1 이상이어야 합니다.'],
    max: [5, '우선순위는 5 이하여야 합니다.'],
    index: true // 우선순위 기반 정렬을 위한 인덱스
  },
  category: {
    type: String,
    default: 'general',
    enum: {
      values: ['general', 'meeting', 'personal', 'work', 'social', 'health', 'education'],
      message: '유효하지 않은 카테고리입니다.'
    },
    lowercase: true,
    trim: true
  },
  isFlexible: {
    type: Boolean,
    default: false
  },
  flexibilityWindow: {
    before: {
      type: Number,
      default: 0,
      min: [0, '유연성 시간은 0 이상이어야 합니다.'],
      max: [1440, '유연성 시간은 24시간(1440분)을 초과할 수 없습니다.'] // 최대 24시간
    },
    after: {
      type: Number,
      default: 0,
      min: [0, '유연성 시간은 0 이상이어야 합니다.'],
      max: [1440, '유연성 시간은 24시간(1440분)을 초과할 수 없습니다.'] // 최대 24시간
    }
  },
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'accepted', 'declined', 'tentative'],
        message: '유효하지 않은 참석 상태입니다.'
      },
      default: 'pending'
    },
    responseTime: {
      type: Date,
      default: null
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  externalParticipants: [{
    email: {
      type: String,
      required: [true, '외부 참석자 이메일은 필수입니다.'],
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, '유효한 이메일 주소를 입력해주세요.']
    },
    name: {
      type: String,
      trim: true,
      maxlength: [100, '이름은 100자를 초과할 수 없습니다.']
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'accepted', 'declined', 'tentative'],
        message: '유효하지 않은 참석 상태입니다.'
      },
      default: 'pending'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  sourceCalendarId: {
    type: String,
    trim: true
  },
  externalEventId: {
    type: String,
    trim: true
  },
  // 반복 일정 관련 필드 추가
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurrenceRule: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
      default: null
    },
    interval: {
      type: Number,
      min: 1,
      default: 1
    },
    endDate: {
      type: Date,
      default: null
    },
    occurrences: {
      type: Number,
      min: 1,
      default: null
    }
  },
  // 알림 설정
  reminders: [{
    method: {
      type: String,
      enum: ['email', 'popup', 'sms'],
      default: 'popup'
    },
    minutesBefore: {
      type: Number,
      min: 0,
      default: 15
    }
  }],
  // 상태 관리
  status: {
    type: String,
    enum: {
      values: ['draft', 'confirmed', 'cancelled', 'completed'],
      message: '유효하지 않은 일정 상태입니다.'
    },
    default: 'confirmed'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true // 생성 후 변경 불가
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  // 스키마 옵션
  timestamps: true, // createdAt, updatedAt 자동 관리
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // _id를 id로 변환하고 __v 제거
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// 가상 필드: 일정 지속 시간 (분 단위)
EventSchema.virtual('durationInMinutes').get(function() {
  if (this.startTime && this.endTime) {
    return Math.round((this.endTime - this.startTime) / (1000 * 60));
  }
  return 0;
});

// 가상 필드: 전체 참석자 수
EventSchema.virtual('totalParticipants').get(function() {
  return (this.participants?.length || 0) + (this.externalParticipants?.length || 0);
});

// 가상 필드: 확정된 참석자 수
EventSchema.virtual('confirmedParticipants').get(function() {
  const internalConfirmed = this.participants?.filter(p => p.status === 'accepted').length || 0;
  const externalConfirmed = this.externalParticipants?.filter(p => p.status === 'accepted').length || 0;
  return internalConfirmed + externalConfirmed;
});

// 가상 필드: 일정이 지났는지 확인
EventSchema.virtual('isPast').get(function() {
  return new Date() > this.endTime;
});

// 가상 필드: 일정이 진행 중인지 확인
EventSchema.virtual('isOngoing').get(function() {
  const now = new Date();
  return now >= this.startTime && now <= this.endTime;
});

// 인덱스 설정
EventSchema.index({ userId: 1, startTime: 1 }); // 사용자별 시간순 조회
EventSchema.index({ startTime: 1, endTime: 1 }); // 시간 범위 검색
EventSchema.index({ priority: -1, startTime: 1 }); // 우선순위별 정렬
EventSchema.index({ category: 1, startTime: 1 }); // 카테고리별 조회
EventSchema.index({ status: 1 }); // 상태별 조회

// 업데이트 시 updatedAt 자동 갱신 (timestamps: true가 있어서 불필요하지만 명시적으로 유지)
EventSchema.pre('save', function(next) {
  if (!this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// 업데이트 시 updatedAt 자동 갱신 (findOneAndUpdate 등)
EventSchema.pre(['updateOne', 'findOneAndUpdate'], function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

// 저장 전 유효성 검증
EventSchema.pre('save', function(next) {
  // 유연한 일정의 경우 flexibilityWindow 확인
  if (this.isFlexible && this.flexibilityWindow.before === 0 && this.flexibilityWindow.after === 0) {
    return next(new Error('유연한 일정은 최소한 한 방향으로는 유연성 시간이 설정되어야 합니다.'));
  }
  
  // 반복 일정의 경우 규칙 확인
  if (this.isRecurring && !this.recurrenceRule.frequency) {
    return next(new Error('반복 일정은 반복 빈도가 설정되어야 합니다.'));
  }
  
  next();
});

// 스태틱 메서드: 특정 기간 내 일정 조회
EventSchema.statics.findByDateRange = function(userId, startDate, endDate) {
  return this.find({
    userId: userId,
    $or: [
      { startTime: { $gte: startDate, $lte: endDate } },
      { endTime: { $gte: startDate, $lte: endDate } },
      { startTime: { $lte: startDate }, endTime: { $gte: endDate } }
    ]
  }).sort({ startTime: 1 });
};

// 스태틱 메서드: 충돌하는 일정 찾기
EventSchema.statics.findConflicting = function(userId, startTime, endTime, excludeEventId = null) {
  const query = {
    userId: userId,
    status: { $ne: 'cancelled' },
    $or: [
      { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
    ]
  };
  
  if (excludeEventId) {
    query._id = { $ne: excludeEventId };
  }
  
  return this.find(query);
};

// 인스턴스 메서드: 참석자 추가
EventSchema.methods.addParticipant = function(userId, isExternal = false, email = null, name = null) {
  if (isExternal) {
    if (!email) throw new Error('외부 참석자는 이메일이 필요합니다.');
    
    const existingExternal = this.externalParticipants.find(p => p.email === email);
    if (existingExternal) throw new Error('이미 추가된 외부 참석자입니다.');
    
    this.externalParticipants.push({ email, name, status: 'pending' });
  } else {
    const existingInternal = this.participants.find(p => p.userId.toString() === userId.toString());
    if (existingInternal) throw new Error('이미 추가된 참석자입니다.');
    
    this.participants.push({ userId, status: 'pending' });
  }
  
  return this.save();
};

// 인스턴스 메서드: 참석 상태 업데이트
EventSchema.methods.updateParticipantStatus = function(participantId, status, isExternal = false) {
  if (isExternal) {
    const participant = this.externalParticipants.id(participantId);
    if (!participant) throw new Error('참석자를 찾을 수 없습니다.');
    participant.status = status;
    participant.responseTime = new Date();
  } else {
    const participant = this.participants.find(p => p.userId.toString() === participantId.toString());
    if (!participant) throw new Error('참석자를 찾을 수 없습니다.');
    participant.status = status;
    participant.responseTime = new Date();
  }
  
  return this.save();
};

module.exports = mongoose.model('Event', EventSchema);