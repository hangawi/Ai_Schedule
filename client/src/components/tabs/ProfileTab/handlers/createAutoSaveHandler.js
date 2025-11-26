// 자동 저장 핸들러 팩토리

import { userService } from '../../../../services/userService';

export const createAutoSaveHandler = (
  isEditing,
  justCancelled,
  defaultSchedule,
  scheduleExceptions,
  personalTimes
) => {
  return async () => {
    // 편집 모드이거나 방금 취소한 상태일 때는 자동 저장하지 않음
    if (isEditing || justCancelled) {
      return;
    }

    try {
      // defaultSchedule은 그대로 저장 (specificDate 포함)
      const scheduleToSave = defaultSchedule.map(s => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        priority: s.priority || 2,
        specificDate: s.specificDate
      }));

      const exceptionsToSave = scheduleExceptions.map(
        ({ title, startTime, endTime, isHoliday, isAllDay, _id, specificDate, priority }) =>
        ({ title, startTime, endTime, isHoliday, isAllDay, _id, specificDate, priority })
      );

      const personalTimesToSave = personalTimes.map(
        ({ title, type, startTime, endTime, days, isRecurring, id, specificDate, color }) => {
          return { title, type, startTime, endTime, days, isRecurring, id, specificDate, color };
        }
      );

      await userService.updateUserSchedule({
        defaultSchedule: scheduleToSave,
        scheduleExceptions: exceptionsToSave,
        personalTimes: personalTimesToSave
      });

    } catch (err) {
      // 자동 저장 실패는 무시
    }
  };
};
