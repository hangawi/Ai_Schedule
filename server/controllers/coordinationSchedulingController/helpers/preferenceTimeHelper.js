// 선호시간 관리 헬퍼
const { timeToMinutes, minutesToTime, getDayOfWeekNumber } = require('../utils/timeUtils');

/**
 * 선호시간에서 배정된 부분만 제거하고 나머지는 분할하여 유지 + 백업
 * @param {Object} user - 사용자 객체
 * @param {Array} slots - 슬롯 배열
 * @param {string} roomId - 방 ID
 */
const removePreferenceTimes = (user, slots, roomId) => {
  const deletedTimes = [];
  const newDefaultSchedule = [];

  // 1. 슬롯을 날짜별로 그룹화하고 개별 시간 범위 저장 (병합하지 않음)
  const assignedRangesByDate = {};

  slots.forEach(slot => {
    const dateStr = slot.date.toISOString().split('T')[0];
    const dayOfWeek = getDayOfWeekNumber(slot.day);

    if (!assignedRangesByDate[dateStr]) {
      assignedRangesByDate[dateStr] = {
        dateStr,
        dayOfWeek,
        ranges: [] // 개별 범위들을 배열로 저장
      };
    }

    assignedRangesByDate[dateStr].ranges.push({
      start: timeToMinutes(slot.startTime),
      end: timeToMinutes(slot.endTime)
    });
  });

  // 2. 각 선호시간을 확인하고 배정 범위와 겹치면 분할
  if (user.defaultSchedule) {
    user.defaultSchedule.forEach(schedule => {
      const scheduleDayOfWeek = schedule.dayOfWeek === 0 ? 7 : schedule.dayOfWeek;

      // 이 선호시간과 겹치는 배정 범위들 찾기
      const prefStart = timeToMinutes(schedule.startTime);
      const prefEnd = timeToMinutes(schedule.endTime);
      const scheduleDayOfWeekForMatch = schedule.dayOfWeek === 0 ? 7 : schedule.dayOfWeek;

      let matchingDateRanges = null;

      for (const [dateStr, dateData] of Object.entries(assignedRangesByDate)) {
        const matches = schedule.specificDate
          ? schedule.specificDate === dateStr
          : scheduleDayOfWeekForMatch === dateData.dayOfWeek;

        if (matches) {
          matchingDateRanges = dateData;
          break;
        }
      }

      if (!matchingDateRanges) {
        // 배정과 겹치지 않으면 그대로 유지
        newDefaultSchedule.push(schedule);
      } else {
        // 배정 범위들과 겹침 확인 및 분할 처리
        let currentSegments = [{ start: prefStart, end: prefEnd }];

        // 각 배정 범위에 대해 겹치는 부분 제거
        for (const assignedRange of matchingDateRanges.ranges) {
          const newSegments = [];

          for (const segment of currentSegments) {
            const overlapStart = Math.max(segment.start, assignedRange.start);
            const overlapEnd = Math.min(segment.end, assignedRange.end);

            if (overlapStart < overlapEnd) {
              // 실제로 겹침 - 백업에 추가
              deletedTimes.push({
                dayOfWeek: schedule.dayOfWeek,
                startTime: minutesToTime(overlapStart),
                endTime: minutesToTime(overlapEnd),
                priority: schedule.priority,
                specificDate: schedule.specificDate
              });

              // 세그먼트 분할
              if (segment.start < assignedRange.start) {
                newSegments.push({ start: segment.start, end: assignedRange.start });
              }
              if (segment.end > assignedRange.end) {
                newSegments.push({ start: assignedRange.end, end: segment.end });
              }
            } else {
              // 겹치지 않으면 그대로 유지
              newSegments.push(segment);
            }
          }

          currentSegments = newSegments;
        }

        // 남은 세그먼트들을 새 선호시간으로 추가
        for (const segment of currentSegments) {
          newDefaultSchedule.push({
            dayOfWeek: schedule.dayOfWeek,
            startTime: minutesToTime(segment.start),
            endTime: minutesToTime(segment.end),
            priority: schedule.priority,
            specificDate: schedule.specificDate
          });
        }
      }
    });

    // 분할된 새 선호시간으로 교체
    user.defaultSchedule = newDefaultSchedule;
  }

  // scheduleExceptions에서 해당 날짜 삭제 (기존 로직 유지)
  if (user.scheduleExceptions) {
    slots.forEach(slot => {
      const dateStr = slot.date.toISOString().split('T')[0];
      user.scheduleExceptions = user.scheduleExceptions.filter(exception => {
        if (exception.specificDate) {
          return exception.specificDate !== dateStr;
        }
        return true;
      });
    });
  }

  // 백업된 삭제 시간을 user.deletedPreferencesByRoom에 저장
  if (deletedTimes.length > 0) {
    if (!user.deletedPreferencesByRoom) {
      user.deletedPreferencesByRoom = [];
    }

    // 기존에 이 방에 대한 백업이 있으면 제거 (새로 덮어쓰기)
    user.deletedPreferencesByRoom = user.deletedPreferencesByRoom.filter(
      item => item.roomId.toString() !== roomId.toString()
    );

    // 새 백업 추가
    user.deletedPreferencesByRoom.push({
      roomId: roomId,
      deletedTimes: deletedTimes,
      deletedAt: new Date()
    });
  }
};

module.exports = {
  removePreferenceTimes,
};
