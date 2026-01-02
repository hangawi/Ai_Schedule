/**
 * 다중 주 스케줄링 서비스
 */

const { SLOTS_PER_HOUR } = require('../constants/timeConstants');
const { filterNonOwnerMembers, extractMemberId } = require('../helpers/memberHelper');

/**
 * 다중 주 스케줄링 실행
 * @param {Object} params - 스케줄링 파라미터
 * @param {Function} runSingleWeekSchedule - 단일 주 스케줄링 함수
 * @returns {Promise<Object>} 스케줄링 결과
 */
const runMultiWeekSchedule = async (params, runSingleWeekSchedule) => {
  const { members, owner, roomTimeSlots, options, deferredAssignments } = params;
  const { minHoursPerWeek, numWeeks, currentWeek, ownerPreferences, roomSettings } = options;

  const startDate = currentWeek ? new Date(currentWeek) : new Date();
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + (numWeeks * 7));

  const allAssignments = {};
  const allSlots = [];
  const warnings = []; // 주별 선호시간 부족 경고

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

    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 7);

    if (weekIndex < 3 || weekIndex >= numWeeks - 2) {
      console.log(`\n✅ [${weekIndex + 1}주차] ${weekStartDate.toISOString().split('T')[0]} ~ ${weekEndDate.toISOString().split('T')[0]} 시작`);
    } else if (weekIndex === 3) {
      console.log(`\n... (${numWeeks - 4}개 주차 생략) ...`);
    }

    // 🔍 이번 주 선호시간 체크
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStartDate);
      day.setUTCDate(weekStartDate.getUTCDate() + i);
      weekDays.push(day);
    }

    const insufficientMembers = [];
    const requiredMinutesPerWeek = minHoursPerWeek * 60;

    for (const member of nonOwnerMembers) {
      const user = member.user;
      const memberName = user?.firstName || user?.name || 'Unknown';
      const memberId = extractMemberId(member);

      // 이번 주 선호시간 계산 (priority >= 2)
      let weekPreferredMinutes = 0;

      // 디버깅: 첫 주차에만 멤버 스케줄 정보 출력
      if (weekIndex === 0) {
        console.log(`\n[DEBUG] ${memberName}의 선호시간 설정:`);
        console.log(`  - defaultSchedule: ${(user.defaultSchedule || []).length}개`);
        (user.defaultSchedule || []).slice(0, 3).forEach(s => {
          console.log(`    dayOfWeek=${s.dayOfWeek}, ${s.startTime}-${s.endTime}, priority=${s.priority}, specificDate=${s.specificDate || 'none'}`);
        });
      }

      for (const day of weekDays) {
        const dayOfWeek = day.getUTCDay(); // 0=일요일, 1=월요일, ...
        const dateStr = day.toISOString().split('T')[0];

        // defaultSchedule에서 해당 요일의 선호시간 찾기
        const daySchedules = (user.defaultSchedule || []).filter(s => {
          if (s.priority < 2) return false;
          
          // specificDate가 있으면 정확히 그 날짜만 매칭
          if (s.specificDate) {
            const specificDateStr = new Date(s.specificDate).toISOString().split('T')[0];
            return specificDateStr === dateStr;
          }
          
          // specificDate가 없으면 dayOfWeek로 매주 반복 매칭
          return s.dayOfWeek === dayOfWeek;
        });

        if (weekIndex === 0 && daySchedules.length > 0) {
          console.log(`  [${dateStr} (요일=${dayOfWeek})] 매칭된 스케줄: ${daySchedules.length}개`);
        }

        for (const schedule of daySchedules) {
          // specificDate 유무에 따라 처리 (위 filter에서 이미 처리됨)

          const [startHour, startMin] = schedule.startTime.split(':').map(Number);
          const [endHour, endMin] = schedule.endTime.split(':').map(Number);
          const minutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
          weekPreferredMinutes += minutes;

          if (weekIndex === 0) {
            const dateType = schedule.specificDate ? '특정날짜' : '매주반복';
            console.log(`    ✅ 추가: ${schedule.startTime}-${schedule.endTime} (${minutes}분) [${dateType}]`);
          }
        }
      }

      console.log(`   📊 [${weekIndex + 1}주차] ${memberName}: 선호시간 ${weekPreferredMinutes}분, 필요 ${requiredMinutesPerWeek}분`);

      if (weekPreferredMinutes < requiredMinutesPerWeek) {
        insufficientMembers.push({
          memberName,
          weekNumber: weekIndex + 1,
          availableMinutes: weekPreferredMinutes,
          requiredMinutes: requiredMinutesPerWeek,
          weekStart: weekStartDate.toISOString().split('T')[0],
          weekEnd: weekEndDate.toISOString().split('T')[0]
        });
      }
    }

    // 선호시간 부족한 멤버 제외하고 배정
    let membersToAssign = nonOwnerMembers;
    const insufficientMemberIds = new Set(); // if 블록 밖에서 선언
    
    if (insufficientMembers.length > 0) {
      console.log(`   ⚠️  [${weekIndex + 1}주차] 선호시간 부족으로 일부 멤버 제외:`);
      insufficientMembers.forEach(m => {
        console.log(`      - ${m.memberName}: ${m.availableMinutes}분 < ${m.requiredMinutes}분`);
        
        // memberName으로부터 실제 memberId 찾기
        const member = nonOwnerMembers.find(mem => {
          const user = mem.user;
          const name = user?.firstName || user?.name || 'Unknown';
          return name === m.memberName;
        });
        
        if (member) {
          const memberId = extractMemberId(member);
          insufficientMemberIds.add(memberId);
        }
        
        warnings.push({
          type: 'insufficient_preferred_time',
          message: `${weekIndex + 1}주차(${m.weekStart})는 ${m.memberName}님의 선호시간(${m.availableMinutes}분)이 부족하여 배정하지 않았습니다. (필요: ${m.requiredMinutes}분)`
        });
      });
      
      // 선호시간이 충분한 멤버만 필터링
      membersToAssign = nonOwnerMembers.filter(m => {
        const memberId = extractMemberId(m);
        return !insufficientMemberIds.has(memberId);
      });
      
      console.log(`   ✅ ${membersToAssign.length}명의 멤버는 배정 진행`);
      
      // 모든 멤버가 부족한 경우에만 주 건너뛰기
      if (membersToAssign.length === 0) {
        console.log(`   ⚠️  모든 멤버가 선호시간 부족으로 이번 주 건너뜀`);
        continue;
      }
    }

    // 이번 주만 배정 (numWeeks = 1)
    // fullRange를 해당 주로 제한하여 데이터가 격리되도록 함
    const weekOptions = {
      ...options,
      numWeeks: 1,
      currentWeek: weekStartDate,
      fullRangeStart: weekStartDate,
      fullRangeEnd: weekEndDate
    };

    // 기존 슬롯 제외하고 배정 (선호시간 부족한 멤버 제외)
    // members 배열에서 선호시간 부족한 멤버만 제외 (owner는 유지)
    const filteredMembers = members.filter(m => {
      const memberId = extractMemberId(m);
      // owner는 항상 포함
      if (memberId === ownerId) return true;
      // 선호시간 부족한 멤버는 제외
      return !insufficientMemberIds.has(memberId);
    });
    
    const result = await runSingleWeekSchedule(filteredMembers, owner, allSlots, weekOptions, deferredAssignments);

    // 결과 병합
    Object.keys(result.assignments).forEach(memberId => {
      const weekAssignment = result.assignments[memberId];
      if (allAssignments[memberId]) {
        allAssignments[memberId].assignedHours += weekAssignment.assignedHours;
        allAssignments[memberId].slots.push(...weekAssignment.slots);
      }
    });

    // Negotiation feature removed
  }

  // warnings 요약 출력
  if (warnings.length > 0) {
    console.log(`\n⚠️  총 ${warnings.length}개 주차에서 선호시간 부족으로 건너뛰었습니다.`);
  }

  return {
    assignments: allAssignments,
    carryOverAssignments: [],
    unassignedMembersInfo: [],
    warnings: warnings // 주별 선호시간 부족 경고
  };
};

// Negotiation feature removed - addWeekInfoToNegotiations function deleted

module.exports = {
  runMultiWeekSchedule
};
