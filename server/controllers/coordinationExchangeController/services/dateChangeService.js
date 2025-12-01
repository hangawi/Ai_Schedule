/**
 * ===================================================================================================
 * Date Change Service (날짜 변경 서비스)
 * ===================================================================================================
 *
 * 설명: 사용자의 시간 변경 요청 처리
 *
 * 주요 기능:
 * - 시간 변경 가능 여부 검증
 *   ✓ 방장의 선호시간 범위 확인
 *   ✓ 멤버의 선호시간 범위 확인
 *   ✓ 이번 주 범위 체크 (다음 주 선호시간 제외)
 * - 슬롯 제거 및 생성
 * - 충돌 처리 (다른 멤버와 겹치는 경우)
 *
 * 관련 파일:
 * - server/controllers/coordinationRequestController/
 * - server/controllers/coordinationExchangeController/helpers/buildScheduleByDay.js
 *
 * ===================================================================================================
 */

/**
 * Date Change Service - 날짜 기반 일정 변경 처리
 *
 * "11월 11일을 14일로" 같은 날짜 기반 변경 요청을 처리합니다.
 */

const Room = require('../../../models/room');
const ActivityLog = require('../../../models/ActivityLog');
const { timeToMinutes, minutesToTime, addHours, getHoursDifference } = require('../utils/timeUtils');
const { logSlotSwap, logAutoPlacement, logChangeRequest } = require('../helpers/activityLogger');
const { findAvailableSlot, removeSlots, createNewSlots } = require('../helpers/autoPlacement');
const { validateNotWeekend, validateMemberPreferredDay, validateHasOverlap } = require('../validators/scheduleValidator');

