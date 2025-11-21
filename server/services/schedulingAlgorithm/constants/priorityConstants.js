/**
 * 우선순위 관련 상수 정의
 */

// 우선순위 레벨
const PRIORITY_LEVELS = {
  LOWEST: 1,
  LOW: 2,
  MEDIUM: 3,
  HIGH: 4,
  HIGHEST: 5
};

// 기본 우선순위
const DEFAULT_PRIORITY = 3; // Medium

// 우선순위 임계값 (이 값 이상만 선호 시간으로 간주)
const PREFERRED_TIME_PRIORITY_THRESHOLD = 2;

// 우선순위 설명
const PRIORITY_DESCRIPTIONS = {
  1: '최하 우선순위',
  2: '낮은 우선순위',
  3: '중간 우선순위 (기본값)',
  4: '높은 우선순위',
  5: '최고 우선순위'
};

module.exports = {
  PRIORITY_LEVELS,
  DEFAULT_PRIORITY,
  PREFERRED_TIME_PRIORITY_THRESHOLD,
  PRIORITY_DESCRIPTIONS
};
