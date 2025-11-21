/**
 * 시간 계산 유틸리티 함수
 */

/**
 * 시간 문자열에 시간을 더함
 * @param {string} timeStr - 시작 시간 (HH:MM 형식)
 * @param {number} hours - 더할 시간 (시간 단위)
 * @returns {string} - 결과 시간 (HH:MM 형식)
 */
function addHours(timeStr, hours) {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMinutes = h * 60 + m + (hours * 60);
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

/**
 * 두 시간 문자열 간의 시간 차이를 계산
 * @param {string} startTime - 시작 시간 (HH:MM)
 * @param {string} endTime - 종료 시간 (HH:MM)
 * @returns {number} - 시간 차이 (시간 단위)
 */
function getHoursDifference(startTime, endTime) {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
}

/**
 * 시간 문자열을 분 단위로 변환
 * @param {string} timeStr - 시간 문자열 (HH:MM)
 * @returns {number} - 분 단위 시간
 */
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * 분 단위를 시간 문자열로 변환
 * @param {number} minutes - 분 단위 시간
 * @returns {string} - 시간 문자열 (HH:MM)
 */
function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * 두 시간 범위가 겹치는지 확인
 * @param {number} start1 - 범위1 시작 (분)
 * @param {number} end1 - 범위1 종료 (분)
 * @param {number} start2 - 범위2 시작 (분)
 * @param {number} end2 - 범위2 종료 (분)
 * @returns {boolean} - 겹치면 true
 */
function hasTimeOverlap(start1, end1, start2, end2) {
  return (start1 >= start2 && start1 < end2) ||
         (end1 > start2 && end1 <= end2) ||
         (start1 <= start2 && end1 >= end2);
}

module.exports = {
  addHours,
  getHoursDifference,
  timeToMinutes,
  minutesToTime,
  hasTimeOverlap
};
