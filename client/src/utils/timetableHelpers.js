/**
 * Helper functions for timetable slot management and ownership logic
 */

import { timeToMinutes, minutesToTime } from './timeUtils';
import { safeDateToISOString, getDayIndex } from './dateUtils';
import { DAY_NAMES, DEFAULT_COLORS, NEGOTIATION_STATUS } from './timetableConstants';

/**
 * Get hour value from room settings (handles both old and new structures)
 * @param {string|number} setting - The setting value
 * @param {string} defaultValue - Default value as string
 * @returns {number} - The hour as number
 */
export const getHourFromSettings = (setting, defaultValue) => {
  if (setting === null || setting === undefined) return parseInt(defaultValue, 10);
  if (typeof setting === 'string') return parseInt(String(setting).split(':')[0], 10);
  if (typeof setting === 'number') return setting;
  return parseInt(defaultValue, 10);
};

/**
 * Generate time slots for a day based on schedule hours
 * @param {number} scheduleStartHour - Start hour
 * @param {number} scheduleEndHour - End hour
 * @returns {string[]} - Array of time slot strings
 */
export const generateDayTimeSlots = (scheduleStartHour, scheduleEndHour) => {
  const timeSlotsInDay = [];
  for (let h = scheduleStartHour; h < scheduleEndHour; h++) {
    for (let m = 0; m < 60; m += 10) {
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      timeSlotsInDay.push(time);
    }
  }
  return timeSlotsInDay;
};

/**
 * Check if a time slot is blocked and return block info
 * @param {string} time - Time string
 * @param {Object} roomSettings - Room settings object
 * @returns {Object|null} - Blocked time info or null
 */
export const getBlockedTimeInfo = (time, roomSettings) => {
  if (!roomSettings?.blockedTimes || roomSettings.blockedTimes.length === 0) {
    return null;
  }

  const blockedTime = roomSettings.blockedTimes.find(blockedTime => {
    return time >= blockedTime.startTime && time < blockedTime.endTime;
  });

  return blockedTime || null;
};

/**
 * Check if a time slot is covered by a room exception
 * @param {Date} date - Date object
 * @param {string} time - Time string
 * @param {Object} roomSettings - Room settings object
 * @returns {Object|null} - Room exception info or null
 */
export const getRoomExceptionInfo = (date, time, roomSettings) => {
  if (!roomSettings?.roomExceptions || roomSettings.roomExceptions.length === 0) {
    return null;
  }


  const slotDateTime = new Date(date);
  slotDateTime.setHours(parseInt(time.split(':')[0]), parseInt(time.split(':')[1]), 0, 0);
  const slotEndTime = new Date(date);
  slotEndTime.setHours(parseInt(time.split(':')[0]), parseInt(time.split(':')[1]) + 10, 0, 0);

  const exception = roomSettings.roomExceptions.find(ex => {
    if (ex.type === 'daily_recurring') {
      const slotDayOfWeek = date.getDay();
      if (slotDayOfWeek === ex.dayOfWeek) {
        return time >= ex.startTime && time < ex.endTime;
      }
    } else if (ex.type === 'date_specific') {
      const exStartDate = new Date(ex.startDate);
      const exEndDate = new Date(ex.endDate);

      // 14:40 문제 디버깅용 로깅
      if (time === '14:40' || time === '15:00') {
        console.log('🔍 getRoomExceptionInfo - 14:40/15:00 시간대 체크:', {
          time,
          date: date.toISOString(),
          exception: ex,
          exStartDate: exStartDate.toISOString(),
          exEndDate: exEndDate.toISOString(),
          slotDateTime: slotDateTime.toISOString(),
          slotEndTime: slotEndTime.toISOString(),
          isMatch: (slotDateTime < exEndDate && slotEndTime > exStartDate),
          localStartTime: exStartDate.toLocaleString('ko-KR'),
          localEndTime: exEndDate.toLocaleString('ko-KR')
        });
      }

      return (slotDateTime < exEndDate && slotEndTime > exStartDate);
    }
    return false;
  });


  return exception || null;
};

