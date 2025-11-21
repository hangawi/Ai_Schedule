/**
 * 스케줄 검증 로직
 */

const { isWeekend } = require('../utils/dateUtils');
const { ERROR_MESSAGES } = require('../constants/errorMessages');

/**
 * 주말이 아닌지 검증
 * @param {Date} date - 검증할 날짜
 * @param {number} month - 월
 * @param {number} day - 일
 * @throws {Error} - 주말이면 에러
 */
function validateNotWeekend(date, month, day) {
  if (isWeekend(date)) {
    throw new Error(ERROR_MESSAGES.WEEKEND_NOT_ALLOWED(month, day));
  }
}

/**
 * 방장의 선호 요일 검증
 * @param {Array} ownerSchedules - 방장의 선호 스케줄
 * @param {string} targetDay - 목표 요일 (한글)
 * @throws {Error} - 선호 요일이 아니면 에러
 */
function validateOwnerPreferredDay(ownerSchedules, targetDay) {
  if (ownerSchedules.length === 0) {
    throw new Error(ERROR_MESSAGES.NOT_OWNER_PREFERRED_DAY(targetDay));
  }
}

/**
 * 멤버의 선호 요일 검증
 * @param {Array} memberSchedules - 멤버의 선호 스케줄
 * @param {string} targetDay - 목표 요일 (한글)
 * @throws {Error} - 선호 요일이 아니면 에러
 */
function validateMemberPreferredDay(memberSchedules, targetDay) {
  if (memberSchedules.length === 0) {
    throw new Error(ERROR_MESSAGES.NOT_MEMBER_PREFERRED_DAY(targetDay));
  }
}

/**
 * 겹치는 시간대 존재 검증
 * @param {Array} overlappingRanges - 겹치는 시간 범위
 * @param {string} targetDay - 목표 요일 (한글)
 * @throws {Error} - 겹치는 시간이 없으면 에러
 */
function validateHasOverlap(overlappingRanges, targetDay) {
  if (overlappingRanges.length === 0) {
    throw new Error(ERROR_MESSAGES.NO_OVERLAP_WITH_OWNER(targetDay));
  }
}

module.exports = {
  validateNotWeekend,
  validateOwnerPreferredDay,
  validateMemberPreferredDay,
  validateHasOverlap
};
