/**
 * 충돌 식별 서비스
 */

const { getNonOwnerAvailable } = require('../validators/conflictValidator');

/**
 * 배정 전 충돌 식별
 * @param {Object} timetable - 타임테이블 객체
 * @param {string} ownerId - 방장 ID
 * @param {Object} memberRequiredSlots - 필요 슬롯 정보
 * @returns {Object} { conflicts, memberAvailableSlots }
 */
const identifyConflictsBeforeAssignment = (timetable, ownerId, memberRequiredSlots = {}) => {
  const conflicts = [];

  // 각 멤버별 가용 슬롯 수 계산
  const memberAvailableSlots = {};
  // 각 멤버별 단독 가용 슬롯 수
  const memberExclusiveSlots = {};
  // 각 멤버별 요일+우선순위별 슬롯 수
  const memberDayPrioritySlots = {};

  for (const key in timetable) {
    const slot = timetable[key];
    if (slot.assignedTo) continue;

    const nonOwnerAvailable = getNonOwnerAvailable(slot, ownerId);

    // 각 멤버별 가용 슬롯 카운트
    nonOwnerAvailable.forEach(a => {
      if (!memberAvailableSlots[a.memberId]) {
        memberAvailableSlots[a.memberId] = 0;
        memberExclusiveSlots[a.memberId] = 0;
        memberDayPrioritySlots[a.memberId] = {};
      }
      memberAvailableSlots[a.memberId]++;

      // 단독 슬롯 (본인만 사용 가능)
      if (nonOwnerAvailable.length === 1) {
        memberExclusiveSlots[a.memberId]++;
      }

      // 요일+우선순위별 슬롯 수 추적
      const dayOfWeek = slot.dayOfWeek;
      const priority = a.priority || 2;
      const dayKey = `day${dayOfWeek}_p${priority}`;
      if (!memberDayPrioritySlots[a.memberId][dayKey]) {
        memberDayPrioritySlots[a.memberId][dayKey] = 0;
      }
      memberDayPrioritySlots[a.memberId][dayKey]++;
    });
  }

  // 충돌 슬롯 식별
  for (const key in timetable) {
    const slot = timetable[key];
    if (slot.assignedTo) continue;

    const allAvailable = slot.available || [];
    const nonOwnerAvailable = allAvailable.filter(a => a.memberId !== ownerId);

    if (nonOwnerAvailable.length >= 2) {
      // 우선순위(선호도) 기준으로 최고값 찾기
      const maxPriority = Math.max(...nonOwnerAvailable.map(a => a.priority || 2));
      const highestPriorityMembers = nonOwnerAvailable.filter(a => (a.priority || 2) === maxPriority);

      // 최고 우선순위 멤버가 2명 이상일 때만 협의 발생
      if (highestPriorityMembers.length >= 2) {
        conflicts.push({
          slotKey: key,
          availableMembers: highestPriorityMembers.map(a => a.memberId),
          priority: maxPriority
        });
      }
      // 최고 우선순위 멤버가 1명이면 자동 배정 (협의 불필요)
    }
  }

  return { conflicts, memberAvailableSlots };
};

/**
 * 멤버별 가용 슬롯 수 계산
 * @param {Object} timetable - 타임테이블 객체
 * @param {string} ownerId - 방장 ID
 * @returns {Object} 멤버 ID -> 가용 슬롯 수
 */
const calculateMemberAvailableSlots = (timetable, ownerId) => {
  const memberAvailableSlots = {};

  for (const key in timetable) {
    const slot = timetable[key];
    if (slot.assignedTo) continue;

    const nonOwnerAvailable = getNonOwnerAvailable(slot, ownerId);

    nonOwnerAvailable.forEach(a => {
      if (!memberAvailableSlots[a.memberId]) {
        memberAvailableSlots[a.memberId] = 0;
      }
      memberAvailableSlots[a.memberId]++;
    });
  }

  return memberAvailableSlots;
};

/**
 * 특정 슬롯의 충돌 멤버 확인
 * @param {Object} slot - 슬롯 객체
 * @param {string} ownerId - 방장 ID
 * @returns {Object|null} 충돌 정보 또는 null
 */
const checkSlotConflict = (slot, ownerId) => {
  if (!slot || slot.assignedTo) return null;

  const nonOwnerAvailable = getNonOwnerAvailable(slot, ownerId);

  if (nonOwnerAvailable.length >= 2) {
    const maxPriority = Math.max(...nonOwnerAvailable.map(a => a.priority || 2));
    const highestPriorityMembers = nonOwnerAvailable.filter(a => (a.priority || 2) === maxPriority);

    if (highestPriorityMembers.length >= 2) {
      return {
        availableMembers: highestPriorityMembers.map(a => a.memberId),
        priority: maxPriority
      };
    }
  }

  return null;
};

module.exports = {
  identifyConflictsBeforeAssignment,
  calculateMemberAvailableSlots,
  checkSlotConflict
};
