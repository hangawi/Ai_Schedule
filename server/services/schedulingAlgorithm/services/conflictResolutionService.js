/**
 * 충돌 해결 서비스
 */

const { DEFAULT_REQUIRED_SLOTS } = require('../constants/schedulingConstants');
const { assignSlot, getUnsatisfiedMembers } = require('../helpers/assignmentHelper');

/**
 * 방장 양보를 통한 충돌 해결 (Phase 5)
 * @param {Object} timetable - 타임테이블 객체
 * @param {Object} assignments - assignments 객체
 * @param {Object} owner - 방장 객체
 * @param {Object} memberRequiredSlots - 필요 슬롯 정보
 */
const resolveConflictsWithOwner = (timetable, assignments, owner, memberRequiredSlots) => {
  const ownerId = owner._id.toString();

  // 할당이 부족한 멤버들 찾기
  const membersNeedingHours = getUnsatisfiedMembers(assignments, memberRequiredSlots, ownerId);

  for (const memberId of membersNeedingHours) {
    const requiredSlots = memberRequiredSlots[memberId] || assignments[memberId]?.requiredSlots || DEFAULT_REQUIRED_SLOTS;
    let needed = requiredSlots - assignments[memberId].assignedHours;

    // 방장이 사용 가능한 시간대 중에서 해당 멤버도 사용 가능한 시간대 찾기
    const availableSlotsForMember = Object.keys(timetable)
      .filter(key => {
        const slot = timetable[key];
        if (slot.assignedTo) return false;

        // 멤버가 사용 가능한지 확인
        const memberAvailable = slot.available.some(a => a.memberId === memberId && !a.isOwner);
        // 방장이 사용 가능한지 확인 (방장이 양보할 수 있는 시간)
        const ownerAvailable = slot.available.some(a => a.memberId === ownerId && a.isOwner);

        return memberAvailable && ownerAvailable;
      })
      .sort((keyA, keyB) => {
        // 충돌이 적은 시간대 우선
        const slotA = timetable[keyA];
        const slotB = timetable[keyB];
        return slotA.available.length - slotB.available.length;
      });

    // 필요한 만큼 할당
    for (const key of availableSlotsForMember) {
      if (needed <= 0) break;
      assignSlot(timetable, assignments, key, memberId);
      needed -= 1;
    }
  }
};

/**
 * 방장이 슬롯을 가져가는 방식의 충돌 해결 (Phase 4) - 현재 미사용
 * 방장은 자동배정에 참여하지 않음
 * @param {Object} timetable - 타임테이블 객체
 * @param {Object} assignments - assignments 객체
 * @param {Object} owner - 방장 객체
 * @param {Object} memberRequiredSlots - 필요 슬롯 정보
 * @param {Object} ownerPreferences - 방장 선호 설정
 */
const resolveConflictsByOwnerTakingSlot = (timetable, assignments, owner, memberRequiredSlots, ownerPreferences = {}) => {
  // 이 함수는 사용하지 않음
  // 방장은 자동배정에 참여하지 않음
  // 방장의 선호시간표는 조원들이 사용 가능한 시간대를 나타낼 뿐
  return;
};

module.exports = {
  resolveConflictsWithOwner,
  resolveConflictsByOwnerTakingSlot
};
