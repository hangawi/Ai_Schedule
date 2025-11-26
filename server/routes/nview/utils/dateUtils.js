/**
 * 날짜 관련 유틸리티 함수
 */

/**
 * 주어진 날짜가 오늘인지 확인
 */
function isToday(date) {
  const today = new Date();
  const checkDate = new Date(date);
  return today.getFullYear() === checkDate.getFullYear() &&
         today.getMonth() === checkDate.getMonth() &&
         today.getDate() === checkDate.getDate();
}

/**
 * 주어진 날짜가 이번 주인지 확인
 */
function isThisWeek(date) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // 이번 주 일요일
  weekStart.setHours(0, 0, 0, 0);
  return date >= weekStart;
}

/**
 * 주어진 날짜가 이번 달인지 확인
 */
function isThisMonth(date) {
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

module.exports = {
  isToday,
  isThisWeek,
  isThisMonth
};