/**
 * Handle date-based change requests (e.g., "11월 11일을 11월 14일로")
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



  // Find the source slot
  const sourceDateStr = sourceDate.toISOString().split('T')[0];




  // First, check all user's slots regardless of date
  const allUserSlots = room.timeSlots.filter(slot => {
    const slotUserId = (slot.user._id || slot.user).toString();
    return slotUserId === req.user.id.toString();
  });


  allUserSlots.forEach(slot => {
    const slotDate = new Date(slot.date).toISOString().split('T')[0];

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


      for (let i = startIndex + 1; i < slotsOnSourceDate.length; i++) {
        const prevSlot = slotsOnSourceDate[i - 1];
        const currSlot = slotsOnSourceDate[i];

        // Check if current slot is consecutive (previous endTime = current startTime)
        if (prevSlot.endTime === currSlot.startTime) {
          requesterSlots.push(currSlot);

        } else {
          // Gap found, stop

          break;
        }
      }
    }
  } else {
    // No sourceTime specified, use all slots on that date
    requesterSlots = slotsOnSourceDate;
  }



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

  // ✅ Validate: Check if target day/time is in OWNER's preferred schedule
  const owner = room.owner;
  const ownerDefaultSchedule = owner.defaultSchedule || [];





  const targetDateStr = targetDate.toISOString().split('T')[0];

  // Check if owner has schedule for this date/day
  const ownerTargetSchedules = ownerDefaultSchedule.filter(s => {
    // ✅ specificDate가 있으면 해당 날짜에만 적용
    if (s.specificDate) {
      return s.specificDate === targetDateStr;
    } else {
      // specificDate가 없으면 dayOfWeek로 체크 (반복 일정)
      return s.dayOfWeek === dayOfWeek;
    }
  });



  if (ownerTargetSchedules.length === 0) {
    return res.status(400).json({
      success: false,
      message: `✅ ${finalTargetMonth}월 ${targetDateNum}일(${targetDayEnglish})은 방장의 선호시간이 아닙니다. 방장이가능한 날짜/시간으로만 이동할 수 있습니다.`
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
      message: `✅ ${finalTargetMonth}월 ${targetDateNum}일 ${newStartTime}-${newEndTime}은 방장의 선호시간(${ownerScheduleRanges})에 포함되지 않습니다.`
    });
  }



  // ✅ Validate: Check if target day is in MEMBER's preferred schedule
  const requesterUser = memberData.user;
  const requesterDefaultSchedule = requesterUser.defaultSchedule || [];
  const requesterScheduleExceptions = requesterUser.scheduleExceptions || []; // ✅ 챗봇으로 추가된 선호시간

  // Map day to dayOfWeek number (0=Sunday, 1=Monday, ..., 6=Saturday)
  const dayOfWeekMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const targetDayOfWeek = dayOfWeekMap[targetDayEnglish];







  // ✅ 이번 주 범위 계산 (월요일~ 일요일)
  // currentWeekStartDate가 제공되었으면 사용, 아니면 현재 날짜로 월요일 계산
  let thisWeekMonday;
  if (currentWeekStartDate) {
    const providedDate = new Date(currentWeekStartDate);
    const providedDay = providedDate.getUTCDay();
    const daysToMonday = providedDay === 0 ? 6 : providedDay - 1;
    thisWeekMonday = new Date(providedDate);
    thisWeekMonday.setUTCDate(providedDate.getUTCDate() - daysToMonday);
    thisWeekMonday.setUTCHours(0, 0, 0, 0);
  } else {
    const now = new Date();
    const nowDay = now.getUTCDay();
    const daysToMonday = nowDay === 0 ? 6 : nowDay - 1;
    thisWeekMonday = new Date(now);
    thisWeekMonday.setUTCDate(now.getUTCDate() - daysToMonday);
    thisWeekMonday.setUTCHours(0, 0, 0, 0);
  }

  const thisWeekSunday = new Date(thisWeekMonday);
  thisWeekSunday.setUTCDate(thisWeekMonday.getUTCDate() + 6);
  thisWeekSunday.setUTCHours(23, 59, 59, 999);




  // 이번 주 범위 내의 스케줄만 필터링 (defaultSchedule + scheduleExceptions)
  const thisWeekDefaultSchedules = requesterDefaultSchedule.filter(s => {
    if (s.specificDate) {
      // specificDate가 있는 경우: 이번 주 범위 내에 있는지 체크
      const scheduleDate = new Date(s.specificDate);
      const isThisWeek = scheduleDate >= thisWeekMonday && scheduleDate <= thisWeekSunday;

      return isThisWeek;
    }
    // specificDate 없는 반복 일정은 매주 반복되므로 항상 포함

    return true;
  });

  // ✅ scheduleExceptions (챗봇으로 추가된 선호시간) 필터링
  const thisWeekExceptions = requesterScheduleExceptions.filter(ex => {
    if (ex.specificDate) {
      const scheduleDate = new Date(ex.specificDate);
      const isThisWeek = scheduleDate >= thisWeekMonday && scheduleDate <= thisWeekSunday;


      if (isThisWeek) {
        // ISO datetime에서 HH:MM 형식으로 변환
        const startDateTime = new Date(ex.startTime);
        const endDateTime = new Date(ex.endTime);
        ex.startTime = `${String(startDateTime.getHours()).padStart(2, '0')}:${String(startDateTime.getMinutes()).padStart(2, '0')}`;
        ex.endTime = `${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`;
        ex.dayOfWeek = scheduleDate.getDay(); // dayOfWeek 추가
      }

      return isThisWeek;
    }
    return false;
  });

  // 두 배열 합치기
  const thisWeekSchedules = [...thisWeekDefaultSchedules, ...thisWeekExceptions];

  // 이번 주 스케줄들에서 요일 추출
  const thisWeekDayOfWeeks = [...new Set(thisWeekSchedules.map(s => s.dayOfWeek))];




  // targetDayOfWeek가 이번 주 요일들에 있는지 체크
  if (!thisWeekDayOfWeeks.includes(targetDayOfWeek)) {
    const dayNames = { 0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토' };
    const availableDays = thisWeekDayOfWeeks.map(d => dayNames[d] + '요일').join(', ') || '없음';
    return res.status(400).json({
      success: false,
      message: `${finalTargetMonth}월 ${targetDateNum}일(${targetDayEnglish})은 이번 주의 선호 시간이 아닙니다. 가능한 요일: ${availableDays}`
    });
  }

  // Check if member has any schedule for this day (이번 주 기준)
  const memberTargetDaySchedules = thisWeekSchedules.filter(s => s.dayOfWeek === targetDayOfWeek);


  if (memberTargetDaySchedules.length > 0) {

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



  // Check if requested time range fits within any merged block
  const fitsInMemberSchedule = mergedBlocks.some(block => {
    const fits = newStartMinutes >= block.start && newEndMinutes <= block.end;

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
      message: `${newStartTime}-${newEndTime}은 회원의 선호 시간대가 아닙니다. 회원의 선호 시간대: ${scheduleRanges}`
    });
  }



  // ✅ Check if OTHER users have slots at target date/time
  // targetDateStr은 위에서 선언됨 (line 182)
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


      // ✅ 시간을 지정하지 않은 경우: 자동으로 빈 시간으로 배치
      if (!targetTime) {


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
            message: `${finalTargetMonth}월 ${targetDateNum}일 ${autoStartTime}-${autoEndTime}으로 자동 배치되었습니다. (원래 시간에 다른 일정이 있어 가장 가까운 빈 시간으로 이동)`,
            immediateSwap: true,
            targetDay: targetDayEnglish,
            targetTime: autoStartTime
          });
        }
        // 빈 슬롯을 못찾으면 아래에서 요청 생성

      }

      // 시간을 지정한 경우 또는 빈 슬롯을 못찾은 경우: 요청 생성
      // Get unique conflicting users
      const conflictingUserIds = [...new Set(conflictingSlots.map(s => {
        const userId = s.user._id || s.user;
        return userId.toString();
      }))];

      // 첫번째 충돌 슬롯의 실제 정보 사용
      const firstConflictSlot = conflictingSlots[0];

      // Create time change request
      const request = {
        requester: req.user.id,
        type: 'time_change',
        targetUser: conflictingUserIds[0], // 첫번째 충돌 사용자를 targetUser로 지정
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
        message: `${new Date(firstConflictSlot.date).toISOString().split('T')[0]} ${newStartTime}-${newEndTime}으로 변경 요청`,
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
        message: `${finalTargetMonth}월 ${targetDateNum}일 ${newStartTime}-${newEndTime} 시간에는 ${conflictUsers.join(', ')}의 일정이 있습니다. 관리요청관리에 요청을 보냈으니 확인하면 자동으로 변경됩니다.`,
        requestCreated: true,
        requestId: request._id
      });
    }
  }

  // ✅ Check if target date/time already has a slot for this user
  const existingSlotsAtTarget = room.timeSlots.filter(slot => {
    const slotUserId = (slot.user._id || slot.user).toString();
    const slotDate = new Date(slot.date).toISOString().split('T')[0];
    const isUserSlot = slotUserId === req.user.id.toString();
    const isTargetDate = slotDate === targetDateStr;

    if (isUserSlot && isTargetDate) {

    }

    return isUserSlot && isTargetDate;
  });

  if (existingSlotsAtTarget.length > 0) {
    // Use validateHasOverlap helper
    const hasOverlap = validateHasOverlap(existingSlotsAtTarget, newStartTime, newEndTime);

    if (hasOverlap) {
      // ✅ 시간을 지정하지 않은 경우: 자기 일정과 겹치므로 자동 배치
      if (!targetTime) {


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
            message: `${finalTargetMonth}월 ${targetDateNum}일 ${autoStartTime}-${autoEndTime}으로 자동 배치되었습니다. (원래 시간에 다른 일정이 있어 가장 가까운 빈 시간으로 이동)`,
            immediateSwap: true,
            targetDay: targetDayEnglish,
            targetTime: autoStartTime
          });
        }
      }
      // 빈 슬롯을 못찾으면 아래에서 에러 반환
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
      message: `${finalTargetMonth}월 ${targetDateNum}일 ${newStartTime}-${newEndTime} 시간에는 이미 일정이 있습니다.
기존 일정: ${existingTimesStr}`
    });
  }



  // Remove old slots and create new ones

  console.log(`   Source slots to remove:`, requesterSlots.map(s => ({
    id: s._id?.toString(),
    date: new Date(s.date).toISOString().split('T')[0],
    time: `${s.startTime}-${s.endTime}`,
    subject: s.subject
  })));

  removeSlots(room, requesterSlots.map(slot => slot._id.toString()));



  // Create new slots based on total duration, not source slot count
  const totalMinutes = timeToMinutes(newEndTime) - timeToMinutes(newStartTime);
  const numSlots = Math.ceil(totalMinutes / 30);


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

  await room.save();
  await room.populate('timeSlots.user', '_id firstName lastName email');


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