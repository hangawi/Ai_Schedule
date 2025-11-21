/**
 * 스케줄 겹침 찾기 헬퍼
 */

const { mergeScheduleRanges, findOverlappingRanges, isWithinRanges } = require('../utils/slotMerger');
const { DAY_OF_WEEK_MAP } = require('../constants/dayMappings');

/**
 * 특정 요일의 사용자 스케줄 가져오기
 * @param {Object} user - User 객체
 * @param {string} targetDayEnglish - 요일 (영어)
 * @returns {Array} - 스케줄 배열
 */
function getUserSchedulesForDay(user, targetDayEnglish) {
  const targetDayOfWeek = DAY_OF_WEEK_MAP[targetDayEnglish];
  const defaultSchedule = user.defaultSchedule || [];
  return defaultSchedule.filter(s => s.dayOfWeek === targetDayOfWeek);
}

/**
 * 방장과 멤버의 겹치는 시간 범위 찾기
 * @param {Array} ownerSchedules - 방장 스케줄
 * @param {Array} memberSchedules - 멤버 스케줄
 * @returns {Array} - 겹치는 범위 배열
 */
function findOwnerMemberOverlap(ownerSchedules, memberSchedules) {
  const ownerMerged = mergeScheduleRanges(ownerSchedules);
  const memberMerged = mergeScheduleRanges(memberSchedules);
  return findOverlappingRanges(ownerMerged, memberMerged);
}

/**
 * 시간 범위가 겹치는 범위 내에 있는지 확인
 * @param {string} startTime - 시작 시간 (HH:MM)
 * @param {string} endTime - 종료 시간 (HH:MM)
 * @param {Array} overlappingRanges - 겹치는 범위 배열
 * @returns {boolean} - 포함되면 true
 */
function isTimeInOverlap(startTime, endTime, overlappingRanges) {
  const { timeToMinutes } = require('../utils/timeUtils');
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  return isWithinRanges(startMinutes, endMinutes, overlappingRanges);
}

/**
 * 가능한 시간 범위 문자열 생성
 * @param {Array} overlappingRanges - 겹치는 범위 배열
 * @returns {string} - "09:00-12:00, 14:00-18:00" 형태
 */
function formatAvailableRanges(overlappingRanges) {
  return overlappingRanges.map(r => `${r.startTime}-${r.endTime}`).join(', ');
}

module.exports = {
  getUserSchedulesForDay,
  findOwnerMemberOverlap,
  isTimeInOverlap,
  formatAvailableRanges
};
