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

    console.log(`[병합] 전체 충돌 슬롯 키:`, sortedConflicts.map(c => c.slotKey));

    const mergedBlocks = [];
    let currentBlock = null;

    for (const conflict of sortedConflicts) {
      const { slotKey, availableMembers } = conflict;
      // slotKey format: "2025-09-15-13:30"
      const parts = slotKey.split('-');
      const date = `${parts[0]}-${parts[1]}-${parts[2]}`; // "2025-09-15"
      const timeRaw = parts[3]; // "13:30"

      console.log(`[병합] 처리 중: ${slotKey} → date: ${date}, timeRaw: ${timeRaw}`);

      // Ensure time is properly formatted as HH:MM
      let time = timeRaw;
      if (!timeRaw.includes(':')) {
        // If time is just a number like "10", format it as "10:00"
        time = `${String(timeRaw).padStart(2, '0')}:00`;
        console.log(`[병합] 시간 변환: ${timeRaw} → ${time}`);
      } else if (timeRaw.split(':')[1] === undefined) {
        // If time is like "10:", format it as "10:00"
        time = `${timeRaw}00`;
        console.log(`[병합] 시간 변환: ${timeRaw} → ${time}`);
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
        console.log(`[병합] 새 블록 생성: ${date} ${time} (요일: ${timetable[slotKey].dayOfWeek})`);
      } else {
        const isSameDay = (date === currentBlock.startDate);
        const isAdjacentTime = (currentBlock.endTime === time);
        const isSameMembers = (membersKey === currentBlock.membersKey);

        console.log(`[병합] 조건 확인: ${slotKey}`);
        console.log(`  - 같은 날? ${isSameDay} (${date} === ${currentBlock.startDate})`);
        console.log(`  - 연속 시간? ${isAdjacentTime} (${currentBlock.endTime} === ${time})`);
        console.log(`  - 같은 멤버? ${isSameMembers}`);

        if (isSameDay && isAdjacentTime && isSameMembers) {
          console.log(`[병합] 블록 확장: ${currentBlock.startTime} → ${this._calculateEndTime(time)}`);
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

    console.log(`[협의] ${mergedBlocks.length}개 협의 블록 생성`);
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

    console.log('스케줄링 알고리즘 - 받은 options:', { minHoursPerWeek, numWeeks, currentWeek, hasOwnerPreferences: !!ownerPreferences });

    // Convert hours to 30-minute slots (1 hour = 2 slots)
    const minSlotsPerWeek = minHoursPerWeek * 2;

    // 각 멤버별 할당 시간 계산 (carryOver 포함)
    const memberRequiredSlots = {};
    members.forEach(m => {
      const memberId = m.user._id.toString();
      const carryOverHours = m.carryOver || 0;
      const totalRequiredHours = minHoursPerWeek + carryOverHours;
      memberRequiredSlots[memberId] = totalRequiredHours * 2; // 시간을 슬롯으로 변환 (1시간 = 2슬롯)
      console.log(`[할당시간] 멤버 ${memberId}: 기본 ${minHoursPerWeek}시간 + 이월 ${carryOverHours}시간 = 총 ${totalRequiredHours}시간 (${memberRequiredSlots[memberId]}슬롯)`);
    });

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

    // Phase 0: Assign Deferred Assignments (0-priority)
    this._assignDeferredAssignments(timetable, assignments, deferredAssignments);

    // Phase 1: Identify conflicts BEFORE assignment (대체 시간 고려)
    console.log(`
🔵🔵🔵 ========== PHASE 1: 충돌 감지 시작 ==========`);
    const conflictingSlots = this._identifyConflictsBeforeAssignment(timetable, ownerId, memberRequiredSlots);
    console.log(`
📋 [협의병합] 연속 충돌 병합 시작... (총 ${conflictingSlots.length}개 충돌)`);
    console.log(`📋 [충돌 슬롯 목록]:`, conflictingSlots.map(c => `${c.slotKey} (${c.availableMembers.map(m => m.substring(0,8)).join(',')})`).join(', '));
    const negotiationBlocks = this._mergeConsecutiveConflicts(conflictingSlots, timetable);
    console.log(`📋 [협의병합] 병합 완료: ${negotiationBlocks.length}개 협의 블록 생성`);
    negotiationBlocks.forEach((block, idx) => {
      console.log(`   블록 ${idx+1}: ${block.startDate} ${block.startTime}-${block.endTime}, 멤버: ${block.conflictingMembers.map(m => m.substring(0,8)).join(',')}`);
    });
    console.log(`🔵🔵🔵 ========== PHASE 1 완료 ==========
`);

    // Phase 2: Assign undisputed high-priority slots (충돌 제외)
    console.log(`
🟢🟢🟢 ========== PHASE 2: 단독 슬롯 배정 시작 ==========`);
    this._assignUndisputedSlots(timetable, assignments, 3, memberRequiredSlots, conflictingSlots);
    console.log(`🟢🟢🟢 ========== PHASE 2 완료 ==========
`);

    // Phase 3: Iteratively fill remaining hours (skip slots that are under negotiation)
    console.log(`
🟡🟡🟡 ========== PHASE 3: 반복 배정 시작 ==========`);
    this._iterativeAssignment(timetable, assignments, 3, memberRequiredSlots, nonOwnerMembers, ownerPreferences, conflictingSlots);
    console.log(`🟡🟡🟡 ========== PHASE 3 완료 ==========
`);

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

        console.log(`알고리즘: 멤버 ${id} - 할당된 슬롯: ${assignments[id].assignedHours}, 필요한 슬롯: ${requiredSlots}, 이월 시간: ${neededHours}시간`);

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

    console.log(`
🔴🔴🔴 ========== 협의 생성 단계 시작 ==========`);
    console.log(`📝 [협의생성] negotiationBlocks 수: ${negotiationBlocks.length}`);
    console.log(`📝 [현재 할당 상황]:`);
    Object.keys(assignments).forEach(memberId => {
      const requiredSlots = memberRequiredSlots[memberId] || 0;
      const assignedSlots = assignments[memberId]?.assignedHours || 0;
      console.log(`   멤버 ${memberId.substring(0,8)}: ${assignedSlots}/${requiredSlots}슬롯 할당됨`);
    });
    
    if (negotiationBlocks.length === 0) {
      console.log(`📝 [협의생성] ⚠️ 협의 블록이 없습니다!`);
    }
    negotiationBlocks.forEach((block, index) => {
      console.log(`
📝 [협의생성] Block ${index + 1}: ${block.startDate} ${block.startTime}-${block.endTime} (요일:${block.dayOfWeek})`);
      console.log(`   멤버들:`, block.conflictingMembers.map(m => m.substring(0,8)).join(', '));
    });

    for (const block of negotiationBlocks) {
      console.log(`
🔥🔥🔥 [협의 처리] 블록: ${block.startDate} ${block.startTime}-${block.endTime} 처리 시작`);
      const dayMap = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday' };
      const dayString = dayMap[block.dayOfWeek];
      console.log(`   요일: ${dayString}, 충돌 멤버: ${block.conflictingMembers.map(m => m.substring(0,8)).join(', ')}`);


      // 시간대 길이 계산 (30분 단위 슬롯 수)
      const [startH, startM] = block.startTime.split(':').map(Number);
      const [endH, endM] = block.endTime.split(':').map(Number);
      const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
      const totalSlots = totalMinutes / 30; // 30분 = 1슬롯

      // 각 멤버가 필요한 슬롯 수 계산
      // 💡 중요: 협의 타입 판단을 위해 '아직 필요한 슬롯'이 아닌 '원래 필요한 슬롯'을 사용
      // 예: A가 1시간(2슬롯) 필요, B도 1시간(2슬롯) 필요 → 둘 다 같은 양을 원함
      const memberSlotNeeds = block.conflictingMembers.map(memberId => {
        const member = nonOwnerMembers.find(m => m.user._id.toString() === memberId);
        const requiredSlots = memberRequiredSlots[memberId] || 0;
        const assignedSlots = (assignments[memberId]?.assignedHours || 0);
        const neededSlots = requiredSlots - assignedSlots; // 아직 할당받아야 할 슬롯
        const originallyNeededSlots = memberRequiredSlots[memberId] || 2; // 원래 필요한 슬롯 (협의 타입 판단용)
        return { memberId, neededSlots, originallyNeededSlots, assignedSlots, requiredSlots };
      });

      // 💡 충족된 멤버 확인 (Issue 2 해결)
      const unsatisfiedMembers = memberSlotNeeds.filter(m => m.neededSlots > 0);
      
      console.log(`🔍 [협의생성] ${dayString} ${block.startTime}: 충돌 멤버 ${block.conflictingMembers.length}명, 미충족 ${unsatisfiedMembers.length}명`);
      memberSlotNeeds.forEach(m => {
        console.log(`   멤버 ${m.memberId.substring(0,8)}: 필요 ${m.requiredSlots}, 할당 ${m.assignedSlots}, 남은 ${m.neededSlots}`);
      });
      
      // 모든 멤버 충족 → 협의 스킵
      if (unsatisfiedMembers.length === 0) {
        console.log(`⏭️ [협의 스킵] 모든 멤버 충족됨`);
        continue;
      }
      
      // 1명만 미충족 → 자동 배정
      if (unsatisfiedMembers.length === 1) {
        const onlyMember = unsatisfiedMembers[0];
        console.log(`✅ [자동배정 예약] ${onlyMember.memberId.substring(0,8)}에게 자동 배정`);
        
        autoAssignments.push({
          memberId: onlyMember.memberId,
          dateObj: block.dateObj,
          dayString: dayString,
          startTime: block.startTime,
          endTime: block.endTime,
          neededSlots: onlyMember.neededSlots,
          totalSlots: totalSlots
        });
        
        continue;
      }
      
      // 2명 이상 미충족 → 협의 생성 (미충족 멤버들만)
      console.log(`🚨 [협의 생성] ${unsatisfiedMembers.length}명 미충족 → 협의 필요`);
      block.conflictingMembers = unsatisfiedMembers.map(m => m.memberId);

      // 협의 타입 판단 (미충족 멤버들만)
      const totalNeeded = unsatisfiedMembers.reduce((sum, m) => sum + m.neededSlots, 0);
      const allNeedSameOriginalAmount = unsatisfiedMembers.every(m =>
        m.originallyNeededSlots === unsatisfiedMembers[0].originallyNeededSlots
      );

      let negotiationType = 'full_conflict';
      let availableTimeSlots = [];

      // 💡 새로운 로직: 충돌이 발생하면 항상 먼저 시간 선택(time_slot_choice)으로 시작
      // 멤버들이 각자 시간을 선택하고, 겹치면 full_conflict로 전환됨 (협의 해결 로직에서 처리)

      // 모든 멤버가 원래 같은 시간 필요 && 충돌 시간대가 필요 시간보다 크거나 같으면
      if (allNeedSameOriginalAmount && totalNeeded <= totalSlots) {
        // 협의 타입 판단을 위해 원래 필요한 슬롯 사용
        const originalNeededPerMember = unsatisfiedMembers[0].originallyNeededSlots;

        // 각 멤버가 선택할 수 있는 시간대 옵션 생성 (원래 필요한 슬롯 기준)
        const numberOfOptions = Math.floor(totalSlots / originalNeededPerMember);

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
            console.log(`   멤버 ${memberId.substring(0,8)} 가능 슬롯:`, memberAvailableSlots.map(m => {
              const h = Math.floor(m / 60);
              const min = m % 60;
              return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
            }).join(', '));
          }

          // 💡 각 멤버별로 가능한 시간대 옵션 생성 (1시간=60분 단위로 슬라이딩)
          const memberTimeSlotOptions = {};
          
          for (const member of unsatisfiedMembers) {
            const memberId = member.memberId;
            const availableSlots = memberAvailableRanges[memberId];
            const memberOptions = [];
            
            // 이 멤버의 가능한 슬롯들을 슬라이딩하면서 필요한 길이만큼 연속된 구간 찾기
            const requiredDuration = originalNeededPerMember * 30; // 분 단위
            
            for (let i = 0; i < availableSlots.length; i++) {
              const startMinutes = availableSlots[i];
              const endMinutes = startMinutes + requiredDuration;
              
              // 이 구간이 연속적으로 가능한지 확인
              let isValidRange = true;
              for (let checkMin = startMinutes; checkMin < endMinutes; checkMin += 30) {
                if (!availableSlots.includes(checkMin)) {
                  isValidRange = false;
                  break;
                }
              }
              
              if (isValidRange) {
                const optionStartH = Math.floor(startMinutes / 60);
                const optionStartM = startMinutes % 60;
                const optionEndH = Math.floor(endMinutes / 60);
                const optionEndM = endMinutes % 60;
                
                const optionStart = `${String(optionStartH).padStart(2,'0')}:${String(optionStartM).padStart(2,'0')}`;
                const optionEnd = `${String(optionEndH).padStart(2,'0')}:${String(optionEndM).padStart(2,'0')}`;
                
                // 1시간 단위로만 이동하므로 60분 단위로만 옵션 추가
                if (startMinutes % 60 === 0) {
                  memberOptions.push({ startTime: optionStart, endTime: optionEnd });
                }
              }
            }
            
            memberTimeSlotOptions[memberId] = memberOptions;
            console.log(`   멤버 ${memberId.substring(0,8)} 가능 시간대 옵션 ${memberOptions.length}개:`, 
              memberOptions.map(o => `${o.startTime}-${o.endTime}`).join(', '));
          }

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
        } else if (totalNeeded === totalSlots && block.conflictingMembers.length === 2) {
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
      }

      console.log(`🔍 [협의생성] ${block.startTime}-${block.endTime} | 블록:${totalSlots}슬롯, 필요:${totalNeeded}슬롯 | 타입:${negotiationType}`);
      if (availableTimeSlots.length > 0) {
        console.log(`  선택가능 시간대 ${availableTimeSlots.length}개:`, availableTimeSlots.map(s => `${s.startTime}-${s.endTime}`).join(', '));
      }

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

      console.log(`   ✅ [협의 생성됨] 타입: ${negotiation.type}, 멤버: ${negotiation.conflictingMembers.map(m => m.user.substring(0,8)).join(',')}`);
      negotiations.push(negotiation);
    }
    
    console.log(`
🔴🔴🔴 ========== 협의 생성 단계 완료 ==========`);
    console.log(`최종 생성된 협의 수: ${negotiations.length}개`);

    // 방장을 assignments에서 제거 (혹시라도 포함되었을 경우)
    if (assignments[ownerId]) {
      console.warn(`⚠️ [경고] assignments에서 방장(${ownerId}) 제거`);
      delete assignments[ownerId];
    }

    // 💡 자동 배정 처리 (협의 생성 후)
    console.log(`
🟣🟣🟣 ========== 자동 배정 처리 시작 ==========`);
    console.log(`📝 [자동배정] ${autoAssignments.length}개 자동 배정 처리`);
    
    for (const autoAssign of autoAssignments) {
      const { memberId, dateObj, dayString, startTime, endTime, neededSlots, totalSlots } = autoAssign;
      
      const [startH, startM] = startTime.split(':').map(Number);
      const slotsToAssign = Math.min(neededSlots, totalSlots);
      const minutesToAssign = slotsToAssign * 30;
      const startMinutes = startH * 60 + startM;
      const endMinutes = startMinutes + minutesToAssign;
      
      console.log(`   ✅ [자동배정] 멤버 ${memberId.substring(0,8)}에게 ${startTime}-${endTime} 배정 (${slotsToAssign}슬롯)`);
      
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
    
    console.log(`🟣🟣🟣 ========== 자동 배정 처리 완료 ==========
`);
    
    console.log(`✅ [자동배정 완료] 조원 ${Object.keys(assignments).length}명 | 협의 ${negotiations.length}개 | 자동배정 ${autoAssignments.length}개`);

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

    console.log('🔍 ========== 충돌 감지 시작 ==========');
    console.log('🔍 [충돌감지] memberRequiredSlots:', memberRequiredSlots);

    // 각 멤버별 가용 슬롯 수 계산 (총 슬롯)
    const memberAvailableSlots = {};
    // 각 멤버별 단독 가용 슬롯 수 계산 (본인만 사용 가능한 슬롯)
    const memberExclusiveSlots = {};

    for (const key in timetable) {
      const slot = timetable[key];
      if (slot.assignedTo) continue;

      const nonOwnerAvailable = slot.available.filter(a => a.memberId !== ownerId);

      nonOwnerAvailable.forEach(a => {
        if (!memberAvailableSlots[a.memberId]) {
          memberAvailableSlots[a.memberId] = 0;
          memberExclusiveSlots[a.memberId] = 0;
        }
        memberAvailableSlots[a.memberId]++;

        // 단독 슬롯 (본인만 사용 가능)
        if (nonOwnerAvailable.length === 1) {
          memberExclusiveSlots[a.memberId]++;
        }
      });
    }

    console.log('🔍 [충돌감지] 각 멤버별 가용 슬롯 수:', memberAvailableSlots);
    console.log('🔍 [충돌감지] 각 멤버별 단독 슬롯 수:', memberExclusiveSlots);

    for (const key in timetable) {
      const slot = timetable[key];
      if (slot.assignedTo) continue;

      const allAvailable = slot.available || [];
      const nonOwnerAvailable = allAvailable.filter(a => a.memberId !== ownerId);

      if (nonOwnerAvailable.length > 1) {
        console.log(`
🔍🔍🔍 [가용성 체크] ${key}: ${nonOwnerAvailable.length}명 겹침`);
        console.log(`   멤버들:`, nonOwnerAvailable.map(a => `${a.memberId.substring(0,8)}(우선순위:${a.priority})`).join(', '));

        // 우선순위별로 그룹화
        const priorityGroups = {};
        nonOwnerAvailable.forEach(member => {
          const priority = member.priority || 2;
          if (!priorityGroups[priority]) {
            priorityGroups[priority] = [];
          }
          priorityGroups[priority].push(member);
        });

        const priorities = Object.keys(priorityGroups).map(p => parseInt(p));
        const highestPriority = Math.max(...priorities);
        const highestPriorityMembers = priorityGroups[highestPriority];

        console.log(`   우선순위 분포: ${Object.keys(priorityGroups).map(p => `P${p}:${priorityGroups[p].length}명`).join(', ')}`);
        console.log(`   최고 우선순위: ${highestPriority}, 해당 멤버 수: ${highestPriorityMembers.length}`);

        // 💡 수정: 2명 이상이 겹치면 무조건 협의 발생 (우선순위 무관)
        console.log(`   🎯 [협의 판단] ${nonOwnerAvailable.length}명 >= 2 → 조건 충족`);
        if (nonOwnerAvailable.length >= 2) {
          console.log(`   ⚠️⚠️⚠️ ${nonOwnerAvailable.length}명 겹침 → 협의 생성 확정 (우선순위 무관)`);

          // 💡 모든 겹치는 멤버를 협의 대상에 포함 (우선순위 무관)
          const membersNeedingThisSlot = nonOwnerAvailable.map(member => {
            const memberId = member.memberId;
            const memberIdShort = memberId.substring(0, 8);
            const requiredSlots = memberRequiredSlots[memberId] || 18;
            const totalAvailableSlots = memberAvailableSlots[memberId] || 0;
            const exclusiveSlots = memberExclusiveSlots[memberId] || 0;

            console.log(`      멤버 ${memberIdShort}: 필요=${requiredSlots}슬롯, 총가용=${totalAvailableSlots}슬롯, 단독=${exclusiveSlots}슬롯`);
            console.log(`      🔹 [협의포함] ${memberIdShort}는 방장의 선택을 기다림`);

            return member;
          });

          // 2명 이상이 겹치면 무조건 협의 발생
          console.log(`   🚨🚨🚨 [협의발생 확정] ${key} - ${membersNeedingThisSlot.length}명 협의 필요`);
          console.log(`      멤버들: ${membersNeedingThisSlot.map(m => m.memberId.substring(0,8)).join(', ')}`);
          console.log(`      ✅ conflicts 배열에 추가됨`);
          
          conflicts.push({
            slotKey: key,
            availableMembers: membersNeedingThisSlot.map(a => a.memberId),
            priority: highestPriority
          });
        } else {
          // 최고 우선순위 멤버가 1명만 있음 → 자동 배정 (협의 불필요)
          console.log(`   ✅ [자동배정] ${key} - 우선순위 ${highestPriority} 멤버 1명만`);
          const winnerIdShort = highestPriorityMembers[0].memberId.substring(0,8);
          console.log(`      승자: ${winnerIdShort} (우선순위 ${highestPriority})`);
          if (priorities.length > 1) {
            const lowerPriorities = priorities.filter(p => p < highestPriority);
            console.log(`      패자: 우선순위 ${lowerPriorities.join(', ')} 멤버들은 제외`);
          }
        }
      } else if (nonOwnerAvailable.length === 1) {
        // 1명만 사용 가능 → 단독 슬롯
        const memberIdShort = nonOwnerAvailable[0].memberId.substring(0,8);
        console.log(`\n🔍 [가용성] ${key}: 1명만 가능 (${memberIdShort})`);
      }
    }

    console.log(`\n🔍 ========== 충돌 감지 완료 ==========`);
    console.log(`🔍 총 ${conflicts.length}개 협의 발생`);
    if (conflicts.length > 0) {
      console.log(`🔍 협의 목록:`, conflicts.map(c => c.slotKey).join(', '));
    } else {
      console.log(`🔍 ⚠️ 협의가 0개입니다! 문제가 있을 수 있습니다.`);
    }
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

    // 방장의 선호시간표를 기반으로 기본 타임테이블 생성 (조원들이 사용 가능한 시간대)
    // 방장은 배정받지 않고, 조원들만 배정받음
    const ownerId = owner._id.toString();

    console.log('📅 [타임테이블] 방장의 선호시간표를 기반으로 가용 시간대 생성');
    console.log(`📅 [타임테이블] 처리할 조원 수: ${members.length}명`);

    // 조원들의 개인 시간표를 추가
    members.forEach(member => {
      const user = member.user;
      const userId = user._id.toString();
      const priority = this.getMemberPriority(member);
      const isOwner = false; // 조원은 방장이 아님



      // 개인 시간표(defaultSchedule) 처리
      if (user.defaultSchedule && Array.isArray(user.defaultSchedule)) {
        // 30분 단위만 필터링 (00분, 30분만 허용)
        const validSchedules = user.defaultSchedule.filter(schedule => {
          if (!schedule.startTime) return false;
          const startMin = parseInt(schedule.startTime.split(':')[1]);
          return startMin === 0 || startMin === 30;
        });

        // 선호시간표 필터링 완료

        validSchedules.forEach(schedule => {
          const dayOfWeek = schedule.dayOfWeek; // 0=일요일, 1=월요일, ..., 6=토요일
          const startTime = schedule.startTime;
          const endTime = schedule.endTime;
          const specificDate = schedule.specificDate; // 특정 날짜 (YYYY-MM-DD 형식)
          const schedulePriority = schedule.priority || priority; // 슬롯별 우선순위

          // 주말 제외
          if (dayOfWeek === 0 || dayOfWeek === 6) {
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

                if (!timetable[key]) {
                  const oneIndexedDayOfWeek = targetDate.getDay() === 0 ? 7 : targetDate.getDay();

                  timetable[key] = {
                    assignedTo: null,
                    available: [],
                    date: new Date(targetDate),
                    dayOfWeek: oneIndexedDayOfWeek,
                  };
                }

                const existingAvailability = timetable[key].available.find(a => a.memberId === userId);
                if (!existingAvailability) {
                  timetable[key].available.push({
                    memberId: userId,
                    priority: schedulePriority,
                    isOwner: isOwner
                  });
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

                  if (!timetable[key]) {
                    const oneIndexedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

                    timetable[key] = {
                      assignedTo: null,
                      available: [],
                      date: new Date(currentDate),
                      dayOfWeek: oneIndexedDayOfWeek,
                    };
                  }

                  const existingAvailability = timetable[key].available.find(a => a.memberId === userId);
                  if (!existingAvailability) {
                    timetable[key].available.push({
                      memberId: userId,
                      priority: schedulePriority,
                      isOwner: isOwner
                    });
                  }
                });
              }
              currentDate.setUTCDate(currentDate.getUTCDate() + 1);
            }
          }
        });
      } else {
        console.log(`⚠️ [조원] ${userId.substring(0,8)}: defaultSchedule가 없거나 비어있음 - 이 멤버는 타임테이블에서 제외됨`);
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
    console.log(`[개인시간표] 총 ${totalSlots}개 시간대 생성 (개인 시간표 기준)`);

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
        slots: []
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

  _assignUndisputedSlots(timetable, assignments, priority, memberRequiredSlots, conflictingSlots = []) {
    let assignedCount = 0;

    // 충돌 슬롯 목록을 Set으로 변환하여 빠른 검색
    const conflictKeys = new Set(conflictingSlots.map(c => c.slotKey));

    console.log(`\n💼 [단독할당] 시작 (충돌 제외 슬롯만 처리, 충돌 슬롯: ${conflictKeys.size}개)`);
    console.log(`💼 [충돌 슬롯 목록]:`, Array.from(conflictKeys).join(', '));

    for (const key in timetable) {
      const slot = timetable[key];
      if (slot.assignedTo) continue;

      // 충돌 슬롯은 건너뛰기 (협의로 처리)
      if (conflictKeys.has(key)) {
        console.log(`   🔒 [충돌슬롯] ${key}: 협의 대상이므로 건너뜀`);
        continue;
      }

      const highPriorityAvailable = slot.available.filter(a => a.priority >= priority && !a.isOwner);

      // 단독으로 가능한 슬롯만 할당
      if (highPriorityAvailable.length === 1) {
        const memberToAssign = highPriorityAvailable[0].memberId;
        const requiredSlots = memberRequiredSlots[memberToAssign] || assignments[memberToAssign]?.requiredSlots || 18;
        if (assignments[memberToAssign] && assignments[memberToAssign].assignedHours < requiredSlots) {
          this._assignSlot(timetable, assignments, key, memberToAssign);
          assignedCount++;
          console.log(`   ✅ [단독할당] ${key}: 멤버 ${memberToAssign.substring(0,8)} 할당 (우선순위: ${highPriorityAvailable[0].priority}, ${assignments[memberToAssign].assignedHours}/${requiredSlots}슬롯)`);
        } else {
          console.log(`   ⏭️ [건너뛰기] ${key}: 멤버 ${memberToAssign.substring(0,8)} 이미 할당 완료 (${assignments[memberToAssign].assignedHours}/${requiredSlots}슬롯)`);
        }
      } else if (highPriorityAvailable.length > 1) {
        // 여러 멤버가 있는 경우 - 충돌로 감지되어야 하지만, 혹시 누락된 경우 경고
        console.log(`   ⚠️ [다중가용] ${key}: ${highPriorityAvailable.length}명 가능, 충돌로 처리되어야 함`);
        console.log(`      멤버들: ${highPriorityAvailable.map(a => a.memberId.substring(0,8)).join(', ')}`);
      }
    }

    console.log(`\n💼 [단독할당완료] 총 ${assignedCount}개 슬롯 할당됨`);

    // 할당 현황 출력
    console.log(`\n📊 [할당현황] 멤버별 현재 할당 상태:`);
    Object.keys(assignments).forEach(memberId => {
      const requiredSlots = memberRequiredSlots[memberId] || assignments[memberId]?.requiredSlots || 18;
      const assignedSlots = assignments[memberId].assignedHours;
      const percentage = ((assignedSlots / requiredSlots) * 100).toFixed(1);
      console.log(`   ${memberId.substring(0,8)}: ${assignedSlots}/${requiredSlots}슬롯 (${percentage}%)`);
    });
  }

  _iterativeAssignment(timetable, assignments, priority, memberRequiredSlots, members = [], ownerPreferences = {}, conflictingSlots = []) {
    let changed = true;
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

      // Iterate through the needy members and try to assign ONE slot to the most needy one
      for (const memberId of membersToAssign) {
        const requiredSlots = memberRequiredSlots[memberId] || assignments[memberId]?.requiredSlots || 18;
        const bestSlotResult = this._findBestSlotForMember(timetable, assignments, memberId, priority, members, ownerPreferences, requiredSlots, conflictingSlots);

        if (bestSlotResult && bestSlotResult.bestSlot) {
          this._assignSlot(timetable, assignments, bestSlotResult.bestSlot.key, memberId);
          changed = true;
          // After assigning one slot, break from the for-loop and restart the while-loop
          // This re-evaluates who is the most "needy" member for the next assignment
          break;
        }
      }
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
          console.log(`🔍 [제외] 슬롯 ${key}는 협의 대상이므로 할당에서 제외 (memberId: ${memberId})`);
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

            console.log(`Score for ${memberId} at ${key}: base=${1000-(contenders*10)}, priority=${(memberAvailability.priority-priority)*50}, proximity=${proximityBonus}, focus=${this._isInPreferredTime(slotTimeString, focusTimeType) ? 150 : 0}, total=${score}`);

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

    // 검증: timetable[key]가 존재하는지 확인
    if (!timetable[key]) {
      console.error(`❌ [_assignSlot] timetable[${key}]가 존재하지 않습니다!`);
      return;
    }

    const [h, m] = startTimeRaw.split(':').map(Number); // Keep this for endTime calculation

    // 30분 추가하여 endTime 계산 (모든 분 값에 대응)
    let endMinute = m + 30;
    let endHour = h;
    if (endMinute >= 60) {
      endMinute -= 60;
      endHour += 1;
    }
    const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

    const slotDate = timetable[key].date; // Use the date object already in the timetable
    const slotDayOfWeek = timetable[key].dayOfWeek; // Use the 1-indexed dayOfWeek from the timetable

    // 검증: date와 dayOfWeek가 있는지 확인
    if (!slotDate || !slotDayOfWeek) {
      console.error(`❌ [_assignSlot] ${key} - date 또는 dayOfWeek가 없습니다!`, {
        date: slotDate,
        dayOfWeek: slotDayOfWeek,
        timetableSlot: timetable[key]
      });
      return;
    }

    const dayString = dayMap[slotDayOfWeek];

    if (!dayString) {
      console.warn("⚠️ [_assignSlot] Invalid dayString for slotDayOfWeek:", slotDayOfWeek, "dateKey:", dateKey);
      return;
    }

    timetable[key].assignedTo = memberId;

    // Initialize assignment if not exists
    if (!assignments[memberId]) {
      assignments[memberId] = {
        memberId: memberId,
        assignedHours: 0,
        slots: []
      };
    }

    assignments[memberId].assignedHours += 1; // This represents one 10-minute slot

    // 슬롯 데이터 검증
    const slotData = {
        date: slotDate,
        day: dayString,
        startTime: startTimeRaw,
        endTime,
        subject: '자동 배정',
        user: memberId,
        status: 'confirmed'
    };

    // 필수 필드 검증
    if (!slotData.date || !slotData.day || !slotData.startTime || !slotData.endTime) {
      console.error(`❌ [_assignSlot] 슬롯 데이터 검증 실패!`, {
        key,
        memberId,
        slotData,
        slotDate,
        dayString,
        startTimeRaw,
        endTime
      });
      return;
    }

    console.log(`✅ [_assignSlot] ${key} → ${memberId}: ${dayString} ${startTimeRaw}-${endTime}`);
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

    console.log(`[이월처리] ${membersNeedingHours.length}명의 멤버가 추가 시간 필요`);

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
        console.log(`⚠️ [이월경고] 멤버 ${memberId}: 2주 이상 연속 이월! 강제 협의 또는 관리자 개입 필요`);
        assignments[memberId].needsIntervention = true;
        assignments[memberId].interventionReason = '2주 이상 연속 이월';
      }

      console.log(`[이월처리] 멤버 ${memberId}: ${neededHours}시간 부족, 다음 주로 이월 예정 (연속 이월: ${consecutiveCarryOvers}회)`);

      // 이월 정보를 assignments에 추가 (실제 할당은 하지 않고 이월 정보만 기록)
      if (!assignments[memberId].carryOver) {
        assignments[memberId].carryOver = 0;
      }
      assignments[memberId].carryOver += neededHours;

      console.log(`[이월처리] 멤버 ${memberId}의 총 이월시간: ${assignments[memberId].carryOver}시간`);
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
