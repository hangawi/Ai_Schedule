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
  
  // 🔧 이번 주 범위 계산 (월요일 ~ 일요일)
  const requestDateObj = new Date(requestDate);
  const requestDay = requestDateObj.getUTCDay();
  const daysToMonday = requestDay === 0 ? 6 : requestDay - 1;
  
  const thisWeekMonday = new Date(requestDateObj);
  thisWeekMonday.setUTCDate(requestDateObj.getUTCDate() - daysToMonday);
  thisWeekMonday.setUTCHours(0, 0, 0, 0);
  
  const thisWeekSunday = new Date(thisWeekMonday);
  thisWeekSunday.setUTCDate(thisWeekMonday.getUTCDate() + 6);
  thisWeekSunday.setUTCHours(23, 59, 59, 999);

  console.log(`🔍 [buildScheduleByDay] 이번 주 범위: ${thisWeekMonday.toISOString().split('T')[0]} ~ ${thisWeekSunday.toISOString().split('T')[0]}`);

  userSchedule.forEach(s => {
    // ✅ specificDate가 있는 경우: 이번 주 범위 내에 있는지 체크
    if (s.specificDate) {
      const specificDateObj = new Date(s.specificDate);
      const isThisWeek = specificDateObj >= thisWeekMonday && specificDateObj <= thisWeekSunday;
      console.log(`   [buildScheduleByDay] specificDate: ${s.specificDate}, isThisWeek: ${isThisWeek}`);
      if (!isThisWeek) return; // 이번 주가 아니면 제외
    } else {
      // ✅ specificDate 없는 반복 일정: 매주 반복되므로 항상 포함
      console.log(`   [buildScheduleByDay] dayOfWeek: ${s.dayOfWeek}, 반복일정 - 포함`);
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
