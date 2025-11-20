/**
 * 나이 계산 및 학년부 판단 유틸리티
 */

import { GRADE_LEVELS } from '../constants/gradeLevelConstants';

/**
 * 생년월일로부터 나이 계산
 * @param {string} birthdate - YYYY-MM-DD 형식의 생년월일
 * @returns {number} - 만 나이
 */
export const calculateAge = (birthdate) => {
  if (!birthdate) return null;

  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
};

/**
 * 나이로부터 학년부 판단
 * @param {number} age - 만 나이
 * @returns {string} - GRADE_LEVELS의 값
 */
export const getGradeLevelFromAge = (age) => {
  if (!age || age < 8) return null;

  if (age <= 13) return GRADE_LEVELS.ELEMENTARY;
  if (age <= 16) return GRADE_LEVELS.MIDDLE;
  if (age <= 19) return GRADE_LEVELS.HIGH;

  return GRADE_LEVELS.HIGH; // 19세 이상은 고등부로 취급
};

/**
 * 제목에서 학년부 추론
 * @param {string} title - 분석할 제목
 * @returns {string|null} - 학년부 ('초등부', '중등부', '고등부') 또는 null
 */
export const inferGradeLevelFromTitle = (title) => {
  if (!title) return null;
  const titleLower = title.toLowerCase();

  // 초등학교 키워드
  if (titleLower.includes('초등') || titleLower.includes('초')) {
    return '초등부';
  }
  // 중학교 키워드
  if (titleLower.includes('중등') || titleLower.includes('중학') ||
      titleLower.match(/\d+학년.*3반/) || titleLower.includes('미리중')) {
    return '중등부';
  }
  // 고등학교 키워드
  if (titleLower.includes('고등') || titleLower.includes('고')) {
    return '고등부';
  }
  return null;
};
