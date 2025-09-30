class SchedulingAlgorithm {

  _calculateEndTime(startTime) {
    const [h, m] = startTime.split(':').map(Number);
    const totalMinutes = h * 60 + m + 10; // 10분 추가
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

    // Convert hours to 10-minute slots (1 hour = 6 slots)
    const minSlotsPerWeek = minHoursPerWeek * 6;

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
        const neededHours = (minSlotsPerWeek - assignments[id].assignedHours) / 6; // Convert back to hours
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

    console.log(`[디버그] negotiationBlocks 수: ${negotiationBlocks.length}`);
    negotiationBlocks.forEach((block, index) => {
      console.log(`[디버그] Block ${index}: startDate=${block.startDate}, startTime=${block.startTime}, endTime=${block.endTime}, dayOfWeek=${block.dayOfWeek}`);
    });

    for (const block of negotiationBlocks) {
      const dayMap = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday' };
      const dayString = dayMap[block.dayOfWeek];

      console.log(`[협의] 생성: ${dayString} ${block.startTime} - 멤버: ${block.conflictingMembers.join(', ')}`);

      const negotiation = {
        slotInfo: {
          day: dayString,
          startTime: block.startTime,
          endTime: block.endTime,
          date: block.dateObj
        },
        conflictingMembers: block.conflictingMembers.map(memberId => {
          const member = nonOwnerMembers.find(m => m.user._id.toString() === memberId);
          return {
            user: memberId,
            priority: this.getMemberPriority(member),
            response: 'pending'
          };
        }),
        messages: [],
        status: 'active',
        createdAt: new Date()
      };

      negotiations.push(negotiation);
    }



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

    for (const key in timetable) {
      const slot = timetable[key];
      if (slot.assignedTo) continue; // Skip already assigned slots

      // 모든 사용자(방장 포함) 중에서 가용성 확인
      const allAvailable = slot.available || [];
      const nonOwnerAvailable = allAvailable.filter(a => a.memberId !== ownerId);

      if (nonOwnerAvailable.length > 0) {
        console.log(`🔍 [가용성] ${key}: ${nonOwnerAvailable.map(a => `${a.memberId}(우선순위:${a.priority})`).join(', ')} 사용 가능`);
      }

      // 2명 이상의 비방장 멤버가 같은 시간대를 원할 때만 충돌 분석
      if (nonOwnerAvailable.length > 1) {
        // 우선순위별로 그룹화
        const priorityGroups = {};
        nonOwnerAvailable.forEach(member => {
          const priority = member.priority || 2; // 기본 우선순위 2
          if (!priorityGroups[priority]) {
            priorityGroups[priority] = [];
          }
          priorityGroups[priority].push(member);
        });

        // 가장 높은 우선순위 그룹 찾기
        const priorities = Object.keys(priorityGroups).map(p => parseInt(p));
        const highestPriority = Math.max(...priorities);
        const highestPriorityMembers = priorityGroups[highestPriority];

        // 최고 우선순위 그룹에 2명 이상 있을 때만 충돌로 처리
        if (highestPriorityMembers.length > 1) {
          console.log(`[협의] ${key}에서 같은 우선순위(${highestPriority}) 멤버들 간 충돌:`,
            highestPriorityMembers.map(m => m.memberId).join(', '));

          conflicts.push({
            slotKey: key,
            availableMembers: highestPriorityMembers.map(a => a.memberId),
            priority: highestPriority
          });

          console.log(`🔍 [충돌추가] ${key} 슬롯을 충돌 목록에 추가: ${highestPriorityMembers.map(a => a.memberId).join(', ')}`);
        } else {
          // 같은 우선순위 멤버가 1명뿐이면 바로 할당 가능
          console.log(`🔍 [우선할당] ${key}: 우선순위 ${highestPriority} 멤버 ${highestPriorityMembers[0].memberId} 단독 가용`);
        }
      }
    }

    console.log(`[협의] 총 ${conflicts.length}개 실제 충돌 감지`);
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

    // 각 멤버의 개인 시간표(defaultSchedule)를 기반으로 타임테이블 생성
    const allMembers = [...members, { user: owner, priority: 5, isOwner: true }]; // 방장도 포함

    allMembers.forEach(member => {
      const user = member.user;
      const userId = user._id.toString();
      const priority = this.getMemberPriority(member);
      const isOwner = member.isOwner || false;



      // 개인 시간표(defaultSchedule) 처리
      if (user.defaultSchedule && Array.isArray(user.defaultSchedule)) {


        user.defaultSchedule.forEach(schedule => {
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

    console.log(`[개인시간표] 총 ${Object.keys(timetable).length}개 시간대 생성 (개인 시간표 기준)`);

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
      currentTime += 10; // 10분 단위
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
      // Convert hours to slots (1 hour = 6 slots)
      const neededSlots = neededHours * 6;
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
    let assignedCount = 0;

    for (const key in timetable) {
      const slot = timetable[key];
      if (slot.assignedTo) continue;

      const highPriorityAvailable = slot.available.filter(a => a.priority >= priority && !a.isOwner);

      if (highPriorityAvailable.length === 1) {
        const memberToAssign = highPriorityAvailable[0].memberId;
        if (assignments[memberToAssign] && assignments[memberToAssign].assignedHours < minSlotsPerWeek) {
          this._assignSlot(timetable, assignments, key, memberToAssign);
          assignedCount++;
          console.log(`🔍 [단독할당] ${key}: 멤버 ${memberToAssign} 할당 (우선순위: ${highPriorityAvailable[0].priority})`);
        }
      } else if (highPriorityAvailable.length > 1) {
        // 같은 우선순위의 여러 멤버가 있는 경우 - 가장 적게 할당받은 멤버에게 우선 할당
        const sortedMembers = highPriorityAvailable
          .filter(a => assignments[a.memberId] && assignments[a.memberId].assignedHours < minSlotsPerWeek)
          .sort((a, b) => {
            const hoursA = assignments[a.memberId]?.assignedHours || 0;
            const hoursB = assignments[b.memberId]?.assignedHours || 0;
            return hoursA - hoursB;
          });

        if (sortedMembers.length > 0) {
          const memberToAssign = sortedMembers[0].memberId;
          this._assignSlot(timetable, assignments, key, memberToAssign);
          assignedCount++;
          console.log(`🔍 [균등할당] ${key}: 멤버 ${memberToAssign} 할당 (${sortedMembers.length}명 중 최소 할당자)`);
        }
      }
    }

    console.log(`🔍 [단독할당완료] 총 ${assignedCount}개 슬롯 할당됨`);
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

    assignments[memberId].assignedHours += 1; // This represents one 10-minute slot
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

    console.log(`[이월처리] ${membersNeedingHours.length}명의 멤버가 추가 시간 필요`);

    for (const memberId of membersNeedingHours) {
      let needed = minSlotsPerWeek - assignments[memberId].assignedHours;
      const neededHours = needed / 6; // 시간으로 변환

      console.log(`[이월처리] 멤버 ${memberId}: ${neededHours}시간 부족, 다음 주로 이월 예정`);

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
