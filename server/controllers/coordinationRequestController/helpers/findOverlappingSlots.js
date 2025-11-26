// 겹치는 슬롯 찾기 헬퍼

const { timeRangesOverlap } = require('../utils/timeConverter');

/**
 * 특정 시간 범위와 겹치는 슬롯들을 찾기
 * @param {Array} timeSlots - 전체 시간 슬롯 배열
 * @param {string} targetUserId - 대상 사용자 ID
 * @param {Object} timeSlot - 확인할 시간 범위
 * @returns {Array} 겹치는 슬롯들
 */
const findOverlappingSlots = (timeSlots, targetUserId, timeSlot) => {
  const overlapping = [];

  timeSlots.forEach(slot => {
    const slotUserId = slot.user._id || slot.user;

    // 사용자 확인
    if (slotUserId.toString() !== targetUserId.toString()) return;

    // 날짜 확인 (있는 경우)
    if (timeSlot.date && slot.date) {
      const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
      const targetDateStr = new Date(timeSlot.date).toISOString().split('T')[0];
      if (slotDateStr !== targetDateStr) return;
    }

    // 요일 확인 (날짜 없는 경우)
    if (!timeSlot.date && slot.day !== timeSlot.day) return;

    // 시간 범위 겹침 확인
    if (timeRangesOverlap(slot.startTime, slot.endTime, timeSlot.startTime, timeSlot.endTime)) {
      overlapping.push(slot);
    }
  });

  return overlapping;
};

module.exports = { findOverlappingSlots };
