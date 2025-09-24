import { timeToMinutes } from './timeUtils';

// 연속된 시간대 병합 함수
export const mergeConsecutiveTimeSlots = (schedule) => {
  if (!schedule || schedule.length === 0) return [];

  const sortedSchedule = [...schedule].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return a.startTime.localeCompare(b.startTime);
  });

  const merged = [];
  let currentGroup = null;

  for (const slot of sortedSchedule) {
    if (currentGroup &&
        currentGroup.dayOfWeek === slot.dayOfWeek &&
        currentGroup.priority === slot.priority &&
        currentGroup.endTime === slot.startTime) {
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
        merged.push(currentGroup);
      }
      currentGroup = { ...slot };
    }
  }

  if (currentGroup) {
    merged.push(currentGroup);
  }

  return merged;
};

// 시간대 범위에 예외가 있는지 확인
export const hasExceptionInTimeRange = (exceptions, selectedDate, startHour, endHour) => {
  if (!exceptions || !selectedDate) return false;

  const year = selectedDate.getFullYear();
  const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
  const day = String(selectedDate.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  return exceptions.some(ex => {
    if (!ex || ex.specificDate !== dateStr || !ex.startTime) return false;

    const exceptionDate = new Date(ex.startTime);
    const exceptionHour = exceptionDate.getHours();

    return exceptionHour >= startHour && exceptionHour < endHour;
  });
};

// 특정 시간에 대한 예외 찾기
export const getExceptionForSlot = (exceptions, selectedDate, startTime) => {
  const year = selectedDate.getFullYear();
  const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
  const day = String(selectedDate.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  const [hour, minute] = startTime.split(':').map(Number);

  for (const ex of exceptions) {
    if (!ex || !ex.specificDate || !ex.startTime) continue;

    const exDateStr = ex.specificDate;
    if (exDateStr === dateStr) {
      const exceptionDate = new Date(ex.startTime);
      const exceptionHour = exceptionDate.getHours();
      const exceptionMinute = exceptionDate.getMinutes();

      if (exceptionHour === hour && exceptionMinute === minute) {
        return ex;
      }
    }
  }
  return null;
};