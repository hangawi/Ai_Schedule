// 요일 매핑
export const DAY_MAP = {
  'monday': '월요일',
  'tuesday': '화요일', 
  'wednesday': '수요일',
  'thursday': '목요일',
  'friday': '금요일',
  'saturday': '토요일',
  'sunday': '일요일'
};

// 요일 이름 배열
export const DAY_NAMES = ['월', '화', '수', '목', '금'];
export const DAY_NAMES_ENGLISH = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

// 요청 상태
export const REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

// 요청 타입
export const REQUEST_TYPES = {
  SLOT_SWAP: 'slot_swap',
  TIME_REQUEST: 'time_request',
  TIME_CHANGE: 'time_change'
};