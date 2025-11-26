// 시간 변환 유틸리티

/**
 * 시간 문자열을 분(minutes)으로 변환
 * @param {string} timeStr - "HH:MM" 형식의 시간
 * @returns {number} 분 단위 시간
 */
const toMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

/**
 * 분(minutes)을 시간 문자열로 변환
 * @param {number} minutes - 분 단위 시간
 * @returns {string} "HH:MM" 형식의 시간
 */
const toTimeString = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * 두 시간 범위가 겹치는지 확인
 * @param {string} start1 - 첫 번째 시작 시간
 * @param {string} end1 - 첫 번째 종료 시간
 * @param {string} start2 - 두 번째 시작 시간
 * @param {string} end2 - 두 번째 종료 시간
 * @returns {boolean} 겹치면 true
 */
const timeRangesOverlap = (start1, end1, start2, end2) => {
  const s1 = toMinutes(start1);
  const e1 = toMinutes(end1);
  const s2 = toMinutes(start2);
  const e2 = toMinutes(end2);
  return s1 < e2 && s2 < e1;
};

module.exports = { toMinutes, toTimeString, timeRangesOverlap };
