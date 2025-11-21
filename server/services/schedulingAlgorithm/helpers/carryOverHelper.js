/**
 * 이월 관련 헬퍼 함수
 */

const { CARRY_OVER_THRESHOLD_WEEKS, CARRY_OVER_TIME_WINDOW_MS } = require('../constants/schedulingConstants');
const { ERROR_MESSAGES } = require('../constants/errorMessages');
const { getMemberPriority, findMemberById } = require('./memberHelper');

/**
 * 이월 필요량 계산
 * @param {Object} assignments - assignments 객체
 * @param {Object} memberRequiredSlots - 필요 슬롯 정보
 * @returns {Object} 멤버 ID -> 이월 시간 (시간 단위)
 */
const calculateCarryOverHours = (assignments, memberRequiredSlots) => {
  const carryOverHours = {};

  Object.keys(assignments).forEach(memberId => {
    const requiredSlots = memberRequiredSlots[memberId] || assignments[memberId]?.requiredSlots || 18;
    const assignedSlots = assignments[memberId].assignedHours;
    const neededSlots = requiredSlots - assignedSlots;

    if (neededSlots > 0) {
      carryOverHours[memberId] = neededSlots / 2; // 슬롯을 시간으로 변환
    }
  });

  return carryOverHours;
};

/**
 * 연속 이월 횟수 확인
 * @param {Object} member - 멤버 객체
 * @returns {number} 최근 2주 내 연속 이월 횟수
 */
const getConsecutiveCarryOvers = (member) => {
  const carryOverHistory = member?.carryOverHistory || [];
  const twoWeeksAgo = new Date(Date.now() - CARRY_OVER_TIME_WINDOW_MS);

  return carryOverHistory.filter(history => {
    return new Date(history.timestamp) >= twoWeeksAgo;
  }).length;
};

/**
 * 개입이 필요한지 확인
 * @param {Object} member - 멤버 객체
 * @returns {boolean}
 */
const needsIntervention = (member) => {
  return getConsecutiveCarryOvers(member) >= CARRY_OVER_THRESHOLD_WEEKS;
};

/**
 * 이월 배정 처리
 * @param {Object} timetable - 타임테이블 객체
 * @param {Object} assignments - assignments 객체
 * @param {Object} memberRequiredSlots - 필요 슬롯 정보
 * @param {Array} members - 멤버 배열
 */
const processCarryOverAssignments = (timetable, assignments, memberRequiredSlots, members) => {
  const membersNeedingHours = Object.keys(assignments).filter(id => {
    const requiredSlots = memberRequiredSlots[id] || assignments[id]?.requiredSlots || 18;
    return assignments[id].assignedHours < requiredSlots;
  });

  for (const memberId of membersNeedingHours) {
    const requiredSlots = memberRequiredSlots[memberId] || assignments[memberId]?.requiredSlots || 18;
    let needed = requiredSlots - assignments[memberId].assignedHours;
    const neededHours = needed / 2;

    // 연속 이월 체크
    const member = findMemberById(members, memberId);
    const consecutiveCarryOvers = getConsecutiveCarryOvers(member);

    if (consecutiveCarryOvers >= CARRY_OVER_THRESHOLD_WEEKS) {
      assignments[memberId].needsIntervention = true;
      assignments[memberId].interventionReason = ERROR_MESSAGES.CARRY_OVER_INTERVENTION_NEEDED;
    }

    // 이월 정보 추가
    if (!assignments[memberId].carryOver) {
      assignments[memberId].carryOver = 0;
    }
    assignments[memberId].carryOver += neededHours;
  }
};

/**
 * 이월 배정 정보 생성
 * @param {Object} assignments - assignments 객체
 * @param {Object} memberRequiredSlots - 필요 슬롯 정보
 * @param {Array} members - 멤버 배열
 * @param {Date} startDate - 시작 날짜
 * @param {string} ownerId - 방장 ID
 * @returns {Array} 이월 배정 정보 배열
 */
const createCarryOverAssignments = (assignments, memberRequiredSlots, members, startDate, ownerId) => {
  const carryOverAssignments = [];

  Object.keys(assignments)
    .filter(id => {
      if (id === ownerId) return false;
      const requiredSlots = memberRequiredSlots[id] || assignments[id]?.requiredSlots || 18;
      return assignments[id].assignedHours < requiredSlots;
    })
    .forEach(id => {
      const requiredSlots = memberRequiredSlots[id] || assignments[id]?.requiredSlots || 18;
      const neededHours = (requiredSlots - assignments[id].assignedHours) / 2;
      const member = findMemberById(members, id);

      if (neededHours > 0) {
        carryOverAssignments.push({
          memberId: id,
          neededHours: neededHours,
          priority: member ? getMemberPriority(member) : 3,
          week: startDate,
          consecutiveCarryOvers: getConsecutiveCarryOvers(member)
        });
      }
    });

  return carryOverAssignments;
};

/**
 * 지연 배정 처리 (0-priority)
 * @param {Object} timetable - 타임테이블 객체
 * @param {Object} assignments - assignments 객체
 * @param {Array} deferredAssignments - 지연 배정 배열
 * @param {Function} assignSlotFn - 슬롯 배정 함수
 */
const processDeferredAssignments = (timetable, assignments, deferredAssignments, assignSlotFn) => {
  for (const deferred of deferredAssignments) {
    const { memberId, neededHours } = deferred;
    const neededSlots = neededHours * 2;
    let slotsAssigned = 0;

    // 해당 멤버가 사용 가능한 슬롯 찾기 (경쟁이 적은 순)
    const availableSlotsForMember = Object.keys(timetable)
      .filter(key => {
        const slot = timetable[key];
        return !slot.assignedTo && slot.available.some(a => a.memberId === memberId && !a.isOwner);
      })
      .sort((keyA, keyB) => {
        const slotA = timetable[keyA];
        const slotB = timetable[keyB];
        return slotA.available.filter(a => !a.isOwner).length - slotB.available.filter(a => !a.isOwner).length;
      });

    for (const key of availableSlotsForMember) {
      if (slotsAssigned >= neededSlots) break;
      assignSlotFn(timetable, assignments, key, memberId);
      slotsAssigned += 1;
    }
  }
};

module.exports = {
  calculateCarryOverHours,
  getConsecutiveCarryOvers,
  needsIntervention,
  processCarryOverAssignments,
  createCarryOverAssignments,
  processDeferredAssignments
};
