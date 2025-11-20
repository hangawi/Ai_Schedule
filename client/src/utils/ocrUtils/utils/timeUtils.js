/**
 * 시간 파싱 및 변환 유틸리티
 */

import { PERIOD_TIMES } from '../constants/gradeLevelConstants';

/**
 * 시간 문자열 파싱 (다양한 형식 지원)
 * @param {string} timeStr - "14:00", "오후 2시", "2:00 PM" 등
 * @returns {Object} - {hour, minute}
 */
export const parseTime = (timeStr) => {
  if (!timeStr) return null;

  // "14:00" 형식
  const standardMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (standardMatch) {
    return {
      hour: parseInt(standardMatch[1]),
      minute: parseInt(standardMatch[2])
    };
  }

  // "오후 2시", "오전 10시 30분" 형식
  const koreanMatch = timeStr.match(/(오전|오후)\s*(\d{1,2})\s*시\s*(\d{1,2})?\s*분?/);
  if (koreanMatch) {
    let hour = parseInt(koreanMatch[2]);
    const isPM = koreanMatch[1] === '오후';
    const minute = koreanMatch[3] ? parseInt(koreanMatch[3]) : 0;

    if (isPM && hour !== 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;

    return { hour, minute };
  }

  // "2:00 PM" 형식
  const englishMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (englishMatch) {
    let hour = parseInt(englishMatch[1]);
    const minute = parseInt(englishMatch[2]);
    const isPM = englishMatch[3].toUpperCase() === 'PM';

    if (isPM && hour !== 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;

    return { hour, minute };
  }

  return null;
};

/**
 * PM/AM 시간을 24시간 형식으로 변환
 * @param {string} timeStr - "PM 1시", "오후 2:30", "1:00 PM" 등
 * @returns {string|null} - "13:00" 형식의 시간
 */
export const convertAmPmTo24Hour = (timeStr) => {
  if (!timeStr) return null;

  const pmPattern = /(?:pm|오후|p\.m\.?)\s*(\d{1,2})(?::(\d{2}))?/i;
  const amPattern = /(?:am|오전|a\.m\.?)\s*(\d{1,2})(?::(\d{2}))?/i;
  const pmAfterPattern = /(\d{1,2})(?::(\d{2}))?\s*(?:pm|오후|p\.m\.?)/i;
  const amAfterPattern = /(\d{1,2})(?::(\d{2}))?\s*(?:am|오전|a\.m\.?)/i;

  let match = timeStr.match(pmPattern) || timeStr.match(pmAfterPattern);
  if (match) {
    let hour = parseInt(match[1]);
    const minute = match[2] ? parseInt(match[2]) : 0;
    if (hour !== 12) hour += 12;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  match = timeStr.match(amPattern) || timeStr.match(amAfterPattern);
  if (match) {
    let hour = parseInt(match[1]);
    const minute = match[2] ? parseInt(match[2]) : 0;
    if (hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  return null;
};

/**
 * 교시 정보를 실제 시간으로 변환
 * @param {string} description - "1교시", "2교시" 등
 * @returns {string|null} - "09:00" 형식의 시작 시간
 */
export const convertPeriodToTime = (description) => {
  if (!description) return null;

  const periodMatch = description.match(/(\d+)교시/);
  if (!periodMatch) return null;

  const period = parseInt(periodMatch[1]);
  return PERIOD_TIMES[period] || null;
};

/**
 * 시간을 분으로 변환
 * @param {string} time - "HH:MM" 형식
 * @returns {number} - 총 분
 */
export const timeToMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/**
 * 분을 시간으로 변환
 * @param {number} minutes - 총 분
 * @returns {string} - "HH:MM" 형식
 */
export const minutesToTime = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
