// CoordinationTab Constants

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
