/**
 * ============================================================================
 * timeUtils.js - Time Parsing and Calculation Utilities
 * ============================================================================
 */

/**
 * 시간 파싱 함수 (오후 3시, 3pm, 15:00 등 다양한 형식 지원)
 */
export const parseTime = (timeStr) => {
  // "오후 3시" 형식
  const koreanTimeMatch = timeStr.match(/(오전|오후)\s*(\d+)시?\s*(\d+)?분?/);
  if (koreanTimeMatch) {
    let hour = parseInt(koreanTimeMatch[2]);
    const minute = koreanTimeMatch[3] ? parseInt(koreanTimeMatch[3]) : 0;
    if (koreanTimeMatch[1] === '오후' && hour !== 12) hour += 12;
    if (koreanTimeMatch[1] === '오전' && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  // "3pm", "3PM" 형식
  const pmMatch = timeStr.match(/(\d+)\s*(pm|PM)/);
  if (pmMatch) {
    let hour = parseInt(pmMatch[1]);
    if (hour !== 12) hour += 12;
    return `${hour.toString().padStart(2, '0')}:00`;
  }

  // "3am", "3AM" 형식
  const amMatch = timeStr.match(/(\d+)\s*(am|AM)/);
  if (amMatch) {
    let hour = parseInt(amMatch[1]);
    if (hour === 12) hour = 0;
    return `${hour.toString().padStart(2, '0')}:00`;
  }

  // "14:40", "14시 40분" 형식
  const timeMatch = timeStr.match(/(\d+)[시:]?\s*(\d+)?분?/);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1]);
    const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  return null;
};

/**
 * 시간표 데이터에서 최소/최대 시간 추출
 */
export const getTimeRange = (currentCombination, personalTimes) => {
  let minHour = 24;
  let maxHour = 0;

  const allSchedules = [...currentCombination, ...personalTimes];

  allSchedules.forEach(schedule => {
    if (schedule.startTime) {
      const startHour = parseInt(schedule.startTime.split(':')[0]);
      minHour = Math.min(minHour, startHour);
    }
    if (schedule.endTime) {
      const endHour = parseInt(schedule.endTime.split(':')[0]);
      const endMinute = parseInt(schedule.endTime.split(':')[1]);
      maxHour = Math.max(maxHour, endMinute > 0 ? endHour + 1 : endHour);
    }
  });

  if (minHour === 24) minHour = 9;
  if (maxHour === 0) maxHour = 18;

  return { start: minHour, end: maxHour };
};

/**
 * 시간 차이 계산 (분 단위)
 */
export const calculateTimeDifference = (oldTime, newTime) => {
  const [oldHour, oldMin] = oldTime.split(':').map(Number);
  const [newHour, newMin] = newTime.split(':').map(Number);
  const oldMinutes = oldHour * 60 + oldMin;
  const newMinutes = newHour * 60 + newMin;
  return newMinutes - oldMinutes;
};

/**
 * 종료 시간 계산 (시작 시간 + duration)
 */
export const calculateEndTime = (startTime, durationMinutes) => {
  const [hour, min] = startTime.split(':').map(Number);
  const endMinutes = hour * 60 + min + durationMinutes;
  const endHour = Math.floor(endMinutes / 60);
  const endMin = endMinutes % 60;
  return `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
};

/**
 * 시간에 분 단위 차이 적용
 */
export const adjustTimeByMinutes = (time, minutesDiff) => {
  const [hour, min] = time.split(':').map(Number);
  const totalMinutes = hour * 60 + min + minutesDiff;
  const newHour = Math.floor(totalMinutes / 60);
  const newMin = totalMinutes % 60;
  return `${newHour.toString().padStart(2, '0')}:${newMin.toString().padStart(2, '0')}`;
};
