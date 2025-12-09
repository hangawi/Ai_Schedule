/**
 * ===================================================================================================
 * coordination.js - 조율 기능 관련 상수 정의
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/constants
 *
 * 🎯 주요 기능:
 *    - 요일 매핑(영어 <-> 한글) 정의
 *    - 요청(request)의 상태(status) 정의 (대기, 승인, 거절)
 *    - 요청(request)의 타입(type) 정의 (슬롯 교환, 시간 요청, 시간 변경)
 *
 * 🔗 연결된 파일:
 *    - src/components/tabs/CoordinationTab/* - 조율 관련 UI 컴포넌트에서 사용
 *    - src/utils/coordinationHandlers.js - 조율 로직 처리 시 사용
 *    - src/services/coordinationService.js - API 요청 및 응답 처리 시 사용
 *
 * ✏️ 수정 가이드:
 *    - 새로운 요일을 추가하려면: `DAY_MAP`, `DAY_NAMES`, `DAY_NAMES_ENGLISH`에 항목 추가
 *    - 새로운 요청 상태를 추가하려면: `REQUEST_STATUS` 객체에 새로운 속성 추가
 *    - 새로운 요청 타입을 추가하려면: `REQUEST_TYPES` 객체에 새로운 속성 추가
 *
 * 📝 참고사항:
 *    - `DAY_MAP`은 백엔드 및 Google Calendar API와의 일관성을 위해 영어 키를 사용합니다.
 *    - `DAY_NAMES`는 UI 표시를 위한 한글 요일명입니다.
 *
 * ===================================================================================================
 */
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