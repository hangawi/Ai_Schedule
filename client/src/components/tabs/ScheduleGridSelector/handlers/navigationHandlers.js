/**
 * 네비게이션 핸들러 팩토리 함수들
 * 클로저를 활용하여 의존성 주입
 */

/**
 * 주간 네비게이션 핸들러 생성
 * @param {Function} navigateWeek - 주 네비게이션 함수
 * @returns {Object} 주간 네비게이션 핸들러들
 */
export const createWeekHandlers = (navigateWeek) => {
  return {
    handlePrevWeek: () => navigateWeek(-1),
    handleNextWeek: () => navigateWeek(1)
  };
};

/**
 * 월간 네비게이션 핸들러 생성
 * @param {Function} navigateMonth - 월 네비게이션 함수
 * @returns {Object} 월간 네비게이션 핸들러들
 */
export const createMonthHandlers = (navigateMonth) => {
  return {
    handlePrevMonth: () => navigateMonth(-1),
    handleNextMonth: () => navigateMonth(1)
  };
};

/**
 * 뷰 모드 토글 핸들러 생성
 * @param {Function} toggleTimeRange - 시간 범위 토글 함수
 * @param {Function} toggleViewMode - 뷰 모드 토글 함수
 * @param {Function} toggleMerged - 병합 모드 토글 함수
 * @returns {Object} 뷰 모드 핸들러들
 */
export const createViewHandlers = (toggleTimeRange, toggleViewMode, toggleMerged) => {
  return {
    handleToggleTimeRange: toggleTimeRange,
    handleToggleViewMode: toggleViewMode,
    handleToggleMerged: toggleMerged
  };
};

/**
 * 날짜 클릭 핸들러 생성
 * @param {Function} openDateDetail - 날짜 상세 열기 함수
 * @returns {Function} 날짜 클릭 핸들러
 */
export const createDateClickHandler = (openDateDetail) => {
  return (date) => {
    openDateDetail(date);
  };
};
