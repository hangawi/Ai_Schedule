/**
 * 요일 추출 및 변환 유틸리티
 */

import { DAY_MAPPING } from '../constants/dayConstants';

/**
 * 텍스트에서 요일 패턴 추출
 * 예: "주3회(월,수,금)", "주 2회 (화,목)" 등
 * @param {string} text - 분석할 텍스트
 * @returns {Array} - 요일 배열 ['MON', 'WED', 'FRI']
 */
export const extractDaysFromText = (text) => {
  if (!text) return [];

  const days = [];

  // 괄호 안의 요일 찾기
  const bracketMatch = text.match(/[(\(]([^\)]+)[\)]/);
  if (bracketMatch) {
    const daysText = bracketMatch[1];
    Object.keys(DAY_MAPPING).forEach(korDay => {
      if (daysText.includes(korDay)) {
        days.push(DAY_MAPPING[korDay]);
      }
    });
  }

  // "주X회" 패턴도 체크
  const weekPatternMatch = text.match(/주\s*(\d+)\s*회/);
  if (weekPatternMatch && days.length === 0) {
    const count = parseInt(weekPatternMatch[1]);
    // 횟수만 있고 요일이 명시되지 않은 경우는 null 반환하여 추가 처리 필요함을 표시
    return null;
  }

  return days.length > 0 ? days : null;
};

/**
 * 한글 요일을 영문 코드로 변환
 * @param {Array} days - 한글 요일 배열
 * @returns {Array} - 영문 코드 배열
 */
export const convertDaysToEnglish = (days) => {
  if (!days || !Array.isArray(days)) return days;

  const dayMap = {
    '월': 'MON', '화': 'TUE', '수': 'WED', '목': 'THU',
    '금': 'FRI', '토': 'SAT', '일': 'SUN'
  };

  return days.map(day => dayMap[day] || day);
};

/**
 * 주 횟수에 따른 기본 요일 할당
 * @param {number} count - 주 횟수
 * @returns {Array} - 기본 요일 배열
 */
export const getDefaultDaysByCount = (count) => {
  const patterns = {
    5: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    3: ['MON', 'WED', 'FRI'],
    2: ['TUE', 'THU']
  };

  return patterns[count] || null;
};
