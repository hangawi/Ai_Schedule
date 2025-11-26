// 권한 검증

const { ERROR_MESSAGES } = require('../constants/errorMessages');

/**
 * 방장 여부 확인
 * @param {Object} room - 방 객체
 * @param {string} userId - 사용자 ID
 * @returns {boolean} 방장이면 true
 */
const isOwner = (room, userId) => {
  return room.owner.toString() === userId || room.isOwner(userId);
};

/**
 * 대상 사용자 여부 확인
 * @param {Object} request - 요청 객체
 * @param {string} userId - 사용자 ID
 * @returns {boolean} 대상 사용자면 true
 */
const isTargetUser = (request, userId) => {
  if (!request.targetUser) return false;

  const targetId = request.targetUser._id
    ? request.targetUser._id.toString()
    : request.targetUser.toString();

  return targetId === userId;
};

/**
 * 요청 처리 권한 확인
 * @param {Object} room - 방 객체
 * @param {Object} request - 요청 객체
 * @param {string} userId - 사용자 ID
 * @returns {Object|null} 에러가 있으면 에러 객체, 없으면 null
 */
const validateHandlePermission = (room, request, userId) => {
  const hasOwnerPermission = isOwner(room, userId);
  const hasTargetPermission = isTargetUser(request, userId);

  if (!hasOwnerPermission && !hasTargetPermission) {
    return { status: 403, msg: ERROR_MESSAGES.NO_PERMISSION };
  }

  return null;
};

/**
 * 요청 삭제 권한 확인
 * @param {Object} request - 요청 객체
 * @param {string} userId - 사용자 ID
 * @returns {Object|null} 에러가 있으면 에러 객체, 없으면 null
 */
const validateDeletePermission = (request, userId) => {
  const canDelete = request.requester.toString() === userId ||
                   (request.targetUser && request.targetUser.toString() === userId);

  if (!canDelete) {
    return { status: 403, msg: ERROR_MESSAGES.NO_DELETE_PERMISSION };
  }

  if (request.status === 'pending' && request.requester.toString() !== userId) {
    return { status: 403, msg: ERROR_MESSAGES.PENDING_REQUESTER_ONLY };
  }

  return null;
};

module.exports = {
  isOwner,
  isTargetUser,
  validateHandlePermission,
  validateDeletePermission
};
