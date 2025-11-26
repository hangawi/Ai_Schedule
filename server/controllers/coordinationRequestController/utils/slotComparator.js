// 슬롯 비교 유틸리티

/**
 * 두 슬롯이 동일한지 비교
 * @param {Object} slot1 - 첫 번째 슬롯
 * @param {Object} slot2 - 두 번째 슬롯
 * @param {boolean} includeDate - 날짜 포함 여부
 * @returns {boolean} 동일하면 true
 */
const slotsAreEqual = (slot1, slot2, includeDate = true) => {
  if (slot1.day !== slot2.day) return false;
  if (slot1.startTime !== slot2.startTime) return false;
  if (slot1.endTime !== slot2.endTime) return false;

  if (includeDate && slot1.date && slot2.date) {
    const date1Str = new Date(slot1.date).toISOString().split('T')[0];
    const date2Str = new Date(slot2.date).toISOString().split('T')[0];
    if (date1Str !== date2Str) return false;
  }

  return true;
};

/**
 * 슬롯이 특정 사용자의 것인지 확인
 * @param {Object} slot - 슬롯 객체
 * @param {string} userId - 사용자 ID
 * @returns {boolean} 해당 사용자의 슬롯이면 true
 */
const slotBelongsToUser = (slot, userId) => {
  const slotUserId = slot.user._id || slot.user;
  return slotUserId.toString() === userId.toString();
};

module.exports = { slotsAreEqual, slotBelongsToUser };
