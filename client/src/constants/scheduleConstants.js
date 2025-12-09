/**
 * ===================================================================================================
 * scheduleConstants.js - 스케줄 관련 상수 정의
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/constants
 *
 * 🎯 주요 기능:
 *    - 시간 슬롯의 우선순위 설정 (`priorityConfig`)
 *    - 주간 요일 이름 정의 (`DAYS_OF_WEEK`)
 *
 * 🔗 연결된 파일:
 *    - src/components/calendar/DetailTimeGrid/constants/priorityConfig.js - 우선순위 설정에 사용
 *    - src/components/schedule/PersonalTimeManager.js - 개인 시간 관리에 사용
 *    - src/components/tabs/ProfileTab/constants/priorityConfig.js - 프로필 탭의 우선순위 설정에 사용
 *
 * ✏️ 수정 가이드:
 *    - 우선순위 레벨 추가/변경: `priorityConfig` 객체에 새로운 속성 추가 또는 기존 값 수정
 *    - 요일 이름 변경: `DAYS_OF_WEEK` 배열의 요소 수정
 *
 * 📝 참고사항:
 *    - `priorityConfig`는 각 우선순위 레벨에 대한 라벨, 색상, 다음 우선순위 레벨을 정의합니다.
 *    - `DAYS_OF_WEEK`는 일요일부터 시작하는 배열입니다.
 *
 * ===================================================================================================
 */
export const priorityConfig = {
  3: { label: '선호', color: 'bg-blue-600', next: 2 },
  2: { label: '보통', color: 'bg-blue-400', next: 1 },
  1: { label: '조정 가능', color: 'bg-blue-200', next: null },
  0: { label: '없어짐', color: 'bg-gray-200', next: null },
};

export const DAYS_OF_WEEK = ['일', '월', '화', '수', '목', '금', '토'];