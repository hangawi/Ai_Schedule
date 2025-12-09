/**
 * 시간 관련 유틸리티 함수
 */

const { MINUTES_PER_SLOT, MINUTES_PER_HOUR, FOCUS_TIME_RANGES } = require('../constants/timeConstants');

/**
 * 시작 시간에 30분을 추가하여 종료 시간 계산
 * @param {string} startTime - HH:MM 형식의 시작 시간
 * @returns {string} HH:MM 형식의 종료 시간
 */
const calculateEndTime = (startTime) => {
  const [h, m] = startTime.split(':').map(Number);
  const totalMinutes = h * MINUTES_PER_HOUR + m + MINUTES_PER_SLOT;
  const endHour = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const endMinute = totalMinutes % MINUTES_PER_HOUR;
  return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
};

/**
 * 시간 문자열을 분으로 변환
 * @param {string} timeStr - HH:MM 형식의 시간
 * @returns {number} 분 단위 시간
 */
const timeToMinutes = (timeStr) => {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * MINUTES_PER_HOUR + m;
};

/**
 * 분을 시간 문자열로 변환
 * @param {number} minutes - 분 단위 시간
 * @returns {string} HH:MM 형식의 시간
 */
const minutesToTime = (minutes) => {
  const hour = Math.floor(minutes / MINUTES_PER_HOUR) % 24;
  const min = minutes % MINUTES_PER_HOUR;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

/**
 * 시간 문자열을 시간(hour) 숫자로 변환
 * @param {string} timeStr - HH:MM 형식의 시간
 * @returns {number} 시간(hour)
 */
const getHourFromTime = (timeStr) => {
  if (!timeStr) return 0;
  const [h] = timeStr.split(':').map(Number);
  return h;
};

/**
 * 설정값에서 시간(hour) 추출
 * @param {string|number} setting - 설정값 (string '09:00' 또는 number 9)
 * @param {string} defaultValue - 기본값
 * @returns {number} 시간(hour)
 */
const getHourFromSettings = (setting, defaultValue) => {
  if (!setting) return parseInt(defaultValue, 10);
  if (typeof setting === 'string') return parseInt(String(setting).split(':')[0], 10);
  if (typeof setting === 'number') return setting;
  return parseInt(defaultValue, 10);
};

/**
 * 시간대가 유효한 30분 단위인지 확인
 * @param {string} timeStr - HH:MM 형식의 시간
 * @returns {boolean}
 */
const isValidSlotTime = (timeStr) => {
  if (!timeStr) return false;
  const minute = parseInt(timeStr.split(':')[1]);
  return minute === 0 || minute === 30;
};

/**
 * 집중 시간대에 해당하는지 확인
 * @param {string} time - HH:MM 형식의 시간
 * @param {string} focusTimeType - 집중 시간 타입 (morning, lunch, afternoon, evening, none)
 * @returns {boolean}
 */
const isInPreferredTime = (time, focusTimeType) => {
  if (!focusTimeType || focusTimeType === 'none') {
    return false;
  }

  const range = FOCUS_TIME_RANGES[focusTimeType];
  if (!range) return false;

  const [hour] = time.split(':').map(Number);
  return hour >= range.start && hour < range.end;
};

/**
 * 시간 문자열 포맷팅 (HH:MM 형식으로 표준화)
 * @param {string} timeRaw - 원본 시간 문자열
 * @returns {string} HH:MM 형식의 시간
 */
const formatTimeString = (timeRaw) => {
  if (!timeRaw) return '00:00';

  if (!timeRaw.includes(':')) {
    return `${String(timeRaw).padStart(2, '0')}:00`;
  }

  const parts = timeRaw.split(':');
  if (parts[1] === undefined) {
    return `${timeRaw}00`;
  }

  return timeRaw;
};

/**
 * 두 시간대가 겹치는지 확인
 * @param {string} start1 - 첫 번째 시간대 시작
 * @param {string} end1 - 첫 번째 시간대 종료
 * @param {string} start2 - 두 번째 시간대 시작
 * @param {string} end2 - 두 번째 시간대 종료
 * @returns {boolean}
 */
const isTimeOverlapping = (start1, end1, start2, end2) => {
  return !(end1 <= start2 || end2 <= start1);
};

/**
 * 시간 범위의 총 분 계산
 * @param {string} startTime - 시작 시간
 * @param {string} endTime - 종료 시간
 * @returns {number} 총 분
 */
const calculateDurationMinutes = (startTime, endTime) => {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  return endMinutes - startMinutes;
};

/**
 * 시간 범위의 슬롯 수 계산
 * @param {string} startTime - 시작 시간
 * @param {string} endTime - 종료 시간
 * @returns {number} 슬롯 수
 */
const calculateSlotCount = (startTime, endTime) => {
  return calculateDurationMinutes(startTime, endTime) / MINUTES_PER_SLOT;
};

/**
 * 예외시간(개인시간)과 충돌하는지 확인
 * @param {string} startTime - 시작 시간 (HH:MM)
 * @param {string} endTime - 종료 시간 (HH:MM)
 * @param {Array} personalTimes - 개인시간 배열 [{startTime, endTime, type}]
 * @param {string} dayOfWeek - 요일 (월, 화, 수 등)
 * @returns {Object|null} 충돌하는 개인시간 객체 또는 null
 */
const findConflictingPersonalTime = (startTime, endTime, personalTimes, dayOfWeek) => {
  if (!personalTimes || personalTimes.length === 0) return null;

  for (const personalTime of personalTimes) {
    // 해당 요일에 적용되는 개인시간인지 확인
    if (personalTime.days && !personalTime.days.includes(dayOfWeek)) continue;

    const ptStart = personalTime.startTime;
    const ptEnd = personalTime.endTime;

    // 시간 충돌 확인
    if (isTimeOverlapping(startTime, endTime, ptStart, ptEnd)) {
      return personalTime;
    }
  }

  return null;
};

/**
 * 예외시간 이후의 다음 가능한 시작 시간 찾기
 * @param {string} arrivalTime - 도착 시간 (HH:MM)
 * @param {number} classDurationMinutes - 수업 시간 (분)
 * @param {Array} personalTimes - 개인시간 배열
 * @param {string} dayOfWeek - 요일
 * @param {string} preferenceEnd - 선호시간 종료 (HH:MM)
 * @returns {Object} { startTime, endTime, waitTime } 또는 { impossible: true }
 */
const findNextAvailableSlot = (
  arrivalTime,
  classDurationMinutes,
  personalTimes,
  dayOfWeek,
  preferenceEnd
) => {
  const arrivalMinutes = timeToMinutes(arrivalTime);
  const classEndMinutes = arrivalMinutes + classDurationMinutes;
  const classEndTime = minutesToTime(classEndMinutes);

  // 1. 도착시간부터 바로 시작 가능한지 확인
  const conflict = findConflictingPersonalTime(arrivalTime, classEndTime, personalTimes, dayOfWeek);

  if (!conflict) {
    // 충돌 없음 - 바로 배정 가능
    const prefEndMinutes = timeToMinutes(preferenceEnd);
    if (classEndMinutes <= prefEndMinutes) {
      return {
        startTime: arrivalTime,
        endTime: classEndTime,
        waitTime: 0
      };
    } else {
      // 선호시간 초과
      return { impossible: true, reason: '선호시간 초과' };
    }
  }

  // 2. 충돌 있음 - 예외시간 이후로 이동
  const afterExceptionMinutes = timeToMinutes(conflict.endTime);
  const newEndMinutes = afterExceptionMinutes + classDurationMinutes;
  const prefEndMinutes = timeToMinutes(preferenceEnd);

  if (newEndMinutes <= prefEndMinutes) {
    // 예외시간 이후 배정 가능
    return {
      startTime: conflict.endTime,
      endTime: minutesToTime(newEndMinutes),
      waitTime: afterExceptionMinutes - arrivalMinutes
    };
  } else {
    // 예외시간 이후도 선호시간 초과
    return { impossible: true, reason: '예외시간 이후 선호시간 부족' };
  }
};

/**
 * 이동시간 + 수업시간이 선호시간 및 예외시간을 고려하여 적합한지 확인
 * @param {string} currentEndTime - 현재 수업 종료 시간 (HH:MM)
 * @param {number} travelTimeMinutes - 이동 시간 (분)
 * @param {number} classDurationMinutes - 수업 시간 (분)
 * @param {string} preferenceStart - 선호시간 시작 (HH:MM)
 * @param {string} preferenceEnd - 선호시간 종료 (HH:MM)
 * @param {Array} personalTimes - 개인시간 배열
 * @param {string} dayOfWeek - 요일
 * @returns {Object} { isValid: boolean, slot?: {startTime, endTime, waitTime}, reason?: string }
 */
const validateTimeSlotWithTravel = (
  currentEndTime,
  travelTimeMinutes,
  classDurationMinutes,
  preferenceStart,
  preferenceEnd,
  personalTimes,
  dayOfWeek
) => {
  // 1. 도착 시간 계산
  const currentEndMinutes = timeToMinutes(currentEndTime);
  const arrivalMinutes = currentEndMinutes + travelTimeMinutes;
  const arrivalTime = minutesToTime(arrivalMinutes);

  // 2. 선호시간 시작 이전 도착 확인
  const prefStartMinutes = timeToMinutes(preferenceStart);
  if (arrivalMinutes < prefStartMinutes) {
    // 선호시간 시작 이전 도착 → 선호시간 시작부터 배정
    const actualStartTime = preferenceStart;
    const result = findNextAvailableSlot(
      actualStartTime,
      classDurationMinutes,
      personalTimes,
      dayOfWeek,
      preferenceEnd
    );

    if (result.impossible) {
      return { isValid: false, reason: result.reason };
    }

    return { isValid: true, slot: result };
  }

  // 3. 선호시간 내 도착 → 예외시간 확인
  const result = findNextAvailableSlot(
    arrivalTime,
    classDurationMinutes,
    personalTimes,
    dayOfWeek,
    preferenceEnd
  );

  if (result.impossible) {
    return { isValid: false, reason: result.reason };
  }

  return { isValid: true, slot: result };
};

module.exports = {
  calculateEndTime,
  timeToMinutes,
  minutesToTime,
  getHourFromTime,
  getHourFromSettings,
  isValidSlotTime,
  isInPreferredTime,
  formatTimeString,
  isTimeOverlapping,
  calculateDurationMinutes,
  calculateSlotCount,
  findConflictingPersonalTime,
  findNextAvailableSlot,
  validateTimeSlotWithTravel
};
