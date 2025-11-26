// 요일별 스케줄 구축 헬퍼

const { toMinutes } = require('../utils/timeConverter');

/**
 * 사용자 스케줄을 요일별로 그룹화하고 병합
 * @param {Array} userSchedule - 사용자 스케줄 배열
 * @param {Date} requestDate - 요청 날짜
 * @returns {Object} 요일별 스케줄 { dayOfWeek: [{start, end}, ...] }
 */
const buildScheduleByDay = (userSchedule, requestDate) => {
  const scheduleByDay = {};
  const seenBlocks = new Set();
  const requestDateMs = new Date(requestDate).getTime();

  userSchedule.forEach(s => {
    // 같은 주 (7일 이내)인지 체크
    if (s.specificDate) {
      const specificDateMs = new Date(s.specificDate).getTime();
      const daysDiff = Math.abs(specificDateMs - requestDateMs) / (1000 * 60 * 60 * 24);
      if (daysDiff > 7) return;
    }

    const blockKey = `${s.dayOfWeek}-${s.startTime}-${s.endTime}`;
    if (seenBlocks.has(blockKey)) return; // 중복 스킵
    seenBlocks.add(blockKey);

    if (!scheduleByDay[s.dayOfWeek]) scheduleByDay[s.dayOfWeek] = [];
    scheduleByDay[s.dayOfWeek].push({
      start: toMinutes(s.startTime),
      end: toMinutes(s.endTime)
    });
  });

  // 병합 및 정렬
  Object.keys(scheduleByDay).forEach(day => {
    const daySlots = scheduleByDay[day].sort((a, b) => a.start - b.start);
    const merged = [];
    daySlots.forEach(slot => {
      if (merged.length === 0 || slot.start > merged[merged.length - 1].end) {
        merged.push({ ...slot });
      } else {
        merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, slot.end);
      }
    });
    scheduleByDay[day] = merged;
  });

  return scheduleByDay;
};

module.exports = { buildScheduleByDay };
