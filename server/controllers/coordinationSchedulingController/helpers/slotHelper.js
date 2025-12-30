// 슬롯 처리 헬퍼
const { timeToMinutes } = require('../utils/timeUtils');

/**
 * 슬롯 중복 확인
 * @param {Array} existingSlots - 기존 슬롯 배열
 * @param {Object} newSlot - 새 슬롯
 * @returns {boolean} 중복 여부
 */
const isDuplicateSlot = (existingSlots, newSlot) => {
  return existingSlots.some(existing =>
    existing.user.toString() === newSlot.user.toString() &&
    existing.date.toISOString() === newSlot.date.toISOString() &&
    existing.startTime === newSlot.startTime &&
    existing.endTime === newSlot.endTime
  );
};

/**
 * 사용자의 personalTimes에 슬롯 추가
 * @param {Object} user - 사용자 객체
 * @param {Object} slot - 슬롯 객체
 * @param {boolean} isOwner - 방장 여부
 */
const addSlotToPersonalTimes = (user, slot, isOwner = false) => {
  const personalTime = {
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    subject: slot.subject,
    priority: isOwner ? 2 : 1, // 방장 수업은 우선순위 2, 조원 수업은 1
    memo: isOwner ? '방장 수업' : '확정된 수업',
  };

  if (!user.personalTimes) {
    user.personalTimes = [];
  }

  // 중복 체크
  const exists = user.personalTimes.some(pt =>
    pt.date.toISOString() === personalTime.date.toISOString() &&
    pt.startTime === personalTime.startTime &&
    pt.endTime === personalTime.endTime
  );

  if (!exists) {
    user.personalTimes.push(personalTime);
  }
};

/**
 * 선호시간 슬롯 삭제 (특정 날짜 범위)
 * @param {Object} user - 사용자 객체
 * @param {Date} startDate - 시작 날짜
 * @param {Date} endDate - 종료 날짜
 * @param {number} minPriority - 최소 우선순위
 */
const removePreferredTimesInRange = (user, startDate, endDate, minPriority = 2) => {
  if (!user.scheduleExceptions) return;

  user.scheduleExceptions = user.scheduleExceptions.filter(exception => {
    const exceptionDate = new Date(exception.specificDate);
    const isInRange = exceptionDate >= startDate && exceptionDate <= endDate;
    const hasHigherPriority = (exception.priority || 3) >= minPriority;

    // 범위 밖이거나, 우선순위가 낮으면 유지
    return !isInRange || !hasHigherPriority;
  });
};

/**
 * 시간 블록이 겹치는지 확인
 * @param {string} start1 - 시작 시간 1
 * @param {string} end1 - 종료 시간 1
 * @param {string} start2 - 시작 시간 2
 * @param {string} end2 - 종료 시간 2
 * @returns {boolean} 겹침 여부
 */
const isTimeOverlap = (start1, end1, start2, end2) => {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);

  return s1 < e2 && s2 < e1;
};

/**
 * 날짜가 범위 내에 있는지 확인
 * @param {Date} date - 확인할 날짜
 * @param {Date} startDate - 시작 날짜
 * @param {Date} endDate - 종료 날짜
 * @returns {boolean} 범위 내 여부
 */
const isDateInRange = (date, startDate, endDate) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  return d >= start && d <= end;
};

module.exports = {
  isDuplicateSlot,
  addSlotToPersonalTimes,
  removePreferredTimesInRange,
  isTimeOverlap,
  isDateInRange,
};
