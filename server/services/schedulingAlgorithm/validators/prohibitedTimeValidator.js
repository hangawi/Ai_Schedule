/**
 * 금지시간 검증 모듈
 *
 * 자동배정 시 금지시간(점심시간 등) 침범을 방지하기 위한 검증 및 분할 로직
 */

const { timeToMinutes, minutesToTime } = require('../utils/timeUtils');

/**
 * 시간 슬롯이 금지 시간 범위와 겹치는지 확인
 *
 * @param {string} startTime - 슬롯 시작 시간 (HH:MM)
 * @param {string} endTime - 슬롯 종료 시간 (HH:MM)
 * @param {Array} blockedTimes - 금지 시간 배열 [{startTime, endTime, name}]
 * @returns {Object|null} 겹치는 금지 시간 객체, 없으면 null
 */
function isTimeInBlockedRange(startTime, endTime, blockedTimes) {
  if (!blockedTimes || blockedTimes.length === 0) return null;

  const slotStart = timeToMinutes(startTime);
  const slotEnd = timeToMinutes(endTime);

  for (const blocked of blockedTimes) {
    const blockedStart = timeToMinutes(blocked.startTime);
    const blockedEnd = timeToMinutes(blocked.endTime);

    // 겹치는 경우:
    // 1. 슬롯 시작이 금지 범위 안에 있거나
    // 2. 슬롯 종료가 금지 범위 안에 있거나
    // 3. 슬롯이 금지 범위를 완전히 포함하는 경우
    if (
      (slotStart >= blockedStart && slotStart < blockedEnd) ||
      (slotEnd > blockedStart && slotEnd <= blockedEnd) ||
      (slotStart <= blockedStart && slotEnd >= blockedEnd)
    ) {
      return blocked;
    }
  }

  return null;
}

/**
 * 연속된 슬롯 블록이 금지시간을 피할 수 있도록 분할
 *
 * 예: 6시간 블록이 12:00-13:00 점심시간을 걸침
 *     → [09:00-12:00 (3시간), 13:00-16:00 (3시간)]으로 분할
 *
 * @param {number} totalMinutes - 총 필요 시간 (분)
 * @param {Array} availableSlots - 가용 슬롯 배열 [{day, date, startTime, endTime, slotKey}]
 * @param {Array} blockedTimes - 금지 시간 배열
 * @param {number} minBlockMinutes - 최소 블록 크기 (분, 기본 60분 = 1시간)
 * @returns {Array} 분할된 블록 배열 [{startTime, endTime, duration}] 또는 빈 배열 (불가능한 경우)
 */
function splitBlockToAvoidProhibited(totalMinutes, availableSlots, blockedTimes, minBlockMinutes = 60) {
  if (!blockedTimes || blockedTimes.length === 0) {
    // 금지시간이 없으면 분할 불필요
    return [];
  }

  // 가용 슬롯을 시간순으로 정렬
  const sortedSlots = [...availableSlots].sort((a, b) =>
    timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  const blocks = [];
  let remainingMinutes = totalMinutes;

  for (const slot of sortedSlots) {
    if (remainingMinutes <= 0) break;

    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd = timeToMinutes(slot.endTime);
    const slotDuration = slotEnd - slotStart;

    // 이 슬롯에서 사용할 수 있는 시간 계산
    const neededMinutes = Math.min(remainingMinutes, slotDuration);
    const blockEnd = slotStart + neededMinutes;

    // 금지시간과 겹치는지 확인
    const blockedTime = isTimeInBlockedRange(
      minutesToTime(slotStart),
      minutesToTime(blockEnd),
      blockedTimes
    );

    if (!blockedTime) {
      // 겹치지 않으면 블록 추가
      if (neededMinutes >= minBlockMinutes) {
        blocks.push({
          startTime: minutesToTime(slotStart),
          endTime: minutesToTime(blockEnd),
          duration: neededMinutes,
          day: slot.day,
          date: slot.date
        });
        remainingMinutes -= neededMinutes;
      }
    } else {
      // 금지시간과 겹치면 분할 시도
      const blockedStart = timeToMinutes(blockedTime.startTime);
      const blockedEnd = timeToMinutes(blockedTime.endTime);

      // 금지시간 이전 구간
      if (slotStart < blockedStart) {
        const beforeDuration = Math.min(blockedStart - slotStart, neededMinutes);
        if (beforeDuration >= minBlockMinutes) {
          blocks.push({
            startTime: minutesToTime(slotStart),
            endTime: minutesToTime(blockedStart),
            duration: beforeDuration,
            day: slot.day,
            date: slot.date
          });
          remainingMinutes -= beforeDuration;
        }
      }

      // 금지시간 이후 구간
      if (blockedEnd < slotEnd && remainingMinutes > 0) {
        const afterStart = Math.max(blockedEnd, slotStart);
        const afterDuration = Math.min(slotEnd - afterStart, remainingMinutes);
        if (afterDuration >= minBlockMinutes) {
          blocks.push({
            startTime: minutesToTime(afterStart),
            endTime: minutesToTime(afterStart + afterDuration),
            duration: afterDuration,
            day: slot.day,
            date: slot.date
          });
          remainingMinutes -= afterDuration;
        }
      }
    }
  }

  // 모든 시간을 배정할 수 있었는지 확인
  if (remainingMinutes > 0) {
    return []; // 실패
  }

  return blocks;
}

/**
 * 배정된 시간 슬롯이 금지시간을 침범하는지 최종 검증
 *
 * @param {Array} assignedSlots - 배정된 슬롯 배열 [{startTime, endTime}]
 * @param {Array} blockedTimes - 금지 시간 배열
 * @returns {Object} {isValid: boolean, violatedSlots: Array}
 */
function validateAssignedSlots(assignedSlots, blockedTimes) {
  if (!blockedTimes || blockedTimes.length === 0) {
    return { isValid: true, violatedSlots: [] };
  }

  const violatedSlots = [];

  for (const slot of assignedSlots) {
    const blockedTime = isTimeInBlockedRange(
      slot.startTime,
      slot.endTime,
      blockedTimes
    );

    if (blockedTime) {
      violatedSlots.push({
        slot,
        blockedTime,
        message: `${slot.startTime}-${slot.endTime}이(가) ${blockedTime.name || '금지 시간'}(${blockedTime.startTime}-${blockedTime.endTime})과 겹칩니다.`
      });
    }
  }

  return {
    isValid: violatedSlots.length === 0,
    violatedSlots
  };
}

module.exports = {
  isTimeInBlockedRange,
  splitBlockToAvoidProhibited,
  validateAssignedSlots
};
