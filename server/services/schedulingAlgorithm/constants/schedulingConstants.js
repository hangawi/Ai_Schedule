/**
 * 스케줄링 관련 상수 정의
 */

// 요일 매핑 (숫자 -> 영문)
const DAY_MAP = {
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
  0: 'sunday',
  7: 'sunday'
};

// 요일 이름 (한글)
const DAY_NAMES_KO = ['일', '월', '화', '수', '목', '금', '토'];

// 요일 이름 (영문)
const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// 평일만 (월~금)
const WEEKDAY_NUMBERS = [1, 2, 3, 4, 5];

// 주말 (토, 일)
const WEEKEND_NUMBERS = [0, 6];

// 기본 최소 시간 설정
const DEFAULT_MIN_HOURS_PER_WEEK = 3; // 주당 최소 3시간
const DEFAULT_NUM_WEEKS = 2; // 기본 2주
const DEFAULT_MIN_SLOTS_PER_WEEK = 6; // 3시간 = 6슬롯 (1시간 = 2슬롯)
const DEFAULT_REQUIRED_SLOTS = 18; // 기본 18슬롯

// 배정 상태
const SLOT_STATUS = {
  CONFIRMED: 'confirmed',
  PENDING: 'pending',
  CANCELLED: 'cancelled'
};

// 멤버 응답 상태
const MEMBER_RESPONSE_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  YIELDED: 'yielded'  // 양보
};

// 자동 배정 subject
const AUTO_ASSIGNMENT_SUBJECT = '자동 배정';

// 이월 관련 상수
const CARRY_OVER_THRESHOLD_WEEKS = 2; // 2주 이상 연속 이월 시 개입 필요
const CARRY_OVER_TIME_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14일 (2주)

// 알고리즘 제한 상수
const MAX_ITERATION_ROUNDS = 20; // 최대 반복 횟수 (교착 상태 방지)

// 점수 계산 상수
const SCORE_BASE = 1000;
const SCORE_CONTENDER_PENALTY = 10;      // 경쟁자 수 패널티
const SCORE_PRIORITY_BONUS = 50;         // 우선순위 보너스
const SCORE_CONTINUITY_BONUS = 200;      // 연속성 보너스
const SCORE_PROXIMITY_BONUS_MAX = 100;   // 시간대 근접성 최대 보너스
const SCORE_PROXIMITY_PENALTY_PER_HOUR = 20; // 시간당 감점
const SCORE_FOCUS_TIME_BONUS = 150;      // 집중시간 보너스

// 공평성 기준
const FAIRNESS_GAP_THRESHOLD = 2; // 2슬롯(1시간) 초과 차이 시 우선 배정

module.exports = {
  DAY_MAP,
  DAY_NAMES_KO,
  DAY_NAMES_EN,
  WEEKDAY_NUMBERS,
  WEEKEND_NUMBERS,
  DEFAULT_MIN_HOURS_PER_WEEK,
  DEFAULT_NUM_WEEKS,
  DEFAULT_MIN_SLOTS_PER_WEEK,
  DEFAULT_REQUIRED_SLOTS,
  SLOT_STATUS,
  MEMBER_RESPONSE_STATUS,
  AUTO_ASSIGNMENT_SUBJECT,
  CARRY_OVER_THRESHOLD_WEEKS,
  CARRY_OVER_TIME_WINDOW_MS,
  MAX_ITERATION_ROUNDS,
  SCORE_BASE,
  SCORE_CONTENDER_PENALTY,
  SCORE_PRIORITY_BONUS,
  SCORE_CONTINUITY_BONUS,
  SCORE_PROXIMITY_BONUS_MAX,
  SCORE_PROXIMITY_PENALTY_PER_HOUR,
  SCORE_FOCUS_TIME_BONUS,
  FAIRNESS_GAP_THRESHOLD
};
