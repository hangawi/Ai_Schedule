/**
 * ===================================================================================================
 * ActivityLog.js - 사용자 및 시스템 활동 로그를 위한 Mongoose 스키마 및 모델
 * ===================================================================================================
 *
 * 📍 위치: 백엔드 > server/models/ActivityLog.js
 *
 * 🎯 주요 기능:
 *    - 애플리케이션 내에서 발생하는 다양한 활동(예: 자동 배정, 멤버 입장, 방 생성 등)을 기록하기 위한 데이터 구조(스키마)를 정의합니다.
 *    - 각 로그 항목은 활동이 발생한 방(roomId), 활동을 수행한 사용자(userId, userName), 활동 유형(action), 상세 설명(details), 추가 데이터(metadata) 등을 포함합니다.
 *    - 데이터베이스 쿼리 성능 향상을 위해 `roomId`, `userId`, `createdAt` 필드에 대한 인덱스가 설정되어 있습니다.
 *    - 특정 방의 최근 활동을 쉽게 조회하는 `getRecentByRoom` 정적(static) 메서드를 제공합니다.
 *    - 활동 로그를 간편하게 생성하는 `logActivity` 정적 헬퍼 메서드를 제공합니다.
 *
 * 🔗 연결된 파일:
 *    - 이 모델은 활동 로깅이 필요한 모든 컨트롤러 및 서비스에서 사용됩니다. (예: `roomController.js`, `coordinationSchedulingController.js` 등)
 *
 * ✏️ 수정 가이드:
 *    - 새로운 활동 유형을 추가하려면: `action` 필드의 `enum` 배열에 새로운 문자열 값을 추가합니다.
 *    - `metadata`에 저장될 데이터 구조가 특정 형태를 가져야 한다면, `mongoose.Schema.Types.Mixed`를 구체적인 서브 스키마로 변경할 수 있습니다.
 *
 * 📝 참고사항:
 *    - `roomId`와 `userId`는 선택적(optional) 필드입니다. 이는 시스템 전역적인 활동(예: 회원가입)이나 사용자가 삭제된 후에도 로그를 유지하기 위함입니다.
 *    - `module.exports`에서 `mongoose.models.ActivityLog || ...` 구문은 개발 중 핫 리로딩(hot-reloading) 시 모델 재컴파일 에러를 방지하기 위한 것입니다.
 *
 * ===================================================================================================
 */
const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
  // 활동이 발생한 방의 ID (전역 활동의 경우 null)
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: false,
    index: true
  },
  // 활동을 수행한 사용자의 ID (시스템 활동 또는 탈퇴 유저의 경우 null)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  // 활동 수행 당시의 사용자 이름 (사용자 삭제 후에도 이름을 보존하기 위함)
  userName: {
    type: String,
    required: true
  },
  // 활동 유형 (enum으로 관리)
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
  // 활동에 대한 상세 설명 (문자열)
  details: {
    type: String,
    default: ''
  },
  // 활동과 관련된 추가적인 구조화된 데이터 (자유 형식)
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // 활동 생성 시간
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false // `createdAt`을 직접 관리하므로 Mongoose의 자동 timestamps는 비활성화
});

// 쿼리 성능 향상을 위한 복합 인덱스 설정
ActivityLogSchema.index({ roomId: 1, createdAt: -1 }); // 방별 최신 활동 조회
ActivityLogSchema.index({ userId: 1, createdAt: -1 }); // 사용자별 최신 활동 조회

/**
 * @static getRecentByRoom
 * @description 특정 방의 최근 활동 로그를 조회합니다.
 * @param {string} roomId - 조회할 방의 ID
 * @param {number} [limit=50] - 조회할 로그의 최대 개수
 * @returns {Promise<Array>} 활동 로그 배열
 */
ActivityLogSchema.statics.getRecentByRoom = function(roomId, limit = 50) {
  return this.find({ roomId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'firstName lastName email'); // 사용자 정보 포함
};

/**
 * @static logActivity
 * @description 활동 로그를 생성하는 헬퍼 메서드
 * @param {string} roomId - 방 ID
 * @param {string} userId - 사용자 ID
 * @param {string} userName - 사용자 이름
 * @param {string} action - 활동 유형
 * @param {string} [details=''] - 상세 설명
 * @param {object} [metadata={}] - 추가 데이터
 * @returns {Promise<object>} 생성된 로그 객체
 */
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

// 모델이 이미 컴파일되었는지 확인 후, 없으면 새로 컴파일
module.exports = mongoose.models.ActivityLog || mongoose.model('ActivityLog', ActivityLogSchema);