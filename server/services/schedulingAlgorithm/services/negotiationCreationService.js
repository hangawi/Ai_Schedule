/**
 * 협의 생성 서비스
 */

const { DAY_MAP, FAIRNESS_GAP_THRESHOLD } = require('../constants/schedulingConstants');
const { calculateBlockSlotCount, filterUnsatisfiedConflictingMembers } = require('../helpers/conflictMerger');
const { findMemberById, calculateFlexibilityScores, sortByFlexibility } = require('../helpers/memberHelper');

/**
 * 협의 블록 처리 및 협의 생성
 * @param {Object} params - 파라미터
 * @returns {Object} { negotiations, autoAssignments }
 */
const processNegotiationBlocks = (params) => {
  const {
    negotiationBlocks,
    assignments,
    memberRequiredSlots,
    memberAvailableSlots,
    nonOwnerMembers,
    timetable,
    ownerId,
    startDate
  } = params;

  const negotiations = [];
  const autoAssignments = [];

  for (const block of negotiationBlocks) {
    const dayString = DAY_MAP[block.dayOfWeek];
    const totalSlots = calculateBlockSlotCount(block);

    // 할당량을 채운 멤버 제거
    block.conflictingMembers = filterUnsatisfiedConflictingMembers(
      block.conflictingMembers,
      assignments,
      memberRequiredSlots
    );

    // 필터링 후 충돌 멤버가 없으면 스킵
    if (block.conflictingMembers.length === 0) {
      continue;
    }

    // 각 멤버가 필요한 슬롯 수 계산
    const memberSlotNeeds = block.conflictingMembers.map(memberId => {
      const requiredSlots = memberRequiredSlots[memberId] || 0;
      const assignedSlots = (assignments[memberId]?.assignedHours || 0);
      const neededSlots = requiredSlots - assignedSlots;
      const originallyNeededSlots = memberRequiredSlots[memberId] || 2;
      return { memberId, neededSlots, originallyNeededSlots, assignedSlots, requiredSlots };
    });

    // 미충족 멤버 필터링
    const unsatisfiedMembers = memberSlotNeeds.filter(m => m.neededSlots > 0);

    // 모든 멤버 충족 → 협의 스킵
    if (unsatisfiedMembers.length === 0) {
      continue;
    }

    // 1명만 미충족 → 자동 배정
    if (unsatisfiedMembers.length === 1) {
      const onlyMember = unsatisfiedMembers[0];

      autoAssignments.push({
        memberId: onlyMember.memberId,
        dateObj: block.dateObj,
        dayString: dayString,
        startTime: block.startTime,
        endTime: block.endTime,
        neededSlots: onlyMember.neededSlots,
        totalSlots: totalSlots
      });

      // 즉시 assignments 업데이트
      const slotsToAssign = Math.min(onlyMember.neededSlots, totalSlots);
      assignments[onlyMember.memberId].assignedHours += slotsToAssign;

      continue;
    }

    // 2명 이상 미충족 → 공평성 기반 자동 배정 또는 협의 생성
    let totalNeeded = 0;
    let memberTimeSlotOptions = {};

    if (unsatisfiedMembers.length >= 2) {
      // 유연성(대체 가능한 시간)이 가장 적은 멤버에게 우선적으로 할당
      const flexibilityScores = calculateFlexibilityScores(
        unsatisfiedMembers.map(m => findMemberById(nonOwnerMembers, m.memberId)),
        memberAvailableSlots
      );

      const sortedByFlexibility = sortByFlexibility(flexibilityScores);

      const leastFlexibleMember = sortedByFlexibility[0];
      const secondLeastFlexibleMember = sortedByFlexibility[1];

      // 가장 유연성이 적은 멤버가 유일한 경우 자동 배정
      if (leastFlexibleMember && secondLeastFlexibleMember &&
          leastFlexibleMember.score < secondLeastFlexibleMember.score) {
        const winnerId = leastFlexibleMember.memberId;
        const winnerMember = unsatisfiedMembers.find(m => m.memberId === winnerId);

        if (winnerMember) {
          autoAssignments.push({
            memberId: winnerId,
            dateObj: block.dateObj,
            dayString: dayString,
            startTime: block.startTime,
            endTime: block.endTime,
            neededSlots: winnerMember.neededSlots,
            totalSlots: totalSlots
          });

          const slotsToAssign = Math.min(winnerMember.neededSlots, totalSlots);
          assignments[winnerId].assignedHours += slotsToAssign;

          continue;
        }
      }

      // 블록이 모든 멤버의 필요량을 수용할 수 있는지 확인
      totalNeeded = unsatisfiedMembers.reduce((sum, m) => sum + m.neededSlots, 0);
      const canAccommodateAll = totalNeeded <= totalSlots;

      if (canAccommodateAll) {
        // 공평성 체크
        const sortedByAssigned = [...unsatisfiedMembers].sort((a, b) => {
          const hoursA = assignments[a.memberId]?.assignedHours || 0;
          const hoursB = assignments[b.memberId]?.assignedHours || 0;
          if (hoursA !== hoursB) {
            return hoursA - hoursB;
          }
          return b.neededSlots - a.neededSlots;
        });

        const leastAssignedMember = sortedByAssigned[0];
        const secondLeastAssignedMember = sortedByAssigned[1];
        const leastHours = assignments[leastAssignedMember.memberId]?.assignedHours || 0;
        const secondLeastHours = assignments[secondLeastAssignedMember.memberId]?.assignedHours || 0;

        // 가장 적게 배정받은 멤버가 다른 멤버보다 2슬롯(1시간) 초과 차이나면 자동 배정
        if (leastHours + FAIRNESS_GAP_THRESHOLD < secondLeastHours) {
          autoAssignments.push({
            memberId: leastAssignedMember.memberId,
            dateObj: block.dateObj,
            dayString: dayString,
            startTime: block.startTime,
            endTime: block.endTime,
            neededSlots: leastAssignedMember.neededSlots,
            totalSlots: totalSlots
          });

          const slotsToAssign = Math.min(leastAssignedMember.neededSlots, totalSlots);
          assignments[leastAssignedMember.memberId].assignedHours += slotsToAssign;

          continue;
        }
      }
    }

    // 협의 시스템 삭제 - 충돌 시 랜덤 자동 배정
    // 가장 적게 배정받은 멤버에게 우선 배정
    const sortedByAssigned = [...unsatisfiedMembers].sort((a, b) => {
      const hoursA = assignments[a.memberId]?.assignedHours || 0;
      const hoursB = assignments[b.memberId]?.assignedHours || 0;
      if (hoursA !== hoursB) {
        return hoursA - hoursB; // 적게 배정받은 멤버 우선
      }
      return b.neededSlots - a.neededSlots; // 더 많이 필요한 멤버 우선
    });

    const winnerMember = sortedByAssigned[0];

    autoAssignments.push({
      memberId: winnerMember.memberId,
      dateObj: block.dateObj,
      dayString: dayString,
      startTime: block.startTime,
      endTime: block.endTime,
      neededSlots: winnerMember.neededSlots,
      totalSlots: totalSlots
    });

    const slotsToAssign = Math.min(winnerMember.neededSlots, totalSlots);
    assignments[winnerMember.memberId].assignedHours += slotsToAssign;
  }

  return { negotiations, autoAssignments };
};

