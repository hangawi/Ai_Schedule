/**
 * 시간 범위 검증
 */

const { TIME_REGEX } = require('../constants/timeFormats');
const { ERROR_MESSAGES } = require('../constants/errorMessages');

/**
 * 시간 형식 검증 (HH:00 형식)
 * @param {string} time - 시간 문자열
 * @returns {boolean} - 유효하면 true
 */
function isValidTimeFormat(time) {
  return TIME_REGEX.test(time);
}

/**
 * 시간 파라미터 검증
 * @param {string} time - 시간 문자열
 * @throws {Error} - 검증 실패 시
 */
function validateTime(time) {
  if (time && !isValidTimeFormat(time)) {
    throw new Error(ERROR_MESSAGES.INVALID_TIME_FORMAT);
  }
}

module.exports = {
  isValidTimeFormat,
  validateTime
};
