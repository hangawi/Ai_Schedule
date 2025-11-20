import { timeToMinutes } from './timeUtils';

/**
 * 수면시간 여부 확인
 * @param {Object} schedule - 일정 객체
 * @returns {boolean} 수면시간 여부
 */
export const isSleepTime = (schedule) => {
  if (!schedule) return false;

  // 제목이나 이름에 '수면' 포함 확인
  if (schedule.title?.includes('수면') || schedule.name?.includes('수면')) {
    return true;
  }

  // 시작 시간이 22:00 이후인지 확인
  if (schedule.startTime && timeToMinutes(schedule.startTime) >= 22 * 60) {
    return true;
  }

  return false;
};

/**
 * 수면시간 필터 (기본 모드에서만 제외)
 * @param {Object} schedule - 일정 객체
 * @param {boolean} showFullDay - 24시간 모드 여부
 * @returns {boolean} 표시 여부
 */
export const filterSleepTime = (schedule, showFullDay) => {
  // 24시간 모드이면 모든 시간 표시
  if (showFullDay) return true;

  // 기본 모드에서는 수면시간 제외
  return !isSleepTime(schedule);
};

/**
 * 개인시간 필터링 (수면시간 제외)
 * @param {Array} personalSlots - 개인시간 배열
 * @param {boolean} showFullDay - 24시간 모드 여부
 * @returns {Array} 필터링된 개인시간 배열
 */
export const filterPersonalSlots = (personalSlots, showFullDay) => {
  if (!personalSlots) return [];

  return personalSlots.filter(p => filterSleepTime(p, showFullDay));
};

/**
 * 중복 제거 (같은 타입, 제목, 우선순위를 가진 이벤트는 하나만 유지)
 * @param {Array} events - 이벤트 배열
 * @returns {Array} 중복 제거된 이벤트 배열
 */
export const removeDuplicateEvents = (events) => {
  const uniqueEvents = [];
  const seenKeys = new Set();

  events.forEach(event => {
    const key = `${event.type}-${event.title || ''}-${event.priority || ''}-${event.startTime || ''}-${event.endTime || ''}`;

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueEvents.push(event);
    }
  });

  return uniqueEvents;
};

/**
 * 특정 날짜의 요일이 포함되는지 확인
 * @param {Array} days - 요일 배열 (1=월, ..., 7=일)
 * @param {number} dayOfWeek - JavaScript 요일 (0=일, 1=월, ...)
 * @returns {boolean} 포함 여부
 */
export const isDayIncluded = (days, dayOfWeek) => {
  if (!days || days.length === 0) return true; // 빈 배열이면 모든 요일

  // DB 형식 (1=월, 7=일) → JS 형식 (0=일, 1=월, ...)
  const convertedDays = days.map(day => day === 7 ? 0 : day);

  return convertedDays.includes(dayOfWeek);
};

/**
 * 특정 날짜가 일정의 specificDate와 일치하는지 확인
 * @param {string} specificDate - 일정의 특정 날짜
 * @param {Date} targetDate - 확인할 대상 날짜
 * @returns {boolean} 일치 여부
 */
export const isSpecificDateMatch = (specificDate, targetDate) => {
  if (!specificDate || !targetDate) return false;

  const scheduleDate = new Date(specificDate);
  const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
  const scheduleDateStr = `${scheduleDate.getFullYear()}-${String(scheduleDate.getMonth() + 1).padStart(2, '0')}-${String(scheduleDate.getDate()).padStart(2, '0')}`;

  return targetDateStr === scheduleDateStr;
};