/**
 * full_conflict 협의를 위한 대체 시간대 옵션 수집
 * @param {Array} unsatisfiedMembers - 미충족 멤버 배열
 * @param {Array} nonOwnerMembers - 방장 제외 멤버 배열
 * @param {Object} assignments - assignments 객체
 * @param {Date} startDate - 시작 날짜
 * @returns {Object} 멤버별 시간대 옵션
 */
const collectFullConflictTimeOptions = (unsatisfiedMembers, nonOwnerMembers, assignments, startDate) => {
  const memberTimeSlotOptions = {};
  const weekEndDate = new Date(startDate);
  weekEndDate.setDate(startDate.getDate() + 7);

  for (const member of unsatisfiedMembers) {
    const memberId = member.memberId;
    const roomMember = findMemberById(nonOwnerMembers, memberId);

    if (roomMember && roomMember.user && roomMember.user.defaultSchedule) {
      const memberOptions = [];
      const existingSlots = assignments[memberId]?.slots || [];

      // 이번 주의 각 날짜에 대해 선호시간 확인
      for (let d = new Date(startDate); d < weekEndDate; d.setDate(d.getDate() + 1)) {
        const currentDate = new Date(d);
        const dayOfWeek = currentDate.getDay();

        // 해당 요일의 선호 시간 필터링
        const dayPreferences = roomMember.user.defaultSchedule.filter(sched =>
          sched.dayOfWeek === dayOfWeek && sched.priority >= 2
        );

        for (const pref of dayPreferences) {
          const prefStart = pref.startTime;
          const prefEnd = pref.endTime;

          // 이미 배정된 시간인지 확인
          const isAlreadyAssigned = existingSlots.some(slot => {
            const slotDate = new Date(slot.date);
            if (slotDate.toDateString() !== currentDate.toDateString()) {
              return false;
            }
            return !(slot.endTime <= prefStart || prefEnd <= slot.startTime);
          });

          if (!isAlreadyAssigned) {
            memberOptions.push({
              startTime: prefStart,
              endTime: prefEnd,
              date: currentDate.toISOString().split('T')[0]
            });
          }
        }
      }

      memberTimeSlotOptions[memberId] = memberOptions;
    }
  }

  return memberTimeSlotOptions;
};

module.exports = {
  processNegotiationBlocks,
  collectFullConflictTimeOptions
};
