/**
 * 날짜 관련 유틸리티 함수
 */

/**
 * ISO 날짜 문자열을 한국 시간대로 변환
 * @param {string} dateStr - YYYY-MM-DD 형식의 날짜
 * @param {string} timeStr - HH:MM 형식의 시간
 * @returns {string} ISO 형식의 날짜시간 문자열
 */
export const toKoreanDateTime = (dateStr, timeStr) => {
  return `${dateStr}T${timeStr}:00+09:00`;
};

/**
 * Date 객체를 YYYY-MM-DD 형식으로 변환
 * @param {Date} date - Date 객체
 * @returns {string} YYYY-MM-DD 형식의 날짜
 */
export const toDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Date 객체를 HH:MM 형식으로 변환
 * @param {Date} date - Date 객체
 * @returns {string} HH:MM 형식의 시간
 */
export const toTimeString = (date) => {
  return date.toTimeString().substring(0, 5);
};

/**
 * 시작 시간과 종료 시간으로 분 단위 duration 계산
 * @param {string} startTime - HH:MM 형식
 * @param {string} endTime - HH:MM 형식
 * @returns {number} 분 단위 duration
 */
export const calculateDuration = (startTime, endTime) => {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  return (endHour * 60 + endMin) - (startHour * 60 + startMin);
};

/**
 * 두 날짜가 같은 날인지 확인
 * @param {Date} date1
 * @param {Date} date2
 * @returns {boolean}
 */
export const isSameDay = (date1, date2) => {
  return date1.toDateString() === date2.toDateString();
};

/**
 * 시간 문자열을 시간(소수)으로 변환 (예: "09:30" -> 9.5)
 * @param {string} timeStr - HH:MM 형식
 * @returns {number}
 */
export const timeToHour = (timeStr) => {
  const [hour, min] = timeStr.split(':').map(Number);
  return hour + min / 60;
};
