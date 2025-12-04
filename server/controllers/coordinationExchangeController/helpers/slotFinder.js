/**
 * 슬롯 찾기 헬퍼 함수
 */

const { groupContinuousSlots, groupSlotsByDate } = require('../utils/slotMerger');
const { dateToString } = require('../utils/dateUtils');

/**
 * 사용자의 모든 유효한 슬롯 찾기 ('자동 배정' 또는 '교환 결과')
 * @param {Object} room - Room 객체
 * @param {string} userId - 사용자 ID
 * @returns {Array} - 사용자의 슬롯 배열
 */
function findUserSlots(room, userId) {
  return room.timeSlots.filter(slot => {
    const slotUserId = (slot.user._id || slot.user).toString();
    const isUserSlot = slotUserId === userId.toString();
    const isValidSubject = slot.subject === '자동 배정' ||
                           slot.subject === '교환 결과' ||
                           slot.subject === '자동 재배치' ||
                           slot.subject === '연쇄 교환 결과' ||
                           slot.subject === '연쇄 조정 결과' ||
                           slot.subject === '직접 교환';
    return isUserSlot && isValidSubject;
  });
}

/**
 * 특정 날짜의 슬롯 찾기
 * @param {Object} room - Room 객체
 * @param {string} userId - 사용자 ID
 * @param {Date} date - 날짜
 * @returns {Array} - 슬롯 배열
 */
function findSlotsOnDate(room, userId, date) {
  const dateStr = dateToString(date);
  return room.timeSlots.filter(slot => {
    const slotUserId = (slot.user._id || slot.user).toString();
    const slotDate = dateToString(new Date(slot.date));
    const isUserSlot = slotUserId === userId.toString();
    const isTargetDate = slotDate === dateStr;
    const isValidSubject = slot.subject === '자동 배정' ||
                           slot.subject === '교환 결과' ||
                           slot.subject === '자동 재배치' ||
                           slot.subject === '연쇄 교환 결과' ||
                           slot.subject === '연쇄 조정 결과' ||
                           slot.subject === '직접 교환';
    return isUserSlot && isTargetDate && isValidSubject;
  });
}

/**
 * 특정 시간에 시작하는 연속 슬롯 블록 찾기
 * @param {Array} slots - 슬롯 배열
 * @param {string} sourceTime - 시작 시간
 * @returns {Array} - 연속 슬롯 배열
 */
function findContinuousBlockStartingAt(slots, sourceTime) {
  const { timeToMinutes } = require('../utils/timeUtils');

  // 시간순 정렬
  const sorted = [...slots].sort((a, b) =>
    timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  // sourceTime을 포함하는 슬롯 찾기
  const sourceMinutes = timeToMinutes(sourceTime);
  let startIndex = -1;

  for (let i = 0; i < sorted.length; i++) {
    const slotStartMinutes = timeToMinutes(sorted[i].startTime);
    const slotEndMinutes = timeToMinutes(sorted[i].endTime);

    if (sourceMinutes >= slotStartMinutes && sourceMinutes < slotEndMinutes) {
      startIndex = i;
      break;
    }
  }

  if (startIndex < 0) return [];

  // 연속 슬롯 선택
  const block = [sorted[startIndex]];
  for (let i = startIndex + 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev.endTime === curr.startTime) {
      block.push(curr);
    } else {
      break;
    }
  }

  return block;
}

/**
 * 사용자의 연속 슬롯 블록들 찾기 (날짜별로 그룹화)
 * @param {Array} userSlots - 사용자 슬롯 배열
 * @returns {Array} - 연속 블록 배열 (각 블록은 슬롯 배열)
 */
function findAllContinuousBlocks(userSlots) {
  const slotsByDate = groupSlotsByDate(userSlots);
  const continuousBlocks = [];

  Object.values(slotsByDate).forEach(slotsOnDate => {
    const blocks = groupContinuousSlots(slotsOnDate);
    continuousBlocks.push(...blocks);
  });

  return continuousBlocks;
}

/**
 * 특정 주차의 슬롯 필터링
 * @param {Array} blocks - 슬롯 블록 배열
 * @param {Date} weekMonday - 주의 월요일
 * @param {Date} weekSunday - 주의 일요일
 * @returns {Array} - 필터링된 블록 배열
 */
function filterBlocksInWeek(blocks, weekMonday, weekSunday) {
  return blocks.filter(block => {
    const blockDate = new Date(block[0].date);
    return blockDate >= weekMonday && blockDate <= weekSunday;
  });
}

/**
 * 특정 요일의 블록 필터링
 * @param {Array} blocks - 슬롯 블록 배열
 * @param {string} dayEnglish - 요일 (영어)
 * @returns {Array} - 필터링된 블록 배열
 */
function filterBlocksByDay(blocks, dayEnglish) {
  return blocks.filter(block => block[0].day === dayEnglish);
}

/**
 * 블록 선택 (타겟 요일이 아닌 블록 우선)
 * @param {Array} blocks - 슬롯 블록 배열
 * @param {string} targetDayEnglish - 타겟 요일 (영어)
 * @returns {Array|null} - 선택된 블록 또는 null
 */
function selectBlockForMove(blocks, targetDayEnglish) {
  if (blocks.length === 0) return null;

  // 타겟 요일이 아닌 블록 우선
  const blocksNotOnTargetDay = blocks.filter(block => block[0].day !== targetDayEnglish);
  if (blocksNotOnTargetDay.length > 0) {
    return blocksNotOnTargetDay[0];
  }

  // 타겟 요일의 블록
  const blocksOnTargetDay = blocks.filter(block => block[0].day === targetDayEnglish);
  if (blocksOnTargetDay.length > 0) {
    return blocksOnTargetDay[0];
  }

  return blocks[0];
}

module.exports = {
  findUserSlots,
  findSlotsOnDate,
  findContinuousBlockStartingAt,
  findAllContinuousBlocks,
  filterBlocksInWeek,
  filterBlocksByDay,
  selectBlockForMove
};
