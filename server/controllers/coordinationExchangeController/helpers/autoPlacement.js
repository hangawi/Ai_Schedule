/**
 * 자동 배치 로직 헬퍼
 */

const { timeToMinutes, minutesToTime } = require('../utils/timeUtils');
const { mergeScheduleRanges } = require('../utils/slotMerger');
const { AUTO_PLACEMENT_INTERVAL } = require('../constants/timeFormats');

/**
 * 빈 슬롯 찾기
 * @param {Object} params - 파라미터
 * @param {Array} params.allSlotsOnDate - 해당 날짜의 모든 슬롯
 * @param {Array} params.memberSchedules - 멤버 선호 스케줄
 * @param {number} params.totalHours - 필요한 총 시간 (시간 단위)
 * @returns {Object|null} - { start: 시작분, end: 종료분 } 또는 null
 */
function findAvailableSlot({ allSlotsOnDate, memberSchedules, totalHours }) {
  const totalMinutes = totalHours * 60;

  // 선호 시간대 병합
  const scheduleTimes = memberSchedules.map(s => ({
    start: timeToMinutes(s.startTime),
    end: timeToMinutes(s.endTime)
  })).sort((a, b) => a.start - b.start);

  const mergedSchedule = [];
  scheduleTimes.forEach(slot => {
    if (mergedSchedule.length === 0 || slot.start > mergedSchedule[mergedSchedule.length - 1].end) {
      mergedSchedule.push({ ...slot });
    } else {
      mergedSchedule[mergedSchedule.length - 1].end = Math.max(
        mergedSchedule[mergedSchedule.length - 1].end,
        slot.end
      );
    }
  });

  // 각 선호 시간 블록에서 빈 슬롯 찾기
  for (const block of mergedSchedule) {
    let currentStart = block.start;

    while (currentStart + totalMinutes <= block.end) {
      const currentEnd = currentStart + totalMinutes;

      // 충돌 확인
      const hasConflict = allSlotsOnDate.some(slot => {
        const slotStart = timeToMinutes(slot.startTime);
        const slotEnd = timeToMinutes(slot.endTime);
        return currentStart < slotEnd && currentEnd > slotStart;
      });

      if (!hasConflict) {
        return { start: currentStart, end: currentEnd };
      }

      currentStart += AUTO_PLACEMENT_INTERVAL;
    }
  }

  return null;
}

/**
 * 슬롯 제거
 * @param {Object} room - Room 객체
 * @param {Array} slotIds - 제거할 슬롯 ID 배열
 */
function removeSlots(room, slotIds) {
  for (const slotId of slotIds) {
    const index = room.timeSlots.findIndex(slot => slot._id.toString() === slotId);
    if (index !== -1) {
      room.timeSlots.splice(index, 1);
    }
  }
}

/**
 * 새 슬롯 생성 (30분 단위)
 * @param {Object} params - 파라미터
 * @param {string} params.userId - 사용자 ID
 * @param {Date} params.targetDate - 타겟 날짜
 * @param {string} params.startTime - 시작 시간
 * @param {string} params.endTime - 종료 시간
 * @param {string} params.dayEnglish - 요일 (영어)
 * @param {number} params.priority - 우선순위
 * @param {string} params.ownerId - 방장 ID
 * @returns {Array} - 생성된 슬롯 배열
 */
function createNewSlots({ userId, targetDate, startTime, endTime, dayEnglish, priority, ownerId }) {
  const { addHours } = require('../utils/timeUtils');
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const totalMinutes = endMinutes - startMinutes;
  const numSlots = Math.ceil(totalMinutes / 30);

  const newSlots = [];
  let currentTime = startTime;

  for (let i = 0; i < numSlots; i++) {
    const slotEndTime = addHours(currentTime, 0.5);
    newSlots.push({
      user: userId,
      date: targetDate,
      startTime: currentTime,
      endTime: slotEndTime,
      day: dayEnglish,
      priority: priority || 3,
      subject: '자동 배정',
      assignedBy: ownerId,
      assignedAt: new Date(),
      status: 'confirmed'
    });
    currentTime = slotEndTime;
  }

  return newSlots;
}

module.exports = {
  findAvailableSlot,
  removeSlots,
  createNewSlots
};
