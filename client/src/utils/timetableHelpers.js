/**
 * Helper functions for timetable slot management and ownership logic
 */

import { timeToMinutes, minutesToTime } from './timeUtils';
import { safeDateToISOString, getDayIndex } from './dateUtils';
import { DAY_NAMES, DEFAULT_COLORS, NEGOTIATION_STATUS } from './timetableConstants';

// 연속된 시간대 병합 함수
export const mergeConsecutiveTimeSlots = (slots) => {
  if (!slots || slots.length === 0) return [];

  // 날짜와 사용자별로 그룹화
  const groupedSlots = {};

  slots.forEach(slot => {
    const userId = slot.user?._id || slot.user;
    const dateKey = slot.date ? new Date(slot.date).toISOString().split('T')[0] : 'no-date';
    const key = `${userId}-${dateKey}`;

    if (!groupedSlots[key]) {
      groupedSlots[key] = [];
    }
    groupedSlots[key].push(slot);
  });

  const mergedSlots = [];

  Object.values(groupedSlots).forEach(userSlots => {
    const sortedSlots = userSlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    let currentGroup = null;

    for (const slot of sortedSlots) {
      const getUserId = (s) => s.user?._id || s.user;
      if (currentGroup &&
          currentGroup.endTime === slot.startTime &&
          getUserId(currentGroup) === getUserId(slot) &&
          currentGroup.isTravel === slot.isTravel) {
        // 연속된 슬롯이므로 병합
        currentGroup.endTime = slot.endTime;
        currentGroup.isMerged = true;
        if (!currentGroup.originalSlots) {
          currentGroup.originalSlots = [{ ...currentGroup }];
        }
        currentGroup.originalSlots.push(slot);
      } else {
        // 새로운 그룹 시작
        if (currentGroup) {
          mergedSlots.push(currentGroup);
        }
        currentGroup = { ...slot };
        delete currentGroup.isMerged;
        delete currentGroup.originalSlots;
      }
    }

    if (currentGroup) {
      mergedSlots.push(currentGroup);
    }
  });

  return mergedSlots;
};

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
  if (!timeSlots || !time || !date) return null;

  const currentTime = time.trim();
  const currentMinutes = timeToMinutes(currentTime);
  const currentDateStr = date.toISOString().split('T')[0];

  // 1. Check for negotiations first
  const negotiationInfo = getNegotiationInfoFunc(date, time);
  if (negotiationInfo) {
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

  // 2. Find the specific slot for the given time
  const bookedSlot = (timeSlots || []).find(slot => {
    if (!slot || !slot.date || !slot.startTime || !slot.endTime) return false;
    
    const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
    if (slotDateStr !== currentDateStr) return false;

    const startMinutes = timeToMinutes(slot.startTime);
    const endMinutes = timeToMinutes(slot.endTime);
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  });

  // 3. If a slot is found, determine its type and return info
  if (bookedSlot) {
    // Handle travel slots
    if (bookedSlot.isTravel) {
        return {
            name: bookedSlot.subject,
            color: '#20B2AA', // LightSeaGreen (background)
            textColor: '#000000', // Black (text)
            isTravel: true,
            userId: 'travel',
            subject: bookedSlot.subject,
            travelInfo: bookedSlot.travelInfo
        };
    }

    // Handle activity slots
    let userId = bookedSlot.userId || bookedSlot.user;
    if (typeof userId === 'object' && userId !== null) {
      userId = userId._id || userId.id;
    }

    const member = (members || []).find(m => {
      const memberId = m.user?._id?.toString() || m.user?.id?.toString();
      return memberId && userId && memberId === userId.toString();
    });

    if (member) {
      const memberData = member.user || member;
      const memberName = memberData.name || `${memberData.firstName || ''} ${memberData.lastName || ''}`.trim() || '알 수 없음';
      const actualUserId = member.user?._id || member.user?.id || member._id || member.id;

      return {
        name: memberName,
        color: member.color || DEFAULT_COLORS.UNKNOWN_USER,
        userId: userId,
        actualUserId: actualUserId,
        subject: bookedSlot.subject,
        isTravel: false, // Explicitly set
        travelInfo: bookedSlot.travelInfo
      };
    }

    // Fallback for unknown slots
    return {
      name: '알 수 없음',
      color: DEFAULT_COLORS.UNKNOWN_USER,
      userId: null,
      subject: bookedSlot.subject
    };
  }

  // 4. If no slot is found, return null
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

export const mergeDefaultSchedule = (schedule) => {
  if (!schedule || schedule.length === 0) return [];

  const recurringGroups = {};
  const dateGroups = {};

  // 1. Group slots
  schedule.forEach(slot => {
    if (slot.specificDate) {
      if (!dateGroups[slot.specificDate]) dateGroups[slot.specificDate] = [];
      dateGroups[slot.specificDate].push(slot);
    } else {
      if (!recurringGroups[slot.dayOfWeek]) recurringGroups[slot.dayOfWeek] = [];
      recurringGroups[slot.dayOfWeek].push(slot);
    }
  });

  const finalMergedSlots = [];

  // 2. Merge each group
  const mergeGroup = (group) => {
    const sortedSlots = group.sort((a, b) => a.startTime.localeCompare(b.startTime));
    let currentBlock = null;
    for (const slot of sortedSlots) {
      if (currentBlock &&
          currentBlock.priority === slot.priority &&
          currentBlock.endTime === slot.startTime) {
        currentBlock.endTime = slot.endTime;
      } else {
        if (currentBlock) finalMergedSlots.push(currentBlock);
        currentBlock = { ...slot };
      }
    }
    if (currentBlock) finalMergedSlots.push(currentBlock);
  };

  Object.values(recurringGroups).forEach(mergeGroup);
  Object.values(dateGroups).forEach(mergeGroup);

  return finalMergedSlots;
};