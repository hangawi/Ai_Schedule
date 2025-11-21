/**
 * 슬롯 병합 및 정렬 유틸리티
 */

const { timeToMinutes } = require('./timeUtils');

/**
 * 슬롯들을 시작 시간 기준으로 정렬
 * @param {Array} slots - 슬롯 배열
 * @returns {Array} - 정렬된 슬롯 배열
 */
function sortSlotsByTime(slots) {
  return [...slots].sort((a, b) => {
    const [aH, aM] = a.startTime.split(':').map(Number);
    const [bH, bM] = b.startTime.split(':').map(Number);
    return (aH * 60 + aM) - (bH * 60 + bM);
  });
}

/**
 * 연속된 슬롯들을 블록으로 그룹화
 * @param {Array} slots - 슬롯 배열
 * @returns {Array} - 연속 블록 배열 (각 블록은 슬롯 배열)
 */
function groupContinuousSlots(slots) {
  if (slots.length === 0) return [];

  const sorted = sortSlotsByTime(slots);
  const blocks = [];
  let currentBlock = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = currentBlock[currentBlock.length - 1];
    const curr = sorted[i];

    // 이전 슬롯의 종료 시간 = 현재 슬롯의 시작 시간 → 연속
    if (prev.endTime === curr.startTime) {
      currentBlock.push(curr);
    } else {
      // 연속 아님 → 현재 블록 저장, 새 블록 시작
      blocks.push([...currentBlock]);
      currentBlock = [curr];
    }
  }
  blocks.push(currentBlock);
  return blocks;
}

/**
 * 날짜별로 슬롯 그룹화
 * @param {Array} slots - 슬롯 배열
 * @returns {Object} - { dateKey: [slots] } 형태의 객체
 */
function groupSlotsByDate(slots) {
  const slotsByDate = {};
  slots.forEach(slot => {
    const dateKey = new Date(slot.date).toISOString().split('T')[0];
    if (!slotsByDate[dateKey]) {
      slotsByDate[dateKey] = [];
    }
    slotsByDate[dateKey].push(slot);
  });
  return slotsByDate;
}

/**
 * 스케줄 타임 범위들을 병합 (겹치는 범위 통합)
 * @param {Array} schedules - 스케줄 배열 (startTime, endTime 포함)
 * @returns {Array} - 병합된 범위 배열 ({ startMinutes, endMinutes, startTime, endTime })
 */
function mergeScheduleRanges(schedules) {
  if (schedules.length === 0) return [];

  const sorted = [...schedules].sort((a, b) => {
    const [aH, aM] = a.startTime.split(':').map(Number);
    const [bH, bM] = b.startTime.split(':').map(Number);
    return (aH * 60 + aM) - (bH * 60 + bM);
  });

  const merged = [];
  let current = null;

  for (const schedule of sorted) {
    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const [endH, endM] = schedule.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (!current) {
      current = { startMinutes, endMinutes, startTime: schedule.startTime, endTime: schedule.endTime };
    } else {
      // 겹치거나 연속된 경우 병합
      if (startMinutes <= current.endMinutes) {
        current.endMinutes = Math.max(current.endMinutes, endMinutes);
        current.endTime = schedule.endTime;
      } else {
        // 겹치지 않음 → 현재 블록 저장, 새 블록 시작
        merged.push({ ...current });
        current = { startMinutes, endMinutes, startTime: schedule.startTime, endTime: schedule.endTime };
      }
    }
  }
  if (current) merged.push(current);
  return merged;
}

/**
 * 두 스케줄 범위 배열의 교집합 (겹치는 시간) 찾기
 * @param {Array} ranges1 - 범위1 (병합된 범위 배열)
 * @param {Array} ranges2 - 범위2 (병합된 범위 배열)
 * @returns {Array} - 겹치는 범위 배열 ({ startMinutes, endMinutes, startTime, endTime })
 */
function findOverlappingRanges(ranges1, ranges2) {
  const overlaps = [];

  for (const r1 of ranges1) {
    for (const r2 of ranges2) {
      const overlapStart = Math.max(r1.startMinutes, r2.startMinutes);
      const overlapEnd = Math.min(r1.endMinutes, r2.endMinutes);

      if (overlapStart < overlapEnd) {
        const startH = Math.floor(overlapStart / 60);
        const startM = overlapStart % 60;
        const endH = Math.floor(overlapEnd / 60);
        const endM = overlapEnd % 60;
        overlaps.push({
          startMinutes: overlapStart,
          endMinutes: overlapEnd,
          startTime: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
          endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
        });
      }
    }
  }
  return overlaps;
}

/**
 * 시간 범위가 특정 범위 내에 포함되는지 확인
 * @param {number} startMinutes - 확인할 시작 시간 (분)
 * @param {number} endMinutes - 확인할 종료 시간 (분)
 * @param {Array} ranges - 범위 배열 ({ startMinutes, endMinutes })
 * @returns {boolean} - 포함되면 true
 */
function isWithinRanges(startMinutes, endMinutes, ranges) {
  return ranges.some(range =>
    startMinutes >= range.startMinutes && endMinutes <= range.endMinutes
  );
}

module.exports = {
  sortSlotsByTime,
  groupContinuousSlots,
  groupSlotsByDate,
  mergeScheduleRanges,
  findOverlappingRanges,
  isWithinRanges
};
