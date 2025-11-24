/**
 * Date Change Service - 날짜 기반 일정 변경 처리
 *
 * "11월 11일을 14일로" 같은 날짜 기반 변경 요청을 처리합니다.
 */

const Room = require('../../../models/Room');
const ActivityLog = require('../../../models/ActivityLog');
const { timeToMinutes, minutesToTime, addHours, getHoursDifference } = require('../utils/timeUtils');
const { logSlotSwap, logAutoPlacement, logChangeRequest } = require('../helpers/activityLogger');
const { findAvailableSlot, removeSlots, createNewSlots } = require('../helpers/autoPlacement');
const { validateNotWeekend, validateMemberPreferredDay, validateHasOverlap } = require('../validators/scheduleValidator');

/**
 * Handle date-based change requests (e.g., "11월 11일 → 11월 14일")
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} room - Room document
 * @param {Object} memberData - Member data from room
 * @param {Object} params - Change parameters
 * @param {number} params.sourceMonth - Source month (optional)
 * @param {number} params.sourceDay - Source day (optional)
 * @param {string} params.sourceTime - Source time (optional, HH:00 format)
 * @param {number} params.targetMonth - Target month (optional)
 * @param {number} params.targetDateNum - Target date number
 * @param {string} params.targetTime - Target time (optional, HH:00 format)
 * @param {string} params.viewMode - View mode (optional)
 * @param {Date} params.currentWeekStartDate - Current week start date (optional)
 * @returns {Promise<Object>} Response object
 */