/**
 * Check if a slot is under negotiation
 * @param {Date} date - Date object
 * @param {string} time - Time string
 * @param {Object} roomData - Room data object
 * @returns {Object|null} - Negotiation info or null
 */
export const getNegotiationInfo = (date, time, roomData) => {
  if (!roomData?.negotiations || roomData.negotiations.length === 0) return null;

  const negotiation = roomData.negotiations.find(neg => {
    if (neg.status !== NEGOTIATION_STATUS.ACTIVE) return false;
    if (!neg.slotInfo) return false;

    // slotInfo.date가 Date 객체인지 문자열인지 확인
    let negDate;
    if (neg.slotInfo.date instanceof Date) {
      negDate = neg.slotInfo.date;
    } else {
      negDate = new Date(neg.slotInfo.date);
    }

    const dateMatch = negDate.toISOString().split('T')[0] === date.toISOString().split('T')[0];

    // Check if the time slot falls within the negotiation time range
    const startTime = neg.slotInfo.startTime.trim();
    const endTime = neg.slotInfo.endTime.trim();
    const currentTime = time.trim();

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    const currentMinutes = timeToMinutes(currentTime);

    // Check if current time slot is within or touches the negotiation time range
    const timeMatch = currentMinutes >= startMinutes && currentMinutes < endMinutes;

    return dateMatch && timeMatch;
  });

  return negotiation || null;
};

/**
 * Get who owns/booked a particular slot
 * @param {Date} date - Date object
 * @param {string} time - Time string
 * @param {Array} timeSlots - Array of time slots
 * @param {Array} members - Array of room members
 * @param {Object} currentUser - Current user object
 * @param {boolean} isRoomOwner - Whether current user is room owner
 * @param {Function} getNegotiationInfoFunc - Function to get negotiation info
 * @returns {Object|null} - Slot owner info or null
 */
