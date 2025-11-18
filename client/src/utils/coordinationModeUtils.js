/**
 * ============================================================================
 * coordinationModeUtils.js - 일정맞추기 주간/월간 모드 유틸리티
 * ============================================================================
 *
 * 주간/월간 모드에 따른 일정 이동 제한 및 날짜 계산 유틸리티
 *
 * [주요 기능]
 * - validateMoveRequest: 이동 가능 여부 검증
 * - getWeekRange: 현재 주 범위 계산
 * - getMonthRange: 현재 월 범위 계산
 * - parseWeekBasedDate: "둘째 주 월요일" → 날짜 변환
 * - parseDateBasedRequest: "11월 15일" → 날짜 변환
 *
 * [사용처]
 * - useChat.js: 채팅 시간 변경 요청 시 검증
 * - coordinationExchangeController.js: 백엔드 검증
 * ============================================================================
 */

// 요일 매핑
const DAY_MAP = {
  '월': 1, '월요일': 1, 'monday': 1, 'mon': 1,
  '화': 2, '화요일': 2, 'tuesday': 2, 'tue': 2,
  '수': 3, '수요일': 3, 'wednesday': 3, 'wed': 3,
  '목': 4, '목요일': 4, 'thursday': 4, 'thu': 4,
  '금': 5, '금요일': 5, 'friday': 5, 'fri': 5,
  '토': 6, '토요일': 6, 'saturday': 6, 'sat': 6,
  '일': 0, '일요일': 0, 'sunday': 0, 'sun': 0
};

// 주차 매핑
const WEEK_MAP = {
  '첫째': 1, '첫번째': 1, '1': 1, '1주': 1, '1주차': 1,
  '둘째': 2, '두번째': 2, '2': 2, '2주': 2, '2주차': 2,
  '셋째': 3, '세번째': 3, '3': 3, '3주': 3, '3주차': 3,
  '넷째': 4, '네번째': 4, '4': 4, '4주': 4, '4주차': 4,
  '다섯째': 5, '다섯번째': 5, '5': 5, '5주': 5, '5주차': 5
};

/**
 * 현재 주의 월요일~일요일 범위를 계산
 * @param {Date} baseDate - 기준 날짜
 * @returns {Object} { start: Date, end: Date }
 */
export const getWeekRange = (baseDate = new Date()) => {
  const date = new Date(baseDate);
  const day = date.getDay();

  // 월요일 찾기 (일요일이면 6일 전, 아니면 (요일-1)일 전)
  const daysToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(date);
  monday.setDate(date.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);

  // 일요일 찾기
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
};

/**
 * 현재 월의 전체 범위를 계산 (첫째 주 월요일 ~ 마지막 주 일요일)
 * @param {Date} baseDate - 기준 날짜
 * @returns {Object} { start: Date, end: Date, weeks: number }
 */
export const getMonthRange = (baseDate = new Date()) => {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();

  // 해당 월의 1일
  const firstDayOfMonth = new Date(year, month, 1);

  // 해당 월의 마지막 날
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // 첫째 주 월요일 찾기
  const firstDayOfWeek = firstDayOfMonth.getDay();
  const daysToMonday = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const firstMonday = new Date(firstDayOfMonth);
  firstMonday.setDate(firstDayOfMonth.getDate() - daysToMonday);
  firstMonday.setHours(0, 0, 0, 0);

  // 마지막 주 일요일 찾기
  const lastDayOfWeek = lastDayOfMonth.getDay();
  const daysToSunday = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
  const lastSunday = new Date(lastDayOfMonth);
  lastSunday.setDate(lastDayOfMonth.getDate() + daysToSunday);
  lastSunday.setHours(23, 59, 59, 999);

  // 주 수 계산
  const totalDays = Math.ceil((lastSunday - firstMonday) / (1000 * 60 * 60 * 24)) + 1;
  const weeks = Math.ceil(totalDays / 7);

  return { start: firstMonday, end: lastSunday, weeks };
};

/**
 * 주차 기반 날짜 파싱 ("11월 둘째 주 월요일" → Date)
 * @param {string} weekStr - 주차 문자열 (예: "둘째", "2주차")
 * @param {string} dayStr - 요일 문자열 (예: "월요일", "월")
 * @param {number} month - 월 (1-12)
 * @param {number} year - 연도
 * @returns {Date|null}
 */
