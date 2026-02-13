/**
 * slotHelpers.js - 시간 슬롯 정보 조회 헬퍼 함수들
 *
 * 📍 위치: DetailTimeGrid/handlers/slotHelpers.js
 * 🔗 연결: ../index.js, ../components/DetailedView.js, ../components/MergedView.js
 */

import { timeToMinutes } from '../utils/timeCalculations';

/**
 * getDateStr - 날짜를 YYYY-MM-DD 형식으로 변환 (로컬 시간 기준)
 */
const getDateStr = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * getSlotInfo - 특정 시간의 선호시간 슬롯 정보 조회
 * 병합/분할 모드 모두 범위 기반 매칭 사용
 */
export const getSlotInfo = (startTime, selectedDate, schedule, mergedSchedule, showMerged) => {
  const dayOfWeek = selectedDate.getDay();
  const dateStr = getDateStr(selectedDate);
  const currentSchedule = showMerged ? mergedSchedule : schedule;

  for (const slot of currentSchedule) {
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
};

/**
 * getExceptionForSlot - 특정 시간의 예외일정 조회
 * ISO 형식과 HH:MM 형식 모두 지원, 범위 기반 매칭
 */
export const getExceptionForSlot = (startTime, selectedDate, exceptions) => {
  const dateStr = getDateStr(selectedDate);
  const [hour, minute] = startTime.split(':').map(Number);
  const slotMinutes = hour * 60 + minute;

  for (const ex of exceptions) {
    if (!ex || !ex.specificDate || !ex.startTime) continue;

    if (ex.specificDate === dateStr) {
      let exStartMinutes, exEndMinutes;

      if (ex.startTime.includes('T')) {
        const exStartTime = new Date(ex.startTime);
        const exEndTime = new Date(ex.endTime);
        exStartMinutes = exStartTime.getHours() * 60 + exStartTime.getMinutes();
        exEndMinutes = exEndTime.getHours() * 60 + exEndTime.getMinutes();
      } else {
        const [exStartHour, exStartMinute] = ex.startTime.split(':').map(Number);
        const [exEndHour, exEndMinute] = ex.endTime.split(':').map(Number);
        exStartMinutes = exStartHour * 60 + exStartMinute;
        exEndMinutes = exEndHour * 60 + exEndMinute;
      }

      if (slotMinutes >= exStartMinutes && slotMinutes < exEndMinutes) {
        return ex;
      }
    }
  }
  return null;
};

/**
 * getPersonalTimeForSlot - 특정 시간의 개인시간 조회
 * overnight(자정 넘김) 지원, 일요일은 7로 변환
 */
export const getPersonalTimeForSlot = (startTime, selectedDate, personalTimes) => {
  const dayOfWeek = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();
  const [hour, minute] = startTime.split(':').map(Number);
  const slotMinutes = hour * 60 + minute;
  const localDateStr = getDateStr(selectedDate);

  for (const pt of personalTimes) {
    let shouldInclude = false;

    if (pt.specificDate) {
      if (pt.specificDate === localDateStr) {
        shouldInclude = true;
      }
    } else if (pt.isRecurring !== false && pt.days && pt.days.includes(dayOfWeek)) {
      shouldInclude = true;
    }

    if (!shouldInclude) continue;

    const [startHour, startMin] = pt.startTime.split(':').map(Number);
    const [endHour, endMin] = pt.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    let endMinutes = endHour * 60 + endMin;

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

/**
 * hasExceptionInTimeRange - 시간 범위 내 '일정' 예외 존재 여부
 */
export const hasExceptionInTimeRange = (selectedDate, exceptions, startHour, endHour) => {
  const dateStr = getDateStr(selectedDate);

  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 10) {
      const hasException = exceptions.some(ex => {
        if (!ex || ex.specificDate !== dateStr || !ex.startTime) return false;
        const [exHour, exMinute] = ex.startTime.split(':').map(Number);
        return exHour === hour && exMinute === minute && ex.title === '일정';
      });
      if (hasException) return true;
    }
  }
  return false;
};

/**
 * removeExceptionsInTimeRange - 시간 범위 내 '일정' 예외 제거
 */
export const removeExceptionsInTimeRange = (selectedDate, exceptions, setExceptions, setHasUnsavedChanges, startHour, endHour) => {
  const dateStr = getDateStr(selectedDate);

  const filteredExceptions = exceptions.filter(ex => {
    const exStartTime = new Date(ex.startTime);
    const exHour = exStartTime.getHours();

    if (ex.specificDate === dateStr &&
        ex.title === '일정' &&
        exHour >= startHour &&
        exHour < endHour) {
      return false;
    }
    return true;
  });

  setExceptions(filteredExceptions);
  setHasUnsavedChanges(true);
};
