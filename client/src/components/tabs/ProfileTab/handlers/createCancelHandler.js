// 취소 핸들러 팩토리

import { userService } from '../../../../services/userService';

export const createCancelHandler = (
  initialState,
  setDefaultSchedule,
  setScheduleExceptions,
  setPersonalTimes,
  setIsEditing,
  setWasCleared,
  setJustCancelled
) => {
  return async () => {
    // 편집 모드 진입 시 저장된 초기 상태로 복원
    setDefaultSchedule([...initialState.defaultSchedule]);
    setScheduleExceptions([...initialState.scheduleExceptions]);
    setPersonalTimes([...initialState.personalTimes]);

    try {
      // 서버에도 초기 상태로 복원
      const exceptionsToRestore = initialState.scheduleExceptions.map(
        ({ title, startTime, endTime, isHoliday, isAllDay, _id, specificDate, priority }) =>
        ({ title, startTime, endTime, isHoliday, isAllDay, _id, specificDate, priority })
      );
      const personalTimesToRestore = initialState.personalTimes.map(
        ({ title, type, startTime, endTime, days, isRecurring, id, specificDate, color }) => {
          return { title, type, startTime, endTime, days, isRecurring, id, specificDate, color };
        }
      );

      await userService.updateUserSchedule({
        defaultSchedule: initialState.defaultSchedule,
        scheduleExceptions: exceptionsToRestore,
        personalTimes: personalTimesToRestore
      });
    } catch (err) {
      // 서버 복원 실패해도 UI는 복원된 상태로 유지
    }

    setIsEditing(false);
    setWasCleared(false); // 초기화 상태도 리셋
    setJustCancelled(true);

    // 일정 시간 후 취소 상태 해제
    setTimeout(() => {
      setJustCancelled(false);
    }, 1000);
  };
};
