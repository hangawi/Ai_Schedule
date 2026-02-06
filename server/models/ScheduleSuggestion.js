/**
 * ===================================================================================================
 * ScheduleSuggestion Model (일정 제안 모델)
 * ===================================================================================================
 *
 * 설명: AI가 감지한 일정 제안을 저장하고 멤버별 응답 상태를 관리
 *
 * 주요 기능:
 * - AI 제안 저장 (날짜, 시간, 제목, 장소)
 * - 멤버별 응답 상태 추적 (pending/accepted/rejected)
 * - 본인 수락 시 개인 캘린더에 자동 추가
 * - 시간 경과 시 자동 상태 변경 (future → past)
 *
 * 관련 파일:
 * - server/services/aiScheduleService.js - AI 제안 생성
 * - server/controllers/chatController.js - 제안 응답 처리
 *
 * ===================================================================================================
 */

const mongoose = require('mongoose');

const MemberResponseSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  // 자동 불참 여부 (일정 충돌로 인한 자동 불참)
  isAutoRejected: {
    type: Boolean,
    default: false
  },
  // 자동 불참 사유 (있으면 일정 충돌)
  autoRejectReason: {
    type: String,
    default: null
  },
  respondedAt: {
    type: Date,
    default: null
  },
  // 수락 시 추가된 개인 일정 ID (삭제 시 참조용)
  personalTimeId: {
    type: Number,
    default: null
  }
});

const ScheduleSuggestionSchema = new mongoose.Schema({
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
    index: true
  },
  // 제안 정보
  summary: {
    type: String,
    required: true
  },
  date: {
    type: String, // YYYY-MM-DD 형식
    required: true
  },
  startTime: {
    type: String, // HH:MM 형식
    required: true
  },
  endTime: {
    type: String, // HH:MM 형식
    required: true
  },
  location: {
    type: String,
    default: ''
  },
  // 멤버별 응답 상태
  memberResponses: [MemberResponseSchema],
  // 제안 상태
  status: {
    type: String,
    enum: ['future', 'today', 'past', 'cancelled'],
    default: 'future'
  },
  // 제안 생성 시간
  suggestedAt: {
    type: Date,
    default: Date.now
  },
  // 제안을 생성한 사용자 (채팅에서 일정을 처음 언급한 사람)
  suggestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // 원본 AI 응답 (디버깅용)
  aiResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// 인덱스 설정
ScheduleSuggestionSchema.index({ room: 1, status: 1 });
ScheduleSuggestionSchema.index({ date: 1, startTime: 1 });

/**
 * 제안 시간이 지났는지 확인하고 상태 업데이트
 */
ScheduleSuggestionSchema.methods.updateStatus = function() {
  const now = new Date();
  const suggestionDateTime = new Date(`${this.date}T${this.startTime}:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const suggestionDate = new Date(this.date);
  suggestionDate.setHours(0, 0, 0, 0);

  if (suggestionDateTime < now) {
    this.status = 'past';
  } else if (suggestionDate.getTime() === today.getTime()) {
    this.status = 'today';
  } else {
    this.status = 'future';
  }

  return this.save();
};

/**
 * 특정 사용자의 응답 상태 조회
 */
ScheduleSuggestionSchema.methods.getUserResponse = function(userId) {
  return this.memberResponses.find(
    response => response.user.toString() === userId.toString()
  );
};

/**
 * 특정 사용자가 수락
 */
ScheduleSuggestionSchema.methods.acceptByUser = function(userId, personalTimeId) {
  const response = this.getUserResponse(userId);
  if (response) {
    response.status = 'accepted';
    response.respondedAt = new Date();
    response.personalTimeId = personalTimeId;
    response.isAutoRejected = false;
    response.autoRejectReason = null;
  }
  return this.save();
};

/**
 * 특정 사용자가 거절
 */
ScheduleSuggestionSchema.methods.rejectByUser = function(userId) {
  const response = this.getUserResponse(userId);
  if (response) {
    response.status = 'rejected';
    response.respondedAt = new Date();
  }
  return this.save();
};

/**
 * 응답 현황 통계
 */
ScheduleSuggestionSchema.methods.getResponseStats = function() {
  const total = this.memberResponses.length;
  const accepted = this.memberResponses.filter(r => r.status === 'accepted').length;
  const rejected = this.memberResponses.filter(r => r.status === 'rejected').length;
  const pending = this.memberResponses.filter(r => r.status === 'pending').length;

  return {
    total,
    accepted,
    rejected,
    pending
  };
};

/**
 * Static: 방의 모든 제안 조회 (상태별)
 */
ScheduleSuggestionSchema.statics.findByRoomAndStatus = function(roomId, status) {
  return this.find({ room: roomId, status })
    .populate('memberResponses.user', 'firstName lastName email')
    .sort({ date: 1, startTime: 1 });
};

/**
 * Static: 시간 지난 제안들을 자동으로 past 상태로 변경
 */
ScheduleSuggestionSchema.statics.updateExpiredSuggestions = async function() {
  const now = new Date();
  const expiredSuggestions = await this.find({
    status: { $in: ['future', 'today'] }
  });

  for (const suggestion of expiredSuggestions) {
    await suggestion.updateStatus();
  }

  return expiredSuggestions.length;
};

module.exports = mongoose.models.ScheduleSuggestion || mongoose.model('ScheduleSuggestion', ScheduleSuggestionSchema);
