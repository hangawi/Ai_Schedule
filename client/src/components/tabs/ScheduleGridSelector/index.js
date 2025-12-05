import React from 'react';
import { PRIORITY_CONFIG } from './constants/scheduleConstants';
import useWeekNavigation from './hooks/useWeekNavigation';
import useMonthNavigation from './hooks/useMonthNavigation';
import useViewMode from './hooks/useViewMode';
import useTimeSlots from './hooks/useTimeSlots';
import useDateDetail from './hooks/useDateDetail';
import { createWeekHandlers, createMonthHandlers, createViewHandlers, createDateClickHandler } from './handlers/navigationHandlers';
import ViewControls from './components/ViewControls';
import MergedWeekView from './components/MergedWeekView';
import DetailedWeekView from './components/DetailedWeekView';
import MonthView from './components/MonthView';
import DateDetailModal from './components/DateDetailModal';

/**
 * ScheduleGridSelector - 리팩터링된 메인 컴포넌트
 *
 * 일정 선택 그리드 컴포넌트 (주간/월간 뷰, 병합/분할 모드 지원)
 *
 * @param {Object} props
 * @param {Array} props.schedule - 기본 일정 (선호 시간)
 * @param {Array} props.exceptions - 예외 일정
 * @param {Array} props.personalTimes - 개인 시간 배열
 * @param {Array} props.fixedSchedules - 고정 일정 배열 (기본값: [])
 * @param {boolean} props.readOnly - 읽기 전용 모드 (기본값: true)
 * @param {boolean} props.enableMonthView - 월간 뷰 활성화 (기본값: false)
 * @param {boolean} props.showViewControls - 뷰 컨트롤 표시 (기본값: true)
 * @param {Object} props.initialTimeRange - 초기 시간 범위 (기본값: null)
 * @param {boolean} props.defaultShowMerged - 기본 병합 모드 (기본값: true)
 */
const ScheduleGridSelector = ({
  schedule = [],
  exceptions = [],
  personalTimes = [],
  fixedSchedules = [],
  readOnly = true,
  enableMonthView = false,
  showViewControls = true,
  initialTimeRange = null,
  defaultShowMerged = true
}) => {
  // ===== 커스텀 훅: 상태 관리 =====

  // 주간 네비게이션 (currentDate, weekDates, navigateWeek, goToToday)
  const {
    currentDate,
    setCurrentDate,
    weekDates,
    navigateWeek,
    goToToday
  } = useWeekNavigation();

  // 월간 네비게이션 (navigateMonth)
  const { navigateMonth } = useMonthNavigation(currentDate, setCurrentDate);

  // 뷰 모드 (viewMode, timeRange, showFullDay, showMerged 등)
  const {
    viewMode,
    timeRange,
    showFullDay,
    showMerged,
    setViewMode,
    setTimeRange,
    setShowFullDay,
    setShowMerged,
    toggleTimeRange,
    toggleViewMode,
    toggleMerged
  } = useViewMode(initialTimeRange);

  // 시간 슬롯 및 개인 시간 병합 (allPersonalTimes, getCurrentTimeSlots)
  const {
    allPersonalTimes,
    getCurrentTimeSlots
  } = useTimeSlots(personalTimes, fixedSchedules, showFullDay, timeRange, setTimeRange);

  // 🔍 디버깅 로그
  React.useEffect(() => {
    console.log('============================================');
    console.log('📅 ScheduleGridSelector - Props:');
    console.log('personalTimes 개수:', personalTimes.length);
    console.log('personalTimes:', personalTimes);
    console.log('allPersonalTimes 개수:', allPersonalTimes.length);
    console.log('allPersonalTimes:', allPersonalTimes);
    console.log('============================================');
  }, [personalTimes, allPersonalTimes]);

  // 날짜 상세 모달 (selectedDateForDetail, showDateDetailModal, openDateDetail, closeDateDetail)
  const {
    selectedDateForDetail,
    showDateDetailModal,
    openDateDetail,
    closeDateDetail,
    setSelectedDateForDetail,
    setShowDateDetailModal
  } = useDateDetail();

  // ===== 핸들러 팩토리: 이벤트 핸들러 생성 =====

  const weekHandlers = createWeekHandlers(navigateWeek);
  const monthHandlers = createMonthHandlers(navigateMonth);
  const viewHandlers = createViewHandlers(toggleTimeRange, toggleViewMode, toggleMerged);
  const dateClickHandler = createDateClickHandler(openDateDetail);

  // ===== 렌더링 =====

  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-6">
      {/* 뷰 컨트롤 (주간/월간, 시간범위, 병합/분할, 네비게이션) */}
      {showViewControls && (
        <ViewControls
          viewMode={viewMode}
          setViewMode={setViewMode}
          enableMonthView={enableMonthView}
          showFullDay={showFullDay}
          toggleTimeRange={viewHandlers.handleToggleTimeRange}
          showMerged={showMerged}
          setShowMerged={setShowMerged}
          currentDate={currentDate}
          navigateMonth={monthHandlers.navigateMonth}
          navigateWeek={weekHandlers.navigateWeek}
          goToToday={goToToday}
        />
      )}

      {/* 메인 뷰 렌더링 (월간 뷰 / 주간 뷰) */}
      {viewMode === 'month' ? (
        // 월간 뷰
        <MonthView
          currentDate={currentDate}
          allPersonalTimes={allPersonalTimes}
          schedule={schedule}
          exceptions={exceptions}
          onDateClick={dateClickHandler}
        />
      ) : (
        // 주간 뷰 (병합 / 상세)
        showMerged ? (
          <MergedWeekView
            allPersonalTimes={allPersonalTimes}
            schedule={schedule}
            exceptions={exceptions}
            weekDates={weekDates}
            getCurrentTimeSlots={getCurrentTimeSlots}
            showFullDay={showFullDay}
            priorityConfig={PRIORITY_CONFIG}
          />
        ) : (
          <DetailedWeekView
            allPersonalTimes={allPersonalTimes}
            schedule={schedule}
            exceptions={exceptions}
            weekDates={weekDates}
            getCurrentTimeSlots={getCurrentTimeSlots}
            priorityConfig={PRIORITY_CONFIG}
          />
        )
      )}

      {/* 날짜 상세 모달 (월간 뷰에서 날짜 클릭 시) */}
      <DateDetailModal
        show={showDateDetailModal}
        onClose={closeDateDetail}
        selectedDate={selectedDateForDetail}
        allPersonalTimes={allPersonalTimes}
        schedule={schedule}
        exceptions={exceptions}
        getCurrentTimeSlots={getCurrentTimeSlots}
        showFullDay={showFullDay}
        setShowFullDay={setShowFullDay}
        showMerged={showMerged}
        setShowMerged={setShowMerged}
        priorityConfig={PRIORITY_CONFIG}
      />
    </div>
  );
};

export default ScheduleGridSelector;
