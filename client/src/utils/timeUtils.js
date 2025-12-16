/**
 * ===================================================================================================
 * timeUtils.js - 시간 관련 변환 및 계산을 수행하는 유틸리티 함수 모음
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/utils/timeUtils.js
 *
 * 🎯 주요 기능:
 *    - 30분 단위의 시간 슬롯 목록을 생성 (`generateTimeSlots`).
 *    - HH:MM 형식의 시간 문자열을 분 단위 정수로 변환 (`timeToMinutes`).
 *    - 분 단위 정수를 HH:MM 형식의 시간 문자열로 변환 (`minutesToTime`).
 *    - 주어진 시작 시간에서 30분 후의 종료 시간을 계산 (`calculateEndTime`).
 *
 * 🔗 연결된 파일:
 *    - ../utils/scheduleUtils.js: `timeToMinutes` 함수를 사용하여 스케줄 병합 로직에서 시간을 계산.
 *    - ../components/timetable/TimetableGrid.js: `generateTimeSlots` 함수를 사용하여 시간표의 세로축 시간대를 생성.
 *    - ../components/calendar/DetailTimeGrid/utils/timeCalculations.js: 시간 관련 계산에 이 유틸리티 함수들을 사용.
 *
 * 💡 UI 위치:
 *    - 시간표 그리드의 시간 표시, 시간 계산 로직 등 애플리케이션의 시간 관련 기능 전반에서 백그라운드로 사용됨.
 *
 * ✏️ 수정 가이드:
 *    - 시간 슬롯의 단위를 30분이 아닌 다른 값으로 변경하려면: `generateTimeSlots`와 `calculateEndTime` 함수의 시간 계산 로직을 수정.
 *    - 시간 형식(예: 12시간제)을 변경하려면: `generateTimeSlots`, `minutesToTime` 함수의 문자열 포맷팅 로직을 수정.
 *
 * 📝 참고사항:
 *    - 이 파일의 함수들은 HH:MM 형식의 24시간제를 기준으로 동작.
 *    - 시간 계산은 주로 분 단위를 기준으로 이루어짐.
 *
 * ===================================================================================================
 */

/**
 * generateTimeSlots
 * @description 30분 단위의 시간 슬롯 배열을 생성합니다.
 * @param {number} [startHour=0] - 생성할 시간 범위의 시작 시간 (0~23).
 * @param {number} [endHour=24] - 생성할 시간 범위의 종료 시간 (1~24).
 * @returns {Array<string>} HH:MM 형식의 시간 문자열 배열.
 */
export const generateTimeSlots = (startHour = 0, endHour = 24) => {
  const slots = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 30) {
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      slots.push(time);
    }
  }
  return slots;
};

/**
 * timeToMinutes
 * @description HH:MM 형식의 시간 문자열을 분 단위의 정수로 변환합니다.
 * @param {string} timeString - HH:MM 형식의 시간 문자열.
 * @returns {number} 분 단위의 총 시간.
 */
export const timeToMinutes = (timeString) => {
  const [hour, minute] = timeString.split(':').map(Number);
  return hour * 60 + minute;
};

/**
 * minutesToTime
 * @description 분 단위의 정수를 HH:MM 형식의 시간 문자열로 변환합니다.
 * @param {number} minutes - 분 단위의 총 시간.
 * @returns {string} HH:MM 형식의 시간 문자열.
 */
export const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

/**
 * calculateEndTime
 * @description 주어진 시작 시간에서 30분을 더한 종료 시간을 계산합니다.
 * @param {string} startTime - HH:MM 형식의 시작 시간.
 * @returns {string} HH:MM 형식의 종료 시간.
 */
export const calculateEndTime = (startTime) => {
  const [h, m] = startTime.split(':').map(Number);
  const totalMinutes = h * 60 + m + 30;
  const endHour = Math.floor(totalMinutes / 60);
  const endMinute = totalMinutes % 60;
  return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
};