export const getSlotOwner = (date, time, timeSlots, members, currentUser, isRoomOwner, getNegotiationInfoFunc) => {
  if (!timeSlots || !members || !time || !date) return null;

  // Check if this slot is under negotiation first
  const negotiationInfo = getNegotiationInfoFunc(date, time);
  if (negotiationInfo) {
    // 협의 멤버 수와 우선순위 정보
    const memberCount = negotiationInfo.conflictingMembers?.length || 0;
    const isUserInvolved = negotiationInfo.conflictingMembers?.some(cm =>
      (cm.user._id || cm.user) === currentUser?.id
    );

    return {
      name: isUserInvolved ? `협의 참여 (${memberCount}명)` : `협의중 (${memberCount}명)`,
      color: isUserInvolved ? DEFAULT_COLORS.NEGOTIATION_USER_INVOLVED : DEFAULT_COLORS.NEGOTIATION_OTHER,
      userId: 'negotiation',
      actualUserId: 'negotiation',
      subject: isUserInvolved ? '내가 참여하는 협의' : '다른 멤버들의 협의',
      isNegotiation: true,
      negotiationData: negotiationInfo,
      isUserInvolved: isUserInvolved
    };
  }

  const currentTime = time.trim();
  const currentMinutes = timeToMinutes(currentTime);
  const currentDateStr = date.toISOString().split('T')[0];

  // Find all slots for this date and user, then check if current time falls in any continuous block
  const sameDaySlots = (timeSlots || []).filter(slot => {
    if (!slot || !slot.date) return false;

    // Handle both startTime field and time field formats
    const hasStartTime = slot.startTime;
    const hasTimeField = slot.time && slot.time.includes('-');

    if (!hasStartTime && !hasTimeField) return false;

    const slotDate = new Date(slot.date);
    return slotDate.toISOString().split('T')[0] === currentDateStr;
  });

  // Group slots by user and find continuous blocks
  const userSlotGroups = {};
  sameDaySlots.forEach(slot => {
    const userId = slot.userId || slot.user;
    const userKey = typeof userId === 'object' ? userId?._id || userId?.id : userId;
    if (userKey) {
      if (!userSlotGroups[userKey]) {
        userSlotGroups[userKey] = [];
      }
      userSlotGroups[userKey].push(slot);
    }
  });

  // Check each user's continuous blocks
  let bookedSlot = null;
  for (const [userId, userSlots] of Object.entries(userSlotGroups)) {
    // Sort slots by start time - handle both startTime and time field formats
    const sortedSlots = userSlots.sort((a, b) => {
      const getSlotStartTime = (slot) => {
        if (slot.startTime) return slot.startTime;
        if (slot.time && slot.time.includes('-')) {
          return slot.time.split('-')[0];
        }
        return '00:00';
      };
      return timeToMinutes(getSlotStartTime(a)) - timeToMinutes(getSlotStartTime(b));
    });

    // Find continuous blocks and check if current time falls within any block
    let blockStart = null;
    let blockEnd = null;

    for (let i = 0; i < sortedSlots.length; i++) {
      const slot = sortedSlots[i];

      // Extract start and end times from both formats
      let slotStartTime, slotEndTime;
      if (slot.startTime) {
        slotStartTime = slot.startTime;
        slotEndTime = slot.endTime || slot.startTime;
      } else if (slot.time && slot.time.includes('-')) {
        const [start, end] = slot.time.split('-');
        slotStartTime = start;
        slotEndTime = end;
      } else {
        continue;
      }

      const slotStart = timeToMinutes(slotStartTime);
      const slotEnd = timeToMinutes(slotEndTime);

      if (blockStart === null) {
        blockStart = slotStart;
        blockEnd = slotEnd;
      } else if (slotStart === blockEnd) {
        // Continuous slot, extend the block
        blockEnd = slotEnd;
      } else {
        // Gap found, check if current time was in the previous block
        if (currentMinutes >= blockStart && currentMinutes < blockEnd) {
          bookedSlot = {
            ...sortedSlots[0], // Use first slot as base
            startTime: minutesToTime(blockStart),
            endTime: minutesToTime(blockEnd)
          };
          break;
        }
        // Start new block
        blockStart = slotStart;
        blockEnd = slotEnd;
      }
    }

    // Check the last block
    if (!bookedSlot && blockStart !== null && currentMinutes >= blockStart && currentMinutes < blockEnd) {
      bookedSlot = {
        ...sortedSlots[0], // Use first slot as base
        startTime: minutesToTime(blockStart),
        endTime: minutesToTime(blockEnd)
      };
      break;
    }
  }

  // Fallback to original logic if no continuous block found
  if (!bookedSlot) {
    bookedSlot = sameDaySlots.find(booked => {
      // Handle both startTime/endTime and time field formats
      let startTime, endTime;

      if (booked.startTime) {
        startTime = booked.startTime.trim();
        endTime = booked.endTime ? booked.endTime.trim() : startTime;
      } else if (booked.time && booked.time.includes('-')) {
        const [start, end] = booked.time.split('-');
        startTime = start.trim();
        endTime = end.trim();
      } else {
        return false;
      }

      if (startTime && endTime) {
        const startMinutes = timeToMinutes(startTime);
        const endMinutes = timeToMinutes(endTime);
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        return currentTime === startTime;
      }
    });
  }

  // 방장의 개인 시간은 시간표에서 제외 (협의에 참여하지 않음)
  if (bookedSlot && isRoomOwner && currentUser) {
    let slotUserId = bookedSlot.userId || bookedSlot.user;
    if (typeof slotUserId === 'object' && slotUserId !== null) {
      slotUserId = slotUserId._id || slotUserId.id;
    }

    const currentUserId = currentUser.id || currentUser._id;

    // 방장의 슬롯이면 null 반환 (시간표에서 제외)
    if (slotUserId && currentUserId && slotUserId.toString() === currentUserId.toString()) {
      return null;
    }
  }

  if (bookedSlot) {
    let userId = bookedSlot.userId || bookedSlot.user;

    if (typeof userId === 'object' && userId !== null) {
      userId = userId._id || userId.id;
    }

    if (!userId && bookedSlot.user) {
      userId = bookedSlot.user._id || bookedSlot.user.id;
    }

    let member = null;

    if (userId) {
      member = (members || []).find(m => {
        const memberId = m.user?._id?.toString() || m.user?.id?.toString();
        const slotUserId = userId.toString();
        return memberId && slotUserId && memberId === slotUserId;
      });
    } else if (bookedSlot.user && bookedSlot.user.email) {
      member = (members || []).find(m => {
        return m.user?.email === bookedSlot.user.email;
      });
    }

    if (member) {
      const memberData = member.user || member;
      const memberName = memberData.name ||
                       `${memberData.firstName || ''} ${memberData.lastName || ''}`.trim() ||
                       `${bookedSlot.user?.firstName || ''} ${bookedSlot.user?.lastName || ''}`.trim() ||
                       '알 수 없음';

      const actualUserId = member.user?._id || member.user?.id || member._id || member.id;

      return {
        name: memberName,
        color: member.color || DEFAULT_COLORS.UNKNOWN_USER,
        userId: userId || bookedSlot.user?.email, // Use email as fallback identifier
        actualUserId: actualUserId,
        subject: bookedSlot.subject // Pass subject from bookedSlot
      };
    }

    return {
      name: '알 수 없음',
      color: DEFAULT_COLORS.UNKNOWN_USER,
      userId: null,
      subject: bookedSlot.subject
    };
  }

  return null;
};

