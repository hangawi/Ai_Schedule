/**
 * ===================================================================================================
 * dayMapping.js - 요일 매핑 상수
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ProfileTab/constants
 *
 * 🎯 주요 기능:
 *    - JavaScript Date의 요일 인덱스(0-6)를 한글 요일명으로 변환
 *    - 요일 이름 배열 제공 (일요일부터 토요일까지)
 *
 * 🔗 연결된 파일:
 *    - ../utils/ownerRoomSync.js - 요일 변환에 사용 (현재 미사용이지만 import됨)
 *    - ../index.js (ProfileTab) - 요일 표시가 필요한 곳에서 사용
 *    - ../components/*.js - 달력 및 스케줄 컴포넌트에서 사용
 *
 * 💡 UI 위치:
 *    - 탭: 프로필 탭 (ProfileTab)
 *    - 섹션: 달력, 시간표, 개인시간 설정
 *    - 경로: 앱 실행 > 프로필 탭 > 요일 표시가 필요한 모든 곳
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 요일 표시 방식이 변경됨
 *    - 요일 형식 변경: '월요일' -> '월' 등으로 축약 가능
 *    - 영문 요일 추가: 새로운 상수 객체 추가 (예: DAY_NAMES_EN)
 *    - 다른 언어 지원: 새로운 매핑 객체 추가
 *
 * 📝 참고사항:
 *    - JavaScript의 getDay()는 0=일요일, 1=월요일, ..., 6=토요일
 *    - DAY_OF_WEEK_MAP: 인덱스로 요일명 조회 (예: DAY_OF_WEEK_MAP[0] = '일요일')
 *    - DAY_NAMES: 배열 순서대로 요일명 제공
 *
 * ===================================================================================================
 */

// 요일 매핑 상수

/**
 * DAY_OF_WEEK_MAP - 요일 인덱스를 한글 요일명으로 변환하는 매핑 객체
 *
 * @description JavaScript Date의 getDay() 반환값(0-6)을 한글 요일명으로 매핑
 * @type {Object.<number, string>}
 * @constant
 *
 * @example
 * const date = new Date('2025-12-08'); // 월요일
 * const dayIndex = date.getDay(); // 1
 * const dayName = DAY_OF_WEEK_MAP[dayIndex]; // '월요일'
 *
 * @note
 * - 0: 일요일, 1: 월요일, 2: 화요일, 3: 수요일, 4: 목요일, 5: 금요일, 6: 토요일
 */
// 요일 매핑 (0: 일, 1: 월, ..., 6: 토)
export const DAY_OF_WEEK_MAP = {
  0: '일요일',
  1: '월요일',
  2: '화요일',
  3: '수요일',
  4: '목요일',
  5: '금요일',
  6: '토요일'
};

/**
 * DAY_NAMES - 요일 이름 배열
 *
 * @description 일요일부터 토요일까지 순서대로 정렬된 한글 요일명 배열
 * @type {string[]}
 * @constant
 *
 * @example
 * DAY_NAMES.forEach((day, index) => {
 *   console.log(`${index}: ${day}`);
 * });
 * // 0: 일요일
 * // 1: 월요일
 * // ...
 * // 6: 토요일
 *
 * @note
 * - DAY_OF_WEEK_MAP과 동일한 순서
 * - 배열 인덱스 = JavaScript의 getDay() 반환값
 */
// 요일 이름 배열
export const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
