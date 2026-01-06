/**
 * ===================================================================================================
 * timeUtils.js - 시간 파싱 및 계산 유틸리티
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/utils
 *
 * 🎯 주요 기능:
 *    - 다양한 형식의 시간 문자열을 "HH:MM" 형식으로 파싱
 *    - 스케줄 목록에서 시간 범위(시작 시간, 종료 시간)를 동적으로 결정
 *    - 두 시간 간의 차이를 분 단위로 계산
 *    - 시작 시간과 지속 시간(duration)을 바탕으로 종료 시간을 계산
 *    - 주어진 시간에 특정 시간(분)을 더하거나 빼서 조정
 *
 * 🔗 연결된 파일:
 *    - commandParser.js, scheduleOperations.js 등 시간 정보 처리가 필요한 여러 유틸리티 및 컴포넌트
 *
 * 💡 UI 위치:
 *    - 이 파일은 UI가 없으며, 애플리케이션 전반의 시간 데이터 처리 로직에 사용됩니다.
 *
 * ✏️ 수정 가이드:
 *    - 새로운 시간 형식 파싱 지원: `parseTime` 함수에 새로운 정규식 및 변환 로직 추가
 *    - 시간 계산 로직 변경: 각 계산 함수(`calculate...`)의 내부 로직 수정
 *
 * 📝 참고사항:
 *    - 시간 계산은 주로 분(minutes) 단위를 기준으로 이루어집니다.
 *    - `getTimeRange`는 스케줄 표의 세로축(시간) 범위를 동적으로 설정하는 데 사용될 수 있습니다.
 *
 * ===================================================================================================
 */

/**
 * parseTime
 * @description 다양한 형식의 시간 문자열을 "HH:MM" 형식으로 파싱합니다.
 * @param {string} timeStr - 파싱할 시간 문자열 (예: "오후 3시", "3pm", "14:40").
 * @returns {string | null} "HH:MM" 형식으로 변환된 시간 문자열 또는 파싱 실패 시 null.
 */
