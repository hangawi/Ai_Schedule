class SchedulingAlgorithm {

  _calculateEndTime(startTime) {
    const [h, m] = startTime.split(':').map(Number);
    const totalMinutes = h * 60 + m + 30; // 30분 추가 (1시간 = 2슬롯)
    const endHour = Math.floor(totalMinutes / 60);
    const endMinute = totalMinutes % 60;
    return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
  }

  _mergeConsecutiveConflicts(conflicts, timetable) {
    if (!conflicts || conflicts.length === 0) return [];

    // Sort conflicts by their slot key (date and time)
    const sortedConflicts = [...conflicts].sort((a, b) => a.slotKey.localeCompare(b.slotKey));

    const mergedBlocks = [];
    let currentBlock = null;

    for (const conflict of sortedConflicts) {
      const { slotKey, availableMembers } = conflict;
      // slotKey format: "2025-09-15-13:30"
      const parts = slotKey.split('-');
      const date = `${parts[0]}-${parts[1]}-${parts[2]}`; // "2025-09-15"
      const timeRaw = parts[3]; // "13:30"

      // Ensure time is properly formatted as HH:MM
      let time = timeRaw;
      if (!timeRaw.includes(':')) {
        time = `${String(timeRaw).padStart(2, '0')}:00`;
      } else if (timeRaw.split(':')[1] === undefined) {
        time = `${timeRaw}00`;
      }

      const membersKey = [...availableMembers].sort().join(',');

      if (currentBlock === null) {
        currentBlock = {
          startDate: date,
          startTime: time,
          endTime: this._calculateEndTime(time),
          membersKey: membersKey,
          conflictingMembers: availableMembers,
          dayOfWeek: timetable[slotKey].dayOfWeek,
          dateObj: timetable[slotKey].date
        };
      } else {
        const isSameDay = (date === currentBlock.startDate);
        const isAdjacentTime = (currentBlock.endTime === time);
        const isSameMembers = (membersKey === currentBlock.membersKey);

        if (isSameDay && isAdjacentTime && isSameMembers) {
          currentBlock.endTime = this._calculateEndTime(time);
        } else {
          mergedBlocks.push(currentBlock);
          currentBlock = {
            startDate: date,
            startTime: time,
            endTime: this._calculateEndTime(time),
            membersKey: membersKey,
            conflictingMembers: availableMembers,
            dayOfWeek: timetable[slotKey].dayOfWeek,
            dateObj: timetable[slotKey].date
          };
        }
      }
    }

    if (currentBlock) {
      mergedBlocks.push(currentBlock);
    }

    return mergedBlocks;
  }

  runAutoSchedule(members, owner, roomTimeSlots, options, deferredAssignments = []) {

    // Input validation
    if (!members || !Array.isArray(members)) {
      throw new Error('Invalid members data provided to scheduling algorithm');
    }

    if (!owner || !owner._id) {
      throw new Error('Invalid owner data provided to scheduling algorithm');
    }

    const { minHoursPerWeek = 3, numWeeks = 2, currentWeek, ownerPreferences = {}, roomSettings = {} } = options;

    // 💡 타임테이블 생성 범위에 포함된 실제 주 수 계산
    // numWeeks는 타임테이블 생성 범위 (주 단위)
    const actualWeeksInRange = numWeeks;

    console.log(`\n🚀 [자동배정 시작] 주당 ${minHoursPerWeek}시간 × ${actualWeeksInRange}주`);

    // Convert hours to 30-minute slots (1 hour = 2 slots)
    const minSlotsPerWeek = minHoursPerWeek * 2;

    // 각 멤버별 할당 시간 계산 (carryOver 포함)
    const memberRequiredSlots = {};
    const memberRequiredSlotsPerWeek = {}; // 💡 주당 필요 슬롯 (제한용)
    members.forEach(m => {
      const memberId = m.user._id.toString();
      const carryOverHours = m.carryOver || 0;
      // 💡 타임테이블 범위 내 각 주마다 minHoursPerWeek씩 배정
      const totalRequiredHours = (minHoursPerWeek * actualWeeksInRange) + carryOverHours;
      memberRequiredSlots[memberId] = totalRequiredHours * 2; // 시간을 슬롯으로 변환 (1시간 = 2슬롯)
      memberRequiredSlotsPerWeek[memberId] = minHoursPerWeek * 2; // 💡 주당 최대 슬롯
      console.log(`📌 멤버 ${memberId.substring(0,8)}: ${totalRequiredHours}시간 (${memberRequiredSlots[memberId]}슬롯) 필요 [주당 ${minHoursPerWeek}시간 × ${actualWeeksInRange}주${carryOverHours > 0 ? ` + 이월 ${carryOverHours}시간` : ''}]`);
    });

    // 💡 this에 저장하여 _assignSlot에서 접근 가능하도록
    this.memberRequiredSlotsPerWeek = memberRequiredSlotsPerWeek;

    // 현재 UI가 보고 있는 주 (2025년 9월 16일 월요일)
    const startDate = new Date('2025-09-16');
    startDate.setHours(0, 0, 0, 0);



    // currentWeek 파라미터가 있으면 해당 주 사용 (UI에서 다른 주를 선택한 경우)
    if (currentWeek) {
      const userSelectedDate = new Date(currentWeek);
      const userDayOfWeek = userSelectedDate.getDay();
      const userMondayOffset = userDayOfWeek === 0 ? -6 : 1 - userDayOfWeek;

      startDate.setTime(userSelectedDate.getTime());
      startDate.setDate(userSelectedDate.getDate() + userMondayOffset);
      startDate.setHours(0, 0, 0, 0);


    }


    // Exclude owner from auto-assignment and define nonOwnerMembers before use
    const ownerId = owner._id.toString();
    const nonOwnerMembers = members.filter(m => m.user._id.toString() !== ownerId);

    // 개인 시간표 기반으로 타임테이블 생성 (기존 roomTimeSlots 대신 개인 시간표 사용)
    const timetable = this._createTimetableFromPersonalSchedules(members, owner, startDate, numWeeks, roomSettings);

    let assignments = this._initializeMemberAssignments(nonOwnerMembers, memberRequiredSlots);

    // 💡 기존 협의 슬롯을 assignments에 로드 (이미 배정받은 멤버는 제외하기 위해)
    if (roomTimeSlots && roomTimeSlots.length > 0) {
      console.log(`📥 [기존 슬롯 로드] ${roomTimeSlots.length}개 슬롯 로드 중...`);
      roomTimeSlots.forEach(slot => {
        const slotUserId = slot.user._id ? slot.user._id.toString() : slot.user.toString();
        if (slotUserId === ownerId) return; // 방장 제외

        if (assignments[slotUserId]) {
          assignments[slotUserId].slots.push({
            date: slot.date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            subject: slot.subject
          });
          assignments[slotUserId].assignedHours += 1; // 30분 슬롯 2개 = 1시간
          console.log(`   ✅ ${slotUserId.substring(0,8)}: ${slot.subject} (${new Date(slot.date).toISOString().split('T')[0]} ${slot.startTime}-${slot.endTime})`);
        }
      });

      // 로드 후 현황 출력
      console.log(`📊 [기존 슬롯 로드 완료] 멤버별 현황:`);
      Object.keys(assignments).forEach(memberId => {
        const assignedSlots = assignments[memberId].slots.length;
        const requiredSlots = memberRequiredSlots[memberId] || 2;
        console.log(`   ${memberId.substring(0,8)}: ${assignedSlots}/${requiredSlots}슬롯 배정됨`);
      });
    }

    // Phase 0: Assign Deferred Assignments (0-priority)
    this._assignDeferredAssignments(timetable, assignments, deferredAssignments);

    // Phase 1: Identify conflicts BEFORE assignment (대체 시간 고려)
    // console.log('\n📍 [PHASE 1] 충돌 감지 시작');
    const conflictingSlots = this._identifyConflictsBeforeAssignment(timetable, ownerId, memberRequiredSlots);
    const negotiationBlocks = this._mergeConsecutiveConflicts(conflictingSlots, timetable);
    // console.log(`✅ ${negotiationBlocks.length}개 협의 블록 생성됨`);

    // Phase 2: Assign undisputed high-priority slots (충돌 제외)
    // console.log('\n📍 [PHASE 2] 단독 슬롯 배정');
    this._assignUndisputedSlots(timetable, assignments, 3, memberRequiredSlots, conflictingSlots, memberRequiredSlotsPerWeek);

    // Phase 3: Iteratively fill remaining hours (skip slots that are under negotiation)
    // console.log('\n📍 [PHASE 3] 반복 배정');
    this._iterativeAssignment(timetable, assignments, 3, memberRequiredSlots, nonOwnerMembers, ownerPreferences, conflictingSlots, ownerId);

    // Phase 4: Explicit Conflict Resolution by Owner Taking Slot (with preferences)
    this._resolveConflictsByOwnerTakingSlot(timetable, assignments, owner, memberRequiredSlots, ownerPreferences);

    // Phase 5: Conflict Resolution using Owner's Schedule
    this._resolveConflictsWithOwner(timetable, assignments, owner, memberRequiredSlots);

    // Phase 6: Carry-over assignments (prioritize unassigned members in future weeks)
    this._carryOverAssignments(timetable, assignments, memberRequiredSlots, members);

    // Store carry-over assignments for next week
    const carryOverAssignments = [];

    // Identify unassigned members (for future carry-over) - 개별 할당시간 기준
    // ⚠️ 방장은 제외
    const unassignedMembersInfo = Object.keys(assignments)
      .filter(id => {
        if (id === ownerId) return false; // 방장 제외
        const requiredSlots = memberRequiredSlots[id] || assignments[id]?.requiredSlots || 18;
        return assignments[id].assignedHours < requiredSlots;
      })
      .map(id => {
        const requiredSlots = memberRequiredSlots[id] || assignments[id]?.requiredSlots || 18;
        const neededHours = (requiredSlots - assignments[id].assignedHours) / 2; // 슬롯을 시간으로 변환 (1시간 = 2슬롯)
        const member = members.find(m => m.user._id.toString() === id);

        // Add to carry-over list
        if (neededHours > 0) {
          carryOverAssignments.push({
            memberId: id,
            neededHours: neededHours,
            priority: member ? this.getMemberPriority(member) : 3, // 기본 우선순위 3
            week: startDate,
            consecutiveCarryOvers: (member?.carryOverHistory || []).filter(h => {
              const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
              return h.timestamp >= twoWeeksAgo;
            }).length
          });
        }

        return {
          memberId: id,
          neededHours: neededHours,
          assignedSlots: assignments[id].slots,
          needsIntervention: assignments[id].needsIntervention || false,
          interventionReason: assignments[id].interventionReason || null
        };
      });

    // Use the conflicts identified before assignment
    const negotiations = [];
    const autoAssignments = []; // 자동 배정할 항목들 (협의 생성 후 처리)

    // console.log('\n📍 [PHASE 4] 협의 생성');
    // console.log(`🔍 현재 할당 현황:`);
    // Object.keys(assignments).forEach(memberId => {
    //   const requiredSlots = memberRequiredSlots[memberId] || 0;
    //   const assignedSlots = assignments[memberId]?.assignedHours || 0;
    //   console.log(`   ${memberId.substring(0,8)}: ${assignedSlots}/${requiredSlots}슬롯`);
    // });

    for (const block of negotiationBlocks) {
      const dayMap = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday' };
      const dayString = dayMap[block.dayOfWeek];

      // console.log(`\n🔥 블록: ${dayString} ${block.startTime}-${block.endTime}`);
      // console.log(`   충돌 멤버: ${block.conflictingMembers.map(m => m.substring(0,8)).join(', ')}`);

      // 시간대 길이 계산 (30분 단위 슬롯 수)
      const [startH, startM] = block.startTime.split(':').map(Number);
      const [endH, endM] = block.endTime.split(':').map(Number);
      const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
      const totalSlots = totalMinutes / 30; // 30분 = 1슬롯

      // 각 멤버가 필요한 슬롯 수 계산
      const memberSlotNeeds = block.conflictingMembers.map(memberId => {
        const member = nonOwnerMembers.find(m => m.user._id.toString() === memberId);
        const requiredSlots = memberRequiredSlots[memberId] || 0;
        const assignedSlots = (assignments[memberId]?.assignedHours || 0);
        const neededSlots = requiredSlots - assignedSlots; // 아직 할당받아야 할 슬롯
        const originallyNeededSlots = memberRequiredSlots[memberId] || 2; // 원래 필요한 슬롯 (협의 타입 판단용)
        return { memberId, neededSlots, originallyNeededSlots, assignedSlots, requiredSlots };
      });

      // 💡 충족된 멤버 확인 (Issue 2 해결)
      const unsatisfiedMembers = memberSlotNeeds.filter(m => {
        const stillNeeds = m.neededSlots > 0;
        if (!stillNeeds) {
          // console.log(`   ✅ 멤버 ${m.memberId.substring(0,8)}: 충족됨 (${m.assignedSlots}/${m.requiredSlots}) → 제외`);
        }
        return stillNeeds;
      });

      // console.log(`   미충족: ${unsatisfiedMembers.length}명`);
      unsatisfiedMembers.forEach(m => {
        // console.log(`      ${m.memberId.substring(0,8)}: ${m.assignedSlots}/${m.requiredSlots}슬롯 (남은: ${m.neededSlots})`);
      });

      // 모든 멤버 충족 → 협의 스킵
      if (unsatisfiedMembers.length === 0) {
        // console.log(`   ⏭️ 스킵: 모두 충족됨`);
        continue;
      }

      // 1명만 미충족 → 자동 배정
      if (unsatisfiedMembers.length === 1) {
        const onlyMember = unsatisfiedMembers[0];
        // console.log(`   ✅ 자동배정: ${onlyMember.memberId.substring(0,8)}`);

        autoAssignments.push({
          memberId: onlyMember.memberId,
          dateObj: block.dateObj,
          dayString: dayString,
          startTime: block.startTime,
          endTime: block.endTime,
          neededSlots: onlyMember.neededSlots,
          totalSlots: totalSlots
        });

        // 💡 즉시 assignments 업데이트하여 다음 블록에서 충족된 것으로 인식
        assignments[onlyMember.memberId].assignedHours += onlyMember.neededSlots;
        // console.log(`   📝 ${onlyMember.memberId.substring(0,8)} 할당 업데이트: ${assignments[onlyMember.memberId].assignedHours}/${memberRequiredSlots[onlyMember.memberId]}슬롯`);

        continue;
      }

      // 2명 이상 미충족 → 공평성 기반 자동 배정 또는 협의 생성
      let totalNeeded = 0; // 협의 타입 판단에도 사용되므로 블록 밖에서 선언
      if (unsatisfiedMembers.length >= 2) {
        // 💡 블록이 모든 멤버의 필요량을 수용할 수 있는지 확인
        totalNeeded = unsatisfiedMembers.reduce((sum, m) => sum + m.neededSlots, 0);
        const canAccommodateAll = totalNeeded <= totalSlots;

        if (!canAccommodateAll) {
          // 블록이 모든 멤버를 수용할 수 없음 → 협의 생성으로 바로 진행
          // console.log(`   🚨 블록 용량 부족 (필요: ${totalNeeded}슬롯 > 가용: ${totalSlots}슬롯) → 협의 생성`);
        } else {
          // 블록이 충분히 큼 → 공평성 체크
          const sortedByAssigned = [...unsatisfiedMembers].sort((a, b) => {
            const hoursA = assignments[a.memberId]?.assignedHours || 0;
            const hoursB = assignments[b.memberId]?.assignedHours || 0;
            if (hoursA !== hoursB) {
              return hoursA - hoursB;
            }
            // 배정 시간이 같으면, 필요한 슬롯이 많은 멤버에게 우선권
            return b.neededSlots - a.neededSlots;
          });

          const leastAssignedMember = sortedByAssigned[0];
          const secondLeastAssignedMember = sortedByAssigned[1];
          const leastHours = assignments[leastAssignedMember.memberId]?.assignedHours || 0;
          const secondLeastHours = assignments[secondLeastAssignedMember.memberId]?.assignedHours || 0;

          // 💡 가장 적게 배정받은 멤버가 다른 멤버보다 **2슬롯(1시간) 초과** 차이나야 자동 배정
          // 그렇지 않으면 협의로 해결 (공평성 유지)
          if (leastHours + 2 < secondLeastHours) {
            // console.log(`   ✅ 자동배정 (공평성): ${leastAssignedMember.memberId.substring(0,8)}에게 할당 (배정시간: ${leastHours} << ${secondLeastHours}, 차이 ${secondLeastHours - leastHours}슬롯)`);

            autoAssignments.push({
              memberId: leastAssignedMember.memberId,
              dateObj: block.dateObj,
              dayString: dayString,
              startTime: block.startTime,
              endTime: block.endTime,
              neededSlots: leastAssignedMember.neededSlots,
              totalSlots: totalSlots
            });

            // 💡 즉시 assignments 업데이트하여 다음 블록에서 충족된 것으로 인식
            assignments[leastAssignedMember.memberId].assignedHours += leastAssignedMember.neededSlots;
            // console.log(`   📝 ${leastAssignedMember.memberId.substring(0,8)} 할당 업데이트: ${assignments[leastAssignedMember.memberId].assignedHours}/${memberRequiredSlots[leastAssignedMember.memberId]}슬롯`);

            continue; // 다음 블록으로
          } else {
            // console.log(`   ⚠️ 공평성 차이 작음 (${leastHours} vs ${secondLeastHours}, 차이 ${secondLeastHours - leastHours}슬롯) → 협의 생성`);
          }
        }
      }

      // 공평성으로 해결 안될 시 협의 생성
      // console.log(`   🚨 협의 생성: ${unsatisfiedMembers.length}명 미충족 (공평성으로 해결 불가)`);
      block.conflictingMembers = unsatisfiedMembers.map(m => m.memberId);

      // 협의 타입 판단 (미충족 멤버들만)
      // totalNeeded는 이미 위에서 계산됨 (272-275줄)
      if (totalNeeded === 0) {
        totalNeeded = unsatisfiedMembers.reduce((sum, m) => sum + m.neededSlots, 0);
      }
      const allNeedSameOriginalAmount = unsatisfiedMembers.every(m =>
        m.originallyNeededSlots === unsatisfiedMembers[0].originallyNeededSlots
      );

      let negotiationType = 'full_conflict';
      let availableTimeSlots = [];
      let memberTimeSlotOptions = {}; // 💡 스코프 외부로 이동

      // 💡 새로운 로직: 충돌이 발생하면 항상 먼저 시간 선택(time_slot_choice)으로 시작
      // 멤버들이 각자 시간을 선택하고, 겹치면 full_conflict로 전환됨 (협의 해결 로직에서 처리)

      // 💡 모든 멤버가 원래 같은 시간 필요하고, 충돌 블록에서 2개 이상의 옵션을 만들 수 있으면
      // (예: 8슬롯에서 6슬롯씩 선택 → 13~16, 14~17 가능)
      if (allNeedSameOriginalAmount) {
        // 협의 타입 판단을 위해 원래 필요한 슬롯 사용
        const originalNeededPerMember = unsatisfiedMembers[0].originallyNeededSlots;
        // console.log(`   [협의 판단] 원래 필요 슬롯: ${originalNeededPerMember}, 총 필요: ${totalNeeded}, 총 슬롯: ${totalSlots}`);

        // 💡 슬라이딩 윈도우로 가능한 옵션 수 계산
        // 예: 8슬롯에서 6슬롯씩 선택 → 0~5, 1~6, 2~7 = 3개 옵션
        // 예: 8슬롯에서 3슬롯씩 선택 → 0~2, 1~3, 2~4, 3~5, 4~6, 5~7 = 6개 옵션
        const numberOfOptions = totalSlots - originalNeededPerMember + 1;
        // console.log(`   [협의 판단] 슬라이딩 윈도우 옵션 수: ${numberOfOptions} (총 ${totalSlots}슬롯에서 ${originalNeededPerMember}슬롯씩)`);

        if (numberOfOptions >= 2) {
          // 2개 이상의 선택지가 있으면 time_slot_choice
          negotiationType = 'time_slot_choice';

          // 💡 각 멤버의 실제 가능한 시간대를 timetable에서 확인
          // 각 멤버마다 개별적으로 시간대 옵션 생성
          const memberAvailableRanges = {};
          
          for (const member of unsatisfiedMembers) {
            const memberId = member.memberId;
            const memberAvailableSlots = [];

            // 블록 내 각 30분 슬롯을 확인하여 멤버가 사용 가능한지 체크
            let currentMinutes = startH * 60 + startM;
            const blockEndMinutes = endH * 60 + endM;

            while (currentMinutes < blockEndMinutes) {
              const slotH = Math.floor(currentMinutes / 60);
              const slotM = currentMinutes % 60;
              const slotTime = `${String(slotH).padStart(2,'0')}:${String(slotM).padStart(2,'0')}`;
              const slotKey = `${block.startDate}-${slotTime}`;

              // timetable에서 이 슬롯에 해당 멤버가 available한지 확인
              if (timetable[slotKey] && timetable[slotKey].available) {
                const memberAvailable = timetable[slotKey].available.find(a => a.memberId === memberId);
                if (memberAvailable) {
                  memberAvailableSlots.push(currentMinutes);
                }
              }

              currentMinutes += 30;
            }

            memberAvailableRanges[memberId] = memberAvailableSlots;
          }

          // 💡 각 멤버별로 가능한 시간대 옵션 생성 (1시간 단위로 슬라이딩)
          // memberTimeSlotOptions는 이미 위에서 선언됨

          for (const member of unsatisfiedMembers) {
            const memberId = member.memberId;
            const availableSlots = memberAvailableRanges[memberId];
            const memberOptions = [];

            // 이 멤버의 가능한 슬롯들을 슬라이딩하면서 필요한 길이만큼 연속된 구간 찾기
            const requiredDuration = originalNeededPerMember * 30; // 분 단위

            // 💡 수정: availableSlots를 정렬하여 연속성 확인
            const sortedAvailableSlots = [...availableSlots].sort((a, b) => a - b);

            // 💡 연속된 슬롯만 추출 (30분 간격 체크)
            const consecutiveRanges = [];
            let currentRange = [];

            for (let i = 0; i < sortedAvailableSlots.length; i++) {
              const currentMin = sortedAvailableSlots[i];

              if (currentRange.length === 0) {
                currentRange.push(currentMin);
              } else {
                const lastMin = currentRange[currentRange.length - 1];
                // 연속된 슬롯인지 확인 (30분 차이)
                if (currentMin - lastMin === 30) {
                  currentRange.push(currentMin);
                } else {
                  // 연속 끊김 → 현재 범위 저장하고 새로운 범위 시작
                  if (currentRange.length > 0) {
                    consecutiveRanges.push([...currentRange]);
                  }
                  currentRange = [currentMin];
                }
              }
            }
            // 마지막 범위 저장
            if (currentRange.length > 0) {
              consecutiveRanges.push(currentRange);
            }

            // 💡 각 연속 범위에서 할당 시간 단위로 슬라이딩하여 옵션 생성
            for (const range of consecutiveRanges) {
              // 범위의 시작점부터 할당 시간 단위로 슬라이딩
              const rangeStartMinutes = range[0];
              const rangeEndMinutes = range[range.length - 1] + 30; // 마지막 슬롯의 끝 시간
              // console.log(`         [슬라이딩] 범위: ${Math.floor(rangeStartMinutes/60)}:${rangeStartMinutes%60} ~ ${Math.floor(rangeEndMinutes/60)}:${rangeEndMinutes%60}, 필요시간: ${requiredDuration}분`);

              // 💡 1시간 단위로 슬라이딩 (더 많은 옵션 생성)
              for (let startMinutes = rangeStartMinutes; startMinutes + requiredDuration <= rangeEndMinutes; startMinutes += 60) {
                // console.log(`         [슬라이딩 체크] 시작: ${Math.floor(startMinutes/60)}:${(startMinutes%60).toString().padStart(2,'0')}, 끝: ${Math.floor((startMinutes+requiredDuration)/60)}:${((startMinutes+requiredDuration)%60).toString().padStart(2,'0')}`);

                // 💡 정시(00분)가 아니면 건너뛰기
                if (startMinutes % 60 !== 0) {
                  continue;
                }

                const endMinutes = startMinutes + requiredDuration;

                // 이 구간이 현재 연속 범위 내에 있는지 확인
                let isValidRange = true;
                for (let checkMin = startMinutes; checkMin < endMinutes; checkMin += 30) {
                  if (!range.includes(checkMin)) {
                    isValidRange = false;
                    // console.log(`         [슬라이딩 제외] ${Math.floor(checkMin/60)}:${(checkMin%60).toString().padStart(2,'0')} 슬롯이 범위에 없음`);
                    break;
                  }
                }

                if (isValidRange) {
                  // console.log(`         [슬라이딩 옵션 생성] ${Math.floor(startMinutes/60)}:${(startMinutes%60).toString().padStart(2,'0')} ~ ${Math.floor(endMinutes/60)}:${(endMinutes%60).toString().padStart(2,'0')}`);

                  const optionStartH = Math.floor(startMinutes / 60);
                  const optionStartM = startMinutes % 60;
                  const optionEndH = Math.floor(endMinutes / 60);
                  const optionEndM = endMinutes % 60;

                  const optionStart = `${String(optionStartH).padStart(2,'0')}:${String(optionStartM).padStart(2,'0')}`;
                  const optionEnd = `${String(optionEndH).padStart(2,'0')}:${String(optionEndM).padStart(2,'0')}`;

                  // 💡 중복 방지: 이미 추가된 옵션인지 확인
                  const isDuplicate = memberOptions.some(opt =>
                    opt.startTime === optionStart && opt.endTime === optionEnd
                  );

                  if (!isDuplicate) {
                    memberOptions.push({ startTime: optionStart, endTime: optionEnd });
                  }
                }
              }
            }

            memberTimeSlotOptions[memberId] = memberOptions;
            // console.log(`      ${memberId.substring(0,8)}: ${memberOptions.length}개 옵션 (${memberOptions.map(o => `${o.startTime}-${o.endTime}`).join(', ')})`);
          }

          // 💡 모든 멤버가 최소 1개 이상의 옵션을 가지는지 확인
          const allMembersHaveOptions = unsatisfiedMembers.every(member =>
            memberTimeSlotOptions[member.memberId] && memberTimeSlotOptions[member.memberId].length > 0
          );

          // console.log(`   [옵션 확인] 모든 멤버가 옵션 보유: ${allMembersHaveOptions}`);

          if (!allMembersHaveOptions) {
            // 💡 어떤 멤버가 선택할 수 있는 옵션이 없으면 full_conflict (양보/주장)
            // console.log(`   ⚠️ 일부 멤버 옵션 없음 → full_conflict`);
            negotiationType = 'full_conflict';
            availableTimeSlots = [];
          } else {
            // console.log(`   ✅ time_slot_choice로 진행`);

            // 💡 모든 멤버가 공통으로 선택 가능한 시간대를 availableTimeSlots에 저장
            // (각 멤버의 옵션을 합집합으로 생성 - 프론트엔드에서 각 멤버별로 필터링됨)
            const allOptionsSet = new Set();
            for (const memberId in memberTimeSlotOptions) {
              memberTimeSlotOptions[memberId].forEach(option => {
                const key = `${option.startTime}-${option.endTime}`;
                allOptionsSet.add(key);
              });
            }

            availableTimeSlots = Array.from(allOptionsSet).map(key => {
              const [startTime, endTime] = key.split('-');
              return { startTime, endTime };
            }).sort((a, b) => a.startTime.localeCompare(b.startTime));
          }
        } else if (totalNeeded === totalSlots && unsatisfiedMembers.length === 2) {
          // 딱 맞게 나눠지는 경우 && 2명만 있으면 → partial_conflict (시간 분할)
          negotiationType = 'partial_conflict';
        } else {
          // 선택지가 1개 이하 → full_conflict (바로 양보/주장)
          negotiationType = 'full_conflict';
        }
      }
      // 모든 멤버가 다른 시간 필요 or 시간이 부족한 경우 → full_conflict (양보/이월)
      else {
        negotiationType = 'full_conflict';

        // 💡 full_conflict일 때도 각 멤버의 가능한 대체 시간대를 수집 (양보 시 다른 선호시간 선택 위해)
        // 각 멤버의 이번 주 선호 시간만 가져오기
        const weekEndDate = new Date(startDate);
        weekEndDate.setDate(startDate.getDate() + 7);

        for (const member of unsatisfiedMembers) {
          const memberId = member.memberId;
          const roomMember = nonOwnerMembers.find(m => m.user._id.toString() === memberId);

          if (roomMember && roomMember.user && roomMember.user.defaultSchedule) {
            // 이번 주 범위 내의 모든 날짜에 대해 선호 시간 수집
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

                // 이 시간대가 이미 배정되었는지 확인
                const isAlreadyAssigned = existingSlots.some(slot => {
                  const slotDate = new Date(slot.date);

                  // 날짜가 다르면 충돌 없음
                  if (slotDate.toDateString() !== currentDate.toDateString()) {
                    return false;
                  }

                  // 시간 겹침 확인
                  return !(slot.endTime <= prefStart || prefEnd <= slot.startTime);
                });

                // 배정되지 않은 시간만 옵션에 추가 (날짜 정보 포함)
                if (!isAlreadyAssigned) {
                  memberOptions.push({
                    startTime: prefStart,
                    endTime: prefEnd,
                    date: currentDate.toISOString().split('T')[0] // YYYY-MM-DD 형식
                  });
                }
              }
            }

            memberTimeSlotOptions[memberId] = memberOptions;
            // console.log(`      [full_conflict] ${memberId.substring(0,8)}: ${memberOptions.length}개 대체 시간 옵션 (이번 주)`);
          }
        }
      }

      // console.log(`   협의 타입: ${negotiationType} (블록:${totalSlots}슬롯, 필요:${totalNeeded}슬롯)`);

      const negotiation = {
        type: negotiationType,
        availableTimeSlots: availableTimeSlots,
        memberSpecificTimeSlots: memberTimeSlotOptions || {}, // 💡 각 멤버별 가능한 시간대 옵션
        slotInfo: {
          day: dayString,
          startTime: block.startTime,
          endTime: block.endTime,
          date: block.dateObj
        },
        conflictingMembers: block.conflictingMembers.map(memberId => {
          const member = nonOwnerMembers.find(m => m.user._id.toString() === memberId);
          const slotNeed = memberSlotNeeds.find(m => m.memberId === memberId);
          return {
            user: memberId,
            priority: member ? this.getMemberPriority(member) : 3,
            requiredSlots: slotNeed ? slotNeed.neededSlots : 0,
            response: 'pending'
          };
        }),
        participants: [...block.conflictingMembers, ownerId], // 당사자들 + 방장
        messages: [],
        status: 'active',
        createdAt: new Date()
      };

      negotiations.push(negotiation);
    }

    console.log(`\n✅ 최종 협의: ${negotiations.length}개`);

    // 방장을 assignments에서 제거 (혹시라도 포함되었을 경우)
    if (assignments[ownerId]) {
      console.warn(`⚠️ [경고] assignments에서 방장(${ownerId}) 제거`);
      delete assignments[ownerId];
    }

    // 💡 자동 배정 처리 (협의 생성 후)
    console.log(`\n📍 [PHASE 5] 자동 배정: ${autoAssignments.length}개`);

    for (const autoAssign of autoAssignments) {
      const { memberId, dateObj, dayString, startTime, endTime, neededSlots, totalSlots } = autoAssign;

      const [startH, startM] = startTime.split(':').map(Number);
      const slotsToAssign = Math.min(neededSlots, totalSlots);
      const minutesToAssign = slotsToAssign * 30;
      const startMinutes = startH * 60 + startM;
      const endMinutes = startMinutes + minutesToAssign;

      console.log(`   ${memberId.substring(0,8)}: ${dayString} ${startTime}-${endTime} (${slotsToAssign}슬롯)`);

      for (let currentMin = startMinutes; currentMin < endMinutes; currentMin += 30) {
        const slotStart = `${Math.floor(currentMin/60).toString().padStart(2,'0')}:${(currentMin%60).toString().padStart(2,'0')}`;
        const slotEnd = `${Math.floor((currentMin+30)/60).toString().padStart(2,'0')}:${((currentMin+30)%60).toString().padStart(2,'0')}`;

        if (!assignments[memberId]) {
          assignments[memberId] = { memberId: memberId, assignedHours: 0, slots: [] };
        }

        assignments[memberId].assignedHours += 1;
        assignments[memberId].slots.push({
          date: dateObj,
          day: dayString,
          startTime: slotStart,
          endTime: slotEnd,
          subject: '자동 배정',
          user: memberId,
          status: 'confirmed'
        });
      }
    }

    console.log(`✅ 최종 결과: 조원 ${Object.keys(assignments).length}명 | 협의 ${negotiations.length}개 | 자동배정 ${autoAssignments.length}개`);

    return {
      assignments,
      unassignedMembersInfo,
      unresolvableConflicts: conflictingSlots, // 할당 전 감지된 충돌
      negotiations, // 협의 목록 추가
      carryOverAssignments, // 다음 주 이월 정보
    };
  }

  getMemberPriority(member) {
    // Check room-level priority first, then user-level priority
    if (member.priority) {
      return member.priority;
    }
    if (member.user && member.user.priority) {
      return member.user.priority;
    }
    return 3; // Default medium priority
  }

  _identifyConflictsBeforeAssignment(timetable, ownerId, memberRequiredSlots = {}) {
    const conflicts = [];

    // 각 멤버별 가용 슬롯 수 계산 (총 슬롯)
    const memberAvailableSlots = {};
    // 각 멤버별 단독 가용 슬롯 수 계산 (본인만 사용 가능한 슬롯)
    const memberExclusiveSlots = {};
    // 💡 각 멤버별 요일+우선순위별 슬롯 수 계산
    const memberDayPrioritySlots = {};

    for (const key in timetable) {
      const slot = timetable[key];
      if (slot.assignedTo) continue;

      const nonOwnerAvailable = slot.available.filter(a => a.memberId !== ownerId);

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

        // 💡 요일+우선순위별 슬롯 수 추적
        const dayOfWeek = slot.dayOfWeek; // 1=월, 2=화, 3=수, 4=목, 5=금
        const priority = a.priority || 2;
        const dayKey = `day${dayOfWeek}_p${priority}`;
        if (!memberDayPrioritySlots[a.memberId][dayKey]) {
          memberDayPrioritySlots[a.memberId][dayKey] = 0;
        }
        memberDayPrioritySlots[a.memberId][dayKey]++;
      });
    }

    console.log('   멤버별 가용 슬롯:', memberAvailableSlots);
    console.log('   멤버별 단독 슬롯:', memberExclusiveSlots);
    console.log('   💡 멤버별 요일+우선순위별 슬롯:', JSON.stringify(memberDayPrioritySlots, null, 2));

    // 🔍 월요일 슬롯 확인
    const mondaySlots = Object.keys(timetable).filter(k => k.includes('2025-10-06'));
    console.log(`   월요일 슬롯 개수: ${mondaySlots.length}개`);
    mondaySlots.forEach(key => {
      const slot = timetable[key];
      const nonOwner = (slot.available || []).filter(a => a.memberId !== ownerId);
      console.log(`      ${key}: ${nonOwner.length}명 가용 - ${nonOwner.map(a => `${a.memberId.substring(0,8)}(우선순위${a.priority})`).join(', ')}`);
    });

    // 🔍 수요일 슬롯 확인
    const wednesdaySlots = Object.keys(timetable).filter(k => k.includes('2025-10-08'));
    console.log(`   수요일 슬롯 개수: ${wednesdaySlots.length}개`);
    wednesdaySlots.forEach(key => {
      const slot = timetable[key];
      const nonOwner = (slot.available || []).filter(a => a.memberId !== ownerId);
      console.log(`      ${key}: ${nonOwner.length}명 가용 - ${nonOwner.map(a => `${a.memberId.substring(0,8)}(우선순위${a.priority})`).join(', ')}`);
    });

    for (const key in timetable) {
      const slot = timetable[key];
      if (slot.assignedTo) continue;

      const allAvailable = slot.available || [];
      const nonOwnerAvailable = allAvailable.filter(a => a.memberId !== ownerId);

      if (nonOwnerAvailable.length >= 2) {
        // 💡 우선순위(선호도) 기준으로 최고값 찾기
        const maxPriority = Math.max(...nonOwnerAvailable.map(a => a.priority || 2));
        const highestPriorityMembers = nonOwnerAvailable.filter(a => (a.priority || 2) === maxPriority);

        console.log(`   🔍 슬롯 ${key}: maxPriority=${maxPriority}, 최고우선순위 멤버 ${highestPriorityMembers.length}명 (${highestPriorityMembers.map(m => m.memberId.substring(0,8)).join(', ')})`);

        // 💡 최고 우선순위 멤버가 2명 이상일 때만 협의 발생
        if (highestPriorityMembers.length >= 2) {
          conflicts.push({
            slotKey: key,
            availableMembers: highestPriorityMembers.map(a => a.memberId),
            priority: maxPriority
          });
          console.log(`      ✅ 협의 추가됨`);
        } else {
          console.log(`      ⏭️ 협의 제외 (최고우선순위 1명)`);
        }
        // 최고 우선순위 멤버가 1명이면 자동 배정 (협의 불필요)
      }
    }

    console.log(`   충돌 감지: ${conflicts.length}개`);
    conflicts.forEach(c => {
      console.log(`      ${c.slotKey}: ${c.availableMembers.map(m => m.substring(0,8)).join(', ')} (우선순위: ${c.priority})`);
    });
    return conflicts;
  }

  _createTimetableFromPersonalSchedules(members, owner, startDate, numWeeks, roomSettings = {}) {
    const timetable = {};

    // Extract schedule start and end hours from room settings
    const getHourFromSettings = (setting, defaultValue) => {
      if (!setting) return parseInt(defaultValue, 10);
      if (typeof setting === 'string') return parseInt(String(setting).split(':')[0], 10);
      if (typeof setting === 'number') return setting;
      return parseInt(defaultValue, 10);
    };

    const scheduleStartHour = getHourFromSettings(roomSettings.scheduleStartTime, '9');
    const scheduleEndHour = getHourFromSettings(roomSettings.scheduleEndTime, '18');

    // Calculate the end date of the scheduling window
    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + (numWeeks * 7));

    const ownerId = owner._id.toString();

    console.log('📅 [타임테이블] 방장의 선호시간표를 기반으로 가용 시간대 생성');
    console.log(`📅 [타임테이블] 처리할 조원 수: ${members.length}명`);
    console.log(`📅 [타임테이블 기간] ${startDate.toISOString().split('T')[0]} ~ ${endDate.toISOString().split('T')[0]} (${numWeeks}주)`);

    // 💡 Step 1: 방장의 가능한 시간대를 먼저 수집
    const ownerAvailableSlots = new Set();

    console.log(`📅 [방장 시간표 체크] defaultSchedule 존재: ${!!owner.defaultSchedule}, 길이: ${owner.defaultSchedule?.length || 0}`);
    if (owner.defaultSchedule && owner.defaultSchedule.length > 0) {
      console.log(`📅 [방장 시간표 샘플]:`, owner.defaultSchedule.slice(0, 2).map(s => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime
      })));
    }

    if (owner.defaultSchedule && Array.isArray(owner.defaultSchedule)) {
      const validSchedules = owner.defaultSchedule.filter(schedule => {
        if (!schedule.startTime) return false;
        const startMin = parseInt(schedule.startTime.split(':')[1]);
        return startMin === 0 || startMin === 30;
      });

      console.log(`📅 [방장 시간표 필터링] 전체: ${owner.defaultSchedule.length}개 → 유효: ${validSchedules.length}개`);

      validSchedules.forEach(schedule => {
        const dayOfWeek = schedule.dayOfWeek;
        const startTime = schedule.startTime;
        const endTime = schedule.endTime;
        const specificDate = schedule.specificDate;

        // 주말 제외
        if (dayOfWeek === 0 || dayOfWeek === 6) return;

        if (specificDate) {
          const targetDate = new Date(specificDate);
          if (targetDate >= startDate && targetDate < endDate) {
            const slots = this._generateTimeSlots(startTime, endTime);
            slots.forEach(slotTime => {
              const dateKey = targetDate.toISOString().split('T')[0];
              const key = `${dateKey}-${slotTime}`;
              ownerAvailableSlots.add(key);
            });
          }
        } else {
          const currentDate = new Date(startDate);
          while (currentDate < endDate) {
            if (currentDate.getDay() === dayOfWeek) {
              const slots = this._generateTimeSlots(startTime, endTime);
              slots.forEach(slotTime => {
                const dateKey = currentDate.toISOString().split('T')[0];
                const key = `${dateKey}-${slotTime}`;
                ownerAvailableSlots.add(key);
              });
            }
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
          }
        }
      });
    }

    console.log(`📅 [방장] 가능한 시간대: ${ownerAvailableSlots.size}개 슬롯`);
    if (ownerAvailableSlots.size > 0) {
      const sampleSlots = Array.from(ownerAvailableSlots).slice(0, 5);
      console.log(`📅 [방장 슬롯 샘플]:`, sampleSlots);
    }

    if (ownerAvailableSlots.size === 0) {
      console.warn(`⚠️ [경고] 방장의 가능한 시간대가 0개입니다!`);
      console.warn(`   - 기간: ${startDate.toISOString().split('T')[0]} ~ ${endDate.toISOString().split('T')[0]}`);
      console.warn(`   - 방장 ID: ${ownerId}`);
      console.warn(`   - defaultSchedule 길이: ${owner.defaultSchedule?.length || 0}`);
    }

    // 💡 Step 2: 조원들의 개인 시간표를 추가 (방장 가능 시간대와 겹치는 것만)
    let memberSlotsAdded = 0;
    members.forEach((member, idx) => {
      const user = member.user;
      const userId = user._id.toString();
      const priority = this.getMemberPriority(member);
      const isOwner = false; // 조원은 방장이 아님

      console.log(`📅 [조원 ${idx + 1}/${members.length}] ID: ${userId.substring(0, 8)}, defaultSchedule 길이: ${user.defaultSchedule?.length || 0}`);

      // 개인 시간표(defaultSchedule) 처리
      if (user.defaultSchedule && Array.isArray(user.defaultSchedule)) {
        // 30분 단위만 필터링 (00분, 30분만 허용)
        const validSchedules = user.defaultSchedule.filter(schedule => {
          if (!schedule.startTime) return false;
          const startMin = parseInt(schedule.startTime.split(':')[1]);
          return startMin === 0 || startMin === 30;
        });

        console.log(`📅 [조원 ${idx + 1}] 유효한 시간표: ${validSchedules.length}/${user.defaultSchedule.length}개`);
        if (validSchedules.length > 0) {
          const sample = validSchedules[0];
          console.log(`📅 [조원 ${idx + 1} 샘플]:`, {
            dayOfWeek: sample.dayOfWeek,
            startTime: sample.startTime,
            endTime: sample.endTime
          });
        }

        let memberSlotCount = 0;
        // 선호시간표 필터링 완료

        let processedSchedules = 0;
        let skippedWeekends = 0;
        let addedToTimetable = 0;
        let rejectedByOwner = 0;

        validSchedules.forEach(schedule => {
          const dayOfWeek = schedule.dayOfWeek; // 0=일요일, 1=월요일, ..., 6=토요일
          const startTime = schedule.startTime;
          const endTime = schedule.endTime;
          const specificDate = schedule.specificDate; // 특정 날짜 (YYYY-MM-DD 형식)
          const schedulePriority = schedule.priority || priority; // 슬롯별 우선순위

          processedSchedules++;

          // 주말 제외
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            skippedWeekends++;
            return;
          }

          // specificDate가 있으면 해당 날짜에만 적용, 없으면 주간 반복
          if (specificDate) {
            // 특정 날짜 처리
            const targetDate = new Date(specificDate);
            
            // 스케줄링 기간 내에 있는지 확인
            if (targetDate >= startDate && targetDate < endDate) {
              const slots = this._generateTimeSlots(startTime, endTime);

              slots.forEach(slotTime => {
                const dateKey = targetDate.toISOString().split('T')[0];
                const key = `${dateKey}-${slotTime}`;

                // 💡 방장이 가능한 시간대인지 확인
                if (!ownerAvailableSlots.has(key)) {
                  rejectedByOwner++;
                  return; // 방장이 불가능한 시간대는 건너뜀
                }

                addedToTimetable++;

                if (!timetable[key]) {
                  const oneIndexedDayOfWeek = targetDate.getDay() === 0 ? 7 : targetDate.getDay();

                  // 💡 주 번호 계산 (startDate 기준)
                  const daysSinceStart = Math.floor((targetDate - startDate) / (1000 * 60 * 60 * 24));
                  const weekNumber = Math.floor(daysSinceStart / 7);

                  timetable[key] = {
                    assignedTo: null,
                    available: [],
                    date: new Date(targetDate),
                    dayOfWeek: oneIndexedDayOfWeek,
                    weekNumber, // 💡 주 번호 추가 (0부터 시작)
                  };
                }

                const existingAvailability = timetable[key].available.find(a => a.memberId === userId);
                if (!existingAvailability) {
                  timetable[key].available.push({
                    memberId: userId,
                    priority: schedulePriority,
                    isOwner: isOwner
                  });
                  memberSlotCount++;
                  memberSlotsAdded++;
                }
              });
            }
          } else {
            // 주간 반복 처리 (기존 로직 유지)
            const currentDate = new Date(startDate);
            while (currentDate < endDate) {
              if (currentDate.getDay() === dayOfWeek) {
                const slots = this._generateTimeSlots(startTime, endTime);

                slots.forEach(slotTime => {
                  const dateKey = currentDate.toISOString().split('T')[0];
                  const key = `${dateKey}-${slotTime}`;

                  // 💡 방장이 가능한 시간대인지 확인
                  if (!ownerAvailableSlots.has(key)) {
                    rejectedByOwner++;
                    return; // 방장이 불가능한 시간대는 건너뜀
                  }

                  addedToTimetable++;

                  if (!timetable[key]) {
                    const oneIndexedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

                    // 💡 주 번호 계산 (startDate 기준)
                    const daysSinceStart = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));
                    const weekNumber = Math.floor(daysSinceStart / 7);

                    timetable[key] = {
                      assignedTo: null,
                      available: [],
                      date: new Date(currentDate),
                      dayOfWeek: oneIndexedDayOfWeek,
                      weekNumber, // 💡 주 번호 추가 (0부터 시작)
                    };
                  }

                  const existingAvailability = timetable[key].available.find(a => a.memberId === userId);
                  if (!existingAvailability) {
                    timetable[key].available.push({
                      memberId: userId,
                      priority: schedulePriority,
                      isOwner: isOwner
                    });
                    memberSlotCount++;
                    memberSlotsAdded++;
                  }
                });
              }
              currentDate.setUTCDate(currentDate.getUTCDate() + 1);
            }
          }
        });
        console.log(`📅 [조원 ${idx + 1}] 타임테이블에 추가한 슬롯: ${memberSlotCount}개`);
        console.log(`   - 처리한 스케줄: ${processedSchedules}개, 주말 제외: ${skippedWeekends}개`);
        console.log(`   - 타임테이블 시도: ${addedToTimetable}개, 방장과 불일치로 거부: ${rejectedByOwner}개`);
      } else {
        console.log(`⚠️ [조원 ${idx + 1}] ${userId.substring(0,8)}: defaultSchedule가 없거나 비어있음 - 이 멤버는 타임테이블에서 제외됨`);
      }

      // 개인시간(personalTimes) 처리 - 이 시간대는 제외해야 함
      if (user.personalTimes && Array.isArray(user.personalTimes)) {


        user.personalTimes.forEach(personalTime => {
          if (personalTime.isRecurring !== false && personalTime.days && personalTime.days.length > 0) {
            personalTime.days.forEach(dayOfWeek => {
              const jsDay = dayOfWeek === 7 ? 0 : dayOfWeek; // 7을 0(일요일)로 변환

              // 스케줄링 기간 내의 모든 해당 요일에서 개인시간 제거
              const currentDate = new Date(startDate);
              while (currentDate < endDate) {
                if (currentDate.getDay() === jsDay) {
                  const slots = this._generateTimeSlots(personalTime.startTime, personalTime.endTime);

                  slots.forEach(slotTime => {
                    const dateKey = currentDate.toISOString().split('T')[0];
                    const key = `${dateKey}-${slotTime}`;

                    // 해당 시간대에서 이 사용자를 제거
                    if (timetable[key]) {
                      timetable[key].available = timetable[key].available.filter(a => a.memberId !== userId);
                      // 아무도 사용할 수 없는 시간대가 되면 삭제
                      if (timetable[key].available.length === 0) {
                        delete timetable[key];
                      }
                    }
                  });
                }
                currentDate.setUTCDate(currentDate.getUTCDate() + 1);
              }
            });
          }
        });
      }
    });

    const totalSlots = Object.keys(timetable).length;
    console.log(`📅 [타임테이블 최종] 총 ${totalSlots}개 시간대 생성, 조원들이 추가한 슬롯: ${memberSlotsAdded}개`);

    // 타임테이블 샘플 출력
    if (totalSlots > 0) {
      const sampleKeys = Object.keys(timetable).slice(0, 3);
      console.log(`[타임테이블샘플] 처음 3개 슬롯:`, sampleKeys.map(key => {
        const slot = timetable[key];
        return `${key} (${slot.available.length}명 가능)`;
      }).join(', '));
    } else {
      console.warn('⚠️ [타임테이블] 생성된 슬롯이 0개입니다! 조원들의 defaultSchedule을 확인하세요.');
    }

    return timetable;
  }

  _generateTimeSlots(startTime, endTime) {
    const slots = [];
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    let currentTime = startHour * 60 + startMin; // 분으로 변환
    const endTimeInMinutes = endHour * 60 + endMin;

    while (currentTime < endTimeInMinutes) {
      const hour = Math.floor(currentTime / 60);
      const minute = currentTime % 60;
      const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      slots.push(timeStr);
      currentTime += 60; // 💡 1시간(60분) 단위로 변경
    }

    return slots;
  }

  _createTimetable(roomTimeSlots, startDate, numWeeks, roomSettings = {}, members = []) {
    const timetable = {};
    const currentDay = new Date(startDate);
    currentDay.setUTCHours(0, 0, 0, 0);

    // Extract schedule start and end hours from room settings
    const getHourFromSettings = (setting, defaultValue) => {
      if (!setting) return parseInt(defaultValue, 10);
      if (typeof setting === 'string') return parseInt(String(setting).split(':')[0], 10);
      if (typeof setting === 'number') return setting;
      return parseInt(defaultValue, 10);
    };

    const scheduleStartHour = getHourFromSettings(roomSettings.scheduleStartTime, '9');
    const scheduleEndHour = getHourFromSettings(roomSettings.scheduleEndTime, '18');

    // Calculate the end date of the scheduling window
    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + (numWeeks * 7));

    // 사용자가 실제로 제출한 시간표만으로 timetable 구성
    console.log(`[타임테이블] 사용자 제출 슬롯 ${roomTimeSlots.length}개 처리 시작`);

    // 사용자별로 슬롯을 그룹화하여 중복 처리 방지
    const userSlots = {};
    roomTimeSlots.forEach(slot => {
      let userId;
      if (slot.user && slot.user._id) {
        userId = slot.user._id.toString();
      } else if (slot.user) {
        userId = slot.user.toString();
      } else {
        console.warn('[타임테이블] 유효하지 않은 사용자:', slot);
        return;
      }

      if (!userSlots[userId]) {
        userSlots[userId] = [];
      }
      userSlots[userId].push(slot);
    });

    // 각 사용자의 슬롯을 처리
    Object.keys(userSlots).forEach(userId => {
      const member = members.find(m => (m.user._id || m.user).toString() === userId);
      if (!member) {
        console.warn(`[타임테이블] 멤버를 찾을 수 없음: ${userId}`);
        return;
      }

      const priority = this.getMemberPriority(member);

      userSlots[userId].forEach(slot => {
        const date = new Date(slot.date);

        // 스케줄링 윈도우 내의 슬롯만 처리
        const slotDateStr = date.toISOString().split('T')[0];
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        if (slotDateStr < startDateStr || slotDateStr >= endDateStr) {
          console.log(`[타임테이블] 윈도우 외부 슬롯 스킵: ${slotDateStr}`);
          return;
        }

        const dateKey = date.toISOString().split('T')[0];
        const key = `${dateKey}-${slot.startTime}`;

        // 해당 시간대 슬롯이 아직 없다면 생성
        if (!timetable[key]) {
          const dayOfWeek = date.getDay();
          const oneIndexedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

          timetable[key] = {
            assignedTo: null,
            available: [],
            date: new Date(date),
            dayOfWeek: oneIndexedDayOfWeek,
          };
        }

        // 중복 추가 방지
        const existingAvailability = timetable[key].available.find(a => a.memberId === userId);
        if (!existingAvailability) {
          timetable[key].available.push({
            memberId: userId,
            priority: priority,
            isOwner: false
          });
          console.log(`[타임테이블] 슬롯 추가: ${key} - 멤버: ${userId}, 우선순위: ${priority}`);
        }
      });
    });

    console.log(`[타임테이블] 총 ${Object.keys(timetable).length}개 시간대 생성 (사용자 제출 기준)`);

    return timetable;
  }

  _initializeMemberAssignments(members, memberRequiredSlots = {}) {
    const assignments = {};
    members.forEach(m => {
      const memberId = m.user._id.toString();
      assignments[memberId] = {
        memberId: memberId,
        assignedHours: 0,
        requiredSlots: memberRequiredSlots[memberId] || 18, // 기본값 3시간 = 18슬롯
        slots: [],
        weeklySlots: {} // 💡 주별 슬롯 카운트 { 0: 2, 1: 4, ... }
      };
    });
    return assignments;
  }

  _assignDeferredAssignments(timetable, assignments, deferredAssignments) {
    for (const deferred of deferredAssignments) {
      const { memberId, neededHours } = deferred;
      // Convert hours to slots (1 hour = 2 slots)
      const neededSlots = neededHours * 2;
      let slotsAssigned = 0;

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
        this._assignSlot(timetable, assignments, key, memberId);
        slotsAssigned += 1;
      }
    }
  }

  _assignUndisputedSlots(timetable, assignments, priority, memberRequiredSlots, conflictingSlots = [], memberRequiredSlotsPerWeek = {}) {
    // 💡 주별 슬롯 제한 추가 (TODO: 체크 로직 추가 필요)
    let assignedCount = 0;

    // 충돌 슬롯 목록을 Set으로 변환하여 빠른 검색
    const conflictKeys = new Set(conflictingSlots.map(c => c.slotKey));

    // 💡 협의에 포함된 멤버들 추출
    const conflictingMembers = new Set();
    conflictingSlots.forEach(c => {
      c.availableMembers.forEach(memberId => conflictingMembers.add(memberId));
    });

    console.log(`   충돌 슬롯 수: ${conflictKeys.size}개`);
    if (conflictingMembers.size > 0) {
      console.log(`   협의 멤버: ${Array.from(conflictingMembers).map(m => m.substring(0,8)).join(', ')}`);
    }

    // 💡 1시간 블록(연속된 2개 슬롯) 찾기
    const findOneHourBlock = (memberId) => {
      const sortedKeys = Object.keys(timetable).sort();
      const isConflictingMember = conflictingMembers.has(memberId);

      for (let i = 0; i < sortedKeys.length - 1; i++) {
        const key1 = sortedKeys[i];
        const key2 = sortedKeys[i + 1];

        const slot1 = timetable[key1];
        const slot2 = timetable[key2];

        // 두 슬롯 모두 비어있고, 충돌 슬롯이 아님
        if (!slot1.assignedTo && !slot2.assignedTo &&
            !conflictKeys.has(key1) && !conflictKeys.has(key2)) {

          const avail1 = slot1.available.filter(a => a.priority >= priority && !a.isOwner);
          const avail2 = slot2.available.filter(a => a.priority >= priority && !a.isOwner);

          // 💡 현재 블록의 날짜 추출 (협의 멤버 체크용)
          const parts1 = key1.split('-');
          const currentDate = parts1.slice(0, 3).join('-'); // "2025-10-06"

          // 💡 조건 1: 멤버가 단독으로 사용 가능 (기존 로직)
          let isAlone = avail1.length === 1 && avail2.length === 1 &&
                        avail1[0].memberId === memberId && avail2[0].memberId === memberId;

          // 💡 협의 멤버인 경우에만 추가 체크 (하지만 현재 슬롯이 충돌 슬롯인 경우는 제외)
          // 이유: 충돌 슬롯은 이미 Phase 1에서 처리되므로, 여기서는 단독 슬롯만 체크
          const isCurrentSlotConflict = conflictKeys.has(key1) || conflictKeys.has(key2);

          if (isAlone && isConflictingMember && !isCurrentSlotConflict) {
            // [수정] 교착상태 방지를 위해 '다른 멤버 미충족' 조건 제거.
            // 단, 같은 날짜에 다른 충돌이 있는 경우는 여전히 차단하여 예측 가능성을 높임.
            const memberConflicts = conflictingSlots.filter(c => c.availableMembers.includes(memberId));
            const hasConflictOnSameDate = memberConflicts.some(c => {
              const conflictParts = c.slotKey.split('-');
              const conflictDate = conflictParts.slice(0, 3).join('-');
              return conflictDate === currentDate;
            });

            if (hasConflictOnSameDate) {
              isAlone = false; // 같은 날짜에 충돌이 있으면 단독 조건 무효화
              console.log(`      ⚠️ 단독 슬롯이지만 같은 날짜(${currentDate})에 다른 충돌이 있어 차단`);
            }
          }

          // 💡 조건 2: 협의 멤버가 명확한 우선순위 우위를 가진 경우 (현재 슬롯이 충돌이 아닐 때만)
          let hasClearPriorityAdvantage = false;
          if (isConflictingMember && !isCurrentSlotConflict) {
            // 현재 슬롯은 충돌이 아니지만, 이 멤버가 다른 슬롯에서 충돌 멤버인 경우
            const memberAvail1 = avail1.find(a => a.memberId === memberId);
            const memberAvail2 = avail2.find(a => a.memberId === memberId);

            if (memberAvail1 && memberAvail2) {
              // [5차 수정] '우선순위 우위'는 실제 경쟁(2명 이상)이 있는 슬롯에서만 판단
              const originalContenders1 = slot1.available.filter(a => !a.isOwner).length;
              const originalContenders2 = slot2.available.filter(a => !a.isOwner).length;

              // 두 슬롯 중 하나라도 경쟁자가 2명 이상일 때만 '우선순위 우위'를 계산
              if (originalContenders1 > 1 || originalContenders2 > 1) {
                const maxPriority1 = Math.max(...avail1.map(a => a.priority));
                const maxPriority2 = Math.max(...avail2.map(a => a.priority));

                const isHighestPriority1 = memberAvail1.priority === maxPriority1;
                const isHighestPriority2 = memberAvail2.priority === maxPriority2;

                // 최고 우선순위를 가진 멤버가 1명뿐인지 확인
                const highestCount1 = avail1.filter(a => a.priority === maxPriority1).length;
                const highestCount2 = avail2.filter(a => a.priority === maxPriority2).length;

                // 💡 추가 조건: 같은 날짜에 충돌이 없는지 확인
                const parts1 = key1.split('-');
                const currentDate = parts1.slice(0, 3).join('-'); // "2025-10-06"

                // 이 멤버가 연루된 충돌들 중 같은 날짜가 있는지 확인
                const memberConflicts = conflictingSlots.filter(c => c.availableMembers.includes(memberId));
                const hasConflictOnSameDate = memberConflicts.some(c => {
                  const conflictParts = c.slotKey.split('-');
                  const conflictDate = conflictParts.slice(0, 3).join('-');
                  return conflictDate === currentDate;
                });

                hasClearPriorityAdvantage = isHighestPriority1 && isHighestPriority2 &&
                                            highestCount1 === 1 && highestCount2 === 1 &&
                                            !hasConflictOnSameDate; // 같은 날짜에 충돌이 없는지만 확인
              }
              
              // 💡 디버그 로그
              console.log(`      🔍 우선순위 우위 체크: ${key1} + ${key2} → ${memberId.substring(0,8)}`);
              console.log(`         경쟁자 수: ${originalContenders1}, ${originalContenders2}`);
              console.log(`         hasClearPriorityAdvantage=${hasClearPriorityAdvantage}`);
            }
          }

          // 두 조건 중 하나라도 만족하면 할당 가능
          if (isAlone || hasClearPriorityAdvantage) {
            // 시간이 연속되는지 확인 (30분 차이)
            // key format: "2025-10-06-13:00"
            const parts1 = key1.split('-');
            const parts2 = key2.split('-');
            const date1 = parts1.slice(0, 3).join('-'); // "2025-10-06"
            const date2 = parts2.slice(0, 3).join('-'); // "2025-10-06"
            const time1 = parts1[3]; // "13:00"
            const time2 = parts2[3]; // "13:30"

            if (date1 === date2 && time1 && time2) {
              const [h1, m1] = time1.split(':').map(Number);
              const [h2, m2] = time2.split(':').map(Number);
              const minutes1 = h1 * 60 + m1;
              const minutes2 = h2 * 60 + m2;

              if (minutes2 - minutes1 === 30) {
                // [4차 수정] reason을 'hasClearPriorityAdvantage'에 우선순위를 두어 결정
                const finalReason = hasClearPriorityAdvantage ? 'hasClearPriorityAdvantage' : 'isAlone';
                console.log(`      ✅ Phase 2 할당: ${key1} + ${key2} → ${memberId.substring(0,8)} (${hasClearPriorityAdvantage ? '우선순위 우위' : '단독'})`);
                return { block: [key1, key2], reason: finalReason };
              }
            }
          }
        }
      }
      return null;
    };

    // 💡 공평한 분배를 위해 라운드 로빈 방식으로 할당
    let allMembersAssigned = false;
    let roundCount = 0;

    while (!allMembersAssigned) {
      allMembersAssigned = true;
      roundCount++;
      console.log(`   💡 [라운드 ${roundCount}] 시작`);

      // 각 멤버에 대해 1시간 블록 찾기
      for (const memberId in assignments) {
        const requiredSlots = memberRequiredSlots[memberId] || assignments[memberId]?.requiredSlots || 18;

        if (assignments[memberId].assignedHours < requiredSlots) {
          const isConflictingMember = conflictingMembers.has(memberId);

          // 💡 [수정] 공평성 로직 단순화: 할당이 필요한 멤버는 모두 시도
          console.log(`      🔍 ${memberId.substring(0,8)} 블록 찾기 시작...`);
          const result = findOneHourBlock(memberId, conflictingSlots, true); // 디버그 모드 활성화

          if (result) {
            // 💡 [수정] 협의 멤버라도 다른 요일에 단독 슬롯이 있으면 배정 (협의 최소화)
            const isConflictingMember = conflictingMembers.has(memberId);
            if (isConflictingMember) {
              // 현재 블록의 날짜 확인
              const blockDate = result.block[0].split('-').slice(0, 3).join('-');

              // 이 멤버가 연루된 충돌이 있는 날짜들 확인
              const memberConflicts = conflictingSlots.filter(c => c.availableMembers.includes(memberId));
              const conflictDates = new Set();
              memberConflicts.forEach(c => {
                const conflictParts = c.slotKey.split('-');
                const conflictDate = conflictParts.slice(0, 3).join('-');
                conflictDates.add(conflictDate);
              });

              // 현재 블록이 충돌 날짜와 다른 요일이면 배정 허용
              if (!conflictDates.has(blockDate)) {
                console.log(`      ✅ 협의 멤버이지만 다른 요일(${blockDate})에 단독 슬롯 발견 → 배정하여 협의 최소화`);
              } else {
                console.log(`      ⏭️ 할당 보류: 멤버 ${memberId.substring(0,8)}가 협의에 포함되어 있고 같은 날짜에 충돌이 있으므로 Phase 4 협의로 해결합니다.`);
                continue;
              }
            }

            // 💡 [추가] 같은 날짜에 다른 미충족 멤버도 가능한지 체크
            const blockDate = result.block[0].split('-').slice(0, 3).join('-');

            let hasOtherUnsatisfiedMemberOnSameDate = false;
            for (const otherMemberId in assignments) {
              if (otherMemberId === memberId) continue;

              const otherRequiredSlots = memberRequiredSlots[otherMemberId] || 0;
              const otherAssignedSlots = assignments[otherMemberId]?.assignedHours || 0;
              const otherStillNeeds = otherAssignedSlots < otherRequiredSlots;

              if (!otherStillNeeds) continue;

              // 이 다른 멤버가 같은 날짜의 블록에 사용 가능한지 확인
              const slot1 = timetable[result.block[0]];
              const slot2 = timetable[result.block[1]];

              if (slot1 && slot2) {
                const otherAvail1 = slot1.available.some(a => a.memberId === otherMemberId && !a.isOwner);
                const otherAvail2 = slot2.available.some(a => a.memberId === otherMemberId && !a.isOwner);

                if (otherAvail1 && otherAvail2) {
                  hasOtherUnsatisfiedMemberOnSameDate = true;
                  console.log(`      ⚠️ 같은 날짜(${blockDate})에 다른 미충족 멤버 ${otherMemberId.substring(0,8)} 발견 (${otherAssignedSlots}/${otherRequiredSlots})`);
                  break;
                }
              }
            }

            if (hasOtherUnsatisfiedMemberOnSameDate) {
              console.log(`      ⏭️ 할당 보류: 같은 날짜에 다른 미충족 멤버도 가능하므로 Phase 4 협의로 넘김`);
              continue;
            }

            // '우선순위 우위'이거나, 일반 멤버의 '단독' 슬롯인 경우 할당 진행
            this._assignSlot(timetable, assignments, result.block[0], memberId);
            this._assignSlot(timetable, assignments, result.block[1], memberId);
            assignedCount += 2;
            allMembersAssigned = false; // 할당이 일어났으므로 루프 계속
            console.log(`      ✅ ${result.block[0]} + ${result.block[1]} → ${memberId.substring(0,8)} (1시간 블록, 이유: ${result.reason})`);

            // 한 라운드에 한 명만 할당하고 다시 처음부터 가장 필요한 사람을 찾기 위해 break
            break;
          } else {
            console.log(`      ⏭️ ${memberId.substring(0,8)}: 1시간 블록 없음`);
          }
        }
      }

      if (roundCount > 20) {
        console.log(`   ⚠️ 라운드 20회 초과, 중단`);
        break;
      }
      
      // 💡 for 루프가 break 없이 모두 돌았다면, 더 이상 할당할 블록이 없는 것
      if (allMembersAssigned) {
        break;
      }
    }

    console.log(`   단독 할당: ${assignedCount}개 슬롯 (${assignedCount/2}시간)`);

    // 할당 현황 출력
    Object.keys(assignments).forEach(memberId => {
      const requiredSlots = memberRequiredSlots[memberId] || assignments[memberId]?.requiredSlots || 18;
      const assignedSlots = assignments[memberId].assignedHours;
      console.log(`   ${memberId.substring(0,8)}: ${assignedSlots}/${requiredSlots}슬롯`);
    });
  }

  _iterativeAssignment(timetable, assignments, priority, memberRequiredSlots, members = [], ownerPreferences = {}, conflictingSlots = [], ownerId = null) {
    let changed = true;
    let iterationCount = 0;

    // 💡 협의에 포함된 멤버들 추출
    const conflictingMembers = new Set();
    conflictingSlots.forEach(c => {
      c.availableMembers.forEach(memberId => conflictingMembers.add(memberId));
    });

    // 💡 충돌 슬롯 키 Set
    const conflictKeys = new Set(conflictingSlots.map(c => c.slotKey));

    // 💡 1시간 블록 찾기 함수 - 우선순위가 가장 높은 블록을 반환
    const findOneHourBlock = (memberId, conflicts, debugMode = false) => {
      // ownerId는 외부 스코프에서 접근 가능
      const sortedKeys = Object.keys(timetable).sort();
      let attemptCount = 0;
      let bestBlock = null;
      let bestBlockPriority = -1; // 가장 높은 우선순위 추적

      for (let i = 0; i < sortedKeys.length - 1; i++) {
        const key1 = sortedKeys[i];
        const key2 = sortedKeys[i + 1];

        const slot1 = timetable[key1];
        const slot2 = timetable[key2];

        // 두 슬롯 모두 비어있고, 충돌 슬롯이 아님
        if (!slot1.assignedTo && !slot2.assignedTo &&
            !conflictKeys.has(key1) && !conflictKeys.has(key2)) {

          const avail1 = slot1.available.find(a => a.memberId === memberId && a.priority >= priority && !a.isOwner);
          const avail2 = slot2.available.find(a => a.memberId === memberId && a.priority >= priority && !a.isOwner);

          // 두 슬롯 모두 해당 멤버가 사용 가능한지 확인
          if (avail1 && avail2) {
            attemptCount++;
            if (debugMode) console.log(`         🔍 시도 ${attemptCount}: ${key1} + ${key2}`);

            // 💡 해당 멤버가 최고 우선순위인지 확인
            const allAvail1 = slot1.available.filter(a => a.priority >= priority && !a.isOwner);
            const allAvail2 = slot2.available.filter(a => a.priority >= priority && !a.isOwner);

            const maxPriority1 = Math.max(...allAvail1.map(a => a.priority));
            const maxPriority2 = Math.max(...allAvail2.map(a => a.priority));

            const isHighestPriority1 = avail1.priority === maxPriority1;
            const isHighestPriority2 = avail2.priority === maxPriority2;

            if (debugMode) console.log(`            멤버우선순위: ${avail1.priority}, 최고우선순위1: ${maxPriority1}, 최고우선순위2: ${maxPriority2}`);

            // 💡 최고 우선순위가 아니면 건너뜀
            if (!isHighestPriority1 || !isHighestPriority2) {
              if (debugMode) console.log(`            ❌ 최고 우선순위 아님`);
              continue;
            }

            // 💡 최고 우선순위가 여러 명이면 건너뜀 (충돌이어야 하는데 놓친 경우)
            const highestCount1 = allAvail1.filter(a => a.priority === maxPriority1).length;
            const highestCount2 = allAvail2.filter(a => a.priority === maxPriority2).length;

            if (debugMode) console.log(`            최고우선순위 멤버 수: slot1=${highestCount1}, slot2=${highestCount2}`);

            if (highestCount1 > 1 || highestCount2 > 1) {
              if (debugMode) console.log(`            ❌ 최고 우선순위 멤버가 2명 이상 (충돌)`);
              continue;
            }

            // 💡 협의 멤버인 경우 Phase 3 할당 정책 체크
            const isConflictingMember = conflictingMembers.has(memberId);
            if (isConflictingMember) {
              if (debugMode) {
                console.log(`            협의멤버 체크 중... (memberId: ${memberId})`);
                console.log(`            전체 협의멤버 목록: ${Array.from(conflictingMembers).join(', ')}`);
              }

              // 💡 이 멤버가 연루된 충돌 목록 찾기
              const memberConflicts = conflicts.filter(c => c.availableMembers.includes(memberId));
              const conflictSlotKeys = new Set(memberConflicts.map(c => c.slotKey));

              if (debugMode) {
                console.log(`            이 멤버가 연루된 충돌 슬롯: ${Array.from(conflictSlotKeys).join(', ')}`);
                console.log(`            현재 시도 블록: [${key1}, ${key2}]`);
              }

              // 💡 현재 블록의 두 슬롯 중 하나라도 충돌 슬롯이면 무조건 Phase 3 차단
              const isBlockInConflict = conflictSlotKeys.has(key1) || conflictSlotKeys.has(key2);

              if (isBlockInConflict) {
                if (debugMode) console.log(`            ❌ 현재 블록이 충돌 슬롯 포함 → Phase 3에서 할당 불가`);
                continue;
              }

              // 💡 충돌 슬롯이 아닌 경우: 현재 블록에서 이 멤버와 함께 충돌하는 다른 멤버가 있는지 확인

              // 이 멤버와 함께 충돌하는 다른 멤버들 찾기
              const coConflictingMembers = new Set();
              memberConflicts.forEach(conflict => {
                conflict.availableMembers.forEach(otherId => {
                  if (otherId !== memberId) {
                    coConflictingMembers.add(otherId);
                  }
                });
              });

              if (debugMode) {
                console.log(`            이 멤버와 충돌하는 다른 멤버들: ${Array.from(coConflictingMembers).join(', ')}`);
              }

              // 현재 블록에 충돌 멤버가 있는지 확인
              const slot1 = timetable[key1];
              const slot2 = timetable[key2];

              const avail1InBlock = (slot1.available || []).filter(a => a.memberId !== ownerId);
              const avail2InBlock = (slot2.available || []).filter(a => a.memberId !== ownerId);

              // 💡 현재 블록에 같은 우선순위 충돌 멤버가 있는지 확인
              const member1Priority = avail1InBlock.find(a => a.memberId === memberId)?.priority || 2;
              const member2Priority = avail2InBlock.find(a => a.memberId === memberId)?.priority || 2;

              const hasCoConflictSamePriority1 = avail1InBlock.some(a =>
                coConflictingMembers.has(a.memberId) && a.priority === member1Priority
              );
              const hasCoConflictSamePriority2 = avail2InBlock.some(a =>
                coConflictingMembers.has(a.memberId) && a.priority === member2Priority
              );

              if (debugMode) {
                console.log(`            현재 블록에 같은 우선순위 충돌 멤버? slot1=${hasCoConflictSamePriority1}, slot2=${hasCoConflictSamePriority2}`);
              }

              // 💡 같은 우선순위 충돌 멤버가 있으면 무조건 차단
              if (hasCoConflictSamePriority1 || hasCoConflictSamePriority2) {
                if (debugMode) console.log(`            ❌ 현재 블록에 같은 우선순위 충돌 멤버 존재 → Phase 3 차단`);
                continue;
              }

              // 💡 [수정] 협의 멤버라도 다른 요일이면 허용 (협의 최소화)
              const blockDate = key1.split('-').slice(0, 3).join('-');
              const conflictDates = new Set();
              memberConflicts.forEach(c => {
                const conflictParts = c.slotKey.split('-');
                const conflictDate = conflictParts.slice(0, 3).join('-');
                conflictDates.add(conflictDate);
              });

              // 현재 블록이 충돌 날짜가 아니면 허용
              if (conflictDates.has(blockDate)) {
                if (debugMode) console.log(`            ❌ 협의 멤버가 충돌 날짜(${blockDate})의 블록 → Phase 3 차단`);
                continue;
              } else {
                if (debugMode) console.log(`            ✅ 협의 멤버이지만 다른 요일(${blockDate}) → Phase 3 허용`);
              }
            }

            // 시간이 연속되는지 확인 (30분 차이)
            const parts1 = key1.split('-');
            const parts2 = key2.split('-');
            const date1 = parts1.slice(0, 3).join('-');
            const date2 = parts2.slice(0, 3).join('-');
            const time1 = parts1[3];
            const time2 = parts2[3];

            if (date1 === date2 && time1 && time2) {
              const [h1, m1] = time1.split(':').map(Number);
              const [h2, m2] = time2.split(':').map(Number);
              const minutes1 = h1 * 60 + m1;
              const minutes2 = h2 * 60 + m2;

              if (minutes2 - minutes1 === 30) {
                // 💡 이 블록의 우선순위 계산 (두 슬롯의 평균)
                const blockPriority = (avail1.priority + avail2.priority) / 2;

                if (debugMode) console.log(`            ✅ 블록 찾음! 우선순위=${blockPriority}`);

                // 💡 더 높은 우선순위 블록이면 교체
                if (blockPriority > bestBlockPriority) {
                  bestBlock = [key1, key2];
                  bestBlockPriority = blockPriority;
                  if (debugMode) console.log(`            🏆 최고 우선순위 블록 갱신!`);
                }
              } else {
                if (debugMode) console.log(`            ❌ 시간 연속 아님 (차이: ${minutes2 - minutes1}분)`);
              }
            }
          }
        }
      }

      if (bestBlock) {
        if (debugMode) console.log(`         ✅✅ 최종 선택: ${bestBlock[0]} + ${bestBlock[1]} (우선순위: ${bestBlockPriority})`);
        return bestBlock;
      }

      if (debugMode) console.log(`         ❌ 총 ${attemptCount}개 시도, 블록 못 찾음`);
      return null;
    };

    // Loop as long as we are successfully assigning slots
    while (changed) {
      changed = false;

      // Find all members who still need hours assigned (개별 할당시간 기준)
      const membersToAssign = Object.keys(assignments)
        .filter(id => {
          const requiredSlots = memberRequiredSlots[id] || assignments[id]?.requiredSlots || 18;
          return assignments[id].assignedHours < requiredSlots;
        })
        // Sort by priority first, then by fewest hours assigned
        .sort((a, b) => {
          const memberA = members.find(m => m.user._id.toString() === a);
          const memberB = members.find(m => m.user._id.toString() === b);

          const priorityA = this.getMemberPriority(memberA);
          const priorityB = this.getMemberPriority(memberB);

          // Higher priority first (5 > 4 > 3 > 2 > 1)
          if (priorityA !== priorityB) {
            return priorityB - priorityA;
          }

          // If same priority, prioritize members with fewest hours
          return assignments[a].assignedHours - assignments[b].assignedHours;
        });

      if (membersToAssign.length === 0) {
        break; // All members have their minimum hours
      }

      console.log(`   💡 [반복 ${iterationCount + 1}] 할당 필요한 멤버: ${membersToAssign.map(id => `${id.substring(0,8)}(${assignments[id].assignedHours}슬롯)`).join(', ')}`);

      // Iterate through the needy members and try to assign ONE HOUR BLOCK to the most needy one
      for (const memberId of membersToAssign) {
        const requiredSlots = memberRequiredSlots[memberId] || assignments[memberId]?.requiredSlots || 18;

        console.log(`      🔍 ${memberId.substring(0,8)} 시도 중 (현재: ${assignments[memberId].assignedHours}/${requiredSlots}슬롯)`);

        // 💡 1시간 블록 찾기 (충돌 슬롯 제외, 최고 우선순위만)
        // 협의 멤버라도 단독 최고 우선순위면 가능
        const block = findOneHourBlock(memberId, conflictingSlots, true); // 디버그 모드 활성화
        if (block) {
          this._assignSlot(timetable, assignments, block[0], memberId);
          this._assignSlot(timetable, assignments, block[1], memberId);
          changed = true;
          iterationCount++;
          console.log(`      ✅ 반복 ${iterationCount}: ${block[0]} + ${block[1]} → ${memberId.substring(0,8)} (1시간 블록)`);
          // After assigning one block, break from the for-loop and restart the while-loop
          // This re-evaluates who is the most "needy" member for the next assignment
          break;
        } else {
          console.log(`      ⏭️ ${memberId.substring(0,8)}: 1시간 블록 없음`);
        }
      }
    }

    if (iterationCount > 0) {
      console.log(`   총 ${iterationCount}개 블록 (${iterationCount * 2}개 슬롯) 할당됨`);
    }
  }

  _getPreviousSlotKey(key) {
    const lastDashIndex = key.lastIndexOf('-');
    if (lastDashIndex === -1) return null;

    const dateKey = key.substring(0, lastDashIndex);
    const time = key.substring(lastDashIndex + 1);
    const [h, m] = time.split(':').map(Number);

    let prevH = h;
    let prevM = m - 30;

    if (prevM < 0) {
        prevM = 30;
        prevH = h - 1;
    }
    
    if (prevH < 0) return null; // Out of time range

    const prevTime = `${String(prevH).padStart(2, '0')}:${String(prevM).padStart(2, '0')}`;
    return `${dateKey}-${prevTime}`;
  }

  _findBestSlotForMember(timetable, assignments, memberId, priority, members = [], ownerPreferences = {}, minSlotsPerWeek = 6, conflictingSlots = []) {
    let bestSlot = null;
    let bestScore = -1;

    // Find member's focus time preference from members array
    const member = members.find(m => m.user._id.toString() === memberId);
    const focusTimeType = ownerPreferences.focusTimeType || 'none';

    // 사용자의 이미 할당된 슬롯들에서 평균 시간대 계산
    const memberSlots = assignments[memberId].slots;
    let avgTime = 12; // 기본값 12시 (정오)

    if (memberSlots.length > 0) {
      const times = memberSlots.map(slot => {
        const timeStr = slot.startTime || slot.time; // Use startTime, fallback to time
        if (!timeStr) return 12; // Default to noon if no time
        const [h, m] = timeStr.split(':').map(Number);
        return h + (m / 60);
      });
      avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    }

    // Create set of conflicting slot keys for fast lookup
    const conflictingSlotKeys = new Set(conflictingSlots.map(c => c.slotKey));

    for (const key in timetable) {
        const slot = timetable[key];
        if (slot.assignedTo) continue;

        // Skip slots that are under negotiation
        if (conflictingSlotKeys.has(key)) {
          continue;
        }

        const memberAvailability = slot.available.find(a => a.memberId === memberId && a.priority >= priority && !a.isOwner);
        if (memberAvailability) {
            const contenders = slot.available.filter(a => !a.isOwner).length;

            // 기본 점수: 경쟁자 수에 따라 감점
            let score = 1000 - (contenders * 10);

            // 선호도 보너스: 높은 priority일수록 보너스 점수
            score += (memberAvailability.priority - priority) * 50;

            // 연속성 보너스: 이전 슬롯이 같은 멤버에게 할당된 경우
            const prevKey = this._getPreviousSlotKey(key);
            if (prevKey && timetable[prevKey] && timetable[prevKey].assignedTo === memberId) {
                score += 200;
            }

            // 시간대 근접성 보너스: 평균 시간에 가까울수록 높은 점수
            const lastDashIndex = key.lastIndexOf('-');
            const timeStr = key.substring(lastDashIndex + 1);
            const [h, m] = timeStr.split(':').map(Number);
            const slotTime = h + (m / 60);
            const timeDiff = Math.abs(slotTime - avgTime);
            const proximityBonus = Math.max(0, 100 - (timeDiff * 20)); // 시간당 20점 감점
            score += proximityBonus;

            // 집중시간 보너스: 설정된 집중시간에 맞는 시간대일 경우 추가 점수
            const slotTimeString = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            if (this._isInPreferredTime(slotTimeString, focusTimeType)) {
              score += 150; // 집중시간 보너스
            }

            if (score > bestScore) {
                bestScore = score;
                bestSlot = { key, slot };
            }
        }
    }
    
    if (bestSlot) {
        return { bestSlot, score: bestScore };
    }
    return null;
  }

  _assignSlot(timetable, assignments, key, memberId) {
    const dayMap = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday' };
    const lastDashIndex = key.lastIndexOf('-');
    const dateKey = key.substring(0, lastDashIndex);
    const startTimeRaw = key.substring(lastDashIndex + 1);

    if (!timetable[key]) {
      console.error(`❌ timetable[${key}]가 존재하지 않습니다!`);
      return;
    }

    // 💡 주별 제한 체크 (임시 비활성화 - 무한루프 문제로 인해)
    // TODO: 타임테이블 생성 단계에서 주별 제한을 적용하도록 재설계 필요
    /*
    if (this.memberRequiredSlotsPerWeek && timetable[key].weekNumber !== undefined) {
      const weekNumber = timetable[key].weekNumber;
      const maxSlotsPerWeek = this.memberRequiredSlotsPerWeek[memberId] || Infinity;

      if (!assignments[memberId]) {
        assignments[memberId] = {
          memberId: memberId,
          assignedHours: 0,
          slots: [],
          weeklySlots: {}
        };
      }

      const currentWeeklySlots = assignments[memberId].weeklySlots[weekNumber] || 0;

      if (currentWeeklySlots >= maxSlotsPerWeek) {
        // 이미 이번 주에 최대치를 받음 (로그 제거 - 무한루프 방지)
        return false; // 배정 실패
      }
    }
    */

    const [h, m] = startTimeRaw.split(':').map(Number);

    // 30분 추가하여 endTime 계산
    let endMinute = m + 30;
    let endHour = h;
    if (endMinute >= 60) {
      endMinute -= 60;
      endHour += 1;
    }
    const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

    const slotDate = timetable[key].date;
    const slotDayOfWeek = timetable[key].dayOfWeek;

    if (!slotDate || !slotDayOfWeek) {
      console.error(`❌ ${key} - date 또는 dayOfWeek가 없습니다!`);
      return;
    }

    const dayString = dayMap[slotDayOfWeek];

    if (!dayString) {
      console.warn("⚠️ Invalid dayString for slotDayOfWeek:", slotDayOfWeek);
      return;
    }

    timetable[key].assignedTo = memberId;

    if (!assignments[memberId]) {
      assignments[memberId] = {
        memberId: memberId,
        assignedHours: 0,
        slots: [],
        weeklySlots: {}
      };
    }

    assignments[memberId].assignedHours += 1;

    // 💡 주별 카운터 증가 (임시 비활성화)
    /*
    if (timetable[key].weekNumber !== undefined) {
      const weekNumber = timetable[key].weekNumber;
      if (!assignments[memberId].weeklySlots[weekNumber]) {
        assignments[memberId].weeklySlots[weekNumber] = 0;
      }
      assignments[memberId].weeklySlots[weekNumber] += 1;
    }
    */

    const slotData = {
        date: slotDate,
        day: dayString,
        startTime: startTimeRaw,
        endTime,
        subject: '자동 배정',
        user: memberId,
        status: 'confirmed'
    };

    if (!slotData.date || !slotData.day || !slotData.startTime || !slotData.endTime) {
      console.error(`❌ 슬롯 데이터 검증 실패!`, { key, memberId });
      return;
    }

    assignments[memberId].slots.push(slotData);
  }

  _resolveConflictsWithOwner(timetable, assignments, owner, memberRequiredSlots) {
    const ownerId = owner._id.toString();

    // 방장의 모든 사용 가능한 시간대에서 충돌을 해결
    // 방장이 양보할 수 있는 시간대를 찾아서 멤버들에게 할당
    const membersNeedingHours = Object.keys(assignments).filter(id => {
      const requiredSlots = memberRequiredSlots[id] || assignments[id]?.requiredSlots || 18;
      return id !== ownerId && assignments[id].assignedHours < requiredSlots;
    });

    for (const memberId of membersNeedingHours) {
      const requiredSlots = memberRequiredSlots[memberId] || assignments[memberId]?.requiredSlots || 18;
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
        this._assignSlot(timetable, assignments, key, memberId);
        needed -= 1;
      }
    }
  }

  _resolveConflictsByOwnerTakingSlot(timetable, assignments, owner, memberRequiredSlots, ownerPreferences = {}) {
    // ❌ 이 함수는 사용하지 않음
    // 방장은 자동배정에 참여하지 않음
    // 방장의 선호시간표는 조원들이 사용 가능한 시간대를 나타낼 뿐
    console.log('ℹ️ [방장] 방장은 자동배정에서 제외됨');
    return;
  }

  _carryOverAssignments(timetable, assignments, memberRequiredSlots, members) {
    const membersNeedingHours = Object.keys(assignments).filter(id => {
      const requiredSlots = memberRequiredSlots[id] || assignments[id]?.requiredSlots || 18;
      return assignments[id].assignedHours < requiredSlots;
    });

    for (const memberId of membersNeedingHours) {
      const requiredSlots = memberRequiredSlots[memberId] || assignments[memberId]?.requiredSlots || 18;
      let needed = requiredSlots - assignments[memberId].assignedHours;
      const neededHours = needed / 2; // 슬롯을 시간으로 변환 (1시간 = 2슬롯)

      // 멤버의 carryOverHistory 확인하여 연속 이월 횟수 체크
      const member = members.find(m => m.user._id.toString() === memberId);
      const carryOverHistory = member?.carryOverHistory || [];

      // 최근 2주 연속 이월 체크
      let consecutiveCarryOvers = 0;
      const now = new Date();
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      carryOverHistory.forEach(history => {
        if (history.timestamp >= twoWeeksAgo) {
          consecutiveCarryOvers++;
        }
      });

      if (consecutiveCarryOvers >= 2) {
        assignments[memberId].needsIntervention = true;
        assignments[memberId].interventionReason = '2주 이상 연속 이월';
      }

      // 이월 정보를 assignments에 추가
      if (!assignments[memberId].carryOver) {
        assignments[memberId].carryOver = 0;
      }
      assignments[memberId].carryOver += neededHours;
    }
  }

  // Helper function to check if a time slot matches focus time preferences
  _isInPreferredTime(time, focusTimeType) {
    if (!focusTimeType || focusTimeType === 'none') {
      return false; // No preference
    }

    const [hour] = time.split(':').map(Number);

    switch (focusTimeType) {
      case 'morning':
        return hour >= 9 && hour < 12;
      case 'lunch':
        return hour >= 12 && hour < 14;
      case 'afternoon':
        return hour >= 14 && hour < 17;
      case 'evening':
        return hour >= 17 && hour < 20;
      default:
        return false;
    }
  }

  // Legacy function for backward compatibility
  _isInOwnerPreferredTime(time, ownerPreferences) {
    return this._isInPreferredTime(time, ownerPreferences.focusTimeType);
  }

  // Helper function to prioritize slots based on owner preferences
  _prioritizeSlotsByOwnerPreference(slots, ownerPreferences) {
    if (!ownerPreferences.focusTimeType || ownerPreferences.focusTimeType === 'none') {
      return slots; // No preference, return as-is
    }

    // Group slots by date to find consecutive slots within preferred time
    const slotsByDate = {};
    slots.forEach(key => {
      const [date] = key.split('-');
      if (!slotsByDate[date]) {
        slotsByDate[date] = [];
      }
      slotsByDate[date].push(key);
    });

    // Prioritize slots within preferred time range and consecutive slots
    const prioritizedSlots = [];
    const nonPreferredSlots = [];

    Object.keys(slotsByDate).forEach(date => {
      const daySlots = slotsByDate[date].sort(); // Sort by time
      const preferredSlots = [];
      const otherSlots = [];

      daySlots.forEach(key => {
        const time = key.split('-').pop();
        if (this._isInOwnerPreferredTime(time, ownerPreferences)) {
          preferredSlots.push(key);
        } else {
          otherSlots.push(key);
        }
      });

      // Add preferred slots first (these are already in time order)
      prioritizedSlots.push(...preferredSlots);
      nonPreferredSlots.push(...otherSlots);
    });

    // Return preferred slots first, then non-preferred
    return [...prioritizedSlots, ...nonPreferredSlots];
  }
}

module.exports = new SchedulingAlgorithm();

// --- DEBUGGING UTILITY ---
/*
class SchedulingAlgorithm {
  debug(roomTimeSlots, options) {
    const { minHoursPerWeek = 3, numWeeks = 2, currentWeek } = options;
    const startDate = currentWeek ? new Date(currentWeek) : new Date();
    
    const timetable = this._createTimetable(roomTimeSlots, startDate, numWeeks);

    const availableSlots = Object.entries(timetable)
      .filter(([key, slot]) => slot.available.length > 0)
      .reduce((acc, [key, slot]) => {
        acc[key] = slot;
        return acc;
      }, {});

    return {
      receivedOptions: options,
      receivedRoomTimeSlots: roomTimeSlots,
      generatedTimetableWithAvailability: availableSlots,
    };
  }
}
*/
