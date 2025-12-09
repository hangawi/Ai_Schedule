/**
 * ===================================================================================================
 * useMonthNavigation.js - 월간 네비게이션 관리 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ScheduleGridSelector/hooks
 *
 * 🎯 주요 기능:
 *    - 월 단위 네비게이션 (이전/다음 월)
 *    - 오늘 날짜로 이동
 *
 * 🔗 연결된 파일:
 *    - ../index.js (ScheduleGridSelector) - 이 훅을 사용하여 월 네비게이션 처리
 *    - ./useWeekNavigation.js - currentDate 상태 공유
 *    - ../components/ViewControls.js - 네비게이션 버튼에서 호출
 *
 * 💡 UI 위치:
 *    - 탭: 프로필 탭
 *    - 섹션: 스케줄 그리드 상단 컨트롤 바
 *    - 경로: 앱 실행 > 프로필 탭 > 스케줄 그리드 > 월간 뷰 > 이전/다음 버튼
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 월간 네비게이션 동작이 변경됨
 *    - 네비게이션 로직 변경: navigateMonth 함수 수정
 *    - 오늘 이동 로직 변경: goToToday 함수 수정
 *
 * 📝 참고사항:
 *    - currentDate는 useWeekNavigation과 공유
 *    - setCurrentDate로 날짜 변경 시 주간 뷰에도 영향
 *    - 월 단위로 이동하며 일(day)은 유지
 *
 * ===================================================================================================
 */

/**
 * useMonthNavigation - 월간 네비게이션 관련 함수를 제공하는 커스텀 훅
 *
 * @description 월 단위로 이전/다음 월로 이동하거나 오늘로 이동하는 함수 제공
 * @param {Date} currentDate - 현재 날짜
 * @param {Function} setCurrentDate - 날짜 설정 함수
 * @returns {Object} 월간 네비게이션 함수들
 * @returns {Function} return.navigateMonth - 월 이동 함수
 * @returns {Function} return.goToToday - 오늘로 이동 함수
 *
 * @example
 * const { navigateMonth, goToToday } = useMonthNavigation(currentDate, setCurrentDate);
 *
 * // 다음 월로 이동
 * navigateMonth(1);
 *
 * // 이전 월로 이동
 * navigateMonth(-1);
 *
 * // 오늘로 이동
 * goToToday();
 *
 * @note
 * - currentDate는 useWeekNavigation과 공유됨
 * - 월 이동 시 일(day)은 유지됨 (예: 1월 15일 -> 2월 15일)
 * - 유효하지 않은 날짜는 자동 조정됨 (예: 1월 31일 -> 2월 28일)
 */
const useMonthNavigation = (currentDate, setCurrentDate) => {
  /**
   * navigateMonth - 월 단위 네비게이션
   *
   * @description 현재 날짜를 기준으로 지정한 방향으로 월 단위 이동
   * @param {number} direction - 이동 방향 (1: 다음 달, -1: 이전 달)
   *
   * @example
   * navigateMonth(1);  // 다음 달로 이동
   * navigateMonth(-1); // 이전 달로 이동
   *
   * @note
   * - 새로운 Date 객체 생성하여 불변성 유지
   * - setMonth로 월 변경 (연도 자동 조정됨)
   */
  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  /**
   * goToToday - 오늘 날짜로 이동
   *
   * @description 현재 날짜를 오늘로 설정
   *
   * @example
   * goToToday(); // 현재 날짜가 오늘로 변경됨
   *
   * @note
   * - 주간 뷰와 월간 뷰 모두 오늘 날짜로 이동
   * - useWeekNavigation에도 동일한 함수 있음 (중복)
   */
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  return {
    navigateMonth,
    goToToday
  };
};

export default useMonthNavigation;
