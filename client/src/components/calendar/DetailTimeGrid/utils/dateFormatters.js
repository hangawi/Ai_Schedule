/**
 * ===================================================================================================
 * dateFormatters.js - 날짜 포맷팅 유틸리티
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/calendar/DetailTimeGrid/utils/dateFormatters.js
 *
 * 🎯 주요 기능:
 *    - 날짜를 한국어 형식으로 포맷팅
 *    - 날짜를 YYYY-MM-DD 형식으로 변환
 *
 * 🔗 연결된 파일:
 *    - ../../index.js - DetailTimeGrid에서 사용
 *
 * 💡 UI 위치:
 *    - 사용: 일정 그리드 날짜 표시
 *
 * ✏️ 수정 가이드:
 *    - 날짜 형식 변경: formatDate 함수 return 값 수정
 *
 * 📝 참고사항:
 *    - formatDate: "2025년 1월 1일 (수)" 형식
 *    - getDateString: "2025-01-01" 형식
 *
 * ===================================================================================================
 */

/**
 * formatDate - 날짜를 한국어 형식으로 포맷팅
 *
 * @param {Date} date - 포맷팅할 날짜
 * @returns {string} "YYYY년 M월 D일 (요일)" 형식 문자열
 */
export const formatDate = (date) => {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
};

/**
 * getDateString - 날짜를 YYYY-MM-DD 형식으로 변환
 *
 * @param {Date} date - 변환할 날짜
 * @returns {string} "YYYY-MM-DD" 형식 문자열
 *
 * @example
 * getDateString(new Date(2025, 0, 1)); // "2025-01-01"
 */
// 날짜를 YYYY-MM-DD 형식의 문자열로 변환
export const getDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
