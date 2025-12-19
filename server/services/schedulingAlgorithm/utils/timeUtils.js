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
  // 10분 단위 허용: 0, 10, 20, 30, 40, 50
  return minute % 10 === 0;
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
 * 방 레벨 금지시간을 personalTimes 형식으로 변환
 * @param {Array} blockedTimes - 방 금지시간 배열 [{ name, startTime, endTime }]
 * @param {string} currentDay - 현재 요일 (월, 화, 수, 목, 금)
 * @returns {Array} personalTimes 형식의 배열
 */
const convertRoomBlockedTimes = (blockedTimes, currentDay) => {
  if (!blockedTimes || blockedTimes.length === 0) return [];
  
  return blockedTimes.map(bt => ({
    type: 'room_blocked',
    title: bt.name,
    startTime: bt.startTime,
    endTime: bt.endTime,
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], // 모든 요일 적용
    isRecurring: true
  }));
};

/**
 * 방 레벨 예외시간을 personalTimes 형식으로 변환
 * @param {Array} roomExceptions - 방 예외시간 배열
 * @param {string} currentDay - 현재 요일 (월, 화, 수, 목, 금)
 * @returns {Array} personalTimes 형식의 배열
 */
const convertRoomExceptions = (roomExceptions, currentDay) => {
  if (!roomExceptions || roomExceptions.length === 0) return [];
  
  // currentDay는 'monday', 'tuesday' 등의 영문 요일
  const dayMap = { 
    'monday': 1, 
    'tuesday': 2, 
    'wednesday': 3, 
    'thursday': 4, 
    'friday': 5, 
    'saturday': 6, 
    'sunday': 0 
  };
  const currentDayNum = dayMap[currentDay];
  
  return roomExceptions
    .filter(ex => {
      if (ex.type === 'daily_recurring') {
        // dayOfWeek 체크 (1=월, 5=금, 0=일)
        return ex.dayOfWeek === currentDayNum;
      }
      return true; // date_specific은 나중에 처리
    })
    .map(ex => ({
      type: 'room_exception',
      title: ex.name,
      startTime: ex.startTime,
      endTime: ex.endTime,
      days: [currentDay],
      isRecurring: ex.type === 'daily_recurring'
    }));
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
  const prefEndMinutes = timeToMinutes(preferenceEnd);
  
  // 루프를 사용하여 모든 충돌을 피함
  let currentStartMinutes = arrivalMinutes;
  const maxIterations = 20; // 무한루프 방지
  let iteration = 0;

  while (iteration < maxIterations) {
    const currentEndMinutes = currentStartMinutes + classDurationMinutes;
    
    // 1. 선호시간 초과 체크
    if (currentEndMinutes > prefEndMinutes) {
      console.log(`   ⚠️  선호시간 초과: ${minutesToTime(currentEndMinutes)} > ${preferenceEnd}`);
      return { impossible: true, reason: '선호시간 초과' };
    }

    const currentStartTime = minutesToTime(currentStartMinutes);
    const currentEndTime = minutesToTime(currentEndMinutes);

    // 2. 충돌 체크
    const conflict = findConflictingPersonalTime(
      currentStartTime,
      currentEndTime,
      personalTimes,
      dayOfWeek
    );

    if (!conflict) {
      // 충돌 없음 - 배정 성공!
      const waitTime = currentStartMinutes - arrivalMinutes;
      
      if (waitTime > 0) {
        console.log(`   ⏰ 대기시간 ${waitTime}분 후 배정: ${currentStartTime}-${currentEndTime}`);
      }
      
      return {
        startTime: currentStartTime,
        endTime: currentEndTime,
        waitTime: Math.max(0, waitTime)
      };
    }

    // 3. 충돌 있음 - 예외시간 이후로 이동
    console.log(`   ⚠️  충돌 발견 [${iteration + 1}]: ${currentStartTime}-${currentEndTime} vs ${conflict.startTime}-${conflict.endTime} (${conflict.type || conflict.title || '금지시간'})`);
    
    currentStartMinutes = timeToMinutes(conflict.endTime);
    iteration++;
  }

  // 너무 많은 충돌 (무한루프 방지)
  console.log(`   ❌ 너무 많은 충돌 (${maxIterations}회 이상)`);
  return { impossible: true, reason: `너무 많은 충돌 (${maxIterations}회 이상)` };
};

