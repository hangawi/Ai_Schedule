/**
 * conflictUtils.js - 시간 충돌/겹침 체크 유틸리티
 *
 * 📍 위치: services/travelSchedule/conflictUtils.js
 * 🔗 연결: ../travelScheduleCalculator.js (index.js)
 */

import { parseTime } from './timeUtils';

export const checkOverlap = (date, startMinutes, endMinutes, assignedSlotsByDate) => {
  const slotsOnDate = assignedSlotsByDate[date] || [];

  for (const slot of slotsOnDate) {
    // 시간이 겹치는지 체크
    if (startMinutes < slot.endMinutes && endMinutes > slot.startMinutes) {
      return true; // 겹침
    }
  }

  return false; // 겹치지 않음
};

export const checkBlockedTimeConflict = (startMinutes, endMinutes, blockedTimes) => {
  for (const blocked of blockedTimes) {
    const blockedStart = parseTime(blocked.startTime);
    const blockedEnd = parseTime(blocked.endTime);

    // 겹침 체크
    if (startMinutes < blockedEnd && endMinutes > blockedStart) {
      return { conflict: true, blockedTime: blocked };
    }
  }

  return { conflict: false };
};
