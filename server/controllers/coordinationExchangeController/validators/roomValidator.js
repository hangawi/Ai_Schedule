/**
 * 방/멤버 권한 검증
 */

const { ERROR_MESSAGES } = require('../constants/errorMessages');

/**
 * 방 존재 여부 검증
 * @param {Object} room - Room 객체
 * @throws {Error} - 방이 없으면 에러
 */
function validateRoomExists(room) {
  if (!room) {
    throw new Error(ERROR_MESSAGES.ROOM_NOT_FOUND);
  }
}

/**
 * 사용자가 방 멤버인지 검증
 * @param {Object} room - Room 객체
 * @param {string} userId - 사용자 ID
 * @returns {Object} - 멤버 데이터
 * @throws {Error} - 멤버가 아니면 에러
 */
function validateIsMember(room, userId) {
  const memberData = room.members.find(m =>
    (m.user._id || m.user).toString() === userId.toString()
  );

  if (!memberData) {
    throw new Error(ERROR_MESSAGES.NOT_MEMBER);
  }

  return memberData;
}

/**
 * 메시지 존재 여부 검증
 * @param {string} message - 메시지
 * @throws {Error} - 메시지가 없으면 에러
 */
function validateMessage(message) {
  if (!message || !message.trim()) {
    throw new Error(ERROR_MESSAGES.NO_MESSAGE);
  }
}

module.exports = {
  validateRoomExists,
  validateIsMember,
  validateMessage
};
