/**
 * ===================================================================================================
 * scheduleConstants.js - 스케줄 그리드 상수 정의
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ScheduleGridSelector/constants
 *
 * 🎯 주요 기능:
 *    - 요일 및 월 이름 상수 제공
 *    - 우선순위 설정 및 색상 매핑
 *    - 시간 범위 기본값 정의
 *    - 뷰 모드 및 최대 높이 설정
 *
 * 🔗 연결된 파일:
 *    - ../index.js (ScheduleGridSelector) - 우선순위 설정 및 요일 사용
 *    - ../components/*.js - 요일, 월 이름, 우선순위 색상 참조
 *    - ../hooks/useViewMode.js - 뷰 모드 및 시간 범위 사용
 *    - ../hooks/useTimeSlots.js - 시간 슬롯 간격 사용
 *
 * 💡 UI 위치:
 *    - 탭: 프로필 탭, 기타 스케줄 그리드 사용하는 곳
 *    - 섹션: 스케줄 그리드, 달력 뷰
 *    - 경로: 앱 실행 > 프로필 탭 > 스케줄 선택 그리드
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 스케줄 그리드의 기본 설정이 변경됨
 *    - 우선순위 색상 변경: PRIORITY_CONFIG 수정
 *    - 시간 범위 변경: DEFAULT_TIME_RANGE 수정
 *    - 시간 슬롯 간격 변경: TIME_SLOT_INTERVAL 수정 (예: 10분 -> 15분)
 *
 * 📝 참고사항:
 *    - DAYS: JavaScript 요일 (0=일, 1=월, ..., 6=토)
 *    - PRIORITY_CONFIG: 1=조정가능, 2=보통, 3=선호
 *    - TIME_SLOT_INTERVAL: 10분 단위
 *    - DEFAULT_TIME_RANGE: basic(9-18시), full(0-24시)
 *
 * ===================================================================================================
 */

/**
 * DAYS - 요일 배열
 *
 * @description JavaScript 요일 인덱스와 한글 요일명 매핑
 * @type {Array<Object>}
 * @constant
 *
 * @example
 * DAYS.forEach(day => console.log(`${day.name}: ${day.dayOfWeek}`));
 * // 일: 0, 월: 1, 화: 2, ..., 토: 6
 *
 * @note
 * - dayOfWeek: JavaScript의 getDay() 반환값 (0=일요일)
 */
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

/**
 * MONTH_NAMES - 월 이름 배열
 *
 * @description 1월부터 12월까지 한글 월 이름
 * @type {string[]}
 * @constant
 *
 * @example
 * const currentMonth = MONTH_NAMES[new Date().getMonth()];
 *
 * @note
 * - 인덱스 0부터 시작 (0=1월, 1=2월, ...)
 */
// 월 이름 배열
export const MONTH_NAMES = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월'
];

/**
 * PRIORITY_CONFIG - 우선순위 설정
 *
 * @description 시간표 우선순위별 라벨 및 색상 정의
 * @type {Object.<number, Object>}
 * @constant
 *
 * @property {Object} 3 - 선호 (진한 파란색)
 * @property {Object} 2 - 보통 (중간 파란색)
 * @property {Object} 1 - 조정 가능 (연한 파란색)
 *
 * @example
 * const priorityLabel = PRIORITY_CONFIG[3].label; // '선호'
 * const priorityColor = PRIORITY_CONFIG[3].color; // 'bg-blue-600'
 *
 * @note
 * - 숫자가 높을수록 우선순위 높음
 * - color는 Tailwind CSS 클래스
 */
// 우선순위 설정
export const PRIORITY_CONFIG = {
  3: { label: '선호', color: 'bg-blue-600' },
  2: { label: '보통', color: 'bg-blue-400' },
  1: { label: '조정 가능', color: 'bg-blue-200' },
};

/**
 * PRIORITY_COLOR_MAP - 우선순위 색상 맵핑
 *
 * @description Tailwind CSS 클래스를 hex 색상 코드로 변환
 * @type {Object.<string, string>}
 * @constant
 *
 * @example
 * const hexColor = PRIORITY_COLOR_MAP['bg-blue-600']; // '#2563eb'
 *
 * @note
 * - MergedWeekView 등에서 inline 스타일 적용 시 사용
 */
