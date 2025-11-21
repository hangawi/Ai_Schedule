/**
 * 충돌 병합 관련 헬퍼 함수
 */

const { calculateEndTime, formatTimeString } = require('../utils/timeUtils');
const { extractDateFromSlotKey, extractTimeFromSlotKey } = require('../utils/slotUtils');
const { sortedJoin } = require('../utils/arrayUtils');

/**
 * 연속된 충돌 슬롯들을 블록으로 병합
 * @param {Array} conflicts - 충돌 배열
 * @param {Object} timetable - 타임테이블 객체
 * @returns {Array} 병합된 충돌 블록 배열
 */
const mergeConsecutiveConflicts = (conflicts, timetable) => {
  if (!conflicts || conflicts.length === 0) return [];

  // 슬롯 키로 정렬
  const sortedConflicts = [...conflicts].sort((a, b) => a.slotKey.localeCompare(b.slotKey));

  const mergedBlocks = [];
  let currentBlock = null;

  for (const conflict of sortedConflicts) {
    const { slotKey, availableMembers } = conflict;

    const date = extractDateFromSlotKey(slotKey);
    const timeRaw = extractTimeFromSlotKey(slotKey);
    const time = formatTimeString(timeRaw);
    const membersKey = sortedJoin(availableMembers);

    if (currentBlock === null) {
      currentBlock = {
        startDate: date,
        startTime: time,
        endTime: calculateEndTime(time),
        membersKey: membersKey,
        conflictingMembers: availableMembers,
        dayOfWeek: timetable[slotKey]?.dayOfWeek,
        dateObj: timetable[slotKey]?.date
      };
    } else {
      const isSameDay = (date === currentBlock.startDate);
      const isAdjacentTime = (currentBlock.endTime === time);
      const isSameMembers = (membersKey === currentBlock.membersKey);

      if (isSameDay && isAdjacentTime && isSameMembers) {
        // 연속된 충돌 - 블록 확장
        currentBlock.endTime = calculateEndTime(time);
      } else {
        // 새 블록 시작
        mergedBlocks.push(currentBlock);
        currentBlock = {
          startDate: date,
          startTime: time,
          endTime: calculateEndTime(time),
          membersKey: membersKey,
          conflictingMembers: availableMembers,
          dayOfWeek: timetable[slotKey]?.dayOfWeek,
          dateObj: timetable[slotKey]?.date
        };
      }
    }
  }

  if (currentBlock) {
    mergedBlocks.push(currentBlock);
  }

  return mergedBlocks;
};

/**
 * 충돌 블록의 총 시간(분) 계산
 * @param {Object} block - 충돌 블록
 * @returns {number} 총 분
 */
const calculateBlockDuration = (block) => {
  const [startH, startM] = block.startTime.split(':').map(Number);
  const [endH, endM] = block.endTime.split(':').map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
};

/**
 * 충돌 블록의 슬롯 수 계산
 * @param {Object} block - 충돌 블록
 * @returns {number} 슬롯 수
 */
const calculateBlockSlotCount = (block) => {
  return calculateBlockDuration(block) / 30;
};

/**
 * 블록의 종료 시간 계산
 * @param {Object} block - 충돌 블록
 * @returns {string} HH:MM 형식 종료 시간
 */
const getBlockEndTime = (block) => {
  const startMinutes = (parseInt(block.startTime.split(':')[0]) * 60) + parseInt(block.startTime.split(':')[1]);
  const endMinutes = startMinutes + block.duration;
  const hour = Math.floor(endMinutes / 60);
  const min = endMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

/**
 * 할당량 채운 멤버 필터링
 * @param {Array} conflictingMembers - 충돌 멤버 배열
 * @param {Object} assignments - assignments 객체
 * @param {Object} memberRequiredSlots - 필요 슬롯 정보
 * @returns {Array} 아직 할당이 필요한 멤버 배열
 */
const filterUnsatisfiedConflictingMembers = (conflictingMembers, assignments, memberRequiredSlots) => {
  return conflictingMembers.filter(memberId => {
    const requiredSlots = memberRequiredSlots[memberId] || 0;
    const assignedSlots = (assignments[memberId]?.assignedHours || 0);
    return assignedSlots < requiredSlots;
  });
};

module.exports = {
  mergeConsecutiveConflicts,
  calculateBlockDuration,
  calculateBlockSlotCount,
  getBlockEndTime,
  filterUnsatisfiedConflictingMembers
};
