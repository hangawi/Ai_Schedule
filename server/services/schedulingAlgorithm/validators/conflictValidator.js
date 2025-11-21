/**
 * 충돌 검증 함수
 */

/**
 * 슬롯이 충돌 슬롯 목록에 있는지 확인
 * @param {string} slotKey - 슬롯 키
 * @param {Set} conflictKeys - 충돌 슬롯 키 Set
 * @returns {boolean}
 */
const isConflictSlot = (slotKey, conflictKeys) => {
  return conflictKeys.has(slotKey);
};

/**
 * 멤버가 충돌에 연루되어 있는지 확인
 * @param {string} memberId - 멤버 ID
 * @param {Set} conflictingMembers - 충돌 멤버 Set
 * @returns {boolean}
 */
const isConflictingMember = (memberId, conflictingMembers) => {
  return conflictingMembers.has(memberId);
};

/**
 * 슬롯에서 방장 제외한 가용 멤버 추출
 * @param {Object} slot - 슬롯 객체
 * @param {string} ownerId - 방장 ID
 * @returns {Array} 방장 제외 가용 멤버 배열
 */
const getNonOwnerAvailable = (slot, ownerId) => {
  if (!slot || !slot.available) return [];
  return slot.available.filter(a => a.memberId !== ownerId);
};

/**
 * 충돌 슬롯 키 Set 생성
 * @param {Array} conflictingSlots - 충돌 슬롯 배열
 * @returns {Set} 충돌 슬롯 키 Set
 */
const createConflictKeysSet = (conflictingSlots) => {
  return new Set(conflictingSlots.map(c => c.slotKey));
};

/**
 * 충돌 멤버 Set 생성
 * @param {Array} conflictingSlots - 충돌 슬롯 배열
 * @returns {Set} 충돌 멤버 ID Set
 */
const createConflictingMembersSet = (conflictingSlots) => {
  const conflictingMembers = new Set();
  conflictingSlots.forEach(c => {
    c.availableMembers.forEach(memberId => conflictingMembers.add(memberId));
  });
  return conflictingMembers;
};

/**
 * 충돌 슬롯 정보에서 해당 멤버와 관련된 충돌만 필터링
 * @param {Array} conflictingSlots - 충돌 슬롯 배열
 * @param {string} memberId - 멤버 ID
 * @returns {Array} 해당 멤버와 관련된 충돌 배열
 */
const getMemberConflicts = (conflictingSlots, memberId) => {
  return conflictingSlots.filter(c => c.availableMembers.includes(memberId));
};

/**
 * 멤버의 충돌이 있는 날짜들 추출
 * @param {Array} memberConflicts - 멤버 관련 충돌 배열
 * @returns {Set} 충돌 날짜 Set
 */
const getMemberConflictDates = (memberConflicts) => {
  const conflictDates = new Set();
  memberConflicts.forEach(c => {
    const parts = c.slotKey.split('-');
    const conflictDate = parts.slice(0, 3).join('-');
    conflictDates.add(conflictDate);
  });
  return conflictDates;
};

/**
 * 멤버가 최고 우선순위인지 확인
 * @param {Object} memberAvailability - 멤버의 availability 정보
 * @param {Array} allAvailable - 모든 availability 배열
 * @returns {boolean}
 */
const isMemberHighestPriority = (memberAvailability, allAvailable) => {
  if (!memberAvailability) return false;
  const maxPriority = Math.max(...allAvailable.map(a => a.priority || 2));
  return memberAvailability.priority === maxPriority;
};

/**
 * 최고 우선순위 멤버가 유일한지 확인
 * @param {Array} allAvailable - 모든 availability 배열
 * @returns {boolean}
 */
const isUniqueHighestPriority = (allAvailable) => {
  const maxPriority = Math.max(...allAvailable.map(a => a.priority || 2));
  const highestCount = allAvailable.filter(a => (a.priority || 2) === maxPriority).length;
  return highestCount === 1;
};

/**
 * 멤버와 함께 충돌하는 다른 멤버들 찾기
 * @param {Array} memberConflicts - 멤버 관련 충돌 배열
 * @param {string} memberId - 현재 멤버 ID
 * @returns {Set} 함께 충돌하는 멤버 ID Set
 */
const getCoConflictingMembers = (memberConflicts, memberId) => {
  const coConflictingMembers = new Set();
  memberConflicts.forEach(conflict => {
    conflict.availableMembers.forEach(otherId => {
      if (otherId !== memberId) {
        coConflictingMembers.add(otherId);
      }
    });
  });
  return coConflictingMembers;
};

module.exports = {
  isConflictSlot,
  isConflictingMember,
  getNonOwnerAvailable,
  createConflictKeysSet,
  createConflictingMembersSet,
  getMemberConflicts,
  getMemberConflictDates,
  isMemberHighestPriority,
  isUniqueHighestPriority,
  getCoConflictingMembers
};
