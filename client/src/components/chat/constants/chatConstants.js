/**
 * ============================================================================
 * chatConstants.js - 채팅 관련 상수들
 * ============================================================================
 */

/**
 * API Base URL
 */
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

/**
 * 요일 매핑 (한글/영문 → 숫자)
 */
export const DAY_MAP = {
  'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4,
  'FRI': 5, 'SAT': 6, 'SUN': 7,
  '월': 1, '화': 2, '수': 3, '목': 4,
  '금': 5, '토': 6, '일': 7
};

/**
 * 시간 추천 시 검색할 오프셋 (분 단위)
 * -180분(-3시간)부터 +180분(+3시간)까지
 */
export const SEARCH_OFFSETS = [-180, -120, -60, 60, 120, 180];

/**
 * 시간 제약
 */
export const TIME_CONSTRAINTS = {
  MIN_HOUR: 9,    // 최소 시간 (9시)
  MAX_HOUR: 22,   // 최대 시간 (22시)
};

/**
 * 추천 시간 생성 시 최대 추천 개수
 */
export const MAX_RECOMMENDATIONS = 5;

/**
 * 시간표 조합 생성 시 설정
 */
export const COMBINATION_SETTINGS = {
  MAX_COMBINATIONS: 5,    // 최대 조합 개수
  MAX_ATTEMPTS: 20,       // 조합 생성 시도 횟수
};

/**
 * 채팅창 크기 설정
 */
export const CHAT_SIZE = {
  DESKTOP: {
    WIDTH: '750px',
    HEIGHT: '1125px',
  },
  MOBILE: {
    MAX_HEIGHT: '70vh',
    HEIGHT: '750px',
    MIN_HEIGHT: '600px',
  },
  MESSAGE_AREA: {
    DESKTOP_MIN_HEIGHT: '525px',
    DESKTOP_MAX_HEIGHT: '525px',
    MOBILE_MIN_HEIGHT: '300px',
    MOBILE_MAX_HEIGHT: 'calc(60vh - 140px)',
  },
};

/**
 * 기본 색상
 */
export const DEFAULT_COLORS = {
  SCHEDULE: '#9333ea',  // 스케줄 기본 색상 (보라색)
};

/**
 * 메시지 타입별 스타일 클래스
 */
export const MESSAGE_STYLES = {
  USER: 'bg-blue-500 text-white rounded-br-none',
  LOADING: 'bg-yellow-100 text-yellow-800 rounded-bl-none',
  ERROR: 'bg-red-100 text-red-800 rounded-bl-none',
  SUCCESS: 'bg-green-100 text-green-800 rounded-bl-none',
  SCHEDULE: 'bg-blue-100 text-blue-900 rounded-bl-none',
  DEFAULT: 'bg-gray-100 text-gray-800 rounded-bl-none',
};

/**
 * 시간 형식 정규식
 */
export const TIME_FORMAT_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
