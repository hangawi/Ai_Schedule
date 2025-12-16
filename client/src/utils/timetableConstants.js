/**
 * ===================================================================================================
 * timetableConstants.js - 타임테이블(시간표) 및 조율 관련 기능에서 사용되는 상수와 설정을 정의하는 파일
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/utils/timetableConstants.js
 *
 * 🎯 주요 기능:
 *    - 요일 이름 정의 (영어, 한국어, 주말 포함).
 *    - 기본 스케줄 시간 범위 정의 (`DEFAULT_SCHEDULE_START_HOUR`, `DEFAULT_SCHEDULE_END_HOUR`).
 *    - 시간 슬롯 간격 (`TIME_SLOT_INTERVAL`), 기본 색상 (`DEFAULT_COLORS`) 등 UI 관련 상수 정의.
 *    - 요청 유형 (`REQUEST_TYPES`), 모달 유형 (`MODAL_TYPES`), 변경 요청 액션 (`CHANGE_ACTIONS`) 등 조율 기능 관련 상수 정의.
 *    - UI 요소(버튼, 알림)에 대한 스타일 및 유형 상수 정의.
 *
 * 🔗 연결된 파일:
 *    - ../components/timetable/*: 시간표 관련 컴포넌트에서 요일, 시간, 색상 등의 상수를 사용.
 *    - ../components/tabs/CoordinationTab/: 조율 탭에서 요청, 모달, 액션 유형 등의 상수를 사용.
 *    - ../utils/coordinationHandlers.js: 요청 데이터 생성 시 `REQUEST_TYPES`, `CHANGE_ACTIONS` 사용.
 *
 * 💡 UI 위치:
 *    - 이 파일의 상수들은 UI에 직접 표시되지 않으나, 시간표의 요일 헤더, 시간 표시, 버튼 스타일, 알림 유형 등 UI의 다양한 부분에 영향을 미침.
 *
 * ✏️ 수정 가이드:
 *    - 요일 표시 순서나 이름을 변경할 경우: `DAY_NAMES`, `DAY_NAMES_KOREAN` 배열을 수정.
 *    - 시간표의 기본 표시 시간 범위를 변경할 경우: `DEFAULT_SCHEDULE_START_HOUR`, `DEFAULT_SCHEDULE_END_HOUR` 값을 수정.
 *    - 새로운 요청이나 액션 유형을 추가할 경우: `REQUEST_TYPES`, `CHANGE_ACTIONS` 객체에 새로운 상수를 추가.
 *    - 버튼 스타일을 변경할 경우: `BUTTON_STYLES` 객체의 클래스 이름을 수정.
 *
 * 📝 참고사항:
 *    - 이 파일은 애플리케이션 전반에서 사용되는 상수들을 중앙에서 관리하여 일관성을 유지하고 유지보수를 용이하게 함.
 *
 * ===================================================================================================
 */

// Day names in English (used for logic)
export const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

// Day names in Korean (used for display)
export const DAY_NAMES_KOREAN = ['월', '화', '수', '목', '금'];

// Day names in Korean including weekends (for date display)
export const DAY_NAMES_KOREAN_FULL = ['일', '월', '화', '수', '목', '금', '토'];

// Display labels for days (legacy support)
export const DAYS = ['월', '화', '수', '목', '금'];

// Default schedule hours
export const DEFAULT_SCHEDULE_START_HOUR = 9;
export const DEFAULT_SCHEDULE_END_HOUR = 18;

// Time slot interval in minutes
export const TIME_SLOT_INTERVAL = 30;

// Default colors for various UI elements
export const DEFAULT_COLORS = {
  UNKNOWN_USER: '#6B7280',
};

// Request types
export const REQUEST_TYPES = {
  TIME_REQUEST: 'time_request',
  TIME_CHANGE: 'time_change',
  SLOT_SWAP: 'slot_swap',
  SLOT_RELEASE: 'slot_release',
};

// Request debounce time in milliseconds
export const REQUEST_DEBOUNCE_TIME = 5000;

// Modal types
export const MODAL_TYPES = {
  ASSIGN: 'assign',
  REQUEST: 'request',
  CHANGE_REQUEST: 'change_request',
};

// Change request actions
export const CHANGE_ACTIONS = {
  RELEASE: 'release',
  SWAP: 'swap',
  CHANGE: 'change',
};

// Button styles for different actions
export const BUTTON_STYLES = {
  [CHANGE_ACTIONS.RELEASE]: 'bg-red-600 hover:bg-red-700',
  [CHANGE_ACTIONS.SWAP]: 'bg-blue-600 hover:bg-blue-700',
  [CHANGE_ACTIONS.CHANGE]: 'bg-purple-600 hover:bg-purple-700',
};

// Alert types
export const ALERT_TYPES = {
  WARNING: 'warning',
  ERROR: 'error',
  SUCCESS: 'success',
  INFO: 'info',
};