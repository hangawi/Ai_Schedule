/**
 * ===================================================================================================
 * [timeCalculations.js] - 시간 그리드(DetailTimeGrid) 관련 시간 계산 유틸리티
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > client/src/components/calendar/DetailTimeGrid/utils/timeCalculations.js
 *
 * 🎯 주요 기능:
 *    - 10분 단위 시간 슬롯 배열 생성
 *    - 특정 시간에서 다음 시간 슬롯(10분 뒤) 계산
 *    - 두 시간 사이의 차이를 분 단위로 계산
 *    - 시간을 분으로 변환 및 종료 시간 계산
 *
 * 🔗 연결된 파일:
 *    - ../index.js: DetailTimeGrid 컴포넌트에서 이 유틸리티 함수들을 사용
 *    - ../handlers/slotHelpers.js: 슬롯 관련 로직에서 시간 계산이 필요할 때 사용
 *
 * ✏️ 수정 가이드:
 *    - 시간 슬롯 단위를 변경하려면 (예: 15분): generateTimeSlots와 getNextTimeSlot, calculateEndTime의 '10'을 수정해야 합니다.
 *    - 시간 형식(HH:mm)을 변경하려면: 모든 함수의 시간 문자열 처리 부분을 수정해야 합니다.
 *
 * 📝 참고사항:
 *    - 이 파일의 함수들은 "HH:mm" 형식의 시간 문자열을 기준으로 동작합니다.
 *    - 시간 계산의 기준 단위는 10분입니다.
 *
 * ===================================================================================================
 */

/**
 * generateTimeSlots
 *
 * @description 10분 단위의 시간 슬롯 배열을 생성합니다.
 * @param {number} [startHour=0] - 생성 시작 시간 (0-23)
 * @param {number} [endHour=24] - 생성 종료 시간 (1-24)
 * @returns {string[]} "HH:mm" 형식의 시간 문자열 배열
 *
 * @example
 * // 00:00부터 23:50까지 10분 단위 슬롯 생성
 * const slots = generateTimeSlots();
 * // slots = ["00:00", "00:10", ..., "23:50"]
 */
export const generateTimeSlots = (startHour = 0, endHour = 24) => {
  const slots = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 10) {
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      slots.push(time);
    }
  }
  return slots;
};

/**
 * getNextTimeSlot
 *
 * @description 주어진 시간 문자열로부터 10분 후의 시간 슬롯을 계산합니다.
 * @param {string} timeString - "HH:mm" 형식의 현재 시간
 * @returns {string} 10분 후의 "HH:mm" 형식 시간
 *
 * @example
 * const nextSlot = getNextTimeSlot("09:50");
 * // nextSlot = "10:00"
 */
export const getNextTimeSlot = (timeString) => {
  const [hour, minute] = timeString.split(':').map(Number);
  const nextMinute = minute + 10;
  const nextHour = nextMinute >= 60 ? hour + 1 : hour;
  const finalMinute = nextMinute >= 60 ? 0 : nextMinute;
  return `${String(nextHour).padStart(2, '0')}:${String(finalMinute).padStart(2, '0')}`;
};

/**
 * getTimeDifferenceInMinutes
 *
 * @description 두 시간 문자열 사이의 차이를 분 단위로 계산합니다.
 * @param {string} startTime - "HH:mm" 형식의 시작 시간
 * @param {string} endTime - "HH:mm" 형식의 종료 시간
 * @returns {number} 두 시간의 차이 (분)
 *
 * @example
 * const diff = getTimeDifferenceInMinutes("10:00", "11:30");
 * // diff = 90
 */
export const getTimeDifferenceInMinutes = (startTime, endTime) => {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  return (endHour * 60 + endMin) - (startHour * 60 + startMin);
};

/**
 * timeToMinutes
 *
 * @description 시간 문자열을 자정부터의 총 분으로 변환합니다.
 * @param {string} timeString - "HH:mm" 형식의 시간
 * @returns {number} 총 분
 *
 * @example
 * const minutes = timeToMinutes("01:30");
 * // minutes = 90
 */
export const timeToMinutes = (timeString) => {
  const [hour, minute] = timeString.split(':').map(Number);
  return hour * 60 + minute;
};

/**
 * calculateEndTime
 *
 * @description 시작 시간 문자열로부터 10분 후의 종료 시간을 계산합니다.
 * @param {string} startTime - "HH:mm" 형식의 시작 시간
 * @returns {string} 10분 후의 "HH:mm" 형식 종료 시간
 *
 * @example
 * const endTime = calculateEndTime("14:20");
 * // endTime = "14:30"
 */
export const calculateEndTime = (startTime) => {
  const [h, m] = startTime.split(':').map(Number);
  const totalMinutes = h * 60 + m + 10;
  const endHour = Math.floor(totalMinutes / 60);
  const endMinute = totalMinutes % 60;
  return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
};