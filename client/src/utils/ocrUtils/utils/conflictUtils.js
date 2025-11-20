/**
 * 시간표 충돌 감지 유틸리티
 */

import { parseTime } from './timeUtils';

/**
 * 시간표 충돌 감지
 * @param {Array} schedules - 시간표 배열
 * @returns {Array} - 충돌하는 시간표 쌍들의 배열
 */
export const detectConflicts = (schedules) => {
  const conflicts = [];

  for (let i = 0; i < schedules.length; i++) {
    for (let j = i + 1; j < schedules.length; j++) {
      const schedule1 = schedules[i];
      const schedule2 = schedules[j];

      // 같은 요일에 겹치는지 확인
      const commonDays = schedule1.days?.filter(day =>
        schedule2.days?.includes(day)
      );

      if (commonDays && commonDays.length > 0) {
        // 시간이 겹치는지 확인
        const start1 = parseTime(schedule1.startTime);
        const end1 = parseTime(schedule1.endTime);
        const start2 = parseTime(schedule2.startTime);
        const end2 = parseTime(schedule2.endTime);

        if (start1 && end1 && start2 && end2) {
          const time1Start = start1.hour * 60 + start1.minute;
          const time1End = end1.hour * 60 + end1.minute;
          const time2Start = start2.hour * 60 + start2.minute;
          const time2End = end2.hour * 60 + end2.minute;

          // 시간 겹침 체크
          if (time1Start < time2End && time1End > time2Start) {
            conflicts.push({
              schedule1: schedule1,
              schedule2: schedule2,
              conflictDays: commonDays
            });
          }
        }
      }
    }
  }

  return conflicts;
};
