/**
 * ===================================================================================================
 * dateUtils.js - CoordinationTab 날짜 유틸리티 함수
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/CoordinationTab/utils
 *
 * 🎯 주요 기능:
 *    - 요일 인덱스를 실제 날짜로 변환
 *    - Date 객체에서 요일 인덱스 추출
 *    - 슬롯 데이터에서 요청 날짜 추출
 *
 * 🔗 연결된 파일:
 *    - ../constants/index.js - DAYS_OF_WEEK, DAY_NAME_TO_INDEX 상수
 *    - ../handlers/requestHandlers.js - 요청 생성 시 사용
 *    - ../handlers/slotHandlers.js - 슬롯 처리 시 사용
 *
 * 💡 UI 위치:
 *    - 탭: 조율 탭 (CoordinationTab)
 *    - 섹션: 요청 관리, 슬롯 선택
 *    - 경로: 앱 실행 > 조율 탭 > 요청 보내기/슬롯 선택
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 날짜 관련 로직이 변경됨
 *    - 주말 포함하려면: getDayIndex 함수에서 0, 6 처리 로직 수정
 *    - 날짜 형식 변경: toISOString().split('T')[0] 부분 수정
 *
 * 📝 참고사항:
 *    - 날짜 형식: YYYY-MM-DD (ISO 8601 형식)
 *    - 요일 인덱스: 1-5 (월-금), 주말은 -1 반환
 *    - UTC 시간대 사용 (getUTCDay)
 *
 * ===================================================================================================
 */

import { DAYS_OF_WEEK, DAY_NAME_TO_INDEX } from '../constants';

/**
 * calculateDateFromDayIndex - 요일 인덱스로부터 이번 주 날짜 계산
 *
 * @description 주어진 요일 인덱스(1-5)를 이번 주의 실제 날짜로 변환
 * @param {number} dayIndex - 요일 인덱스 (1=월요일, 2=화요일, 3=수요일, 4=목요일, 5=금요일)
 * @returns {string} YYYY-MM-DD 형식의 날짜 문자열
 *
 * @example
 * calculateDateFromDayIndex(1); // "2025-12-08" (이번 주 월요일)
 * calculateDateFromDayIndex(5); // "2025-12-12" (이번 주 금요일)
 *
 * @note
 * - 현재 날짜를 기준으로 이번 주의 해당 요일 날짜를 계산
 * - 오늘이 목요일이고 dayIndex=1(월요일)이면 다음 주 월요일이 아닌 이번 주 월요일 반환
 */
export const calculateDateFromDayIndex = (dayIndex) => {
  const targetDayName = DAYS_OF_WEEK[dayIndex - 1];
  const targetDayOfWeek = DAY_NAME_TO_INDEX[targetDayName];

  const currentDate = new Date();
  const currentDay = currentDate.getDay(); // 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
  const diff = targetDayOfWeek - currentDay;
  const targetDate = new Date(currentDate);
  targetDate.setDate(currentDate.getDate() + (diff >= 0 ? diff : diff + 7));
  return targetDate.toISOString().split('T')[0]; // YYYY-MM-DD 형식
};

/**
 * getDayIndex - Date 객체에서 요일 인덱스 추출
 *
 * @description Date 객체를 받아서 월요일=0, 금요일=4로 변환 (주말은 -1)
 * @param {Date} date - Date 객체
 * @returns {number} 요일 인덱스 (0=월요일, 1=화요일, 2=수요일, 3=목요일, 4=금요일, -1=주말)
 *
 * @example
 * const monday = new Date('2025-12-08');
 * getDayIndex(monday); // 0 (월요일)
 *
 * const sunday = new Date('2025-12-07');
 * getDayIndex(sunday); // -1 (일요일, 주말)
 *
 * @note
 * - UTC 시간대 기준으로 요일 계산 (getUTCDay 사용)
 * - JavaScript의 getDay()는 0=일요일이지만, 이 함수는 0=월요일로 변환
 * - 주말(토,일)은 -1 반환하여 유효하지 않음을 표시
 */
export const getDayIndex = (date) => {
  const dayOfWeek = date.getUTCDay(); // 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
  // We want Monday=0, Tuesday=1, Wednesday=2, Thursday=3, Friday=4
  if (dayOfWeek === 0) return -1; // Sunday, not valid
  if (dayOfWeek === 6) return -1; // Saturday, not valid
  return dayOfWeek - 1; // Monday(1)->0, Tuesday(2)->1, etc.
};

/**
 * getRequestDate - 슬롯 데이터에서 요청 날짜 추출
 *
 * @description 슬롯 데이터에서 date 또는 dayIndex를 사용하여 YYYY-MM-DD 형식의 날짜 문자열 반환
 * @param {Object} slotData - 슬롯 데이터 객체
 * @param {Date|string} [slotData.date] - 날짜 (Date 객체 또는 문자열)
 * @param {number} [slotData.dayIndex] - 요일 인덱스 (date가 없을 경우 사용)
 * @returns {string} YYYY-MM-DD 형식의 날짜 문자열
 *
 * @example
 * // date가 있는 경우
 * getRequestDate({ date: new Date('2025-12-08') }); // "2025-12-08"
 * getRequestDate({ date: "2025-12-08" }); // "2025-12-08"
 *
 * // dayIndex만 있는 경우
 * getRequestDate({ dayIndex: 1 }); // "2025-12-08" (이번 주 월요일)
 *
 * @note
 * - date 속성이 우선순위가 높음 (date가 있으면 dayIndex 무시)
 * - Date 객체는 자동으로 YYYY-MM-DD 형식으로 변환됨
 */
export const getRequestDate = (slotData) => {
  if (slotData.date) {
    return slotData.date instanceof Date
      ? slotData.date.toISOString().split('T')[0]
      : slotData.date;
  }
  return calculateDateFromDayIndex(slotData.dayIndex);
};
