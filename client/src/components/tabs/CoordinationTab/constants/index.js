/**
 * ===================================================================================================
 * [파일명] constants/index.js - CoordinationTab 관련 상수 모음
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > [client/src/components/tabs/CoordinationTab/constants/index.js]
 *
 * 🎯 주요 기능:
 *    - 'CoordinationTab' 및 그 하위 컴포넌트들에서 공통적으로 사용되는 상수들을 정의하고 export.
 *    - "매직 넘버"나 "매직 스트링"을 코드에서 제거하여 가독성과 유지보수성을 높이는 역할.
 *
 * 🔗 연결된 파일:
 *    - ../index.js (CoordinationTab): 이 파일에 정의된 상수들을 import하여 초기 상태 설정 등에 사용.
 *    - ../components/*: 여러 하위 컴포넌트에서 뷰 모드, 탭 타입 등을 구분하기 위해 상수를 사용.
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 협업 탭 전반에 걸쳐 사용되는 기본값, 키 값 등이 변경될 수 있습니다.
 *    - 새로운 상수 추가: 협업 탭 내에서 반복적으로 사용되는 값이 있다면 이곳에 추가하여 관리하는 것이 좋습니다.
 *
 * 📝 참고사항:
 *    - 이 파일은 어떠한 로직도 포함하지 않으며, 오직 상수 데이터의 정의와 export만을 담당합니다.
 *    - 예를 들어, 뷰 모드('week', 'month')나 탭 종류('owned', 'joined') 같은 문자열들을 상수로 관리하여 오타를 방지하고 코드의 의도를 명확하게 합니다.
 *
 * ===================================================================================================
 */

// Request view modes
export const REQUEST_VIEW_MODES = {
  RECEIVED: 'received',
  SENT: 'sent'
};

// Initial expanded sections state
export const INITIAL_EXPANDED_SECTIONS = {
  receivedProcessed: true,
  sentProcessed: true
};

// Tab types
export const TAB_TYPES = {
  OWNED: 'owned',
  JOINED: 'joined'
};

// Modal default tabs
export const MODAL_DEFAULT_TABS = {
  INFO: 'info',
  LOGS: 'logs'
};

// Day of week mapping for sync
export const DAY_OF_WEEK_MAP = {
  0: '일요일',
  1: '월요일',
  2: '화요일',
  3: '수요일',
  4: '목요일',
  5: '금요일',
  6: '토요일'
};

// Days array for request calculation
export const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

// Day name to index mapping
export const DAY_NAME_TO_INDEX = {
  'monday': 1,
  'tuesday': 2,
  'wednesday': 3,
  'thursday': 4,
  'friday': 5
};

// Initial schedule options
export const INITIAL_SCHEDULE_OPTIONS = {
  minHoursPerWeek: 3,
  ownerFocusTime: 'none'
};

// Initial custom alert state
export const INITIAL_CUSTOM_ALERT = {
  show: false,
  message: '',
  type: 'warning'
};

// View modes
export const VIEW_MODES = {
  WEEK: 'week',
  MONTH: 'month',
  GRID: 'grid'
};