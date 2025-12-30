// 이동시간 관련 헬퍼
const { SLOT_TYPES } = require('../constants/travelModes');

/**
 * 이동시간 슬롯 생성
 * @param {Object} params - 슬롯 파라미터
 * @returns {Object} 이동시간 슬롯
 */
const createTravelTimeSlot = (params) => {
  const {
    user,
    date,
    startTime,
    endTime,
    subject = SLOT_TYPES.TRAVEL_TIME,
    assignedBy = 'auto',
  } = params;

  return {
    user,
    date,
    startTime,
    endTime,
    subject,
    assignedBy,
    duration: calculateSlotDuration(startTime, endTime),
  };
};

/**
 * 슬롯 지속 시간 계산 (분)
 * @param {string} startTime - 시작 시간
 * @param {string} endTime - 종료 시간
 * @returns {number} 지속 시간 (분)
 */
const calculateSlotDuration = (startTime, endTime) => {
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);
  return (end - start) / (1000 * 60);
};

/**
 * 이동시간 슬롯 필터링
 * @param {Array} slots - 슬롯 배열
 * @returns {Array} 이동시간 슬롯
 */
const filterTravelTimeSlots = (slots) => {
  return slots.filter(slot => slot.subject === SLOT_TYPES.TRAVEL_TIME);
};

/**
 * 일반 슬롯 필터링 (이동시간 제외)
 * @param {Array} slots - 슬롯 배열
 * @returns {Array} 일반 슬롯
 */
const filterNormalSlots = (slots) => {
  return slots.filter(slot => slot.subject !== SLOT_TYPES.TRAVEL_TIME);
};

/**
 * 이동시간 조정 여부 확인
 * @param {Object} slot - 슬롯 객체
 * @returns {boolean} 조정 여부
 */
const isAdjustedForTravelTime = (slot) => {
  return slot.adjustedForTravelTime === true;
};

module.exports = {
  createTravelTimeSlot,
  calculateSlotDuration,
  filterTravelTimeSlots,
  filterNormalSlots,
  isAdjustedForTravelTime,
};
