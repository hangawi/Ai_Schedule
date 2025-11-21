/**
 * 날짜 계산 유틸리티 함수
 */

/**
 * 현재 주의 월요일을 구함 (UTC 기준)
 * @returns {Date} - 월요일 날짜 (UTC)
 */
function getCurrentWeekMonday() {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setUTCDate(diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

/**
 * 특정 날짜의 주의 월요일을 구함 (UTC 기준)
 * @param {Date|string} date - 날짜 객체 또는 문자열
 * @returns {Date} - 월요일 날짜 (UTC)
 */
function getWeekMonday(date) {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setUTCDate(diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

/**
 * 주 오프셋을 적용한 월요일을 구함
 * @param {Date} baseMonday - 기준 월요일
 * @param {number} weekOffset - 주 오프셋 (0=이번주, 1=다음주, -1=저번주)
 * @returns {Date} - 오프셋 적용된 월요일
 */
function getOffsetMonday(baseMonday, weekOffset) {
  const targetMonday = new Date(baseMonday);
  targetMonday.setUTCDate(baseMonday.getUTCDate() + (weekOffset * 7));
  return targetMonday;
}

/**
 * 특정 월의 N번째 요일 찾기
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @param {number} dayOfWeek - 요일 (1=월, 2=화, ..., 5=금)
 * @param {number} weekNumber - 주차 (1-5)
 * @returns {Date} - N번째 요일 날짜 (UTC)
 */
function getNthWeekdayOfMonth(year, month, dayOfWeek, weekNumber) {
  // 해당 월의 1일 (UTC)
  const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const firstDayWeekday = firstDayOfMonth.getUTCDay(); // 0=일, 1=월, ..., 6=토

  // 첫 번째 해당 요일까지의 일수 계산
  let daysToFirstTargetDay = dayOfWeek - firstDayWeekday;
  if (daysToFirstTargetDay < 0) daysToFirstTargetDay += 7;
  if (daysToFirstTargetDay === 0 && firstDayWeekday === 0) daysToFirstTargetDay = 1;

  // 첫 번째 해당 요일
  const firstTargetDay = new Date(Date.UTC(year, month - 1, 1 + daysToFirstTargetDay));

  // N번째 해당 요일
  const targetDate = new Date(firstTargetDay);
  targetDate.setUTCDate(firstTargetDay.getUTCDate() + (weekNumber - 1) * 7);

  return targetDate;
}

/**
 * 날짜를 YYYY-MM-DD 형식 문자열로 변환
 * @param {Date} date - 날짜 객체
 * @returns {string} - YYYY-MM-DD 형식 문자열
 */
function dateToString(date) {
  return date.toISOString().split('T')[0];
}

/**
 * 날짜가 주말인지 확인
 * @param {Date} date - 날짜 객체
 * @returns {boolean} - 주말이면 true
 */
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

module.exports = {
  getCurrentWeekMonday,
  getWeekMonday,
  getOffsetMonday,
  getNthWeekdayOfMonth,
  dateToString,
  isWeekend
};
