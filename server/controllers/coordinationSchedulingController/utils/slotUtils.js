// 슬롯 관련 유틸리티 함수
const { SLOT_TYPES } = require('../constants/travelModes');
const { timeToMinutes } = require('./timeUtils');

/**
 * 슬롯이 보존되어야 하는지 확인
 * @param {Object} slot - 슬롯 객체
 * @returns {boolean} 보존 여부
 */
const shouldPreserveSlot = (slot) => {
  // assignedBy가 없으면 수동 배정 → 유지
  if (!slot.assignedBy) return true;

  // 개인 일정으로 확정된 슬롯 → 유지
  if (slot.confirmedToPersonalCalendar) return true;

  // 협의로 배정된 슬롯 → 유지
  if (slot.subject && (slot.subject.includes('협의') || slot.subject === SLOT_TYPES.AUTO_ASSIGNED)) {
    // '협의 결과', '협의 결과 (대체시간)', '협의 결과 (시간선택)' 등은 유지
    if (slot.subject.includes('협의')) return true;
    // '자동 배정'은 삭제
    if (slot.subject === SLOT_TYPES.AUTO_ASSIGNED) return false;
  }

  // 기타 assignedBy가 있는 슬롯 → 삭제
  return false;
};

/**
 * 슬롯 필터링 - 자동 배정된 슬롯만
 * @param {Array} slots - 슬롯 배열
 * @returns {Array} 필터링된 슬롯
 */
const filterAutoAssignedSlots = (slots) => {
  return slots.filter(slot =>
    slot.assignedBy === 'auto' &&
    slot.subject !== SLOT_TYPES.TRAVEL_TIME &&
    !slot.confirmedToPersonalCalendar
  );
};

/**
 * 슬롯 필터링 - 이동시간 슬롯 제외
 * @param {Array} slots - 슬롯 배열
 * @returns {Array} 필터링된 슬롯
 */
const filterNonTravelSlots = (slots) => {
  return slots.filter(slot => slot.subject !== SLOT_TYPES.TRAVEL_TIME);
};

/**
 * 슬롯을 사용자와 날짜별로 그룹화
 * @param {Array} slots - 슬롯 배열
 * @returns {Map} 그룹화된 슬롯 맵
 */
const groupSlotsByUserAndDate = (slots) => {
  const grouped = new Map();

  for (const slot of slots) {
    const userId = slot.user.toString();
    const dateStr = slot.date.toISOString().split('T')[0];
    const key = `${userId}_${dateStr}`;

    if (!grouped.has(key)) {
      grouped.set(key, { user: slot.user, date: slot.date, slots: [] });
    }
    grouped.get(key).slots.push(slot);
  }

  return grouped;
};

/**
 * 날짜별로 슬롯 병합
 * @param {Array} slots - 같은 날짜의 슬롯 배열
 * @returns {Array} 병합된 슬롯 배열
 */
const mergeSlotsByDate = (slots) => {
  if (!slots || slots.length === 0) return [];

  // 시간순 정렬
  slots.sort((a, b) => {
    const aTime = new Date(a.startTime).getTime();
    const bTime = new Date(b.startTime).getTime();
    return aTime - bTime;
  });

  const merged = [];
  let current = { ...slots[0] };

  for (let i = 1; i < slots.length; i++) {
    const slot = slots[i];
    const currentEnd = new Date(current.endTime);
    const slotStart = new Date(slot.startTime);

    // 연속된 슬롯이면 병합
    if (currentEnd.getTime() === slotStart.getTime()) {
      current.endTime = slot.endTime;
    } else {
      merged.push(current);
      current = { ...slot };
    }
  }

  merged.push(current);
  return merged;
};

/**
 * 사용자 ID 추출
 * @param {Object} userRef - 사용자 참조 (ObjectId 또는 객체)
 * @returns {string} 사용자 ID 문자열
 */
const extractUserId = (userRef) => {
  return userRef._id ? userRef._id.toString() : userRef.toString();
};

/**
 * 연속된 슬롯 병합 (시간 문자열 기반)
 * @param {Array} slots - 슬롯 배열
 * @returns {Array} 병합된 슬롯 배열
 */
const mergeConsecutiveSlots = (slots) => {
  if (slots.length === 0) return [];

  // 시간순으로 정렬
  slots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const merged = [];
  // Mongoose 문서의 속성을 명시적으로 복사
  let current = {
    startTime: slots[0].startTime,
    endTime: slots[0].endTime
  };

  for (let i = 1; i < slots.length; i++) {
    const slot = slots[i];

    // 현재 슬롯의 끝 시간과 다음 슬롯의 시작 시간이 연속되는지 확인
    if (current.endTime === slot.startTime) {
      // 연속되면 병합 (끝 시간만 업데이트)
      current.endTime = slot.endTime;
    } else {
      // 연속되지 않으면 현재 블록을 결과에 추가하고 새 블록 시작
      merged.push(current);
      current = {
        startTime: slot.startTime,
        endTime: slot.endTime
      };
    }
  }

  // 마지막 블록 추가
  merged.push(current);

  return merged;
};

module.exports = {
  shouldPreserveSlot,
  filterAutoAssignedSlots,
  filterNonTravelSlots,
  groupSlotsByUserAndDate,
  mergeSlotsByDate,
  extractUserId,
  mergeConsecutiveSlots,
};