/**
 * 이동시간 + 수업시간이 선호시간 및 예외시간을 고려하여 적합한지 확인 (수정된 로직)
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
  dayOfWeek,
  roomBlockedTimes = [],
  roomExceptions = []
) => {
  // 1. 모든 금지시간(개인, 방)을 병합
  const roomBlocked = convertRoomBlockedTimes(roomBlockedTimes, dayOfWeek);
  const roomExcept = convertRoomExceptions(roomExceptions, dayOfWeek);

  // 17-24시 절대 금지시간 추가 (모든 날에 적용)
  const absoluteBlockedTime = {
    type: 'absolute_blocked',
    title: '17-24시 절대 금지시간',
    startTime: '17:00',
    endTime: '24:00',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    isRecurring: true
  };

  const allBlockedTimes = [...personalTimes, ...roomBlocked, ...roomExcept, absoluteBlockedTime];

  // 2. 이동 시작 시간 계산 (선호시간 시작 고려)
  const currentEndMinutes = timeToMinutes(currentEndTime);
  const prefStartMinutes = timeToMinutes(preferenceStart);
  const travelStartMinutes = Math.max(currentEndMinutes, prefStartMinutes);
  const travelStartTime = minutesToTime(travelStartMinutes);

  // 3. 전체 소요 시간 = 이동시간 + 수업시간 (핵심!)
  const totalDurationMinutes = travelTimeMinutes + classDurationMinutes;

  console.log(`\n🔍 [validateTimeSlotWithTravel] ===== 시작 =====`);
  console.log(`   이동 시작: ${travelStartTime}`);
  console.log(`   전체 시간: ${totalDurationMinutes}분 (이동 ${travelTimeMinutes}분 + 수업 ${classDurationMinutes}분)`);

  // 4. 이동시작부터 수업종료까지 전체 블록 검증 (핵심!)
  const result = findNextAvailableSlot(
    travelStartTime,          // ← 이동 시작부터
    totalDurationMinutes,     // ← 이동+수업 전체 시간
    allBlockedTimes,
    dayOfWeek,
    preferenceEnd
  );

  // 5. 결과 반환
  if (result.impossible) {
    console.log(`   ❌ 배정 불가: ${result.reason}`);
    return { isValid: false, reason: `[${dayOfWeek}] ${preferenceStart}-${preferenceEnd}: ${result.reason}` };
  }

  // 6. 이동시간과 수업시간 분리
  const actualTravelStartMinutes = timeToMinutes(result.startTime);
  const actualTravelEndMinutes = actualTravelStartMinutes + travelTimeMinutes;
  const actualTravelEndTime = minutesToTime(actualTravelEndMinutes);

  console.log(`   ✅ 배정 성공!`);
  console.log(`   → 이동: ${result.startTime} - ${actualTravelEndTime} (${travelTimeMinutes}분)`);
  console.log(`   → 수업: ${actualTravelEndTime} - ${result.endTime}`);
  console.log(`   ===== 완료 =====\n`);

  return {
    isValid: true,
    slot: {
      travelStartTime: result.startTime,        // 이동 시작
      travelEndTime: actualTravelEndTime,       // 이동 종료 (= 수업 시작)
      startTime: actualTravelEndTime,           // 수업 시작
      endTime: result.endTime,                  // 수업 종료
      waitTime: 0  // 이동 직후 바로 수업이므로 대기시간 0
    }
  };
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
  validateTimeSlotWithTravel,
  convertRoomBlockedTimes,  // 추가
  convertRoomExceptions     // 추가
};
