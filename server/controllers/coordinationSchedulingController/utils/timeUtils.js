// 시간 관련 유틸리티 함수

/**
 * 시간 문자열을 분으로 변환
 * @param {string} timeString - "HH:MM" 형식의 시간 문자열
 * @returns {number} 분 단위 시간
 */
const timeToMinutes = (timeString) => {
  if (!timeString) return 0;
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * 분을 시간 문자열로 변환
 * @param {number} minutes - 분 단위 시간
 * @returns {string} "HH:MM" 형식의 시간 문자열
 */
const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

/**
 * 날짜 범위 계산
 * @param {Date} startDate - 시작 날짜
 * @param {number} days - 일 수
 * @returns {Date} 계산된 날짜
 */
const addDays = (startDate, days) => {
  const result = new Date(startDate);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * 두 시간 사이의 분 차이 계산
 * @param {string} startTime - 시작 시간 "HH:MM"
 * @param {string} endTime - 종료 시간 "HH:MM"
 * @returns {number} 분 차이
 */
const getTimeDifference = (startTime, endTime) => {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
};

/**
 * day 문자열을 숫자로 변환
 * @param {string} day - 요일 문자열 (monday, tuesday, ...)
 * @returns {number} 요일 번호 (1-7)
 */
const getDayOfWeekNumber = (day) => {
  const dayMap = {
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6,
    'sunday': 7
  };
  return dayMap[day] || 1;
};

module.exports = {
  timeToMinutes,
  minutesToTime,
  addDays,
  getTimeDifference,
  getDayOfWeekNumber,
};
