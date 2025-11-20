/**
 * 학년부 관련 상수 정의
 */

// 학년부 정의
export const GRADE_LEVELS = {
  ELEMENTARY: 'elementary',  // 초등부 (8-13세)
  MIDDLE: 'middle',          // 중등부 (14-16세)
  HIGH: 'high'               // 고등부 (17-19세)
};

// 학년부 한글 → 영어 변환
export const GRADE_LEVEL_MAPPING = {
  '초등부': 'elementary',
  '초등학생': 'elementary',
  '초등': 'elementary',
  '중등부': 'middle',
  '중학생': 'middle',
  '중등': 'middle',
  '고등부': 'high',
  '고등학생': 'high',
  '고등': 'high'
};

// 학년부별 기본 수업 시간 (분)
export const DEFAULT_CLASS_DURATION = {
  [GRADE_LEVELS.ELEMENTARY]: 40,  // 초등부 40분
  '초등부': 40,
  '초등학생': 40,
  '초등': 40,
  [GRADE_LEVELS.MIDDLE]: 45,       // 중등부 45분
  '중등부': 45,
  '중학생': 45,
  '중등': 45,
  [GRADE_LEVELS.HIGH]: 50,         // 고등부 50분
  '고등부': 50,
  '고등학생': 50,
  '고등': 50
};

// 교시별 시간표 (초등학교 기준: 40분 수업 + 10분 쉬는 시간)
export const PERIOD_TIMES = {
  1: '09:00',
  2: '09:50',
  3: '10:40',
  4: '11:30',
  5: '13:00', // 점심시간 후
  6: '13:50',
  7: '14:40',
  8: '15:30'
};
