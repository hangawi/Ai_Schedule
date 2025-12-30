// Room DB 쿼리 헬퍼
const Room = require('../../../models/room');

/**
 * 방 조회 (멤버 정보 포함)
 * @param {string} roomId - 방 ID
 * @returns {Promise<Object>} 방 객체
 */
const getRoomWithMembers = async (roomId) => {
  return await Room.findById(roomId)
    .populate('owner', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority')
    .populate('members.user', 'firstName lastName email defaultSchedule scheduleExceptions personalTimes priority');
};

/**
 * 방 조회 (기본)
 * @param {string} roomId - 방 ID
 * @returns {Promise<Object>} 방 객체
 */
const getRoomById = async (roomId) => {
  return await Room.findById(roomId);
};

/**
 * 방의 타임슬롯 초기화
 * @param {Object} room - 방 객체
 */
const clearTravelModeData = (room) => {
  room.originalTimeSlots = [];
  room.travelTimeSlots = [];
};

/**
 * 방의 자동 배정 슬롯 제거 (보존할 슬롯 유지)
 * @param {Object} room - 방 객체
 * @param {Function} shouldPreserve - 슬롯 보존 여부 판단 함수
 */
const removeAutoAssignedSlots = (room, shouldPreserve) => {
  room.timeSlots = room.timeSlots.filter(shouldPreserve);
};

/**
 * 방 설정 업데이트
 * @param {Object} room - 방 객체
 * @param {Object} settings - 설정 객체
 */
const updateRoomSettings = (room, settings) => {
  Object.assign(room.settings, settings);
};

/**
 * 조원 목록 가져오기 (방장 제외)
 * @param {Object} room - 방 객체
 * @returns {Array} 조원 배열
 */
const getMembersOnly = (room) => {
  return room.members.filter(m => {
    const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
    const ownerId = room.owner._id ? room.owner._id.toString() : room.owner.toString();
    return memberId !== ownerId;
  });
};

/**
 * 조원 ID 목록 가져오기
 * @param {Array} members - 조원 배열
 * @returns {Array} 조원 ID 배열
 */
const getMemberIds = (members) => {
  return members.map(m => {
    const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
    return memberId;
  });
};

/**
 * 이월 정보 가져오기
 * @param {Array} members - 멤버 배열
 * @param {Date} startDate - 시작 날짜
 * @returns {Array} 이월 정보 배열
 */
const getExistingCarryOvers = (members, startDate) => {
  const carryOvers = [];
  for (const member of members) {
    if (member.carryOver > 0) {
      carryOvers.push({
        memberId: member.user._id.toString(),
        neededHours: member.carryOver,
        priority: member.priority || 3,
        week: startDate
      });
    }
  }
  return carryOvers;
};

/**
 * 방의 확정 타이머 취소
 * @param {Object} room - 방 객체
 */
const cancelConfirmationTimer = (room) => {
  room.autoConfirmAt = null;
  room.autoConfirmDuration = null;
};

/**
 * 방의 확정 타이머 설정
 * @param {Object} room - 방 객체
 * @param {number} hours - 시간
 */
const setConfirmationTimer = (room, hours) => {
  const confirmAt = new Date();
  confirmAt.setHours(confirmAt.getHours() + hours);
  room.autoConfirmAt = confirmAt;
  room.autoConfirmDuration = hours;
};

module.exports = {
  getRoomWithMembers,
  getRoomById,
  clearTravelModeData,
  removeAutoAssignedSlots,
  updateRoomSettings,
  getMembersOnly,
  getMemberIds,
  getExistingCarryOvers,
  cancelConfirmationTimer,
  setConfirmationTimer,
};