/**
 * Check if a slot is selected by the current user
 * @param {Date} date - Date object
 * @param {string} time - Time string
 * @param {Array} currentSelectedSlots - Array of selected slots
 * @returns {boolean} - Whether the slot is selected
 */
export const isSlotSelected = (date, time, currentSelectedSlots) => {
  // Add defensive check for date
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return false; // Or handle as appropriate
  }
  const dayIndex = getDayIndex(date);
  if (dayIndex === -1) return false; // Weekend
  const dayKey = DAY_NAMES[dayIndex];
  return currentSelectedSlots.some(s => s.day === dayKey && s.startTime === time);
};

/**
 * Get current week's negotiations
 * @param {Object} roomData - Room data object
 * @param {Array} weekDates - Array of week dates
 * @param {Array} timeSlotsInDay - Array of time slots in a day
 * @param {Function} getNegotiationInfoFunc - Function to get negotiation info
 * @returns {Array} - Array of current week negotiations
 */
export const getCurrentWeekNegotiations = (roomData, weekDates, timeSlotsInDay, getNegotiationInfoFunc) => {
  if (!roomData?.negotiations || !weekDates || weekDates.length === 0) return [];

  const currentWeekNegotiations = [];
  const addedNegotiationIds = new Set(); // 중복 방지

  // 각 협의를 한 번만 추가 (병합된 상태로)
  roomData.negotiations.forEach(negotiation => {
    if (negotiation.status !== 'active') return;
    if (addedNegotiationIds.has(negotiation._id)) return;

    // 협의의 날짜가 현재 주에 포함되는지 확인
    const negDate = negotiation.slotInfo?.date;
    if (!negDate) return;

    const negDateStr = new Date(negDate).toISOString().split('T')[0];
    const weekDateInfo = weekDates.find(d => {
      const weekDateStr = new Date(d.fullDate).toISOString().split('T')[0];
      return weekDateStr === negDateStr;
    });

    if (weekDateInfo) {
      addedNegotiationIds.add(negotiation._id);
      currentWeekNegotiations.push({
        ...negotiation,
        dayIndex: weekDates.indexOf(weekDateInfo),
        time: negotiation.slotInfo.startTime,
        date: weekDateInfo.fullDate,
        dayDisplay: weekDateInfo.display
      });
    }
  });

  return currentWeekNegotiations;
};