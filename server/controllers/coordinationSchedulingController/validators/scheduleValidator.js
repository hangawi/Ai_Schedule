// 스케줄 검증 로직
const { VALIDATION_RULES } = require('../constants/validationRules');
const { ERROR_MESSAGES } = require('../constants/errorMessages');

/**
 * 주당 최소 할당 시간 검증
 * @param {number} minHoursPerWeek - 주당 최소 할당 시간
 * @throws {Error} 유효하지 않은 값일 경우
 */
const validateMinHoursPerWeek = (minHoursPerWeek) => {
  if (minHoursPerWeek < VALIDATION_RULES.MIN_HOURS_PER_WEEK ||
      minHoursPerWeek > VALIDATION_RULES.MAX_HOURS_PER_WEEK) {
    throw new Error(ERROR_MESSAGES.INVALID_HOURS_PER_WEEK);
  }
};

/**
 * 방장 선호시간 검증
 * @param {Object} owner - 방장 객체
 * @returns {boolean} 유효 여부
 */
const validateOwnerSchedule = (owner) => {
  const hasDefaultSchedule = owner?.defaultSchedule && owner.defaultSchedule.length > 0;
  const hasScheduleExceptions = owner?.scheduleExceptions && owner.scheduleExceptions.length > 0;
  return hasDefaultSchedule || hasScheduleExceptions;
};

/**
 * 멤버 선호시간 검증
 * @param {Array} members - 멤버 배열
 * @returns {Array} 선호시간이 없는 멤버 이름 배열
 */
const validateMembersSchedule = (members) => {
  const membersWithoutSchedule = [];

  for (const member of members) {
    const hasDefaultSchedule = member.user?.defaultSchedule && member.user.defaultSchedule.length > 0;
    const hasScheduleExceptions = member.user?.scheduleExceptions && member.user.scheduleExceptions.length > 0;

    if (!member.user || (!hasDefaultSchedule && !hasScheduleExceptions)) {
      const userName = member.user?.name ||
                      `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim() ||
                      '알 수 없음';
      membersWithoutSchedule.push(userName);
    }
  }

  return membersWithoutSchedule;
};

/**
 * 자동 확정 기간 검증
 * @param {number} hours - 자동 확정 기간 (시간)
 * @throws {Error} 유효하지 않은 값일 경우
 */
const validateAutoConfirmDuration = (hours) => {
  if (!hours ||
      hours < VALIDATION_RULES.MIN_AUTO_CONFIRM_DURATION ||
      hours > VALIDATION_RULES.MAX_AUTO_CONFIRM_DURATION) {
    throw new Error(ERROR_MESSAGES.INVALID_DURATION);
  }
};

/**
 * 이동 모드 검증
 * @param {string} travelMode - 이동 모드
 * @param {Array} validModes - 유효한 모드 배열
 * @returns {boolean} 유효 여부
 */
const validateTravelMode = (travelMode, validModes) => {
  return validModes.includes(travelMode);
};

module.exports = {
  validateMinHoursPerWeek,
  validateOwnerSchedule,
  validateMembersSchedule,
  validateAutoConfirmDuration,
  validateTravelMode,
};
