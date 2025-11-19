/**
 * ============================================================================
 * modalConstants.js - Modal Constants
 * ============================================================================
 */

/**
 * 요일 레이블 매핑
 */
export const DAY_LABELS = {
  MON: '월요일',
  TUE: '화요일',
  WED: '수요일',
  THU: '목요일',
  FRI: '금요일',
  SAT: '토요일',
  SUN: '일요일'
};

/**
 * 학년부 레이블 매핑
 */
export const GRADE_LEVEL_LABELS = {
  elementary: '초등부',
  middle: '중등부',
  high: '고등부'
};

/**
 * 요일 맵 (한글/영문 -> 영문 코드)
 */
export const DAY_MAP = {
  '월요일': 'MON', '화요일': 'TUE', '수요일': 'WED', '목요일': 'THU',
  '금요일': 'FRI', '토요일': 'SAT', '일요일': 'SUN',
  '월': 'MON', '화': 'TUE', '수': 'WED', '목': 'THU',
  '금': 'FRI', '토': 'SAT', '일': 'SUN'
};

/**
 * 학년부 맵 (한글 -> 영문 코드)
 */
export const GRADE_LEVEL_MAP = {
  '초등부': 'elementary', '중등부': 'middle', '고등부': 'high',
  '초등': 'elementary', '중등': 'middle', '고등': 'high'
};
