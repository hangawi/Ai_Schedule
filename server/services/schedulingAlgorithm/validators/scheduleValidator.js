/**
 * 스케줄 검증 함수
 */

const { WEEKEND_NUMBERS } = require('../constants/schedulingConstants');
const { PREFERRED_TIME_PRIORITY_THRESHOLD } = require('../constants/priorityConstants');
const { isValidSlotTime } = require('../utils/timeUtils');

/**
 * 주말 요일인지 확인
 * @param {number} dayOfWeek - 요일 숫자 (0=일요일, 6=토요일)
 * @returns {boolean}
 */
const isWeekendDay = (dayOfWeek) => {
  return WEEKEND_NUMBERS.includes(dayOfWeek);
};

/**
 * 스케줄이 30분 단위로 유효한지 확인
 * @param {Object} schedule - 스케줄 객체
 * @returns {boolean}
 */
const isValid30MinuteSchedule = (schedule) => {
  if (!schedule || !schedule.startTime) return false;
  return isValidSlotTime(schedule.startTime);
};

/**
 * 선호 시간인지 확인 (우선순위 기반)
 * @param {number} priority - 우선순위
 * @returns {boolean}
 */
const isPreferredTime = (priority) => {
  return priority >= PREFERRED_TIME_PRIORITY_THRESHOLD;
};

/**
 * 스케줄이 특정 날짜에 적용되는지 확인
 * @param {Object} schedule - 스케줄 객체
 * @param {string} dateStr - YYYY-MM-DD 형식 날짜
 * @param {number} dayOfWeek - 요일 숫자
 * @returns {boolean}
 */
const isScheduleApplicableToDate = (schedule, dateStr, dayOfWeek) => {
  // specificDate가 있으면 그 날짜에만 적용
  if (schedule.specificDate) {
    return schedule.specificDate === dateStr;
  }
  // 없으면 요일로 판단 (반복 일정)
  return schedule.dayOfWeek === dayOfWeek;
};

/**
 * 스케줄 배열을 30분 단위로 필터링
 * @param {Array} schedules - 스케줄 배열
 * @returns {Array} 유효한 스케줄만 포함된 배열
 */
const filterValidSchedules = (schedules) => {
  if (!schedules || !Array.isArray(schedules)) return [];
  return schedules.filter(isValid30MinuteSchedule);
};

/**
 * 날짜 범위 내 스케줄인지 확인
 * @param {Date} slotDate - 슬롯 날짜
 * @param {Date} startDate - 범위 시작
 * @param {Date} endDate - 범위 끝
 * @returns {boolean}
 */
const isScheduleInDateRange = (slotDate, startDate, endDate) => {
  const slotDateStr = new Date(slotDate).toISOString().split('T')[0];
  const startDateStr = new Date(startDate).toISOString().split('T')[0];
  const endDateStr = new Date(endDate).toISOString().split('T')[0];
  return slotDateStr >= startDateStr && slotDateStr < endDateStr;
};

/**
 * 시간이 스케줄 범위 내에 있는지 확인
 * @param {number} timeMinutes - 확인할 시간 (분)
 * @param {number} startMinutes - 시작 시간 (분)
 * @param {number} endMinutes - 종료 시간 (분)
 * @returns {boolean}
 */
const isTimeInScheduleRange = (timeMinutes, startMinutes, endMinutes) => {
  // 자정을 넘어가는 경우 처리
  if (endMinutes <= startMinutes) {
    return timeMinutes >= startMinutes || timeMinutes < endMinutes;
  }
  return timeMinutes >= startMinutes && timeMinutes < endMinutes;
};

module.exports = {
  isWeekendDay,
  isValid30MinuteSchedule,
  isPreferredTime,
  isScheduleApplicableToDate,
  filterValidSchedules,
  isScheduleInDateRange,
  isTimeInScheduleRange
};
