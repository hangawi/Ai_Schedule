// 날짜 포맷팅 유틸리티 함수

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
