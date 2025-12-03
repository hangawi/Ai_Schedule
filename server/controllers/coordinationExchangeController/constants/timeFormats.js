/**
 * 시간 형식 정규식 및 상수
 */

// 시간 형식 정규식 (HH:MM 형식 - 분 단위 포함)
const TIME_REGEX = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;

// 시간 형식 정규식 (HH:MM 형식) - TIME_REGEX와 동일
const TIME_WITH_MINUTES_REGEX = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;

// 30분 슬롯 (분 단위)
const SLOT_DURATION_MINUTES = 30;

// 1시간 (분 단위)
const HOUR_IN_MINUTES = 60;

// 자동 배치 시 슬롯 검색 간격 (분)
const AUTO_PLACEMENT_INTERVAL = 30;

// 슬롯 검색 시 미세 간격 (분)
const FINE_SEARCH_INTERVAL = 10;

module.exports = {
  TIME_REGEX,
  TIME_WITH_MINUTES_REGEX,
  SLOT_DURATION_MINUTES,
  HOUR_IN_MINUTES,
  AUTO_PLACEMENT_INTERVAL,
  FINE_SEARCH_INTERVAL
};
