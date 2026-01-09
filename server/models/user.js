/**
 * ===================================================================================================
 * User Model (사용자 모델)
 * ===================================================================================================
 *
 * 설명: MongoDB 사용자 스키마 정의
 *
 * 주요 기능:
 * - 사용자 기본 정보 (이름, 이메일, 비밀번호)
 * - 선호 시간표 (defaultSchedule) - 주별 반복 가능 시간
 * - 예외 일정 (scheduleExceptions) - 특정 날짜의 선호 시간
 * - 개인 시간 (personalTimes) - 수면, 식사, 출퇴근 등
 * - 연결된 캘린더 (Google Calendar 등)
 *
 * 관련 파일:
 * - server/routes/auth.js - 회원가입/로그인
 * - server/controllers/authController.js - 인증 로직
 *
 * ===================================================================================================
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true, // Allow null values and only enforce uniqueness on non-null values
    index: true
  },
  email: {
    type: String,
    required: [true, '이메일은 필수입니다.'],
    unique: true,
    lowercase: true, // 자동으로 소문자 변환
    trim: true,
    maxlength: [100, '이메일은 100자를 초과할 수 없습니다.'],
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      '유효한 이메일 주소를 입력해주세요.'
    ],
    
  },
  password: {
    type: String,
    required: [true, '비밀번호는 필수입니다.'],
    minlength: [6, '비밀번호는 최소 6자리 이상이어야 합니다.'],
    maxlength: [128, '비밀번호는 128자를 초과할 수 없습니다.'],
    select: false // 기본적으로 조회 시 제외
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  avatar: {
    type: String,
    default: null
  },
  name: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  addressLat: {
    type: Number,
    default: null
  },
  addressLng: {
    type: Number,
    default: null
  },
  addressPlaceId: {
    type: String,
    default: null
  },
  occupation: {
    type: String,
    default: ''
  },
  birthdate: {
    type: String,
    default: ''
  },
  preferences: {
    workHours: {
      start: {
        type: String,
        default: "09:00",
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, '유효한 시간 형식(HH:MM)이어야 합니다.']
      },
      end: {
        type: String,
        default: "17:00",
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, '유효한 시간 형식(HH:MM)이어야 합니다.']
      }
    },
    timezone: {
      type: String,
      default: 'Asia/Seoul'
    },
    defaultMeetingDuration: {
      type: Number,
      default: 60,
      min: [15, '기본 회의 시간은 최소 15분이어야 합니다.'],
      max: [480, '기본 회의 시간은 최대 8시간을 초과할 수 없습니다.']
    },
    language: {
      type: String,
      default: 'ko',
      enum: ['ko', 'en', 'ja', 'zh']
    },
    theme: {
      type: String,
      default: 'light',
      enum: ['light', 'dark', 'auto']
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      },
      summary: {
        type: String,
        default: 'daily',
        enum: ['immediate', 'daily', 'weekly', 'none']
      }
    }
  },
  // 계정 상태 관리
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending'],
    default: 'active'
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  },
  // 보안 관련
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    default: null
  },
  passwordResetToken: {
    type: String,
    default: null
  },
  passwordResetExpires: {
    type: Date,
    default: null
  },
  // 로그인 이력
  lastLoginAt: {
    type: Date,
    default: null
  },
  lastLogoutAt: {
    type: Date,
    default: null
  },
  loginCount: {
    type: Number,
    default: 0
  },
  // 연결된 캘린더 서비스
  connectedCalendars: [{
    provider: {
      type: String,
      enum: ['google', 'outlook', 'apple', 'exchange']
    },
    accountId: String,
    accessToken: {
      type: String,
      select: false // 보안상 기본 조회에서 제외
    },
    refreshToken: {
      type: String,
      select: false // 보안상 기본 조회에서 제외
    },
    expiresAt: Date,
    isActive: {
      type: Boolean,
      default: true
    },
    connectedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true // 생성 후 변경 불가
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  google: {
    id: String,
    accessToken: String,
    refreshToken: String,
  },

  // 사용자의 기본 주간 시간표
  defaultSchedule: [{
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 }, // 0: Sunday, ..., 6: Saturday
    startTime: { type: String, required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ }, // HH:MM
    endTime: { type: String, required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ }, // HH:MM
    priority: { type: Number, default: 2, enum: [1, 2, 3] }, // 1: Low, 2: Medium, 3: High
    specificDate: { type: String } // Optional: YYYY-MM-DD format for date-specific schedules
  }],

  // 기본 시간표의 예외 (예: 휴가, 특별 이벤트)
  scheduleExceptions: [{
    title: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    priority: { type: Number, enum: [1, 2, 3] }, // 1: 조정가능, 2: 보통, 3: 선호 (기본값 제거)
    specificDate: { type: String }, // YYYY-MM-DD 형태
    isHoliday: { type: Boolean, default: false },
    isAllDay: { type: Boolean, default: false }
  }],

  // 개인 시간 설정 (수면, 식사, 출퇴근 등)
  personalTimes: [{
    id: { type: Number, required: true }, // ID 필드 추가
    title: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['sleep', 'meal', 'commute', 'study', 'break', 'custom', 'event', 'room_blocked', 'personal']
    },
    startTime: {
      type: String,
      required: true,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    endTime: {
      type: String,
      required: true,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    days: [{
      type: Number,
      min: 1,
      max: 7
    }], // 1: 월, 2: 화, ..., 7: 일
    isRecurring: { type: Boolean, default: true },
    specificDate: { type: String }, // YYYY-MM-DD 형식의 특정 날짜 (반복되지 않는 개인시간용)
    color: { type: String }, // 색상 정보
    // 🔧 확정된 일정 관련 필드 추가
    location: { type: String }, // 장소 주소
    locationLat: { type: Number }, // 위도
    locationLng: { type: Number }, // 경도
    transportMode: { type: String }, // 교통수단 (driving, transit, walking)
    roomId: { type: String }, // 조율방 ID
    isTravelTime: { type: Boolean }, // 이동시간 여부
    hasTravelTime: { type: Boolean } // 이동시간 포함 여부
  }],

  // 방별로 삭제된 선호시간 추적 (확정 시 삭제된 defaultSchedule 백업)
  deletedPreferencesByRoom: [{
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    deletedTimes: [{
      dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
      priority: { type: Number, default: 2, enum: [1, 2, 3] },
      specificDate: { type: String }
    }],
    deletedAt: { type: Date, default: Date.now }
  }],
}, {
  // 스키마 옵션
  timestamps: true, // createdAt, updatedAt 자동 관리
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // 민감한 정보 제거
      delete ret.password;
      delete ret.passwordResetToken;
      delete ret.emailVerificationToken;
      delete ret.__v;
      
      // _id를 id로 변환
      ret.id = ret._id;
      delete ret._id;
      
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// 가상 필드: 전체 이름 (향후 확장용)
UserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`.trim();
});

// 가상 필드: 활성 캘린더 연결 수
UserSchema.virtual('activeCalendarConnections').get(function() {
  return this.connectedCalendars?.filter(cal => cal.isActive).length || 0;
});

// 가상 필드: 계정 연령 (일 단위)
UserSchema.virtual('accountAge').get(function() {
  if (this.createdAt) {
    const diffTime = Math.abs(new Date() - this.createdAt);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return 0;
});

// 인덱스 설정
UserSchema.index({ firebaseUid: 1 });
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ status: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ lastLoginAt: -1 });

// 이메일 저장 전 소문자 변환
UserSchema.pre('save', function(next) {
  if (this.isModified('email')) {
    this.email = this.email.toLowerCase().trim();
  }
  
  // 이름 앞뒤 공백 제거 (firstName, lastName에 적용)
  if (this.isModified('firstName')) {
    this.firstName = this.firstName.trim();
  }
  if (this.isModified('lastName')) {
    this.lastName = this.lastName.trim();
  }
  
  // updatedAt 갱신
  if (!this.isNew) {
    this.updatedAt = new Date();
  }
  
  next();
});

// 비밀번호 해싱 (저장 전)
UserSchema.pre('save', async function(next) {
  // 비밀번호가 수정되지 않았다면 건너뛰기
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 업데이트 시 updatedAt 자동 갱신
UserSchema.pre(['updateOne', 'findOneAndUpdate'], function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

// 인스턴스 메서드: 비밀번호 검증
UserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('비밀번호 검증 중 오류가 발생했습니다.');
  }
};

// 인스턴스 메서드: 비밀번호 재설정 토큰 생성
UserSchema.methods.createPasswordResetToken = function() {
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10분 후 만료
  
  return resetToken;
};

// 인스턴스 메서드: 이메일 검증 토큰 생성
UserSchema.methods.createEmailVerificationToken = function() {
  const crypto = require('crypto');
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  return verificationToken;
};

// 인스턴스 메서드: 로그인 카운트 증가
UserSchema.methods.incrementLoginCount = function() {
  this.loginCount += 1;
  this.lastLoginAt = new Date();
  return this.save();
};

// 인스턴스 메서드: 캘린더 연결 추가
UserSchema.methods.addCalendarConnection = function(provider, accountId, tokens) {
  const existingConnection = this.connectedCalendars.find(
    cal => cal.provider === provider && cal.accountId === accountId
  );
  
  if (existingConnection) {
    // 기존 연결 업데이트
    existingConnection.accessToken = tokens.accessToken;
    existingConnection.refreshToken = tokens.refreshToken;
    existingConnection.expiresAt = tokens.expiresAt;
    existingConnection.isActive = true;
  } else {
    // 새 연결 추가
    this.connectedCalendars.push({
      provider,
      accountId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      isActive: true
    });
  }
  
  return this.save();
};

// 스태틱 메서드: 이메일로 사용자 찾기
UserSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase().trim() });
};

// 스태틱 메서드: 활성 사용자만 조회
UserSchema.statics.findActiveUsers = function() {
  return this.find({ status: 'active' });
};

// 스태틱 메서드: 최근 로그인 사용자 조회
UserSchema.statics.findRecentlyActive = function(days = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.find({
    lastLoginAt: { $gte: cutoffDate },
    status: 'active'
  }).sort({ lastLoginAt: -1 });
};

// 스태틱 메서드: 비밀번호 재설정 토큰으로 사용자 찾기
UserSchema.statics.findByPasswordResetToken = function(token) {
  const crypto = require('crypto');
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  
  return this.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });
};

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);