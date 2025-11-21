/**
 * 입력 검증 함수
 */

const { ERROR_MESSAGES } = require('../constants/errorMessages');

/**
 * 멤버 배열 유효성 검사
 * @param {Array} members - 멤버 배열
 * @throws {Error} 유효하지 않은 경우
 */
const validateMembers = (members) => {
  if (!members || !Array.isArray(members)) {
    throw new Error(ERROR_MESSAGES.INVALID_MEMBERS_DATA);
  }
};

/**
 * 방장 데이터 유효성 검사
 * @param {Object} owner - 방장 객체
 * @throws {Error} 유효하지 않은 경우
 */
const validateOwner = (owner) => {
  if (!owner || !owner._id) {
    throw new Error(ERROR_MESSAGES.INVALID_OWNER_DATA);
  }
};

/**
 * 스케줄링 옵션 유효성 검사 및 기본값 설정
 * @param {Object} options - 옵션 객체
 * @returns {Object} 검증/보정된 옵션
 */
const validateAndNormalizeOptions = (options = {}) => {
  const {
    minHoursPerWeek = 3,
    numWeeks = 2,
    currentWeek,
    ownerPreferences = {},
    roomSettings = {},
    fullRangeStart,
    fullRangeEnd
  } = options;

  return {
    minHoursPerWeek: Math.max(1, minHoursPerWeek),
    numWeeks: Math.max(1, numWeeks),
    currentWeek: currentWeek || null,
    ownerPreferences,
    roomSettings,
    fullRangeStart,
    fullRangeEnd
  };
};

/**
 * 멤버 ID 추출
 * @param {Object} member - 멤버 객체
 * @returns {string|null} 멤버 ID 문자열
 */
const extractMemberId = (member) => {
  if (!member || !member.user) return null;
  return member.user._id ? member.user._id.toString() : member.user.toString();
};

/**
 * 슬롯 사용자 ID 추출
 * @param {Object} slot - 슬롯 객체
 * @returns {string|null} 사용자 ID 문자열
 */
const extractSlotUserId = (slot) => {
  if (!slot || !slot.user) return null;
  return slot.user._id ? slot.user._id.toString() : slot.user.toString();
};

/**
 * 유효한 스케줄인지 확인 (30분 단위 체크)
 * @param {Object} schedule - 스케줄 객체
 * @returns {boolean}
 */
const isValidSchedule = (schedule) => {
  if (!schedule || !schedule.startTime) return false;
  const startMin = parseInt(schedule.startTime.split(':')[1]);
  return startMin === 0 || startMin === 30;
};

/**
 * 방장 제외 멤버 필터링
 * @param {Array} members - 멤버 배열
 * @param {string} ownerId - 방장 ID
 * @returns {Array} 방장 제외 멤버 배열
 */
const filterNonOwnerMembers = (members, ownerId) => {
  return members.filter(m => {
    const memberId = extractMemberId(m);
    return memberId !== ownerId;
  });
};

module.exports = {
  validateMembers,
  validateOwner,
  validateAndNormalizeOptions,
  extractMemberId,
  extractSlotUserId,
  isValidSchedule,
  filterNonOwnerMembers
};
