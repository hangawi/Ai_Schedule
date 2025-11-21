/**
 * 다중 주 스케줄링 서비스
 */

const { SLOTS_PER_HOUR } = require('../constants/timeConstants');
const { filterNonOwnerMembers, extractMemberId } = require('../helpers/memberHelper');

/**
 * 다중 주 스케줄링 실행
 * @param {Object} params - 스케줄링 파라미터
 * @param {Function} runSingleWeekSchedule - 단일 주 스케줄링 함수
 * @returns {Object} 스케줄링 결과
 */
const runMultiWeekSchedule = (params, runSingleWeekSchedule) => {
  const { members, owner, roomTimeSlots, options, deferredAssignments } = params;
  const { minHoursPerWeek, numWeeks, currentWeek, ownerPreferences, roomSettings } = options;

  const startDate = currentWeek ? new Date(currentWeek) : new Date();
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + (numWeeks * 7));

  const allAssignments = {};
  const allNegotiations = [];
  const allSlots = [];

  // 각 멤버별로 assignments 초기화
  const ownerId = owner._id.toString();
  const nonOwnerMembers = filterNonOwnerMembers(members, ownerId);

  nonOwnerMembers.forEach(m => {
    const memberId = extractMemberId(m);
    allAssignments[memberId] = {
      memberId,
      assignedHours: 0,
      requiredSlots: minHoursPerWeek * SLOTS_PER_HOUR * numWeeks,
      slots: []
    };
  });

  // 각 주마다 반복
  for (let weekIndex = 0; weekIndex < numWeeks; weekIndex++) {
    const weekStartDate = new Date(startDate);
    weekStartDate.setUTCDate(startDate.getUTCDate() + (weekIndex * 7));

    console.log(`\n✅ [${weekIndex + 1}주차] ${weekStartDate.toISOString().split('T')[0]} 시작`);

    // 이번 주만 배정 (numWeeks = 1)
    // 전체 범위(fullRangeStart, fullRangeEnd)를 전달하여 방장 가용 시간 계산 시 사용
    const weekOptions = {
      ...options,
      numWeeks: 1,
      currentWeek: weekStartDate,
      fullRangeStart: startDate,
      fullRangeEnd: endDate
    };

    // 기존 슬롯 제외하고 배정
    const result = runSingleWeekSchedule(members, owner, allSlots, weekOptions, deferredAssignments);

    // 결과 병합
    Object.keys(result.assignments).forEach(memberId => {
      const weekAssignment = result.assignments[memberId];
      if (allAssignments[memberId]) {
        allAssignments[memberId].assignedHours += weekAssignment.assignedHours;
        allAssignments[memberId].slots.push(...weekAssignment.slots);
      }
    });

    // 협의 병합 (주별로 분리)
    if (result.negotiations && result.negotiations.length > 0) {
      const weekNegotiations = result.negotiations.map(neg => ({
        ...neg,
        weekIndex: weekIndex + 1,
        weekStartDate: weekStartDate.toISOString().split('T')[0]
      }));
      allNegotiations.push(...weekNegotiations);
    }
  }

  return {
    assignments: allAssignments,
    negotiations: allNegotiations,
    carryOverAssignments: [],
    unassignedMembersInfo: []
  };
};

/**
 * 주차 정보 추가하여 협의 생성
 * @param {Array} negotiations - 협의 배열
 * @param {number} weekIndex - 주 인덱스 (0-based)
 * @param {Date} weekStartDate - 주 시작 날짜
 * @returns {Array} 주차 정보가 추가된 협의 배열
 */
const addWeekInfoToNegotiations = (negotiations, weekIndex, weekStartDate) => {
  return negotiations.map(neg => ({
    ...neg,
    weekIndex: weekIndex + 1,
    weekStartDate: weekStartDate.toISOString().split('T')[0]
  }));
};

module.exports = {
  runMultiWeekSchedule,
  addWeekInfoToNegotiations
};
