/**
 * ===================================================================================================
 * Build Schedule By Day (요일별 스케줄 구축 헬퍼)
 * ===================================================================================================
 *
 * 설명: 사용자의 선호시간을 요일별로 그룹화하고 병합
 *
 * 주요 기능:
 * - 이번 주 범위 계산 (월요일 ~ 일요일)
 * - specificDate 있는 일정: 이번 주 범위 내만 포함
 * - specificDate 없는 일정: 반복 일정으로 항상 포함
 * - 겹치는 시간대 병합
 *
 * 반환값:
 * {
 *   "1": [{start: 540, end: 720}],  // 월요일 09:00-12:00
 *   "2": [{start: 540, end: 1020}]  // 화요일 09:00-17:00
 * }
 *
 * 관련 파일:
 * - server/controllers/coordinationRequestController/index.js
 * - server/controllers/coordinationExchangeController/services/dateChangeService.js
 *
 * ===================================================================================================
 */

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



  userSchedule.forEach(s => {
    // ✅ dayOfWeek 계산 (scheduleExceptions의 경우 specificDate에서 계산)
    let dayOfWeek = s.dayOfWeek;

    // ✅ specificDate가 있는 경우: 이번 주 범위 내에 있는지 체크
    if (s.specificDate) {
      const specificDateObj = new Date(s.specificDate);
      const isThisWeek = specificDateObj >= thisWeekMonday && specificDateObj <= thisWeekSunday;
      if (!isThisWeek) return; // 이번 주가 아니면 제외

      // dayOfWeek가 없으면 specificDate에서 계산
      if (dayOfWeek === undefined || dayOfWeek === null) {
        dayOfWeek = specificDateObj.getDay();
      }
    } else {
      // ✅ specificDate 없는 반복 일정: 매주 반복되므로 항상 포함
    }

    // dayOfWeek가 여전히 없으면 스킵
    if (dayOfWeek === undefined || dayOfWeek === null) return;

    const blockKey = `${dayOfWeek}-${s.startTime}-${s.endTime}`;
    if (seenBlocks.has(blockKey)) return; // 중복 스킵
    seenBlocks.add(blockKey);

    if (!scheduleByDay[dayOfWeek]) scheduleByDay[dayOfWeek] = [];
    scheduleByDay[dayOfWeek].push({
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