async function handleDateChange(req, res, room, memberData, params) {
  const { sourceMonth, sourceDay, sourceTime, sourceYear, targetMonth, targetDateNum, targetTime, targetYear, viewMode, currentWeekStartDate } = params;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Calculate source date (use UTC to avoid timezone issues)
  let sourceDate;
  if (sourceMonth && sourceDay) {
    const finalSourceYear = sourceYear || currentYear;
    sourceDate = new Date(Date.UTC(finalSourceYear, sourceMonth - 1, sourceDay, 0, 0, 0, 0));
  } else {
    // "오늘 일정" - find user's slot for today
    const today = new Date();
    sourceDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0));
  }

  // Calculate target date (use UTC to avoid timezone issues)
  const finalTargetMonth = targetMonth || currentMonth;
  const finalTargetYear = targetYear || currentYear;
  const targetDate = new Date(Date.UTC(finalTargetYear, finalTargetMonth - 1, targetDateNum, 0, 0, 0, 0));

  // Get day of week for target date
  const dayOfWeek = targetDate.getDay();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDayEnglish = dayNames[dayOfWeek];

  // Validate: only weekdays
  try {
    validateNotWeekend(targetDate);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: `${finalTargetMonth}월 ${targetDateNum}일은 주말입니다. 평일(월~금)로만 이동할 수 있습니다.`
    });
  }

  console.log(`📅 Date change: ${sourceMonth || 'today'}/${sourceDay || 'today'} → ${finalTargetMonth}/${targetDateNum} (${targetDayEnglish})`);

  // Find the source slot
  const sourceDateStr = sourceDate.toISOString().split('T')[0];

  console.log(`🔍 Looking for slots on source date: ${sourceDateStr}${sourceTime ? ` at ${sourceTime}` : ''}`);
  console.log(`👤 User ID: ${req.user.id}`);

  // First, check all user's slots regardless of date
  const allUserSlots = room.timeSlots.filter(slot => {
    const slotUserId = (slot.user._id || slot.user).toString();
    return slotUserId === req.user.id.toString();
  });

  console.log(`📊 Total slots for user: ${allUserSlots.length}`);
  allUserSlots.forEach(slot => {
    const slotDate = new Date(slot.date).toISOString().split('T')[0];
    console.log(`   - ${slotDate} ${slot.startTime}-${slot.endTime} (subject: "${slot.subject}")`);
  });

  // Filter by date first
  const slotsOnSourceDate = room.timeSlots.filter(slot => {
    const slotUserId = (slot.user._id || slot.user).toString();
    const slotDate = new Date(slot.date).toISOString().split('T')[0];
    const isUserSlot = slotUserId === req.user.id.toString();
    const isSourceDate = slotDate === sourceDateStr;
    const isValidSubject = slot.subject === '자동 배정' || slot.subject === '교환 결과';
    return isUserSlot && isSourceDate && isValidSubject;
  });

  console.log(`📊 Slots on source date ${sourceDateStr}: ${slotsOnSourceDate.length}`);

  let requesterSlots = [];

  // If sourceTime is specified, select the continuous block starting at that time
  if (sourceTime) {
    // Sort slots by time
    slotsOnSourceDate.sort((a, b) => {
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });

    // Find the first slot that starts at or contains sourceTime
    const sourceMinutes = timeToMinutes(sourceTime);
    let startIndex = -1;

    for (let i = 0; i < slotsOnSourceDate.length; i++) {
      const slotStartMinutes = timeToMinutes(slotsOnSourceDate[i].startTime);
      const slotEndMinutes = timeToMinutes(slotsOnSourceDate[i].endTime);

      // Find slot where sourceTime falls within or at the start
      if (sourceMinutes >= slotStartMinutes && sourceMinutes < slotEndMinutes) {
        startIndex = i;
        break;
      }
    }

    if (startIndex >= 0) {
      // Select all consecutive slots starting from this slot
      requesterSlots = [slotsOnSourceDate[startIndex]];
      console.log(`   🎯 Starting slot: ${slotsOnSourceDate[startIndex].startTime}-${slotsOnSourceDate[startIndex].endTime}`);

      for (let i = startIndex + 1; i < slotsOnSourceDate.length; i++) {
        const prevSlot = slotsOnSourceDate[i - 1];
        const currSlot = slotsOnSourceDate[i];

        // Check if current slot is consecutive (previous endTime = current startTime)
        if (prevSlot.endTime === currSlot.startTime) {
          requesterSlots.push(currSlot);
          console.log(`   🎯 Consecutive slot: ${currSlot.startTime}-${currSlot.endTime}`);
        } else {
          // Gap found, stop
          console.log(`   ⚠️ Gap found after ${prevSlot.endTime}, stopping`);
          break;
        }
      }
    }
  } else {
    // No sourceTime specified, use all slots on that date
    requesterSlots = slotsOnSourceDate;
  }

  console.log(`✅ Filtered slots on ${sourceDateStr}: ${requesterSlots.length}`);

  if (requesterSlots.length === 0) {
    return res.status(400).json({
      success: false,
      message: `${sourceMonth || (now.getMonth() + 1)}월 ${sourceDay || now.getDate()}일에 배정된 일정이 없습니다.`
    });
  }

  // Sort and group into continuous block
  requesterSlots.sort((a, b) => {
    const [aH, aM] = a.startTime.split(':').map(Number);
    const [bH, bM] = b.startTime.split(':').map(Number);
    return (aH * 60 + aM) - (bH * 60 + bM);
  });

  const blockStartTime = requesterSlots[0].startTime;
  const blockEndTime = requesterSlots[requesterSlots.length - 1].endTime;
  const totalHours = getHoursDifference(blockStartTime, blockEndTime);

  const newStartTime = targetTime || blockStartTime;
  const newEndTime = addHours(newStartTime, totalHours);

  // 🔒 Validate: Check if target day/time is in OWNER's preferred schedule
  const owner = room.owner;
  const ownerDefaultSchedule = owner.defaultSchedule || [];

  console.log(`🔍 [방장 검증] Checking owner's schedule - Target day: ${targetDayEnglish} (dayOfWeek: ${dayOfWeek})`);
  console.log(`👑 Owner user ID: ${owner._id || owner.toString()}`);
  console.log(`👑 Owner's defaultSchedule (${ownerDefaultSchedule.length} entries)`);

  const targetDateStr = targetDate.toISOString().split('T')[0];

  // Check if owner has schedule for this date/day
  const ownerTargetSchedules = ownerDefaultSchedule.filter(s => {
    // 🔧 specificDate가 있으면 그 날짜에만 적용
    if (s.specificDate) {
      return s.specificDate === targetDateStr;
    } else {
      // specificDate가 없으면 dayOfWeek로 체크 (반복 일정)
      return s.dayOfWeek === dayOfWeek;
    }
  });

  console.log(`📅 [방장 검증] Owner schedules for ${targetDateStr}: ${ownerTargetSchedules.length} entries`);

  if (ownerTargetSchedules.length === 0) {
    return res.status(400).json({
      success: false,
      message: `❌ ${finalTargetMonth}월 ${targetDateNum}일(${targetDayEnglish})은 방장의 선호시간이 아닙니다. 방장이 가능한 날짜/시간으로만 이동할 수 있습니다.`
    });
  }

  // Check if the requested time fits within owner's schedule
  const ownerStartMinutes = timeToMinutes(newStartTime);
  const ownerEndMinutes = timeToMinutes(newEndTime);

  const ownerScheduleTimes = ownerTargetSchedules.map(s => ({
    start: timeToMinutes(s.startTime),
    end: timeToMinutes(s.endTime)
  })).sort((a, b) => a.start - b.start);

  const ownerMergedBlocks = [];
  ownerScheduleTimes.forEach(slot => {
    if (ownerMergedBlocks.length === 0) {
      ownerMergedBlocks.push({ start: slot.start, end: slot.end });
    } else {
      const lastBlock = ownerMergedBlocks[ownerMergedBlocks.length - 1];
      if (slot.start <= lastBlock.end) {
        lastBlock.end = Math.max(lastBlock.end, slot.end);
      } else {
        ownerMergedBlocks.push({ start: slot.start, end: slot.end });
      }
    }
  });

  console.log(`📊 [방장 검증] Owner merged blocks:`, ownerMergedBlocks.map(b => `${Math.floor(b.start/60)}:${String(b.start%60).padStart(2,'0')}-${Math.floor(b.end/60)}:${String(b.end%60).padStart(2,'0')}`).join(', '));

  const fitsInOwnerSchedule = ownerMergedBlocks.some(block =>
    ownerStartMinutes >= block.start && ownerEndMinutes <= block.end
  );

  if (!fitsInOwnerSchedule) {
    const ownerScheduleRanges = ownerMergedBlocks.map(b => {
      const startHour = Math.floor(b.start / 60);
      const startMin = b.start % 60;
      const endHour = Math.floor(b.end / 60);
      const endMin = b.end % 60;
      return `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}-${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
    }).join(', ');

    return res.status(400).json({
      success: false,
      message: `❌ ${finalTargetMonth}월 ${targetDateNum}일 ${newStartTime}-${newEndTime}은 방장의 선호시간(${ownerScheduleRanges})에 포함되지 않습니다.`
    });
  }

  console.log(`✅ [방장 검증] 통과: ${newStartTime}-${newEndTime}은 방장의 선호시간 내에 있습니다.`);

  // 🔒 Validate: Check if target day is in MEMBER's preferred schedule
  const requesterUser = memberData.user;
  const requesterDefaultSchedule = requesterUser.defaultSchedule || [];

  // Map day to dayOfWeek number (0=Sunday, 1=Monday, ..., 6=Saturday)
  const dayOfWeekMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const targetDayOfWeek = dayOfWeekMap[targetDayEnglish];

  console.log(`🔍 Checking member's schedule - Target day: ${targetDayEnglish} (dayOfWeek: ${targetDayOfWeek})`);
  console.log(`👤 Requester user ID: ${requesterUser._id || requesterUser.toString()}`);
  console.log(`👤 Requester name: ${requesterUser.firstName} ${requesterUser.lastName}`);
  console.log(`👤 Member's defaultSchedule (${requesterDefaultSchedule.length} entries):`, JSON.stringify(requesterDefaultSchedule, null, 2));

  // 🔧 targetDate 기준 7일 이내 스케줄만 필터링 (±3일)
  const sevenDaysBefore = new Date(targetDate);
  sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 3);
  const sevenDaysAfter = new Date(targetDate);
  sevenDaysAfter.setDate(sevenDaysAfter.getDate() + 3);

  const nearbySchedules = requesterDefaultSchedule.filter(s => {
    if (s.specificDate) {
      const scheduleDate = new Date(s.specificDate);
      return scheduleDate >= sevenDaysBefore && scheduleDate <= sevenDaysAfter;
    }
    return false;
  });

  // 7일 이내 스케줄들의 요일 추출
  const nearbyDayOfWeeks = [...new Set(nearbySchedules.map(s => s.dayOfWeek))];

  console.log(`🔍 [멤버 검증] targetDate: ${targetDate.toISOString().split('T')[0]}`);
  console.log(`🔍 [멤버 검증] 7일 이내 범위: ${sevenDaysBefore.toISOString().split('T')[0]} ~ ${sevenDaysAfter.toISOString().split('T')[0]}`);
  console.log(`🔍 [멤버 검증] 7일 이내 스케줄: ${nearbySchedules.length}개`);
  console.log(`🔍 [멤버 검증] 7일 이내 요일: ${nearbyDayOfWeeks.join(', ')}`);

  // targetDayOfWeek가 7일 이내 요일에 있는지 체크
  if (!nearbyDayOfWeeks.includes(targetDayOfWeek)) {
    const dayNames = { 0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토' };
    const availableDays = nearbyDayOfWeeks.map(d => dayNames[d] + '요일').join(', ') || '없음';
    return res.status(400).json({
      success: false,
      message: `${finalTargetMonth}월 ${targetDateNum}일(${targetDayEnglish})은 해당 주의 선호 시간이 아닙니다. 가능한 요일: ${availableDays}`
    });
  }

  // Check if member has any schedule for this day (7일 이내 기준)
  const memberTargetDaySchedules = nearbySchedules.filter(s => s.dayOfWeek === targetDayOfWeek);

  console.log(`📅 Filtered schedules for dayOfWeek ${targetDayOfWeek}: ${memberTargetDaySchedules.length} entries`);
  if (memberTargetDaySchedules.length > 0) {
    console.log(`   Time ranges:`, memberTargetDaySchedules.map(s => `${s.startTime}-${s.endTime}`).join(', '));
  }

  // Validate member preferred day
  try {
    validateMemberPreferredDay(memberTargetDaySchedules, finalTargetMonth, targetDateNum, targetDayEnglish);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  // Check if the requested time range fits within member's preferred time slots
  const newStartMinutes = timeToMinutes(newStartTime);
  const newEndMinutes = timeToMinutes(newEndTime);

  console.log(`🕐 Requested time range: ${newStartTime}-${newEndTime} (${newStartMinutes}-${newEndMinutes} minutes)`);

  // Merge schedule slots to get continuous time blocks
  const scheduleTimes = memberTargetDaySchedules.map(s => ({
    start: timeToMinutes(s.startTime),
    end: timeToMinutes(s.endTime)
  })).sort((a, b) => a.start - b.start);

  const mergedBlocks = [];
  scheduleTimes.forEach(slot => {
    if (mergedBlocks.length === 0) {
      mergedBlocks.push({ start: slot.start, end: slot.end });
    } else {
      const lastBlock = mergedBlocks[mergedBlocks.length - 1];
      // Merge if overlapping or consecutive
      if (slot.start <= lastBlock.end) {
        lastBlock.end = Math.max(lastBlock.end, slot.end);
      } else {
        mergedBlocks.push({ start: slot.start, end: slot.end });
      }
    }
  });

  console.log(`📊 Merged schedule blocks:`, mergedBlocks.map(b => `${Math.floor(b.start/60)}:${String(b.start%60).padStart(2,'0')}-${Math.floor(b.end/60)}:${String(b.end%60).padStart(2,'0')}`).join(', '));

  // Check if requested time range fits within any merged block
  const fitsInMemberSchedule = mergedBlocks.some(block => {
    const fits = newStartMinutes >= block.start && newEndMinutes <= block.end;
    console.log(`   Checking against ${Math.floor(block.start/60)}:${String(block.start%60).padStart(2,'0')}-${Math.floor(block.end/60)}:${String(block.end%60).padStart(2,'0')}: ${fits ? '✅ FITS' : '❌ NO'}`);
    return fits;
  });

  if (!fitsInMemberSchedule) {
    // Use already-merged blocks for error message
    const scheduleRanges = mergedBlocks.map(b => {
      const startHour = Math.floor(b.start / 60);
      const startMin = b.start % 60;
      const endHour = Math.floor(b.end / 60);
      const endMin = b.end % 60;
      return `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}-${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
    }).join(', ');

    return res.status(400).json({
      success: false,
      message: `${newStartTime}-${newEndTime}는 회원님의 선호 시간대가 아닙니다. 회원님의 선호 시간대: ${scheduleRanges}`
    });
  }

  console.log(`✅ Member's schedule check passed`);

  // 🔒 Check if OTHER users have slots at target date/time
  // targetDateStr은 이미 위에서 선언됨 (line 182)
  const otherUsersSlots = room.timeSlots.filter(slot => {
    const slotUserId = (slot.user._id || slot.user).toString();
    const slotDate = new Date(slot.date).toISOString().split('T')[0];
    const isOtherUser = slotUserId !== req.user.id.toString();
    const isTargetDate = slotDate === targetDateStr;
    return isOtherUser && isTargetDate;
  });

  if (otherUsersSlots.length > 0) {
    // Check if there's a time overlap with other users
    const newSlotStart = timeToMinutes(newStartTime);
    const newSlotEnd = timeToMinutes(newEndTime);

    const conflictingSlots = otherUsersSlots.filter(slot => {
      const slotStart = timeToMinutes(slot.startTime);
      const slotEnd = timeToMinutes(slot.endTime);
      return (newSlotStart >= slotStart && newSlotStart < slotEnd) ||
             (newSlotEnd > slotStart && newSlotEnd <= slotEnd) ||
             (newSlotStart <= slotStart && newSlotEnd >= slotEnd);
    });

    if (conflictingSlots.length > 0) {
      console.log(`⚠️ Conflict with other users at target date/time`);

      // 🆕 시간을 지정하지 않은 경우: 자동으로 빈 시간에 배치
      if (!targetTime) {
        console.log(`🔄 No specific time requested - finding next available slot`);

        // 해당 날짜의 모든 슬롯 가져오기 (다른 사용자 + 본인)
        const allSlotsOnTargetDate = room.timeSlots.filter(slot => {
          const slotDate = new Date(slot.date).toISOString().split('T')[0];
          return slotDate === targetDateStr;
        });

        // 빈 슬롯 찾기
        const foundSlot = findAvailableSlot({
          allSlotsOnDate: allSlotsOnTargetDate,
          memberSchedules: memberTargetDaySchedules,
          totalHours
        });

        if (foundSlot) {
          const autoStartTime = minutesToTime(foundSlot.start);
          const autoEndTime = minutesToTime(foundSlot.end);

          console.log(`✅ Found available slot: ${autoStartTime}-${autoEndTime}`);

          // 기존 슬롯 삭제
          removeSlots(room, requesterSlots.map(slot => slot._id.toString()));

          // 새 슬롯 생성
          const newSlots = createNewSlots({
            userId: req.user.id,
            targetDate,
            startTime: autoStartTime,
            endTime: autoEndTime,
            dayEnglish: targetDayEnglish,
            priority: requesterSlots[0]?.priority || 3,
            ownerId: room.owner._id
          });

          room.timeSlots.push(...newSlots);
          await room.save();
          await room.populate('timeSlots.user', '_id firstName lastName email');

          // Log activity
          const prevSlot = requesterSlots[0];
          const userName = memberData.user.firstName && memberData.user.lastName
            ? `${memberData.user.firstName} ${memberData.user.lastName}`
            : memberData.user.email;

          await logAutoPlacement(
            room._id,
            req.user.id,
            userName,
            prevSlot,
            {
              month: finalTargetMonth,
              day: targetDateNum,
              startTime: autoStartTime,
              endTime: autoEndTime
            }
          );

          return res.json({
            success: true,
            message: `${finalTargetMonth}월 ${targetDateNum}일 ${autoStartTime}-${autoEndTime}로 자동 배치되었습니다! (원래 시간대에 다른 일정이 있어서 가장 가까운 빈 시간으로 이동)`,
            immediateSwap: true,
            targetDay: targetDayEnglish,
            targetTime: autoStartTime
          });
        }
        // 빈 슬롯을 못 찾으면 아래에서 요청 생성
        console.log(`⚠️ No available slot found - creating request`);
      }

      // 시간을 지정한 경우 또는 빈 슬롯을 못 찾은 경우: 요청 생성
      // Get unique conflicting users
      const conflictingUserIds = [...new Set(conflictingSlots.map(s => {
        const userId = s.user._id || s.user;
        return userId.toString();
      }))];

      // 첫 번째 충돌 슬롯의 실제 정보 사용
      const firstConflictSlot = conflictingSlots[0];

      // Create time change request
      const request = {
        requester: req.user.id,
        type: 'time_change',
        targetUser: conflictingUserIds[0], // 첫 번째 충돌 사용자를 targetUser로 설정
        requesterSlots: requesterSlots.map(slot => ({
          user: slot.user,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          day: slot.day,
          priority: slot.priority,
          subject: slot.subject
        })),
        timeSlot: {
          user: firstConflictSlot.user._id || firstConflictSlot.user,
          date: firstConflictSlot.date,
          startTime: newStartTime,
          endTime: newEndTime,
          day: targetDayEnglish,
          priority: firstConflictSlot.priority,
          subject: firstConflictSlot.subject
        },
        desiredDay: targetDayEnglish,
        desiredTime: newStartTime,
        message: `${new Date(firstConflictSlot.date).toISOString().split('T')[0]} ${newStartTime}-${newEndTime}를 양보 요청`,
        status: 'pending',
        createdAt: new Date()
      };

      room.requests.push(request);
      await room.save();

      const conflictUsers = conflictingUserIds.map(userId => {
        const member = room.members.find(m => (m.user._id || m.user).toString() === userId);
        if (member && member.user && typeof member.user === 'object') {
          return `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim();
        }
        return '다른 사용자';
      });

      // Log activity
      const requesterName = memberData.user.firstName && memberData.user.lastName
        ? `${memberData.user.firstName} ${memberData.user.lastName}`
        : memberData.user.email;

      const prevSlot = requesterSlots[0];
      await logChangeRequest(
        room._id,
        req.user.id,
        requesterName,
        prevSlot,
        {
          month: finalTargetMonth,
          day: targetDateNum,
          startTime: newStartTime,
          endTime: newEndTime
        },
        conflictUsers
      );

      return res.json({
        success: true,
        message: `${finalTargetMonth}월 ${targetDateNum}일 ${newStartTime}-${newEndTime} 시간대에 ${conflictUsers.join(', ')}님의 일정이 있습니다. 자리요청관리에 요청을 보냈습니다. 승인되면 자동으로 변경됩니다.`,
        requestCreated: true,
        requestId: request._id
      });
    }
  }

  // 🔒 Check if target date/time already has a slot for this user
  const existingSlotsAtTarget = room.timeSlots.filter(slot => {
    const slotUserId = (slot.user._id || slot.user).toString();
    const slotDate = new Date(slot.date).toISOString().split('T')[0];
    const isUserSlot = slotUserId === req.user.id.toString();
    const isTargetDate = slotDate === targetDateStr;

    if (isUserSlot && isTargetDate) {
      console.log(`⚠️ Existing slot at target: ${slotDate} ${slot.startTime}-${slot.endTime}`);
    }

    return isUserSlot && isTargetDate;
  });

  if (existingSlotsAtTarget.length > 0) {
    // Use validateHasOverlap helper
    const hasOverlap = validateHasOverlap(existingSlotsAtTarget, newStartTime, newEndTime);

    if (hasOverlap) {
      // 🆕 시간을 지정하지 않은 경우: 자기 일정과 겹쳐도 자동 배치
      if (!targetTime) {
        console.log(`🔄 Self-conflict detected, no specific time requested - finding next available slot`);

        const allSlotsOnTargetDate = room.timeSlots.filter(slot => {
          const slotDate = new Date(slot.date).toISOString().split('T')[0];
          return slotDate === targetDateStr;
        });

        const foundSlot = findAvailableSlot({
          allSlotsOnDate: allSlotsOnTargetDate,
          memberSchedules: memberTargetDaySchedules,
          totalHours
        });

        if (foundSlot) {
          const autoStartTime = minutesToTime(foundSlot.start);
          const autoEndTime = minutesToTime(foundSlot.end);

          // 기존 슬롯 삭제
          removeSlots(room, requesterSlots.map(slot => slot._id.toString()));

          // 새 슬롯 생성
          const newSlots = createNewSlots({
            userId: req.user.id,
            targetDate: new Date(targetDateStr + 'T00:00:00Z'),
            startTime: autoStartTime,
            endTime: autoEndTime,
            dayEnglish: targetDayEnglish,
            priority: requesterSlots[0]?.priority || 3,
            ownerId: room.owner._id
          });

          room.timeSlots.push(...newSlots);
          await room.save();
          await room.populate('timeSlots.user', '_id firstName lastName email');

          // Log activity
          const prevSlot = requesterSlots[0];
          const userName = memberData.user.firstName && memberData.user.lastName
            ? `${memberData.user.firstName} ${memberData.user.lastName}`
            : memberData.user.email;

          await logAutoPlacement(
            room._id,
            req.user.id,
            userName,
            prevSlot,
            {
              month: finalTargetMonth,
              day: targetDateNum,
              startTime: autoStartTime,
              endTime: autoEndTime
            }
          );

          return res.json({
            success: true,
            message: `${finalTargetMonth}월 ${targetDateNum}일 ${autoStartTime}-${autoEndTime}로 자동 배치되었습니다! (원래 시간대에 다른 일정이 있어서 가장 가까운 빈 시간으로 이동)`,
            immediateSwap: true,
            targetDay: targetDayEnglish,
            targetTime: autoStartTime
          });
        }
      }
      // 빈 슬롯을 못 찾으면 아래에서 에러 반환
    }

    // Merge overlapping and consecutive slots into continuous blocks for error message
    const existingSlotTimes = existingSlotsAtTarget.map(s => ({
      start: timeToMinutes(s.startTime),
      end: timeToMinutes(s.endTime),
      startTime: s.startTime,
      endTime: s.endTime
    }));

    const sortedSlots = [...existingSlotTimes].sort((a, b) => a.start - b.start);
    const mergedBlocks = [];

    sortedSlots.forEach(slot => {
      if (mergedBlocks.length === 0) {
        mergedBlocks.push({ start: slot.start, end: slot.end, startTime: slot.startTime, endTime: slot.endTime });
      } else {
        const lastBlock = mergedBlocks[mergedBlocks.length - 1];

        // Check if current slot overlaps or is consecutive with last block
        if (slot.start <= lastBlock.end) {
          // Overlapping or consecutive - merge by extending end time
          if (slot.end > lastBlock.end) {
            lastBlock.end = slot.end;
            lastBlock.endTime = slot.endTime;
          }
        } else {
          // Gap found - start new block
          mergedBlocks.push({ start: slot.start, end: slot.end, startTime: slot.startTime, endTime: slot.endTime });
        }
      }
    });

    const existingTimesStr = mergedBlocks.map(b => `${b.startTime}-${b.endTime}`).join(', ');

    return res.status(400).json({
      success: false,
      message: `${finalTargetMonth}월 ${targetDateNum}일 ${newStartTime}-${newEndTime} 시간대에 이미 일정이 있습니다.
기존 일정: ${existingTimesStr}`
    });
  }

  console.log(`✅ No time conflict at target date`);

  // Remove old slots and create new ones
  console.log(`🗑️ Removing ${requesterSlots.length} source slots from ${sourceDateStr}`);
  console.log(`   Source slots to remove:`, requesterSlots.map(s => ({
    id: s._id?.toString(),
    date: new Date(s.date).toISOString().split('T')[0],
    time: `${s.startTime}-${s.endTime}`,
    subject: s.subject
  })));

  removeSlots(room, requesterSlots.map(slot => slot._id.toString()));

  console.log(`✅ Deleted ${requesterSlots.length} slots. Remaining user slots: ${room.timeSlots.filter(s => (s.user._id || s.user).toString() === req.user.id.toString()).length}`);

  // Create new slots based on total duration, not source slot count
  const totalMinutes = timeToMinutes(newEndTime) - timeToMinutes(newStartTime);
  const numSlots = Math.ceil(totalMinutes / 30);
  console.log(`➕ Creating ${numSlots} new slots at ${targetDateStr} ${newStartTime}-${newEndTime} (${totalMinutes} minutes)`);

  const newSlots = createNewSlots({
    userId: req.user.id,
    targetDate,
    startTime: newStartTime,
    endTime: newEndTime,
    dayEnglish: targetDayEnglish,
    priority: requesterSlots[0]?.priority || 3,
    ownerId: room.owner._id
  });

  room.timeSlots.push(...newSlots);
  console.log(`💾 Saving room with ${room.timeSlots.length} total slots`);
  await room.save();
  await room.populate('timeSlots.user', '_id firstName lastName email');
  console.log(`✅ Save complete`);

  const targetDateFormatted = `${finalTargetMonth}월 ${targetDateNum}일`;

  // Log activity
  const prevSlot = requesterSlots[0];
  const userName = memberData.user.firstName && memberData.user.lastName
    ? `${memberData.user.firstName} ${memberData.user.lastName}`
    : memberData.user.email;

  await logSlotSwap(
    room._id,
    req.user.id,
    userName,
    prevSlot,
    {
      month: finalTargetMonth,
      day: targetDateNum,
      startTime: newStartTime,
      endTime: newEndTime
    }
  );

  return res.json({
    success: true,
    message: `${targetDateFormatted} ${newStartTime}-${newEndTime}로 즉시 변경되었습니다!`,
    immediateSwap: true,
    targetDay: targetDayEnglish,
    targetTime: newStartTime
  });
}

module.exports = {
  handleDateChange
};
