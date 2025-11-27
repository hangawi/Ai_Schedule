/**
 * 스케줄 검증 로직
 */

/**
 * 스케줄이 유효한지 검증
 */
function validateSchedule(schedule) {
  if (!schedule || !Array.isArray(schedule)) {
    return false;
  }
  return true;
}

/**
 * 스케줄이 비어있는지 확인
 */
function isScheduleEmpty(parsedSchedule, currentSchedule, action) {
  if (parsedSchedule.length === 0 && currentSchedule.length > 0) {
    if (action !== 'question') {
      return true;
    }
  }
  return false;
}

module.exports = {
  validateSchedule,
  isScheduleEmpty
};
