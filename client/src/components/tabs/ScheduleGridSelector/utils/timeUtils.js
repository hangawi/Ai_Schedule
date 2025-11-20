import { TIME_SLOT_INTERVAL } from '../constants/scheduleConstants';

/**
 * 시간 문자열을 분으로 변환
 * @param {string} timeString - "HH:MM" 형식의 시간
 * @returns {number} 분 단위 시간
 */
export const timeToMinutes = (timeString) => {
  if (!timeString || !timeString.includes(':')) return 0;
  const [hour, minute] = timeString.split(':').map(Number);
  return hour * 60 + minute;
};

/**
 * 분을 시간 문자열로 변환
 * @param {number} minutes - 분 단위 시간
 * @returns {string} "HH:MM" 형식의 시간
 */
export const minutesToTime = (minutes) => {
  const hour = Math.floor(minutes / 60);
  const min = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

/**
 * 시간 슬롯 배열 생성
 * @param {number} startHour - 시작 시간 (기본값: 0)
 * @param {number} endHour - 종료 시간 (기본값: 24)
 * @returns {string[]} 시간 슬롯 배열
 */
export const generateTimeSlots = (startHour = 0, endHour = 24) => {
  const slots = [];
  // 24:00 이후 생성 방지: h < endHour 사용
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += TIME_SLOT_INTERVAL) {
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      slots.push(time);
    }
  }
  return slots;
};

/**
 * 해당 주의 일요일 날짜 계산
 * @param {Date} date - 기준 날짜
 * @returns {Date} 해당 주의 일요일
 */
export const getSundayOfCurrentWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  // 현재 날짜에서 요일만큼 빼서 해당 주의 일요일을 구함
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * 블록의 종료 시간 계산
 * @param {Object} block - 시간 블록 객체 (startTime, duration 포함)
 * @returns {string} "HH:MM" 형식의 종료 시간
 */
export const getEndTimeForBlock = (block) => {
  const startMinutes = timeToMinutes(block.startTime);
  const endMinutes = startMinutes + block.duration;
  return minutesToTime(endMinutes);
};

/**
 * 두 시간이 연속되는지 확인
 * @param {string} endTime1 - 첫 번째 시간의 종료 시간
 * @param {string} startTime2 - 두 번째 시간의 시작 시간
 * @returns {boolean} 연속 여부
 */
export const areTimesConsecutive = (endTime1, startTime2) => {
  return endTime1 === startTime2;
};

/**
 * 시간 범위가 자정을 넘는지 확인
 * @param {string} startTime - 시작 시간
 * @param {string} endTime - 종료 시간
 * @returns {boolean} 자정 넘김 여부
 */
export const crossesMidnight = (startTime, endTime) => {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  return endMinutes <= startMinutes;
};

/**
 * 특정 시간이 시간 범위 내에 있는지 확인
 * @param {string} time - 확인할 시간
 * @param {string} startTime - 범위 시작 시간
 * @param {string} endTime - 범위 종료 시간
 * @returns {boolean} 범위 내 포함 여부
 */
export const isTimeInRange = (time, startTime, endTime) => {
  const timeMinutes = timeToMinutes(time);
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  // 자정을 넘나드는 시간인지 확인
  if (endMinutes <= startMinutes) {
    // 예: 22:00~08:00의 경우
    return timeMinutes >= startMinutes || timeMinutes < endMinutes;
  } else {
    // 일반적인 하루 내 시간
    return timeMinutes >= startMinutes && timeMinutes < endMinutes;
  }
};
