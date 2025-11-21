/**
 * 날짜 관련 유틸리티 함수
 */

const { DAY_NAMES_KO, WEEKEND_NUMBERS } = require('../constants/schedulingConstants');

/**
 * Date 객체를 YYYY-MM-DD 형식 문자열로 변환
 * @param {Date} date - Date 객체
 * @returns {string} YYYY-MM-DD 형식
 */
const formatDateToString = (date) => {
  if (!date || isNaN(new Date(date).getTime())) return null;
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

/**
 * Date 객체를 YYYY-MM-DD 형식으로 변환 (UTC 기반)
 * @param {Date} date - Date 객체
 * @returns {string} YYYY-MM-DD 형식
 */
const formatDateToUTCString = (date) => {
  if (!date || isNaN(new Date(date).getTime())) return null;
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 요일 숫자를 한글 요일명으로 변환
 * @param {number} dayOfWeek - 요일 숫자 (0=일요일, 6=토요일)
 * @returns {string} 한글 요일명
 */
const getDayNameKo = (dayOfWeek) => {
  return DAY_NAMES_KO[dayOfWeek] || '';
};

/**
 * 날짜가 주말인지 확인
 * @param {Date} date - Date 객체
 * @returns {boolean}
 */
const isWeekend = (date) => {
  const dayOfWeek = new Date(date).getDay();
  return WEEKEND_NUMBERS.includes(dayOfWeek);
};

/**
 * 날짜가 주말인지 확인 (UTC 기반)
 * @param {Date} date - Date 객체
 * @returns {boolean}
 */
const isWeekendUTC = (date) => {
  const dayOfWeek = new Date(date).getUTCDay();
  return WEEKEND_NUMBERS.includes(dayOfWeek);
};

/**
 * JavaScript 요일(0-6)을 1-indexed 요일(1-7)로 변환
 * 0(일요일)은 7로 변환
 * @param {number} jsDay - JavaScript 요일 (0=일요일)
 * @returns {number} 1-indexed 요일 (1=월요일, 7=일요일)
 */
const convertToOneIndexedDay = (jsDay) => {
  return jsDay === 0 ? 7 : jsDay;
};

/**
 * 1-indexed 요일(1-7)을 JavaScript 요일(0-6)로 변환
 * 7(일요일)은 0으로 변환
 * @param {number} oneIndexedDay - 1-indexed 요일 (7=일요일)
 * @returns {number} JavaScript 요일 (0=일요일)
 */
const convertToJsDay = (oneIndexedDay) => {
  return oneIndexedDay === 7 ? 0 : oneIndexedDay;
};

/**
 * 스케줄링 기간의 종료일 계산
 * @param {Date} startDate - 시작일
 * @param {number} numWeeks - 주 수
 * @returns {Date} 종료일
 */
const calculateEndDate = (startDate, numWeeks) => {
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + (numWeeks * 7));
  return endDate;
};

/**
 * 스케줄링 기간의 종료일 계산 (UTC 기반)
 * @param {Date} startDate - 시작일
 * @param {number} numWeeks - 주 수
 * @returns {Date} 종료일
 */
const calculateEndDateUTC = (startDate, numWeeks) => {
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + (numWeeks * 7));
  return endDate;
};

/**
 * 두 날짜가 같은 날인지 비교
 * @param {Date} date1 - 첫 번째 날짜
 * @param {Date} date2 - 두 번째 날짜
 * @returns {boolean}
 */
const isSameDay = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.toDateString() === d2.toDateString();
};

/**
 * 날짜가 범위 내에 있는지 확인
 * @param {Date} date - 확인할 날짜
 * @param {Date} startDate - 범위 시작
 * @param {Date} endDate - 범위 끝
 * @returns {boolean}
 */
const isDateInRange = (date, startDate, endDate) => {
  const d = new Date(date);
  const start = new Date(startDate);
  const end = new Date(endDate);
  return d >= start && d < end;
};

/**
 * 날짜에 일수 추가
 * @param {Date} date - 원본 날짜
 * @param {number} days - 추가할 일수
 * @returns {Date} 새 날짜
 */
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * 날짜에 일수 추가 (UTC 기반)
 * @param {Date} date - 원본 날짜
 * @param {number} days - 추가할 일수
 * @returns {Date} 새 날짜
 */
const addDaysUTC = (date, days) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

module.exports = {
  formatDateToString,
  formatDateToUTCString,
  getDayNameKo,
  isWeekend,
  isWeekendUTC,
  convertToOneIndexedDay,
  convertToJsDay,
  calculateEndDate,
  calculateEndDateUTC,
  isSameDay,
  isDateInRange,
  addDays,
  addDaysUTC
};
