// 요청 검증

const { ERROR_MESSAGES } = require('../constants/errorMessages');

/**
 * 요청 생성 시 필수 필드 검증
 * @param {Object} body - 요청 본문
 * @returns {Object|null} 에러가 있으면 에러 객체, 없으면 null
 */
const validateCreateRequest = (body) => {
  const { roomId, type, timeSlot } = body;

  if (!roomId || !type || !timeSlot) {
    return { status: 400, msg: ERROR_MESSAGES.REQUIRED_FIELDS_MISSING };
  }

  return null;
};

/**
 * 요청 처리 액션 검증
 * @param {string} action - 처리 액션 (approved/rejected)
 * @returns {Object|null} 에러가 있으면 에러 객체, 없으면 null
 */
const validateAction = (action) => {
  if (!['approved', 'rejected'].includes(action)) {
    return { status: 400, msg: ERROR_MESSAGES.INVALID_ACTION };
  }

  return null;
};

/**
 * 중복 요청 확인
 * @param {Array} requests - 기존 요청 배열
 * @param {string} userId - 요청자 ID
 * @param {Object} timeSlot - 시간 슬롯
 * @param {string} type - 요청 타입
 * @param {string} targetUserId - 대상 사용자 ID (선택)
 * @returns {boolean} 중복이면 true
 */
const hasDuplicateRequest = (requests, userId, timeSlot, type, targetUserId = null) => {
  return requests.some(
    request =>
      request.requester.toString() === userId &&
      request.status === 'pending' &&
      request.timeSlot.day === timeSlot.day &&
      request.timeSlot.startTime === timeSlot.startTime &&
      request.timeSlot.endTime === timeSlot.endTime &&
      ((type === 'slot_swap' || type === 'time_request')
        ? request.targetUser?.toString() === targetUserId
        : true)
  );
};

module.exports = {
  validateCreateRequest,
  validateAction,
  hasDuplicateRequest
};
