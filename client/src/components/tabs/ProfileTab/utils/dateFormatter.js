/**
 * ===================================================================================================
 * dateFormatter.js - '내 프로필' 탭에서 사용되는 날짜 포맷팅 유틸리티
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ProfileTab/utils/dateFormatter.js
 *
 * 🎯 주요 기능:
 *    - `formatDateWithDay`: 날짜를 "M월 D일 (요일)" 형식의 문자열로 변환.
 *    - `getKoreanLocalDate`: 날짜 객체를 한국 시간 기준의 'YYYY-MM-DD' 형식 문자열로 변환.
 *
 * 🔗 연결된 파일:
 *    - ../components/PreferenceTimeSection.js - 선호시간 목록에서 날짜를 표시하기 위해 `formatDateWithDay` 사용.
 *    - ../hooks/useCalendarUpdate.js - 챗봇 응답 처리 시 한국 날짜를 얻기 위해 `getKoreanLocalDate` 사용.
 *    - ../constants/dayMapping.js - 요일 이름을 가져오기 위해 사용.
 *
 * 💡 UI 위치:
 *    - 이 파일은 UI가 없으나, 반환된 문자열이 '선호시간 관리' 섹션 등에 표시됩니다.
 *
 * ✏️ 수정 가이드:
 *    - 날짜 표시 형식을 변경하려면 이 파일의 해당 함수 내부 로직을 수정합니다.
 *    - 시간대(timezone) 관련 로직을 변경하려면 `getKoreanLocalDate` 함수를 수정합니다.
 *
 * 📝 참고사항:
 *    - `getKoreanLocalDate`는 사용자의 로컬 시간대와 관계없이 항상 한국 시간을 기준으로 날짜를 계산하기 위해 중요합니다.
 *
 * ===================================================================================================
 */

import { DAY_NAMES } from '../constants/dayMapping';

/**
 * 날짜를 "M월 D일 (요일)" 형식으로 포맷
 * @param {Date|string} date - 날짜 객체 또는 문자열
 * @returns {string} 포맷된 날짜 문자열
 */
export const formatDateWithDay = (date) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const dayName = DAY_NAMES[dateObj.getDay()];
  return `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 (${dayName})`;
};

/**
 * 한국 로컬 날짜 문자열 생성 (YYYY-MM-DD)
 * @param {Date} dateTime - 날짜 객체
 * @returns {string} YYYY-MM-DD 형식 문자열
 */
export const getKoreanLocalDate = (dateTime) => {
  const koreaDateTime = new Date(dateTime.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const localYear = koreaDateTime.getFullYear();
  const localMonth = String(koreaDateTime.getMonth() + 1).padStart(2, '0');
  const localDay = String(koreaDateTime.getDate()).padStart(2, '0');
  return `${localYear}-${localMonth}-${localDay}`;
};
