/**
 * 시간 관련 상수 정의
 */

// 시간 단위 상수
const MINUTES_PER_SLOT = 10; // 10분 = 1슬롯
const SLOTS_PER_HOUR = 6; // 1시간 = 6슬롯
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

// 기본 스케줄 시간
const DEFAULT_SCHEDULE_START_HOUR = 9; // 오전 9시
const DEFAULT_SCHEDULE_END_HOUR = 18; // 오후 6시
const DEFAULT_SCHEDULE_START_TIME = '9';
const DEFAULT_SCHEDULE_END_TIME = '18';

// 집중 시간대 정의
const FOCUS_TIME_RANGES = {
  morning: { start: 9, end: 12 },    // 오전
  lunch: { start: 12, end: 14 },     // 점심
  afternoon: { start: 14, end: 17 },  // 오후
  evening: { start: 17, end: 20 },    // 저녁
  none: null                          // 선호 없음
};

// 시간 포맷팅 상수
const TIME_FORMAT_PATTERN = /^\d{1,2}:\d{2}$/;
const VALID_MINUTE_VALUES = [0, 10, 20, 30, 40, 50]; // 10분 단위만 허용

module.exports = {
  MINUTES_PER_SLOT,
  SLOTS_PER_HOUR,
  MINUTES_PER_HOUR,
  HOURS_PER_DAY,
  DEFAULT_SCHEDULE_START_HOUR,
  DEFAULT_SCHEDULE_END_HOUR,
  DEFAULT_SCHEDULE_START_TIME,
  DEFAULT_SCHEDULE_END_TIME,
  FOCUS_TIME_RANGES,
  TIME_FORMAT_PATTERN,
  VALID_MINUTE_VALUES
};
