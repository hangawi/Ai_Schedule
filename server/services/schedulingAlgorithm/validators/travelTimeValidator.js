/**
 * 이동시간 검증 모듈
 *
 * 교통수단 보기/적용 시 선호시간과 금지시간을 검증
 */

const { timeToMinutes, minutesToTime } = require('../utils/timeUtils');
const { isTimeInBlockedRange } = require('./prohibitedTimeValidator');

/**
 * 시간 범위가 멤버의 선호시간 안에 있는지 검증
 *
 * @param {string} startTime - 시작 시간 (HH:MM)
 * @param {string} endTime - 종료 시간 (HH:MM)
 * @param {Array} defaultSchedule - 멤버의 선호시간 배열 [{dayOfWeek, startTime, endTime, priority, specificDate}]
 * @param {Date|string} date - 날짜 (요일 계산용)
 * @returns {Object} { isValid: boolean, reason: string, matchedSchedules: Array }
 */
function isWithinPreferredTime(startTime, endTime, defaultSchedule, date) {
  if (!defaultSchedule || defaultSchedule.length === 0) {
    // 선호시간이 없으면 항상 허용
    return { isValid: true, reason: '선호시간 미설정', matchedSchedules: [] };
  }

  const dateObj = date instanceof Date ? date : new Date(date);
  const dayOfWeek = dateObj.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const dateString = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD

  // 특정 날짜 또는 요일에 해당하는 선호시간 필터링
  const relevantSchedules = defaultSchedule.filter(schedule => {
    if (schedule.specificDate) {
      return schedule.specificDate === dateString;
    }
    return schedule.dayOfWeek === dayOfWeek;
  });

  if (relevantSchedules.length === 0) {
    return {
      isValid: false,
      reason: `${dayOfWeek}요일(${dateString})에 선호시간 없음`,
      matchedSchedules: []
    };
  }

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  // 시작과 종료가 모두 선호시간 안에 있는지 확인
  for (const schedule of relevantSchedules) {
    const scheduleStart = timeToMinutes(schedule.startTime);
    const scheduleEnd = timeToMinutes(schedule.endTime);

    // 시작과 종료가 모두 이 선호시간 안에 있으면 OK
    if (startMinutes >= scheduleStart && endMinutes <= scheduleEnd) {
      return {
        isValid: true,
        reason: `선호시간 ${schedule.startTime}-${schedule.endTime} 안에 포함`,
        matchedSchedules: [schedule]
      };
    }
  }

  // 어떤 선호시간에도 완전히 포함되지 않음
  const scheduleRanges = relevantSchedules.map(s => `${s.startTime}-${s.endTime}`).join(', ');
  return {
    isValid: false,
    reason: `${startTime}-${endTime}이(가) 선호시간 [${scheduleRanges}]을 벗어남`,
    matchedSchedules: relevantSchedules
  };
}

/**
 * 멤버의 선호시간 가져오기 (defaultSchedule + scheduleExceptions)
 *
 * @param {Object} member - 멤버 객체 (user.defaultSchedule, user.scheduleExceptions 포함)
 * @returns {Array} 병합된 선호시간 배열
 */
function getAllPreferredTimes(member) {
  const preferredTimes = [];

  // defaultSchedule 추가
  if (member.defaultSchedule && Array.isArray(member.defaultSchedule)) {
    preferredTimes.push(...member.defaultSchedule);
  }

  // scheduleExceptions 추가 (특정 날짜 선호시간)
  if (member.scheduleExceptions && Array.isArray(member.scheduleExceptions)) {
    const exceptions = member.scheduleExceptions.map(ex => {
      const startDate = new Date(ex.startTime);
      const endDate = new Date(ex.endTime);

      return {
        dayOfWeek: startDate.getDay(),
        startTime: `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`,
        endTime: `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`,
        priority: ex.priority || 2,
        specificDate: startDate.toISOString().split('T')[0]
      };
    });
    preferredTimes.push(...exceptions);
  }

  return preferredTimes;
}

/**
 * 이동시간 포함 슬롯이 유효한지 검증 (선호시간 + 금지시간)
 *
 * @param {Object} slot - 검증할 슬롯 {startTime, endTime, date, user}
 * @param {Object} member - 멤버 객체 (user 정보 포함)
 * @param {Array} blockedTimes - 금지 시간 배열
 * @returns {Object} { isValid: boolean, errors: Array<string> }
 */
function validateTravelTimeSlot(slot, member, blockedTimes) {
  const errors = [];

  // 1. 선호시간 검증
  const defaultSchedule = getAllPreferredTimes(member);
  const preferredCheck = isWithinPreferredTime(
    slot.startTime,
    slot.endTime,
    defaultSchedule,
    slot.date
  );

  if (!preferredCheck.isValid) {
    errors.push(`[선호시간 위반] ${preferredCheck.reason}`);
  }

  // 2. 금지시간 검증
  const blockedTime = isTimeInBlockedRange(slot.startTime, slot.endTime, blockedTimes);
  if (blockedTime) {
    errors.push(`[금지시간 침범] ${slot.startTime}-${slot.endTime}이(가) ${blockedTime.name || '금지 시간'}(${blockedTime.startTime}-${blockedTime.endTime})과 겹침`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 여러 슬롯을 한 번에 검증
 *
 * @param {Array} slots - 검증할 슬롯 배열
 * @param {Array} members - 멤버 배열
 * @param {Array} blockedTimes - 금지 시간 배열
 * @returns {Object} { isValid: boolean, invalidSlots: Array }
 */
function validateAllSlots(slots, members, blockedTimes) {
  const invalidSlots = [];

  for (const slot of slots) {
    // 슬롯의 사용자 ID 찾기
    const slotUserId = slot.user._id ? slot.user._id.toString() : slot.user.toString();

    // 해당 멤버 찾기
    const member = members.find(m => {
      const memberId = m.user._id ? m.user._id.toString() : m.user.toString();
      return memberId === slotUserId;
    });

    if (!member) {
      invalidSlots.push({
        slot,
        errors: ['멤버 정보를 찾을 수 없습니다.']
      });
      continue;
    }

    // 검증 실행
    const validation = validateTravelTimeSlot(slot, member.user, blockedTimes);
    if (!validation.isValid) {
      invalidSlots.push({
        slot,
        errors: validation.errors
      });
    }
  }

  return {
    isValid: invalidSlots.length === 0,
    invalidSlots
  };
}

module.exports = {
  isWithinPreferredTime,
  getAllPreferredTimes,
  validateTravelTimeSlot,
  validateAllSlots
};
