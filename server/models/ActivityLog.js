const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: false,  // 전역 활동(회원가입, 회원탈퇴)은 roomId가 없음
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false  // 회원탈퇴 후에는 userId가 없을 수 있음
  },
  userName: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'auto_assign',           // 자동배정 실행
      'confirm_schedule',      // 배정 시간 확정
      'slot_request',          // 자리 요청
      'slot_yield',            // 자리 양보
      'slot_swap',             // 자리 교환
      'member_join',           // 멤버 입장
      'member_leave',          // 멤버 퇴장
      'member_kick',           // 멤버 강퇴
      'room_create',           // 방 생성
      'room_update',           // 방 설정 변경
      'schedule_update',       // 일정 수정
      'change_request',        // 변경 요청
      'change_approve',        // 변경 승인
      'change_reject',         // 변경 거절
      'user_withdraw'          // 회원탈퇴
    ]
  },
  details: {
    type: String,
    default: ''
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false
});

// 복합 인덱스
ActivityLogSchema.index({ roomId: 1, createdAt: -1 });
ActivityLogSchema.index({ userId: 1, createdAt: -1 });

// 스태틱 메서드: 방의 최근 활동 로그 조회
ActivityLogSchema.statics.getRecentByRoom = function(roomId, limit = 50) {
  return this.find({ roomId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'firstName lastName email');
};

// 스태틱 메서드: 활동 로그 생성 헬퍼
ActivityLogSchema.statics.logActivity = async function(roomId, userId, userName, action, details = '', metadata = {}) {
  return this.create({
    roomId,
    userId,
    userName,
    action,
    details,
    metadata
  });
};

module.exports = mongoose.models.ActivityLog || mongoose.model('ActivityLog', ActivityLogSchema);
