import { timeToMinutes } from '../utils/timeCalculations';
import { getDateString } from '../utils/dateFormatters';

// 슬롯 정보 조회 함수들

export const getSlotInfo = (startTime, selectedDate, schedule, mergedSchedule, showMerged) => {
  const dayOfWeek = selectedDate.getDay();
  const dateStr = getDateString(selectedDate);
  const currentSchedule = showMerged ? mergedSchedule : schedule;

  if (showMerged) {
    // 병합 모드에서는 해당 시간이 병합된 슬롯에 포함되는지 확인
    for (const slot of currentSchedule) {
      // specificDate가 있으면 날짜도 비교, 없으면 dayOfWeek만 비교
      const dateMatches = slot.specificDate ? slot.specificDate === dateStr : slot.dayOfWeek === dayOfWeek;

      if (dateMatches) {
        const slotStartMinutes = timeToMinutes(slot.startTime);
        const slotEndMinutes = timeToMinutes(slot.endTime);
        const currentTimeMinutes = timeToMinutes(startTime);

        if (currentTimeMinutes >= slotStartMinutes && currentTimeMinutes < slotEndMinutes) {
          return slot;
        }
      }
    }
    return null;
  } else {
    return currentSchedule.find(
      s => {
        const dateMatches = s.specificDate ? s.specificDate === dateStr : s.dayOfWeek === dayOfWeek;
        return dateMatches && s.startTime === startTime;
      }
    );
  }
};

export const getExceptionForSlot = (startTime, selectedDate, exceptions) => {
  const dateStr = getDateString(selectedDate);
  const [hour, minute] = startTime.split(':').map(Number);

  for (const ex of exceptions) {
    // 유효하지 않은 데이터 필터링
    if (!ex || !ex.specificDate || !ex.startTime) continue;

    // specificDate 필드를 사용해야 함
    const exDateStr = ex.specificDate;

    if (exDateStr === dateStr) {
      // startTime이 ISO 형식인 경우와 "HH:MM" 형식인 경우를 모두 처리
      let exStartHour, exStartMinute;

      if (ex.startTime.includes('T')) {
        // ISO 형식 (예: "2025-09-26T10:00:00.000Z")
        const exStartTime = new Date(ex.startTime);
        exStartHour = exStartTime.getHours();
        exStartMinute = exStartTime.getMinutes();
      } else {
        // "HH:MM" 형식
        [exStartHour, exStartMinute] = ex.startTime.split(':').map(Number);
      }

      if (hour === exStartHour && minute === exStartMinute) {
        return ex;
      }
    }
  }
  return null;
};

export const getPersonalTimeForSlot = (startTime, selectedDate, personalTimes) => {
  const dayOfWeek = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();
  const [hour, minute] = startTime.split(':').map(Number);
  const slotMinutes = hour * 60 + minute;

  for (const pt of personalTimes) {
    let shouldInclude = false;

    // specificDate가 있으면 날짜가 일치하는지만 체크
    if (pt.specificDate) {
      const dateStr = getDateString(selectedDate);

      if (pt.specificDate === dateStr) {
        shouldInclude = true;
      }
    }
    // specificDate가 없으면 반복되는 개인시간 체크
    else if (pt.isRecurring !== false && pt.days && pt.days.includes(dayOfWeek)) {
      shouldInclude = true;
    }

    if (!shouldInclude) {
      continue;
    }

    const [startHour, startMin] = pt.startTime.split(':').map(Number);
    const [endHour, endMin] = pt.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    let endMinutes = endHour * 60 + endMin;

    // 수면시간과 같은 overnight 시간 처리
    if (endMinutes <= startMinutes) {
      endMinutes += 24 * 60;
      if (slotMinutes >= startMinutes || slotMinutes < (endMinutes - 24 * 60)) {
        return pt;
      }
    } else {
      if (slotMinutes >= startMinutes && slotMinutes < endMinutes) {
        return pt;
      }
    }
  }
  return null;
};

// 특정 시간대에 예외가 있는지 확인하는 함수
export const hasExceptionInTimeRange = (selectedDate, exceptions, startHour, endHour) => {
  const dateStr = getDateString(selectedDate);

  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 10) {
      const hasException = exceptions.some(ex => {
        // specificDate로 날짜 비교, startTime으로 시간 비교
        if (!ex || ex.specificDate !== dateStr || !ex.startTime) return false;

        const [exHour, exMinute] = ex.startTime.split(':').map(Number);
        return exHour === hour && exMinute === minute && ex.title === '일정';
      });
      if (hasException) return true;
    }
  }
  return false;
};