export const parseWeekBasedDate = (weekStr, dayStr, month, year = new Date().getFullYear()) => {
  const weekNum = WEEK_MAP[weekStr];
  const dayNum = DAY_MAP[dayStr?.toLowerCase()];

  if (!weekNum || dayNum === undefined) {
    return null;
  }

  // 해당 월의 1일
  const firstDay = new Date(year, month - 1, 1);

  // 첫째 주 월요일 찾기
  const firstDayOfWeek = firstDay.getDay();
  const daysToMonday = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const firstMonday = new Date(firstDay);
  firstMonday.setDate(firstDay.getDate() - daysToMonday);

  // 요청한 주차의 월요일
  const targetMonday = new Date(firstMonday);
  targetMonday.setDate(firstMonday.getDate() + (weekNum - 1) * 7);

  // 요청한 요일
  const targetDate = new Date(targetMonday);
  const daysToAdd = dayNum === 0 ? 6 : dayNum - 1; // 월요일 기준
  targetDate.setDate(targetMonday.getDate() + daysToAdd);

  return targetDate;
};

/**
 * 날짜 기반 요청 파싱 ("11월 15일" → Date)
 * @param {number} month - 월 (1-12)
 * @param {number} day - 일
 * @param {number} year - 연도
 * @returns {Date}
 */
export const parseDateBasedRequest = (month, day, year = new Date().getFullYear()) => {
  return new Date(year, month - 1, day);
};

/**
 * 이동 요청 검증
 * @param {Object} params
 * @param {string} params.viewMode - 'week' 또는 'month'
 * @param {Date} params.currentDate - 현재 기준 날짜
 * @param {Date} params.targetDate - 이동 목표 날짜
 * @param {Date} params.sourceDate - 현재 슬롯 날짜 (선택)
 * @returns {Object} { valid: boolean, message: string, warning?: string }
 */
export const validateMoveRequest = ({ viewMode, currentDate, targetDate, sourceDate }) => {
  const target = new Date(targetDate);
  const current = new Date(currentDate);

  if (viewMode === 'week') {
    // 주간 모드: 이번 주 내에서만 이동 가능
    const weekRange = getWeekRange(current);

    if (target < weekRange.start || target > weekRange.end) {
      const weekStart = weekRange.start.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
      const weekEnd = weekRange.end.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });

      return {
        valid: false,
        message: `주간 모드에서는 이번 주(${weekStart} ~ ${weekEnd}) 내에서만 이동할 수 있습니다. 다른 주로 이동하려면 월간 모드로 전환해주세요.`
      };
    }

    return { valid: true, message: '이동 가능합니다.' };

  } else {
    // 월간 모드: 월 전체 범위에서 이동 가능
    const monthRange = getMonthRange(current);

    if (target < monthRange.start || target > monthRange.end) {
      const monthName = current.toLocaleDateString('ko-KR', { month: 'long' });

      return {
        valid: false,
        message: `${monthName} 범위를 벗어나는 이동입니다.`,
        warning: '다음 달로 이동하시겠습니까?'
      };
    }

    return { valid: true, message: '이동 가능합니다.' };
  }
};

/**
 * 요일 문자열을 숫자로 변환
 * @param {string} dayStr - 요일 문자열
 * @returns {number|null} 0(일)~6(토)
 */
export const getDayNumber = (dayStr) => {
  return DAY_MAP[dayStr?.toLowerCase()] ?? null;
};

/**
 * 특정 날짜가 몇 주차인지 계산
 * @param {Date} date - 확인할 날짜
 * @returns {number} 주차 (1~5)
 */
export const getWeekOfMonth = (date) => {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstDayOfWeek = firstDay.getDay();
  const daysToMonday = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const firstMonday = new Date(firstDay);
  firstMonday.setDate(firstDay.getDate() - daysToMonday);

  const diffDays = Math.floor((date - firstMonday) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
};

/**
 * viewMode를 localStorage에 저장
 * @param {string} mode - 'week' 또는 'month'
 */
export const saveViewMode = (mode) => {
  localStorage.setItem('coordinationViewMode', mode);
};

/**
 * localStorage에서 viewMode 가져오기
 * @returns {string} 'week' 또는 'month'
 */
export const getViewMode = () => {
  return localStorage.getItem('coordinationViewMode') || 'week';
};

/**
 * currentWeekStartDate를 localStorage에 저장
 * @param {Date|string} date
 */
export const saveCurrentWeekStartDate = (date) => {
  const dateStr = date instanceof Date ? date.toISOString() : date;
  localStorage.setItem('coordinationCurrentWeekStartDate', dateStr);
};

/**
 * localStorage에서 currentWeekStartDate 가져오기
 * @returns {Date}
 */
export const getCurrentWeekStartDate = () => {
  const stored = localStorage.getItem('coordinationCurrentWeekStartDate');
  return stored ? new Date(stored) : new Date();
};

export default {
  getWeekRange,
  getMonthRange,
  parseWeekBasedDate,
  parseDateBasedRequest,
  validateMoveRequest,
  getDayNumber,
  getWeekOfMonth,
  saveViewMode,
  getViewMode,
  saveCurrentWeekStartDate,
  getCurrentWeekStartDate
};
