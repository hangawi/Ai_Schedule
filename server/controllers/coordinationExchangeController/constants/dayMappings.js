/**
 * 요일 관련 상수 및 맵핑
 */

// 요일 이름 배열 (영어)
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// 한글 → 영어 요일 맵핑
const DAY_MAP_KO_TO_EN = {
  '월요일': 'monday',
  '화요일': 'tuesday',
  '수요일': 'wednesday',
  '목요일': 'thursday',
  '금요일': 'friday',
  '토요일': 'saturday',
  '일요일': 'sunday',
  // 단축형
  '월': 'monday',
  '화': 'tuesday',
  '수': 'wednesday',
  '목': 'thursday',
  '금': 'friday',
  '토': 'saturday',
  '일': 'sunday'
};

// 영어 요일 → dayOfWeek 숫자 맵핑 (1=월요일, ..., 5=금요일)
const DAY_OF_WEEK_MAP = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

// 영어 요일 → dayOfWeek 숫자 맵핑 (평일용)
const DAY_NUMBERS = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5
};

// 유효한 평일 목록 (한글)
const VALID_DAYS_KO = ['월요일', '화요일', '수요일', '목요일', '금요일'];

// 유효한 평일 목록 (영어)
const VALID_DAYS_EN = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

module.exports = {
  DAY_NAMES,
  DAY_MAP_KO_TO_EN,
  DAY_OF_WEEK_MAP,
  DAY_NUMBERS,
  VALID_DAYS_KO,
  VALID_DAYS_EN
};
