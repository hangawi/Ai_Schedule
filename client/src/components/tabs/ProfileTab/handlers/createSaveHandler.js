// 저장 핸들러 팩토리

import { userService } from '../../../../services/userService';
import { MESSAGES, TITLES } from '../constants/messages';

export const createSaveHandler = (
  defaultSchedule,
  scheduleExceptions,
  personalTimes,
  setIsEditing,
  setDefaultSchedule,
  setScheduleExceptions,
  setPersonalTimes,
  setError,
  showAlert
) => {
  return async () => {
    // defaultSchedule은 그대로 저장 (specificDate 포함)
    const scheduleToSave = defaultSchedule.map(s => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      priority: s.priority || 2,
      specificDate: s.specificDate
    }));

    // scheduleExceptions도 그대로 저장
    const exceptionsToSave = scheduleExceptions.map(
      ({ title, startTime, endTime, isHoliday, isAllDay, _id, specificDate, priority }) =>
      ({ title, startTime, endTime, isHoliday, isAllDay, _id, specificDate, priority })
    );

    const personalTimesToSave = personalTimes.map(
      ({ title, type, startTime, endTime, days, isRecurring, id, specificDate, color }) => {
        return { title, type, startTime, endTime, days, isRecurring, id, specificDate, color };
      }
    );

    try {
      await userService.updateUserSchedule({
        defaultSchedule: scheduleToSave,
        scheduleExceptions: exceptionsToSave,
        personalTimes: personalTimesToSave
      });
      showAlert(MESSAGES.SAVE_SUCCESS, TITLES.SAVE_COMPLETE);
      setIsEditing(false);

      // 저장 후 서버에서 최신 데이터 동기화
      const freshData = await userService.getUserSchedule();

      // UI 깜박임 방지: 데이터가 실제로 변경된 경우만 상태 업데이트
      if (JSON.stringify(freshData.defaultSchedule || []) !== JSON.stringify(defaultSchedule)) {
        setDefaultSchedule(freshData.defaultSchedule || []);
      }
      if (JSON.stringify(freshData.scheduleExceptions || []) !== JSON.stringify(scheduleExceptions)) {
        setScheduleExceptions(freshData.scheduleExceptions || []);
      }
      if (JSON.stringify(freshData.personalTimes || []) !== JSON.stringify(personalTimes)) {
        setPersonalTimes(freshData.personalTimes || []);
      }

      // CalendarView 강제 리렌더링
      window.dispatchEvent(new Event('calendarUpdate'));

    } catch (err) {
      setError(err.message);
      showAlert(MESSAGES.SAVE_ERROR + err.message, TITLES.ERROR);
    }
  };
};