// 우선순위 색상 맵핑
export const PRIORITY_COLOR_MAP = {
  'bg-blue-600': '#2563eb',  // 선호 (priority 3)
  'bg-blue-400': '#60a5fa',  // 보통 (priority 2)
  'bg-blue-200': '#bfdbfe'   // 조정 가능 (priority 1)
};

/**
 * DAY_MAP - 요일 문자열을 숫자로 변환하는 맵핑
 *
 * @description 영문/한글 요일명을 숫자로 변환
 * @type {Object.<string, number>}
 * @constant
 *
 * @example
 * const dayNum = DAY_MAP['월']; // 1
 * const dayNum2 = DAY_MAP['MON']; // 1
 *
 * @note
 * - 1=월요일, 7=일요일 (데이터베이스 형식)
 * - JavaScript getDay()와 다름 (0=일요일)
 */
// 요일 맵핑 (문자열 → 숫자)
export const DAY_MAP = {
  'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4,
  'FRI': 5, 'SAT': 6, 'SUN': 7,
  '월': 1, '화': 2, '수': 3, '목': 4,
  '금': 5, '토': 6, '일': 7
};

/**
 * DEFAULT_TIME_RANGE - 기본 시간 범위
 *
 * @description 시간표에서 사용하는 기본 시간 범위 설정
 * @type {Object}
 * @constant
 *
 * @property {Object} basic - 기본 모드 (9시~18시)
 * @property {Object} full - 24시간 모드 (0시~24시)
 *
 * @example
 * const startHour = DEFAULT_TIME_RANGE.basic.start; // 9
 * const endHour = DEFAULT_TIME_RANGE.basic.end; // 18
 *
 * @note
 * - basic: 일반적인 활동 시간대
 * - full: 수면시간 포함 전체 시간대
 */
// 기본 시간 범위
export const DEFAULT_TIME_RANGE = {
  basic: { start: 9, end: 18 },
  full: { start: 0, end: 24 }
};

/**
 * TIME_SLOT_INTERVAL - 시간 슬롯 간격 (분)
 *
 * @description 시간표 그리드의 최소 시간 단위
 * @type {number}
 * @constant
 *
 * @example
 * // 09:00, 09:10, 09:20, ... (10분 간격)
 * const interval = TIME_SLOT_INTERVAL; // 10
 *
 * @note
 * - 기본값: 10분
 * - 변경 시 generateTimeSlots 함수 영향받음
 */
// 시간 슬롯 간격 (분)
export const TIME_SLOT_INTERVAL = 10;

/**
 * VIEW_MODES - 뷰 모드
 *
 * @description 스케줄 그리드의 표시 모드
 * @type {Object}
 * @constant
 *
 * @property {string} WEEK - 주간 뷰
 * @property {string} MONTH - 월간 뷰
 *
 * @example
 * const currentView = VIEW_MODES.WEEK; // 'week'
 * if (viewMode === VIEW_MODES.MONTH) { ... }
 *
 * @note
 * - useViewMode 훅에서 기본값으로 사용
 */
// 뷰 모드
export const VIEW_MODES = {
  WEEK: 'week',
  MONTH: 'month'
};

/**
 * MAX_HEIGHTS - 최대 높이 설정
 *
 * @description 각 뷰 모드별 최대 높이 제한
 * @type {Object}
 * @constant
 *
 * @property {string} MERGED_VIEW - 병합 뷰 최대 높이
 * @property {string} DETAILED_VIEW - 상세 뷰 최대 높이
 * @property {string} MODAL - 모달 최대 높이
 *
 * @example
 * <div style={{ maxHeight: MAX_HEIGHTS.MERGED_VIEW }}>...</div>
 *
 * @note
 * - CSS 스타일 값 (px, vh 등 포함)
 */
// 최대 높이 설정
export const MAX_HEIGHTS = {
  MERGED_VIEW: '1000px',
  DETAILED_VIEW: '600px',
  MODAL: 'calc(85vh - 80px)'
};
