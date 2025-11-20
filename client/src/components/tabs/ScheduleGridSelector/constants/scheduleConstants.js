// 요일 배열
export const DAYS = [
  { name: '일', dayOfWeek: 0 },
  { name: '월', dayOfWeek: 1 },
  { name: '화', dayOfWeek: 2 },
  { name: '수', dayOfWeek: 3 },
  { name: '목', dayOfWeek: 4 },
  { name: '금', dayOfWeek: 5 },
  { name: '토', dayOfWeek: 6 },
];

// 월 이름 배열
export const MONTH_NAMES = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월'
];

// 우선순위 설정
export const PRIORITY_CONFIG = {
  3: { label: '선호', color: 'bg-blue-600' },
  2: { label: '보통', color: 'bg-blue-400' },
  1: { label: '조정 가능', color: 'bg-blue-200' },
};

// 우선순위 색상 맵핑
export const PRIORITY_COLOR_MAP = {
  'bg-blue-600': '#2563eb',  // 선호 (priority 3)
  'bg-blue-400': '#60a5fa',  // 보통 (priority 2)
  'bg-blue-200': '#bfdbfe'   // 조정 가능 (priority 1)
};

// 요일 맵핑 (문자열 → 숫자)
export const DAY_MAP = {
  'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4,
  'FRI': 5, 'SAT': 6, 'SUN': 7,
  '월': 1, '화': 2, '수': 3, '목': 4,
  '금': 5, '토': 6, '일': 7
};

// 기본 시간 범위
export const DEFAULT_TIME_RANGE = {
  basic: { start: 9, end: 18 },
  full: { start: 0, end: 24 }
};

// 시간 슬롯 간격 (분)
export const TIME_SLOT_INTERVAL = 10;

// 뷰 모드
export const VIEW_MODES = {
  WEEK: 'week',
  MONTH: 'month'
};

// 최대 높이 설정
export const MAX_HEIGHTS = {
  MERGED_VIEW: '1000px',
  DETAILED_VIEW: '600px',
  MODAL: 'calc(85vh - 80px)'
};
