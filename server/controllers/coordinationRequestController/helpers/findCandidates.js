// 후보 시간 찾기 헬퍼

const { toMinutes } = require('../utils/timeConverter');

/**
 * 빈 시간 후보들을 찾기
 * @param {Object} scheduleByDay - 요일별 스케줄
 * @param {number} originalDayOfWeek - 원래 요일
 * @param {Date} originalDate - 원래 날짜
 * @param {number} originalStartMinutes - 원래 시작 시간 (분)
 * @param {number} totalDuration - 필요한 총 시간 (분)
 * @param {number} requestStart - 요청 시작 시간 (분)
 * @param {number} requestEnd - 요청 종료 시간 (분)
 * @returns {Array} 후보 배열 (거리순 정렬됨)
 */
const findCandidates = (
  scheduleByDay,
  originalDayOfWeek,
  originalDate,
  originalStartMinutes,
  totalDuration,
  requestStart,
  requestEnd
) => {
  const candidates = [];

  // 월요일 계산
  const dayOfWeek = originalDate.getUTCDay();
  const monday = new Date(originalDate);
  monday.setUTCDate(originalDate.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));

  // 같은 날 우선 - 원래 시간 주변 검색
  if (scheduleByDay[originalDayOfWeek]) {
    scheduleByDay[originalDayOfWeek].forEach(block => {
      for (let start = block.start; start + totalDuration <= block.end; start += 30) {
        // 겹치는 슬롯 영역과 겹치면 스킵
        if (start < requestEnd && start + totalDuration > requestStart) return;

        const distance = Math.abs(start - originalStartMinutes);
        candidates.push({
          dayOfWeek: originalDayOfWeek,
          date: originalDate,
          startMinutes: start,
          distance
        });
      }
    });
  }

  // 다른 요일들
  Object.keys(scheduleByDay).forEach(dayNum => {
    const day = parseInt(dayNum);
    if (day === originalDayOfWeek) return; // 이미 처리함

    scheduleByDay[day].forEach(block => {
      for (let start = block.start; start + totalDuration <= block.end; start += 30) {
        const targetDate = new Date(monday);
        targetDate.setUTCDate(monday.getUTCDate() + day - 1);

        candidates.push({
          dayOfWeek: day,
          date: targetDate,
          startMinutes: start,
          distance: 24 * 60 * Math.abs(day - originalDayOfWeek) + Math.abs(start - originalStartMinutes)
        });
      }
    });
  });

  // 거리순 정렬
  candidates.sort((a, b) => a.distance - b.distance);

  return candidates;
};

module.exports = { findCandidates };
