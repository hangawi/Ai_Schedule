// 방 권한 검증 로직
const { ERROR_MESSAGES, HTTP_STATUS } = require('../constants/errorMessages');

/**
 * 방 존재 여부 검증
 * @param {Object} room - 방 객체
 * @param {Object} res - Express response 객체
 * @returns {boolean} 유효 여부
 */
const validateRoomExists = (room, res) => {
  if (!room) {
    res.status(HTTP_STATUS.NOT_FOUND).json({ msg: ERROR_MESSAGES.ROOM_NOT_FOUND });
    return false;
  }
  return true;
};

/**
 * 방장 권한 검증
 * @param {Object} room - 방 객체
 * @param {string} userId - 사용자 ID
 * @param {Object} res - Express response 객체
 * @returns {boolean} 유효 여부
 */
const validateOwnerPermission = (room, userId, res) => {
  if (!room.isOwner(userId)) {
    res.status(HTTP_STATUS.FORBIDDEN).json({ msg: ERROR_MESSAGES.OWNER_ONLY });
    return false;
  }
  return true;
};

/**
 * 스케줄 확정 상태 검증
 * @param {Object} room - 방 객체
 * @returns {boolean} 확정 여부
 */
const isScheduleConfirmed = (room) => {
  return !!room.confirmedAt;
};

/**
 * 확정 타이머 실행 상태 검증
 * @param {Object} room - 방 객체
 * @returns {boolean} 타이머 실행 여부
 */
const isConfirmationTimerRunning = (room) => {
  return !!room.autoConfirmAt;
};

module.exports = {
  validateRoomExists,
  validateOwnerPermission,
  isScheduleConfirmed,
  isConfirmationTimerRunning,
};
