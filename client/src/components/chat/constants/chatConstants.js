/**
 * ===================================================================================================
 * [chatConstants.js] - 채팅 및 스케줄 관련 상수 정의
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > client/src/components/chat/constants/chatConstants.js
 *
 * 🎯 주요 기능:
 *    - 채팅 및 스케줄링 로직 전반에서 사용되는 상수 값들을 중앙에서 관리
 *    - API 기본 URL, 요일 매핑, 시간 제약, 추천 개수 제한 등 하드코딩될 수 있는 값들을 상수로 정의
 *    - 메시지 버블 스타일, 채팅창 크기 등 UI 관련 상수 값 제공
 *
 * 🔗 연결된 파일:
 *    - 채팅 및 스케줄 관련 다수의 컴포넌트, 훅, 핸들러에서 이 파일을 import하여 사용
 *    - 예: `../ChatBox.js`, `../handlers/messageHandlers.js`, `../hooks/useChatState.js`
 *
 * ✏️ 수정 가이드:
 *    - API URL을 변경해야 할 경우: `API_BASE_URL` 상수를 수정합니다. (환경 변수 우선)
 *    - 메시지 버블의 스타일을 변경하려면: `MESSAGE_STYLES` 객체의 Tailwind CSS 클래스를 수정합니다.
 *    - 채팅창의 크기를 조절하려면: `CHAT_SIZE` 객체의 값들을 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 파일은 애플리케이션의 동작과 UI 표현에 영향을 미치는 중요한 설정값들을 포함하고 있습니다.
 *    - 수정 시에는 이 상수를 사용하는 모든 파일에 미치는 영향을 고려해야 합니다.
 *
 * ===================================================================================================
 */

/**
 * @constant {string} API_BASE_URL - 백엔드 API의 기본 URL.
 */
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

/**
 * @constant {object} DAY_MAP - 요일 문자열(한/영)을 숫자(1-7)로 매핑하는 객체.
 */
export const DAY_MAP = {
  'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4,
  'FRI': 5, 'SAT': 6, 'SUN': 7,
  '월': 1, '화': 2, '수': 3, '목': 4,
  '금': 5, '토': 6, '일': 7
};

/**
 * @constant {number[]} SEARCH_OFFSETS - 시간 추천 시 검색할 오프셋(분 단위) 배열.
 */
export const SEARCH_OFFSETS = [-180, -120, -60, 60, 120, 180];

/**
 * @constant {object} TIME_CONSTRAINTS - 스케줄링 시 적용되는 시간 제약 (최소/최대 시간).
 */
export const TIME_CONSTRAINTS = {
  MIN_HOUR: 9,    // 최소 시간 (9시)
  MAX_HOUR: 22,   // 최대 시간 (22시)
};

/**
 * @constant {number} MAX_RECOMMENDATIONS - AI가 한 번에 제안하는 최대 시간 추천 개수.
 */
export const MAX_RECOMMENDATIONS = 5;

/**
 * @constant {object} COMBINATION_SETTINGS - 시간표 조합 생성 시 최대 조합 개수 및 시도 횟수 설정.
 */
export const COMBINATION_SETTINGS = {
  MAX_COMBINATIONS: 5,    // 최대 조합 개수
  MAX_ATTEMPTS: 20,       // 조합 생성 시도 횟수
};

/**
 * @constant {object} CHAT_SIZE - 데스크탑 및 모바일 환경별 채팅창 UI 크기 설정.
 */
export const CHAT_SIZE = {
  DESKTOP: {
    WIDTH: '750px',
    HEIGHT: '1125px',
  },
  MOBILE: {
    MAX_HEIGHT: '55vh',
    HEIGHT: '500px',
    MIN_HEIGHT: '400px',
  },
  MESSAGE_AREA: {
    DESKTOP_MIN_HEIGHT: '525px',
    DESKTOP_MAX_HEIGHT: '525px',
    MOBILE_MIN_HEIGHT: '200px',
    MOBILE_MAX_HEIGHT: 'calc(45vh - 100px)',
  },
};

/**
 * @constant {object} DEFAULT_COLORS - UI 요소에 사용되는 기본 색상.
 */
export const DEFAULT_COLORS = {
  SCHEDULE: '#9333ea',  // 스케줄 기본 색상 (보라색)
};

/**
 * @constant {object} MESSAGE_STYLES - 메시지 유형에 따른 Tailwind CSS 스타일 클래스 매핑.
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
 * @constant {RegExp} TIME_FORMAT_REGEX - "HH:mm" 형식의 시간을 검증하기 위한 정규식.
 */
export const TIME_FORMAT_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;