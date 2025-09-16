class SchedulingAlgorithm {

  runAutoSchedule(members, owner, roomTimeSlots, options, deferredAssignments = []) {
    const { minHoursPerWeek = 3, numWeeks = 2, currentWeek, ownerPreferences = {} } = options;
    // Convert hours to 30-minute slots (1 hour = 2 slots)
    const minSlotsPerWeek = minHoursPerWeek * 2;
    const startDate = currentWeek ? new Date(currentWeek) : new Date();
    
    const timetable = this._createTimetable(roomTimeSlots, startDate, numWeeks);

    let assignments = this._initializeMemberAssignments(members);

    // Phase 0: Assign Deferred Assignments (0-priority)
    this._assignDeferredAssignments(timetable, assignments, deferredAssignments);

    // Phase 1: Assign undisputed high-priority slots
    this._assignUndisputedSlots(timetable, assignments, 3, minSlotsPerWeek);

    // Phase 2: Iteratively fill remaining hours
    // Since all submitted slots are treated as high priority, we only need to run this once.
    this._iterativeAssignment(timetable, assignments, 3, minSlotsPerWeek);

    // Phase 2.5: Explicit Conflict Resolution by Owner Taking Slot (with preferences)
    this._resolveConflictsByOwnerTakingSlot(timetable, assignments, owner, minSlotsPerWeek, ownerPreferences);

    // Phase 3: Conflict Resolution using Owner's Schedule
    this._resolveConflictsWithOwner(timetable, assignments, owner, minSlotsPerWeek);

    // Phase 4: Carry-over assignments (prioritize unassigned members in future weeks)
    this._carryOverAssignments(timetable, assignments, minSlotsPerWeek);

    // Identify unassigned members (for future carry-over)
    const unassignedMembersInfo = Object.keys(assignments)
      .filter(id => assignments[id].assignedHours < minSlotsPerWeek)
      .map(id => {
        const neededHours = (minSlotsPerWeek - assignments[id].assignedHours) / 2; // Convert back to hours
        console.log(`알고리즘: 멤버 ${id} - 할당된 슬롯: ${assignments[id].assignedHours}, 필요한 슬롯: ${minSlotsPerWeek}, 이월 시간: ${neededHours}시간`);
        return {
          memberId: id,
          neededHours: neededHours,
          assignedSlots: assignments[id].slots,
        };
      });

    // Identify unresolvable conflicts
    const unresolvableConflicts = [];
    const ownerId = owner._id.toString(); 
    for (const key in timetable) {
      const slot = timetable[key];
      if (!slot.assignedTo) {
        const nonOwnerAvailable = slot.available.filter(a => a.memberId !== ownerId);
        if (nonOwnerAvailable.length > 1) {
          unresolvableConflicts.push({
            slotKey: key,
            date: slot.date,
            availableMembers: nonOwnerAvailable.map(a => a.memberId)
          });
        }
      }
    }

    return {
      assignments,
      unassignedMembersInfo,
      unresolvableConflicts,
    };
  }

  getMemberPriority(member) {
    return member.user.priority || 0;
  }

  _createTimetable(roomTimeSlots, startDate, numWeeks) {
    const timetable = {};
    const currentDay = new Date(startDate);
    currentDay.setUTCHours(0, 0, 0, 0);

    for (let w = 0; w < numWeeks; w++) {
      for (let d = 0; d < 5; d++) { // Monday to Friday
        const date = new Date(currentDay);
        date.setUTCDate(currentDay.getUTCDate() + d + (w * 7));
        const dayOfWeek = date.getUTCDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
        if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip Saturday and Sunday

        // Convert to 1-indexed day of week (1=Mon, 2=Tue, ..., 5=Fri)
        const oneIndexedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek; // Sunday becomes 7

        for (let h = 9; h < 18; h++) {
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

    // Populate availability from the user-submitted roomTimeSlots
    console.log('schedulingAlgorithm._createTimetable: Processing roomTimeSlots:', roomTimeSlots.length);
    roomTimeSlots.forEach(slot => {
      console.log('schedulingAlgorithm._createTimetable: Processing slot:', slot);
      const date = new Date(slot.date);
      const dateKey = date.toISOString().split('T')[0];
      const key = `${dateKey}-${slot.startTime}`;

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
        
        // Mark all submitted slots as high priority
        timetable[key].available.push({ memberId: userId, priority: 3, isOwner: false });
        console.log(`Added availability for user ${userId} at ${key}`);
      } else {
        console.warn(`Timetable slot not found for key: ${key}`);
      }
    });

    return timetable;
  }

  _initializeMemberAssignments(members) {
    const assignments = {};
    members.forEach(m => {
      assignments[m.user._id.toString()] = { assignedHours: 0, slots: [] };
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

  _iterativeAssignment(timetable, assignments, priority, minSlotsPerWeek) {
    let changed = true;
    // Loop as long as we are successfully assigning slots
    while (changed) {
      changed = false;
      
      // Find all members who still need hours assigned
      const membersToAssign = Object.keys(assignments)
        .filter(id => assignments[id].assignedHours < minSlotsPerWeek)
        // Prioritize members with the fewest hours assigned so far
        .sort((a, b) => assignments[a].assignedHours - assignments[b].assignedHours);

      if (membersToAssign.length === 0) {
        break; // All members have their minimum hours
      }

      // Iterate through the needy members and try to assign ONE slot to the most needy one
      for (const memberId of membersToAssign) {
        const bestSlotResult = this._findBestSlotForMember(timetable, assignments, memberId, priority);

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

  _findBestSlotForMember(timetable, assignments, memberId, priority) {
    let bestSlot = null;
    let bestScore = -1;

    // 사용자의 이미 할당된 슬롯들에서 평균 시간대 계산
    const memberSlots = assignments[memberId].slots;
    let avgTime = 12; // 기본값 12시 (정오)
    
    if (memberSlots.length > 0) {
      const times = memberSlots.map(slot => {
        const [h, m] = slot.startTime.split(':').map(Number);
        return h + (m / 60);
      });
      avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    }

    for (const key in timetable) {
        const slot = timetable[key];
        if (slot.assignedTo) continue;

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

            console.log(`Score for ${memberId} at ${key}: base=${1000-(contenders*10)}, priority=${(memberAvailability.priority-priority)*50}, proximity=${proximityBonus}, total=${score}`);

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
    let changed = true;
    while (changed) {
      changed = false;
      const membersNeedingHours = Object.keys(assignments).filter(id => 
        id !== owner._id.toString() && assignments[id].assignedHours < minSlotsPerWeek
      );

      for (const memberId of membersNeedingHours) {
        for (const key in timetable) {
          const slot = timetable[key];
          if (slot.assignedTo) continue;

          const memberAvailability = slot.available.find(a => a.memberId === memberId && !a.isOwner);
          if (!memberAvailability) continue; 

          const ownerAvailability = slot.available.find(a => a.memberId === owner._id.toString() && a.isOwner);
          if (!ownerAvailability) continue; 

          this._assignSlot(timetable, assignments, key, memberId);
          changed = true;
          break;
        }
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

  // Helper function to check if a time slot matches owner preferences
  _isInOwnerPreferredTime(time, ownerPreferences) {
    if (!ownerPreferences.focusTimeType || ownerPreferences.focusTimeType === 'none') {
      return false; // No preference
    }

    const [hour] = time.split(':').map(Number);

    switch (ownerPreferences.focusTimeType) {
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

  // Helper function to prioritize slots based on owner preferences
  _prioritizeSlotsByOwnerPreference(slots, ownerPreferences) {
    if (!ownerPreferences.focusTimeType || ownerPreferences.focusTimeType === 'none') {
      return slots; // No preference, return as-is
    }

    return slots.sort((keyA, keyB) => {
      const timeA = keyA.split('-').pop();
      const timeB = keyB.split('-').pop();

      const isPreferredA = this._isInOwnerPreferredTime(timeA, ownerPreferences);
      const isPreferredB = this._isInOwnerPreferredTime(timeB, ownerPreferences);

      if (isPreferredA && !isPreferredB) return -1;
      if (!isPreferredA && isPreferredB) return 1;
      return 0;
    });
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
