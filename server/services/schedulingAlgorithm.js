class SchedulingAlgorithm {

  runAutoSchedule(members, owner, roomTimeSlots, options, deferredAssignments = []) {
    const { minHoursPerWeek = 3, numWeeks = 2, currentWeek } = options;
    const startDate = currentWeek ? new Date(currentWeek) : new Date();
    
    const timetable = this._createTimetable(roomTimeSlots, startDate, numWeeks);

    let assignments = this._initializeMemberAssignments(members);

    // Phase 0: Assign Deferred Assignments (0-priority)
    this._assignDeferredAssignments(timetable, assignments, deferredAssignments);

    // Phase 1: Assign undisputed high-priority slots
    this._assignUndisputedSlots(timetable, assignments, 3, minHoursPerWeek);

    // Phase 2: Iteratively fill remaining hours
    // Since all submitted slots are treated as high priority, we only need to run this once.
    this._iterativeAssignment(timetable, assignments, 3, minHoursPerWeek);

    // Phase 2.5: Explicit Conflict Resolution by Owner Taking Slot
    this._resolveConflictsByOwnerTakingSlot(timetable, assignments, owner, minHoursPerWeek);

    // Phase 3: Conflict Resolution using Owner's Schedule
    this._resolveConflictsWithOwner(timetable, assignments, owner, minHoursPerWeek);

    // Phase 4: Carry-over assignments (prioritize unassigned members in future weeks)
    this._carryOverAssignments(timetable, assignments, minHoursPerWeek);

    // Identify unassigned members (for future carry-over)
    const unassignedMembersInfo = Object.keys(assignments)
      .filter(id => assignments[id].assignedHours < minHoursPerWeek)
      .map(id => ({
        memberId: id,
        neededHours: minHoursPerWeek - assignments[id].assignedHours,
        assignedSlots: assignments[id].slots,
      }));

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
    roomTimeSlots.forEach(slot => {
      const date = new Date(slot.date);
      const dateKey = date.toISOString().split('T')[0];
      const key = `${dateKey}-${slot.startTime}`;

      if (timetable[key]) {
        const userId = slot.user.toString();
        // Assume all submitted slots are high priority
        timetable[key].available.push({ memberId: userId, priority: 3, isOwner: false });
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
      let hoursAssigned = 0;

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
        if (hoursAssigned >= neededHours) break;
        this._assignSlot(timetable, assignments, key, memberId);
        hoursAssigned += 0.5;
      }
    }
  }

  _assignUndisputedSlots(timetable, assignments, priority, minHoursPerWeek) {
    for (const key in timetable) {
      const slot = timetable[key];
      if (slot.assignedTo) continue;

      const highPriorityAvailable = slot.available.filter(a => a.priority === priority && !a.isOwner);
      
      if (highPriorityAvailable.length === 1) {
        const memberToAssign = highPriorityAvailable[0].memberId;
        if (assignments[memberToAssign].assignedHours < minHoursPerWeek) {
          this._assignSlot(timetable, assignments, key, memberToAssign);
        }
      }
    }
  }

  _iterativeAssignment(timetable, assignments, priority, minHoursPerWeek) {
    const membersToAssign = Object.keys(assignments).filter(id => assignments[id].assignedHours < minHoursPerWeek);

    for (const memberId of membersToAssign) {
        // Try to fill this member's hours before moving to the next member
        while (assignments[memberId].assignedHours < minHoursPerWeek) {
            const bestSlotResult = this._findBestSlotForMember(timetable, assignments, memberId, priority);

            if (bestSlotResult && bestSlotResult.bestSlot) {
                this._assignSlot(timetable, assignments, bestSlotResult.bestSlot.key, memberId);
            } else {
                // No more slots can be found for this member at this priority.
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

    for (const key in timetable) {
        const slot = timetable[key];
        if (slot.assignedTo) continue;

        const memberAvailability = slot.available.find(a => a.memberId === memberId && a.priority === priority && !a.isOwner);
        if (memberAvailability) {
            const contenders = slot.available.filter(a => !a.isOwner).length;
            
            let score = 1000 - (contenders * 10);

            const prevKey = this._getPreviousSlotKey(key);
            if (prevKey && timetable[prevKey] && timetable[prevKey].assignedTo === memberId) {
                score += 100;
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
    assignments[memberId].assignedHours += 0.5;
    console.log("SchedulingAlgorithm:_assignSlot - Pushing slot with startTime:", startTimeRaw, "and endTime:", endTime);
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

  _resolveConflictsWithOwner(timetable, assignments, owner, minHoursPerWeek) {
    let changed = true;
    while (changed) {
      changed = false;
      const membersNeedingHours = Object.keys(assignments).filter(id => 
        id !== owner._id.toString() && assignments[id].assignedHours < minHoursPerWeek
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

  _resolveConflictsByOwnerTakingSlot(timetable, assignments, owner, minHoursPerWeek) {
    const ownerId = owner._id.toString();
    for (const key in timetable) {
      const slot = timetable[key];
      if (slot.assignedTo) continue;

      const nonOwnerAvailable = slot.available.filter(a => a.memberId !== ownerId);

      if (nonOwnerAvailable.length > 1) {
        const ownerAvailability = slot.available.find(a => a.memberId === ownerId && a.isOwner);
        if (ownerAvailability) {
          slot.assignedTo = ownerId;
        }
      }
    }
  }

  _carryOverAssignments(timetable, assignments, minHoursPerWeek) {
    const membersNeedingHours = Object.keys(assignments).filter(id => assignments[id].assignedHours < minHoursPerWeek);

    for (const memberId of membersNeedingHours) {
      let needed = minHoursPerWeek - assignments[memberId].assignedHours;
      
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
        needed -= 0.5;
      }
    }
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
