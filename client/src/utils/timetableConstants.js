/**
 * Constants and configurations for timetable operations
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