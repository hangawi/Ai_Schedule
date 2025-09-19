class SchedulingAlgorithm {

  _calculateEndTime(startTime) {
    const [h, m] = startTime.split(':').map(Number);
    const endHour = m === 30 ? h + 1 : h;
    const endMinute = m === 30 ? 0 : 30;
    return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
  }

  _mergeConsecutiveConflicts(conflicts, timetable) {
    if (!conflicts || conflicts.length === 0) {
      console.log('📦 [병합처리] 충돌이 없어서 빈 배열 반환');
      return [];
    }

    console.log('📦 [병합처리] ===========================================');
    console.log('📦 [병합처리] 입력 충돌 수:', conflicts.length);
    console.log('📦 [병합처리] 충돌 목록:', conflicts.map(c => `${c.slotKey}: ${c.availableMembers.join(', ')}`));

    // 1. Sort conflicts by their slot key (date and time)
    const sortedConflicts = [...conflicts].sort((a, b) => a.slotKey.localeCompare(b.slotKey));

    console.log('📦 [병합처리] 정렬된 충돌:', sortedConflicts.map(c => `${c.slotKey}: ${c.availableMembers.join(', ')}`));

    const mergedBlocks = [];
    let currentBlock = null;

    for (const conflict of sortedConflicts) {
      const { slotKey, availableMembers } = conflict;
      const [date, timeRaw] = slotKey.split('-');

      // Ensure time is properly formatted as HH:MM
      let time = timeRaw;
      if (!timeRaw.includes(':')) {
        // If time is just a number like "10", format it as "10:00"
        time = `${String(timeRaw).padStart(2, '0')}:00`;
      } else if (timeRaw.split(':')[1] === undefined) {
        // If time is like "10:", format it as "10:00"
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
      console.log('📦 [병합처리] 마지막 블록 추가:', {
        startDate: currentBlock.startDate,
        startTime: currentBlock.startTime,
        endTime: currentBlock.endTime,
        conflictingMembers: currentBlock.conflictingMembers
      });
      mergedBlocks.push(currentBlock);
    }

    console.log('📦 [병합처리] 최종 블록 수:', mergedBlocks.length);
    console.log('📦 [병합처리] 최종 블록들:', mergedBlocks.map(block =>
      `${block.startDate} ${block.startTime}-${block.endTime}: ${block.conflictingMembers.join(', ')}`
    ));
    console.log('📦 [병합처리] ===========================================');

    return mergedBlocks;
  }

  runAutoSchedule(members, owner, roomTimeSlots, options, deferredAssignments = []) {
    console.log('=== 스케줄링 알고리즘 시작 ===');
    console.log('호출 스택:', new Error().stack.split('\n').slice(1, 4));

    // Input validation
    if (!members || !Array.isArray(members)) {
      throw new Error('Invalid members data provided to scheduling algorithm');
    }

    if (!owner || !owner._id) {
      throw new Error('Invalid owner data provided to scheduling algorithm');
    }

    if (!roomTimeSlots || !Array.isArray(roomTimeSlots)) {
      throw new Error('Invalid timeSlots data provided to scheduling algorithm');
    }

    const { minHoursPerWeek = 3, numWeeks = 2, currentWeek, ownerPreferences = {}, roomSettings = {} } = options;

    console.log('스케줄링 알고리즘 - 받은 options:', { minHoursPerWeek, numWeeks, currentWeek, hasOwnerPreferences: !!ownerPreferences });

    // Convert hours to 30-minute slots (1 hour = 2 slots)
    const minSlotsPerWeek = minHoursPerWeek * 2;

    // UI가 실제로 보고 있는 주의 월요일로 설정 (2025-09-16이 월요일)
    const forceCurrentWeek = "2025-09-16";
    console.log('스케줄링 알고리즘 - 강제 설정 (UI 현재 주):', forceCurrentWeek);
    const startDate = new Date(forceCurrentWeek);

    console.log('스케줄링 알고리즘 - 원래 currentWeek:', currentWeek);
    console.log('스케줄링 알고리즘 - 강제 설정된 startDate:', startDate.toISOString());

    // startDate를 해당 주의 월요일로 조정
    const dayOfWeek = startDate.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 일요일이면 -6, 아니면 1-dayOfWeek
    startDate.setUTCDate(startDate.getUTCDate() + mondayOffset);
    startDate.setUTCHours(0, 0, 0, 0);

    console.log('스케줄링 알고리즘 - startDate (조정 후, 월요일):', startDate.toISOString());


    // Exclude owner from auto-assignment and define nonOwnerMembers before use
    const ownerId = owner._id.toString();
    const nonOwnerMembers = members.filter(m => m.user._id.toString() !== ownerId);

    const timetable = this._createTimetable(roomTimeSlots, startDate, numWeeks, roomSettings, nonOwnerMembers);

    let assignments = this._initializeMemberAssignments(nonOwnerMembers);

    // Phase 0: Assign Deferred Assignments (0-priority)
    this._assignDeferredAssignments(timetable, assignments, deferredAssignments);

    // Phase 1: Assign undisputed high-priority slots
    this._assignUndisputedSlots(timetable, assignments, 3, minSlotsPerWeek);

    // Phase 1.5: Identify conflicts before assignment and create negotiations
    const conflictingSlots = this._identifyConflictsBeforeAssignment(timetable, ownerId);
    const negotiationBlocks = this._mergeConsecutiveConflicts(conflictingSlots, timetable);

    // Phase 2: Iteratively fill remaining hours (skip slots that are under negotiation)
    // Since all submitted slots are treated as high priority, we only need to run this once.
    this._iterativeAssignment(timetable, assignments, 3, minSlotsPerWeek, nonOwnerMembers, ownerPreferences, conflictingSlots);

    // Phase 2.5: Explicit Conflict Resolution by Owner Taking Slot (with preferences)
    this._resolveConflictsByOwnerTakingSlot(timetable, assignments, owner, minSlotsPerWeek, ownerPreferences);

    // Phase 3: Conflict Resolution using Owner's Schedule
    this._resolveConflictsWithOwner(timetable, assignments, owner, minSlotsPerWeek);

    // Phase 4: Carry-over assignments (prioritize unassigned members in future weeks)
    this._carryOverAssignments(timetable, assignments, minSlotsPerWeek);

    // Store carry-over assignments for next week
    const carryOverAssignments = [];

    // Identify unassigned members (for future carry-over)
    const unassignedMembersInfo = Object.keys(assignments)
      .filter(id => assignments[id].assignedHours < minSlotsPerWeek)
      .map(id => {
        const neededHours = (minSlotsPerWeek - assignments[id].assignedHours) / 2; // Convert back to hours
        console.log(`알고리즘: 멤버 ${id} - 할당된 슬롯: ${assignments[id].assignedHours}, 필요한 슬롯: ${minSlotsPerWeek}, 이월 시간: ${neededHours}시간`);

        // Add to carry-over list
        if (neededHours > 0) {
          carryOverAssignments.push({
            memberId: id,
            neededHours: neededHours,
            priority: this.getMemberPriority(members.find(m => m.user._id.toString() === id)),
            week: startDate
          });
        }

        return {
          memberId: id,
          neededHours: neededHours,
          assignedSlots: assignments[id].slots,
        };
      });

    // Use the conflicts identified before assignment
    const negotiations = [];

    console.log('🚀 [협의생성] ===========================================');
    console.log('🚀 [협의생성] negotiationBlocks 수:', negotiationBlocks.length);

    for (const block of negotiationBlocks) {
      const dayMap = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday' };
      const dayString = dayMap[block.dayOfWeek];

      console.log('🚀 [협의생성] 블록 처리:', {
        dayOfWeek: block.dayOfWeek,
        dayString,
        startTime: block.startTime,
        endTime: block.endTime,
        dateObj: block.dateObj,
        conflictingMembers: block.conflictingMembers
      });

      const negotiation = {
        slotInfo: {
          day: dayString,
          startTime: block.startTime,
          endTime: block.endTime,
          date: block.dateObj
        },
        conflictingMembers: block.conflictingMembers.map(memberId => {
          const member = nonOwnerMembers.find(m => m.user._id.toString() === memberId);
          console.log(`🚀 [협의생성] 멤버 ${memberId} 매핑:`, {
            found: !!member,
            priority: member ? this.getMemberPriority(member) : 'NOT_FOUND'
          });
          return {
            user: memberId,
            priority: this.getMemberPriority(member),
            response: 'pending' // 초기 응답 상태
          };
        }),
        messages: [],
        status: 'active',
        createdAt: new Date()
      };

      console.log('🚀 [협의생성] 생성된 협의:', {
        slotInfo: negotiation.slotInfo,
        conflictingMembersCount: negotiation.conflictingMembers.length,
        conflictingMembers: negotiation.conflictingMembers.map(cm => `${cm.user}(우선순위: ${cm.priority})`)
      });

      negotiations.push(negotiation);
    }

    console.log('🚀 [협의생성] 총 생성된 협의 수:', negotiations.length);
    console.log('🚀 [협의생성] ===========================================')

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

  _identifyConflictsBeforeAssignment(timetable, ownerId) {
    const conflicts = [];

    console.log('🔍 [충돌감지] ===========================================');
    console.log('🔍 [충돌감지] 전체 timetable 키 수:', Object.keys(timetable).length);
    console.log('🔍 [충돌감지] 방장 ID:', ownerId);
    console.log('🔍 [충돌감지] timetable 키 샘플:', Object.keys(timetable).slice(0, 5));

    // 각 슬롯을 상세히 분석
    for (const key in timetable) {
      const slot = timetable[key];
      if (slot.assignedTo) {
        console.log(`🔍 [충돌감지] 슬롯 ${key}: 이미 할당됨 (${slot.assignedTo}) - 스킵`);
        continue;
      }

      const nonOwnerAvailable = slot.available.filter(a => a.memberId !== ownerId);

      console.log(`🔍 [충돌감지] 슬롯 ${key}:`);
      console.log(`   - 전체 가능 멤버: ${slot.available.length}명`);
      console.log(`   - 비방장 가능 멤버: ${nonOwnerAvailable.length}명`);

      if (slot.available.length > 0) {
        console.log(`   - 전체 멤버들:`, slot.available.map(a => `${a.memberId}(우선순위: ${a.priority})`));
      }

      if (nonOwnerAvailable.length > 0) {
        console.log(`   - 비방장 멤버들:`, nonOwnerAvailable.map(a => `${a.memberId}(우선순위: ${a.priority})`));
      }

      // ❌ 문제의 로직: 2명 이상이 가능한 모든 슬롯을 협의 대상으로 처리
      // ✅ 수정된 로직: 실제로 같은 우선순위의 멤버들이 충돌하는 경우만 협의 대상
      if (nonOwnerAvailable.length > 1) {
        // 같은 우선순위 그룹별로 분석
        const priorityGroups = {};
        nonOwnerAvailable.forEach(member => {
          if (!priorityGroups[member.priority]) {
            priorityGroups[member.priority] = [];
          }
          priorityGroups[member.priority].push(member);
        });

        console.log(`   - 우선순위 그룹:`, priorityGroups);

        // 가장 높은 우선순위 그룹 찾기
        const highestPriority = Math.max(...Object.keys(priorityGroups).map(p => parseInt(p)));
        const highestPriorityMembers = priorityGroups[highestPriority];

        console.log(`   - 가장 높은 우선순위: ${highestPriority}`);
        console.log(`   - 최고 우선순위 멤버들:`, highestPriorityMembers.map(m => m.memberId));

        // 최고 우선순위 그룹에 2명 이상 있을 때만 충돌로 처리
        if (highestPriorityMembers.length > 1) {
          console.log(`⚡ [충돌감지] ${key}에서 ${highestPriorityMembers.map(m => m.memberId).join(', ')} 간 실제 충돌 발생! (우선순위 ${highestPriority})`);
          conflicts.push({
            slotKey: key,
            availableMembers: highestPriorityMembers.map(a => a.memberId),
            priority: highestPriority
          });
        } else {
          console.log(`✅ [충돌감지] ${key}: 우선순위가 다르므로 충돌 없음 (${highestPriorityMembers[0].memberId}가 자동 할당)`);
        }
      } else if (nonOwnerAvailable.length === 1) {
        console.log(`✅ [충돌감지] ${key}: 단일 멤버 ${nonOwnerAvailable[0].memberId} 자동 할당`);
      } else {
        console.log(`➖ [충돌감지] ${key}: 가능한 비방장 멤버 없음`);
      }
    }

    console.log('🔍 [충돌감지] ===========================================');
    console.log('🔍 [충돌감지] 총 실제 충돌 수:', conflicts.length);
    if (conflicts.length > 0) {
      console.log('🔍 [충돌감지] 충돌 목록:', conflicts.map(c => `${c.slotKey}: ${c.availableMembers.join(', ')}`));
    }
    console.log('🔍 [충돌감지] ===========================================');

    return conflicts;
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

    for (let w = 0; w < numWeeks; w++) {
      for (let d = 0; d < 5; d++) { // Monday to Friday
        const date = new Date(currentDay);
        date.setUTCDate(currentDay.getUTCDate() + d + (w * 7));
        const dayOfWeek = date.getUTCDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
        if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip Saturday and Sunday

        // Convert to 1-indexed day of week (1=Mon, 2=Tue, ..., 5=Fri)
        const oneIndexedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek; // Sunday becomes 7

        for (let h = scheduleStartHour; h < scheduleEndHour; h++) {
          for (let m = 0; m < 60; m += 30) {
            const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
            const key = `${dateKey}-${time}`;
            timetable[key] = {
              assignedTo: null,
              available: [],
              date: date, // Store the actual date object
              dayOfWeek: oneIndexedDayOfWeek, // Store 1-indexed day of week
            };
          }
        }
      }
    }

    // Calculate the end date of the scheduling window
    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + (numWeeks * 7));

    // Populate availability from the user-submitted roomTimeSlots
    console.log('schedulingAlgorithm._createTimetable: Processing roomTimeSlots:', roomTimeSlots.length);
    console.log('schedulingAlgorithm._createTimetable: Scheduling window:', startDate.toISOString(), 'to', endDate.toISOString());

    roomTimeSlots.forEach(slot => {
      console.log('schedulingAlgorithm._createTimetable: Processing slot:', {
        date: slot.date,
        startTime: slot.startTime,
        user: slot.user?._id || slot.user
      });

      const date = new Date(slot.date);
      console.log('schedulingAlgorithm._createTimetable: Parsed date:', date.toISOString());

      // Only process slots within the scheduling window
      if (date < startDate || date >= endDate) {
        console.log(`Skipping slot outside scheduling window: ${date.toISOString()}`);
        return;
      }

      const dateKey = date.toISOString().split('T')[0];
      const key = `${dateKey}-${slot.startTime}`;
      console.log('schedulingAlgorithm._createTimetable: Generated key:', key);

      if (timetable[key]) {
        let userId;
        if (slot.user && slot.user._id) {
          userId = slot.user._id.toString();
        } else if (slot.user) {
          userId = slot.user.toString();
        } else {
          console.warn('Invalid slot user:', slot);
          return;
        }

        const member = members.find(m => (m.user._id || m.user).toString() === userId);
        const priority = this.getMemberPriority(member);

        timetable[key].available.push({ memberId: userId, priority: priority, isOwner: false });
        console.log(`Added availability for user ${userId} with priority ${priority} at ${key}`);
      } else {
        console.warn(`Timetable slot not found for key: ${key}. Available keys sample:`, Object.keys(timetable).slice(0, 5));
      }
    });

    return timetable;
  }

  _initializeMemberAssignments(members) {
    const assignments = {};
    members.forEach(m => {
      const memberId = m.user._id.toString();
      assignments[memberId] = {
        memberId: memberId,
        assignedHours: 0,
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

  _assignUndisputedSlots(timetable, assignments, priority, minSlotsPerWeek) {
    for (const key in timetable) {
      const slot = timetable[key];
      if (slot.assignedTo) continue;

      const highPriorityAvailable = slot.available.filter(a => a.priority === priority && !a.isOwner);
      
      if (highPriorityAvailable.length === 1) {
        const memberToAssign = highPriorityAvailable[0].memberId;
        if (assignments[memberToAssign].assignedHours < minSlotsPerWeek) {
          this._assignSlot(timetable, assignments, key, memberToAssign);
        }
      }
    }
  }

  _iterativeAssignment(timetable, assignments, priority, minSlotsPerWeek, members = [], ownerPreferences = {}, conflictingSlots = []) {
    let changed = true;
    // Loop as long as we are successfully assigning slots
    while (changed) {
      changed = false;
      
      // Find all members who still need hours assigned
      const membersToAssign = Object.keys(assignments)
        .filter(id => assignments[id].assignedHours < minSlotsPerWeek)
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
        const bestSlotResult = this._findBestSlotForMember(timetable, assignments, memberId, priority, members, ownerPreferences, minSlotsPerWeek, conflictingSlots);

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
          console.log(`슬롯 ${key}는 협의 대상이므로 할당에서 제외`);
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
            const [h, m] = key.split('-')[1].split(':').map(Number);
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
    const [h, m] = startTimeRaw.split(':').map(Number); // Keep this for endTime calculation
    
    const endHour = m === 30 ? h + 1 : h;
    const endMinute = m === 30 ? 0 : 30;
    const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

    const slotDate = timetable[key].date; // Use the date object already in the timetable
    const slotDayOfWeek = timetable[key].dayOfWeek; // Use the 1-indexed dayOfWeek from the timetable
    const dayString = dayMap[slotDayOfWeek];

    if (!dayString) {
      console.warn("SchedulingAlgorithm:_assignSlot - Invalid dayString for slotDayOfWeek:", slotDayOfWeek, "dateKey:", dateKey);
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

    assignments[memberId].assignedHours += 1; // This represents one 30-minute slot
    console.log("SchedulingAlgorithm:_assignSlot - Pushing slot with startTime:", startTimeRaw, "and endTime:", endTime, "and date:", slotDate);
    assignments[memberId].slots.push({
        date: slotDate,
        day: dayString,
        startTime: startTimeRaw, // Use startTimeRaw directly
        endTime,
        subject: '자동 배정',
        user: memberId,
        status: 'confirmed'
    });
  }

  _resolveConflictsWithOwner(timetable, assignments, owner, minSlotsPerWeek) {
    const ownerId = owner._id.toString();

    // 방장의 모든 사용 가능한 시간대에서 충돌을 해결
    // 방장이 양보할 수 있는 시간대를 찾아서 멤버들에게 할당
    const membersNeedingHours = Object.keys(assignments).filter(id =>
      id !== ownerId && assignments[id].assignedHours < minSlotsPerWeek
    );

    for (const memberId of membersNeedingHours) {
      let needed = minSlotsPerWeek - assignments[memberId].assignedHours;

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

  _resolveConflictsByOwnerTakingSlot(timetable, assignments, owner, minSlotsPerWeek, ownerPreferences = {}) {
    const ownerId = owner._id.toString();

    // Get all conflicting slots that the owner can take
    const conflictingSlotsOwnerCanTake = [];

    for (const key in timetable) {
      const slot = timetable[key];
      if (slot.assignedTo) continue;

      const nonOwnerAvailable = slot.available.filter(a => a.memberId !== ownerId);
      if (nonOwnerAvailable.length > 1) {
        const ownerAvailability = slot.available.find(a => a.memberId === ownerId && a.isOwner);
        if (ownerAvailability) {
          conflictingSlotsOwnerCanTake.push(key);
        }
      }
    }

    // Prioritize slots based on owner preferences
    const prioritizedSlots = this._prioritizeSlotsByOwnerPreference(conflictingSlotsOwnerCanTake, ownerPreferences);

    // Assign owner to prioritized slots
    for (const key of prioritizedSlots) {
      const slot = timetable[key];
      if (!slot.assignedTo) {
        slot.assignedTo = ownerId;
        if (!assignments[ownerId]) {
          assignments[ownerId] = { memberId: ownerId, assignedHours: 0, slots: [] };
        }
        assignments[ownerId].assignedHours += 1;
        assignments[ownerId].slots.push({
          day: slot.day,
          time: slot.time,
          date: slot.date
        });
      }
    }
  }

  _carryOverAssignments(timetable, assignments, minSlotsPerWeek) {
    const membersNeedingHours = Object.keys(assignments).filter(id => assignments[id].assignedHours < minSlotsPerWeek);

    for (const memberId of membersNeedingHours) {
      let needed = minSlotsPerWeek - assignments[memberId].assignedHours;
      
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
        if (needed <= 0) break;
        this._assignSlot(timetable, assignments, key, memberId);
        needed -= 1;
      }
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
