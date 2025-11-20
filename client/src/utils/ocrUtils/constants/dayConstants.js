/**
 * 요일 관련 상수 정의
 */

// 요일 매핑 (한글/영문 → 코드)
export const DAY_MAPPING = {
  '월': 'MON',
  '화': 'TUE',
  '수': 'WED',
  '목': 'THU',
  '금': 'FRI',
  '토': 'SAT',
  '일': 'SUN',
  'monday': 'MON',
  'tuesday': 'TUE',
  'wednesday': 'WED',
  'thursday': 'THU',
  'friday': 'FRI',
  'saturday': 'SAT',
  'sunday': 'SUN'
};

// 주간 시간표 초기 구조
export const WEEKLY_SCHEDULE_TEMPLATE = {
  MON: [],
  TUE: [],
  WED: [],
  THU: [],
  FRI: [],
  SAT: [],
  SUN: []
};
