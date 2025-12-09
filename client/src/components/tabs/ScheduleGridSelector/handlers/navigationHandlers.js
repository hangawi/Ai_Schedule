/**
 * ===================================================================================================
 * navigationHandlers.js - 네비게이션 핸들러 팩토리 함수
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ScheduleGridSelector/handlers
 *
 * 🎯 주요 기능:
 *    - 주간 네비게이션 핸들러 생성 (이전/다음 주)
 *    - 월간 네비게이션 핸들러 생성 (이전/다음 월)
 *    - 뷰 모드 토글 핸들러 생성 (시간범위, 뷰모드, 병합모드)
 *    - 날짜 클릭 핸들러 생성
 *
 * 🔗 연결된 파일:
 *    - ../index.js (ScheduleGridSelector) - 핸들러 생성 및 사용
 *    - ../components/ViewControls.js - 버튼 클릭 시 핸들러 호출
 *    - ../hooks/useWeekNavigation.js - navigateWeek 함수 제공
 *    - ../hooks/useMonthNavigation.js - navigateMonth 함수 제공
 *    - ../hooks/useViewMode.js - 토글 함수들 제공
 *
 * 💡 UI 위치:
 *    - 탭: 프로필 탭
 *    - 섹션: 스케줄 그리드 상단 컨트롤 바
 *    - 경로: 앱 실행 > 프로필 탭 > 스케줄 그리드 > 버튼 클릭
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 네비게이션 동작 방식이 변경됨
 *    - 새 핸들러 추가: createXXXHandlers 함수 추가
 *    - 핸들러 로직 변경: 반환 객체의 함수 수정
 *
 * 📝 참고사항:
 *    - 팩토리 패턴으로 의존성 주입 (클로저 활용)
 *    - 핸들러는 순수 함수로 구성
 *    - 각 핸들러는 컴포넌트에서 독립적으로 사용 가능
 *
 * ===================================================================================================
 */

/**
 * 네비게이션 핸들러 팩토리 함수들
 * 클로저를 활용하여 의존성 주입
 */

/**
 * createWeekHandlers - 주간 네비게이션 핸들러 생성
 *
 * @description 주간 뷰에서 이전/다음 주로 이동하는 핸들러 생성
 * @param {Function} navigateWeek - 주 네비게이션 함수 (direction: number) => void
 * @returns {Object} 주간 네비게이션 핸들러들
 * @returns {Function} return.navigateWeek - 원본 navigateWeek 함수
 * @returns {Function} return.handlePrevWeek - 이전 주로 이동 핸들러
 * @returns {Function} return.handleNextWeek - 다음 주로 이동 핸들러
 *
 * @example
 * const weekHandlers = createWeekHandlers(navigateWeek);
 * <button onClick={weekHandlers.handlePrevWeek}>이전 주</button>
 * <button onClick={weekHandlers.handleNextWeek}>다음 주</button>
 *
 * @note
 * - direction: 1 (다음 주), -1 (이전 주)
 * - 클로저를 활용하여 navigateWeek 함수 캡처
 */
export const createWeekHandlers = (navigateWeek) => {
  return {
    navigateWeek,  // navigateWeek 함수 자체도 포함
    handlePrevWeek: () => navigateWeek(-1),
    handleNextWeek: () => navigateWeek(1)
  };
};

/**
 * createMonthHandlers - 월간 네비게이션 핸들러 생성
 *
 * @description 월간 뷰에서 이전/다음 월로 이동하는 핸들러 생성
 * @param {Function} navigateMonth - 월 네비게이션 함수 (direction: number) => void
 * @returns {Object} 월간 네비게이션 핸들러들
 * @returns {Function} return.navigateMonth - 원본 navigateMonth 함수
 * @returns {Function} return.handlePrevMonth - 이전 월로 이동 핸들러
 * @returns {Function} return.handleNextMonth - 다음 월로 이동 핸들러
 *
 * @example
 * const monthHandlers = createMonthHandlers(navigateMonth);
 * <button onClick={monthHandlers.handlePrevMonth}>이전 월</button>
 * <button onClick={monthHandlers.handleNextMonth}>다음 월</button>
 *
 * @note
 * - direction: 1 (다음 월), -1 (이전 월)
 * - 클로저를 활용하여 navigateMonth 함수 캡처
 */
export const createMonthHandlers = (navigateMonth) => {
  return {
    navigateMonth,  // navigateMonth 함수 자체도 포함
    handlePrevMonth: () => navigateMonth(-1),
    handleNextMonth: () => navigateMonth(1)
  };
};

/**
 * createViewHandlers - 뷰 모드 토글 핸들러 생성
 *
 * @description 시간 범위, 뷰 모드, 병합 모드를 토글하는 핸들러 생성
 * @param {Function} toggleTimeRange - 시간 범위 토글 함수 (9-18시 ↔ 24시간)
 * @param {Function} toggleViewMode - 뷰 모드 토글 함수 (주간 ↔ 월간)
 * @param {Function} toggleMerged - 병합 모드 토글 함수 (병합 ↔ 분할)
 * @returns {Object} 뷰 모드 핸들러들
 * @returns {Function} return.handleToggleTimeRange - 시간 범위 토글 핸들러
 * @returns {Function} return.handleToggleViewMode - 뷰 모드 토글 핸들러
 * @returns {Function} return.handleToggleMerged - 병합 모드 토글 핸들러
 *
 * @example
 * const viewHandlers = createViewHandlers(toggleTimeRange, toggleViewMode, toggleMerged);
 * <button onClick={viewHandlers.handleToggleTimeRange}>24시간</button>
 * <button onClick={viewHandlers.handleToggleMerged}>병합</button>
 *
 * @note
 * - 토글 함수는 boolean 상태를 반전시킴
 * - ViewControls 컴포넌트에서 사용
 */
export const createViewHandlers = (toggleTimeRange, toggleViewMode, toggleMerged) => {
  return {
    handleToggleTimeRange: toggleTimeRange,
    handleToggleViewMode: toggleViewMode,
    handleToggleMerged: toggleMerged
  };
};

/**
 * createDateClickHandler - 날짜 클릭 핸들러 생성
 *
 * @description 월간 뷰에서 날짜 클릭 시 상세 모달을 여는 핸들러 생성
 * @param {Function} openDateDetail - 날짜 상세 열기 함수 (date: Object) => void
 * @returns {Function} 날짜 클릭 핸들러
 *
 * @example
 * const dateClickHandler = createDateClickHandler(openDateDetail);
 * <div onClick={() => dateClickHandler(dayData)}>날짜 셀</div>
 *
 * @note
 * - date 객체는 날짜 정보 및 요일 정보 포함
 * - DateDetailModal 오픈 트리거
 */
export const createDateClickHandler = (openDateDetail) => {
  return (date) => {
    openDateDetail(date);
  };
};
