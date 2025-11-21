/**
 * 요일/날짜 검증
 */

const { VALID_DAYS_KO, DAY_MAP_KO_TO_EN } = require('../constants/dayMappings');
const { ERROR_MESSAGES } = require('../constants/errorMessages');

/**
 * 한글 요일이 유효한지 검증
 * @param {string} dayKo - 한글 요일
 * @returns {boolean} - 유효하면 true
 */
function isValidDay(dayKo) {
  return VALID_DAYS_KO.includes(dayKo);
}

/**
 * 한글 요일을 영어로 변환
 * @param {string} dayKo - 한글 요일
 * @returns {string|null} - 영어 요일 또는 null (유효하지 않으면)
 */
function convertDayToEnglish(dayKo) {
  return DAY_MAP_KO_TO_EN[dayKo] || null;
}

/**
 * time_change 타입 파라미터 검증
 * @param {Object} parsed - 파싱된 데이터
 * @throws {Error} - 검증 실패 시
 */
function validateTimeChangeParams(parsed) {
  if (!parsed.targetDay || !isValidDay(parsed.targetDay)) {
    throw new Error(ERROR_MESSAGES.INVALID_DAY);
  }
}

/**
 * date_change 타입 파라미터 검증
 * @param {Object} parsed - 파싱된 데이터
 * @throws {Error} - 검증 실패 시
 */
function validateDateChangeParams(parsed) {
  if (!parsed.targetDate) {
    throw new Error(ERROR_MESSAGES.INVALID_TARGET_DATE);
  }
}

module.exports = {
  isValidDay,
  convertDayToEnglish,
  validateTimeChangeParams,
  validateDateChangeParams
};
