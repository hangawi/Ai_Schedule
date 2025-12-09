/**
 * ===================================================================================================
 * messages.js - 알림 메시지 상수
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ProfileTab/constants
 *
 * 🎯 주요 기능:
 *    - 프로필 탭에서 사용하는 모든 알림 메시지를 중앙 관리
 *    - 저장 성공/실패, 초기화, 빈 상태 안내 메시지 제공
 *    - 알림 제목 상수 제공
 *
 * 🔗 연결된 파일:
 *    - ../index.js (ProfileTab) - 알림 표시 시 메시지 사용
 *    - ../handlers/saveHandlers.js - 저장 성공/실패 메시지 사용
 *    - ../handlers/clearHandlers.js - 초기화 메시지 사용
 *    - ../components/*.js - 빈 상태 안내 메시지 사용
 *
 * 💡 UI 위치:
 *    - 탭: 프로필 탭 (ProfileTab)
 *    - 섹션: 알림 팝업, 빈 상태 안내
 *    - 경로: 앱 실행 > 프로필 탭 > 저장/초기화/에러 발생 시 표시
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 알림 메시지 내용이 변경됨
 *    - 새 메시지 추가: MESSAGES 또는 TITLES 객체에 새 키/값 추가
 *    - 메시지 내용 변경: 해당 키의 값 수정
 *    - 다국어 지원: 메시지 객체를 함수로 변경하여 언어별 분기
 *
 * 📝 참고사항:
 *    - 모든 메시지를 한 곳에서 관리하여 일관성 유지
 *    - 메시지 변경 시 코드 수정 없이 이 파일만 수정
 *    - MESSAGES: 알림 본문 메시지
 *    - TITLES: 알림 제목 메시지
 *
 * ===================================================================================================
 */

// 알림 메시지 상수

/**
 * MESSAGES - 알림 본문 메시지 상수
 *
 * @description 프로필 탭에서 사용하는 모든 알림 메시지를 정의
 * @type {Object.<string, string>}
 * @constant
 *
 * @property {string} SAVE_SUCCESS - 저장 성공 메시지
 * @property {string} SAVE_ERROR - 저장 실패 메시지 (에러 메시지 앞에 표시)
 * @property {string} CLEAR_IN_EDIT_MODE - 편집 모드 초기화 안내 메시지
 * @property {string} NO_PREFERENCE_TIME - 선호시간 미설정 안내 메시지
 * @property {string} NO_PREFERENCE_TIME_HELP - 선호시간 추가 방법 안내
 * @property {string} NO_SPECIFIC_DATE_PREFERENCE - 특정 날짜 선호시간 미설정 안내
 * @property {string} NO_SPECIFIC_DATE_HELP - 날짜별 시간 추가 방법 안내
 * @property {string} VIEW_INFO_READ_ONLY - 읽기 전용 모드 안내 메시지
 * @property {string} VIEW_INFO_EDITING - 편집 모드 안내 메시지 (색상 설명 포함)
 *
 * @example
 * showAlert({ title: TITLES.SAVE_COMPLETE, message: MESSAGES.SAVE_SUCCESS });
 * showAlert({ title: TITLES.ERROR, message: MESSAGES.SAVE_ERROR + error.message });
 *
 * @note
 * - 편집 모드 vs 읽기 모드에 따라 다른 메시지 사용
 * - 색상 설명: 파란색(기본), 초록색(예외), 빨간색(개인시간)
 */
export const MESSAGES = {
  SAVE_SUCCESS: '기본 시간표, 예외 일정 및 개인 시간이 저장되었습니다!',
  SAVE_ERROR: '저장에 실패했습니다: ',
  CLEAR_IN_EDIT_MODE: '편집 모드에서 초기화되었습니다. 저장 버튼을 눌러야 실제로 저장됩니다.',
  NO_PREFERENCE_TIME: '아직 선호시간이 설정되지 않았습니다.',
  NO_PREFERENCE_TIME_HELP: '위 달력에서 날짜를 클릭하여 시간을 추가하세요.',
  NO_SPECIFIC_DATE_PREFERENCE: '특정 날짜에 선호시간이 설정되지 않았습니다.',
  NO_SPECIFIC_DATE_HELP: '달력에서 날짜를 클릭하여 시간을 추가하세요.',
  VIEW_INFO_READ_ONLY: '현재 설정된 기본 일정을 확인할 수 있습니다. 날짜를 클릭하면 세부 시간표를 볼 수 있습니다.',
  VIEW_INFO_EDITING: '날짜를 클릭하여 세부 시간표를 설정하세요. 파란색은 기본 일정, 초록색은 예외 일정, 빨간색은 개인 시간입니다.'
};

/**
 * TITLES - 알림 제목 상수
 *
 * @description 알림 팝업의 제목으로 사용되는 상수
 * @type {Object.<string, string>}
 * @constant
 *
 * @property {string} SAVE_COMPLETE - 저장 완료 제목
 * @property {string} ERROR - 오류 제목
 * @property {string} CLEAR - 초기화 제목
 * @property {string} NOTIFICATION - 알림 제목
 *
 * @example
 * showAlert({ title: TITLES.SAVE_COMPLETE, message: '저장되었습니다.' });
 * showAlert({ title: TITLES.ERROR, message: '오류가 발생했습니다.' });
 *
 * @note
 * - 짧고 명확한 제목 사용
 * - MESSAGES와 조합하여 사용
 */
export const TITLES = {
  SAVE_COMPLETE: '저장 완료',
  ERROR: '오류',
  CLEAR: '초기화',
  NOTIFICATION: '알림'
};