export const parseTime = (timeStr) => {
  if (!timeStr) return null;
  const normalizedTimeStr = timeStr.trim();

  // "오후 3시", "오전 10시 30분" 형식
  const koreanTimeMatch = normalizedTimeStr.match(/(오전|오후)\s*(\d{1,2})시(?:\s*(\d{1,2})분)?/);
  if (koreanTimeMatch) {
    let hour = parseInt(koreanTimeMatch[2], 10);
    const minute = koreanTimeMatch[3] ? parseInt(koreanTimeMatch[3], 10) : 0;
    if (koreanTimeMatch[1] === '오후' && hour !== 12) hour += 12;
    if (koreanTimeMatch[1] === '오전' && hour === 12) hour = 0; // 자정 (12am)
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  // "3pm", "3PM" 형식
  const pmMatch = normalizedTimeStr.match(/(\d{1,2})\s*(pm|PM)/i);
  if (pmMatch) {
    let hour = parseInt(pmMatch[1], 10);
    if (hour !== 12) hour += 12; // 12pm는 12:00
    return `${String(hour).padStart(2, '0')}:00`;
  }

  // "3am", "3AM" 형식
  const amMatch = normalizedTimeStr.match(/(\d{1,2})\s*(am|AM)/i);
  if (amMatch) {
    let hour = parseInt(amMatch[1], 10);
    if (hour === 12) hour = 0; // 12am는 00:00
    return `${String(hour).padStart(2, '0')}:00`;
  }

  // "14:40", "14시 40분" 형식
  const timeMatch = normalizedTimeStr.match(/(\d{1,2})[시:]\s*(\d{1,2})분?/);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  // "3시" 같은 단독 시간
  const singleHourMatch = normalizedTimeStr.match(/(\d{1,2})시/);
  if(singleHourMatch) {
      const hour = parseInt(singleHourMatch[1], 10);
      return `${String(hour).padStart(2, '0')}:00`;
  }

  return null;
};

/**
 * getTimeRange
 * @description 스케줄 목록에서 가장 이른 시작 시간과 가장 늦은 종료 시간을 찾아 시간 범위를 반환합니다.
 * @param {Array<Object>} currentCombination - 현재 조합 스케줄 목록.
 * @param {Array<Object>} personalTimes - 개인 일정 목록.
 * @returns {{start: number, end: number}} 시간 범위 객체 (시작 시, 종료 시).
 */
export const getTimeRange = (currentCombination, personalTimes, currentFixedSchedules) => {
  console.log('⏱️ [getTimeRange] 입력:', {
    currentCombinationLength: currentCombination?.length || 0,
    personalTimesLength: personalTimes?.length || 0,
    fixedSchedulesLength: currentFixedSchedules?.length || 0
  });
  let minHour = 24;
  let maxHour = 0;

  const allSchedules = [...(currentCombination || []), ...(personalTimes || [])];

  allSchedules.forEach(schedule => {
    // ⭐ startTime이 문자열인지 확인
    if (schedule && schedule.startTime && typeof schedule.startTime === 'string') {
      const startParts = schedule.startTime.split(':');
      if (startParts.length >= 1) {
        const startHour = parseInt(startParts[0], 10);
        if (!isNaN(startHour)) minHour = Math.min(minHour, startHour);
      }
    }
    // ⭐ endTime이 문자열인지 확인
    if (schedule && schedule.endTime && typeof schedule.endTime === 'string') {
      const endParts = schedule.endTime.split(':');
      if (endParts.length >= 2) {
        const endHour = parseInt(endParts[0], 10);
        const endMinute = parseInt(endParts[1], 10);
        if (!isNaN(endHour)) maxHour = Math.max(maxHour, endMinute > 0 ? endHour + 1 : endHour);
      }
    }
  });

  return {
    start: minHour === 24 ? 9 : minHour,
    end: maxHour === 0 ? 18 : maxHour,
  };
};

/**
 * calculateTimeDifference
 * @description 두 "HH:MM" 형식의 시간 문자열 간의 차이를 분 단위로 계산합니다.
 * @param {string} oldTime - 이전 시간 (예: "14:00").
 * @param {string} newTime - 새로운 시간 (예: "15:30").
 * @returns {number} 두 시간의 차이 (분).
 */
export const calculateTimeDifference = (oldTime, newTime) => {
  // ⭐ 타입 체크
  if (!oldTime || !newTime || typeof oldTime !== 'string' || typeof newTime !== 'string') {
    return 0;
  }
  const oldParts = oldTime.split(':');
  const newParts = newTime.split(':');
  if (oldParts.length < 2 || newParts.length < 2) {
    return 0;
  }
  const [oldHour, oldMin] = oldParts.map(Number);
  const [newHour, newMin] = newParts.map(Number);
  const oldMinutes = oldHour * 60 + oldMin;
  const newMinutes = newHour * 60 + newMin;
  return newMinutes - oldMinutes;
};

/**
 * calculateEndTime
 * @description 시작 시간과 지속 시간(분)을 바탕으로 종료 시간을 "HH:MM" 형식으로 계산합니다.
 * @param {string} startTime - 시작 시간 (HH:MM).
 * @param {number} durationMinutes - 지속 시간 (분).
 * @returns {string} 계산된 종료 시간 (HH:MM).
 */
export const calculateEndTime = (startTime, durationMinutes) => {
  // ⭐ 타입 체크
  if (!startTime || typeof startTime !== 'string') {
    return '00:00';
  }
  const parts = startTime.split(':');
  if (parts.length < 2) {
    return '00:00';
  }
  const [hour, min] = parts.map(Number);
  if (isNaN(hour) || isNaN(min)) {
    return '00:00';
  }
  const totalStartMinutes = hour * 60 + min;
  const endMinutesTotal = totalStartMinutes + (durationMinutes || 0);
  const endHour = Math.floor(endMinutesTotal / 60) % 24;
  const endMin = endMinutesTotal % 60;
  return `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
};

/**
 * adjustTimeByMinutes
 * @description 주어진 시간에 특정 시간(분)을 더하거나 빼서 조정합니다.
 * @param {string} time - 조정할 시간 (HH:MM).
 * @param {number} minutesDiff - 더하거나 뺄 시간 (분).
 * @returns {string} 조정된 시간 (HH:MM).
 */
export const adjustTimeByMinutes = (time, minutesDiff) => {
  // ⭐ 타입 체크
  if (!time || typeof time !== 'string') {
    return '00:00';
  }
  const parts = time.split(':');
  if (parts.length < 2) {
    return '00:00';
  }
  const [hour, min] = parts.map(Number);
  if (isNaN(hour) || isNaN(min)) {
    return '00:00';
  }
  const totalMinutes = hour * 60 + min + (minutesDiff || 0);
  const newHour = Math.floor(totalMinutes / 60) % 24;
  const newMin = totalMinutes % 60;
  return `${String(newHour).padStart(2, '0')}:${String(newMin).padStart(2, '0')}`;
};