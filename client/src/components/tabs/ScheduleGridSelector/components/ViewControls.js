import React from 'react';
import { ChevronLeft, ChevronRight, Calendar, Grid, Clock, Merge, Split } from 'lucide-react';
import { MONTH_NAMES } from '../constants/scheduleConstants';

/**
 * 뷰 컨트롤 버튼들을 렌더링하는 컴포넌트
 * - 주간/월간 모드 전환
 * - 시간 범위 토글 (기본 9-18시 ↔ 24시간)
 * - 병합/분할 모드 토글
 * - 네비게이션 버튼 (이전/다음, 오늘)
 *
 * @param {Object} props
 * @param {string} props.viewMode - 현재 뷰 모드 ('week' | 'month')
 * @param {Function} props.setViewMode - 뷰 모드 설정 함수
 * @param {boolean} props.enableMonthView - 월간 뷰 활성화 여부
 * @param {boolean} props.showFullDay - 24시간 모드 여부
 * @param {Function} props.toggleTimeRange - 시간 범위 토글 함수
 * @param {boolean} props.showMerged - 병합 모드 여부
 * @param {Function} props.setShowMerged - 병합 모드 설정 함수
 * @param {Date} props.currentDate - 현재 날짜
 * @param {Function} props.navigateMonth - 월 네비게이션 함수
 * @param {Function} props.navigateWeek - 주 네비게이션 함수
 * @param {Function} props.goToToday - 오늘로 이동 함수
 */
const ViewControls = ({
  viewMode,
  setViewMode,
  enableMonthView,
  showFullDay,
  toggleTimeRange,
  showMerged,
  setShowMerged,
  currentDate,
  navigateMonth,
  navigateWeek,
  goToToday
}) => {
  return (
    <div className="flex items-center justify-between mb-4 flex-wrap gap-y-2">
      {/* 왼쪽: 뷰 모드 및 옵션 버튼들 */}
      <div className="flex items-center space-x-2 flex-wrap gap-y-2">
        {/* 주간 모드 버튼 */}
        <button
          onClick={() => setViewMode('week')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            viewMode === 'week'
              ? 'bg-blue-500 text-white shadow-md'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <Grid size={16} className="mr-2 inline" />주간
        </button>

        {/* 월간 모드 버튼 */}
        <button
          onClick={() => setViewMode('month')}
          disabled={!enableMonthView}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            !enableMonthView
              ? 'cursor-not-allowed bg-gray-100 text-gray-400'
              : viewMode === 'month'
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <Calendar size={16} className="mr-2 inline" />
          월간{!enableMonthView && ' (개발 중)'}
        </button>

        {/* 구분선 + 시간 범위 및 병합/분할 토글 */}
        <div className="border-l border-gray-300 pl-3 ml-1 flex space-x-2 flex-wrap gap-y-2">
          {/* 시간 범위 토글 (기본 9-18시 ↔ 24시간) */}
          <button
            onClick={toggleTimeRange}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              showFullDay
                ? 'bg-purple-500 text-white shadow-md'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Clock size={16} className="mr-2 inline" />
            {showFullDay ? '24시간' : '기본'}
          </button>

          {/* 병합/분할 모드 토글 */}
          <button
            onClick={() => setShowMerged(!showMerged)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              showMerged
                ? 'bg-green-500 text-white shadow-md'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {showMerged ? (
              <>
                <Merge size={16} className="mr-2 inline" />병합
              </>
            ) : (
              <>
                <Split size={16} className="mr-2 inline" />분할
              </>
            )}
          </button>
        </div>
      </div>

      {/* 오른쪽: 네비게이션 버튼들 */}
      <div className="flex items-center space-x-2">
        {/* 이전 버튼 (주간/월간에 따라 다르게 동작) */}
        <button
          onClick={() => viewMode === 'month' ? navigateMonth(-1) : navigateWeek(-1)}
          className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>

        {/* 현재 날짜 표시 */}
        <div className="text-lg font-semibold min-w-40 text-center whitespace-nowrap">
          {`${currentDate.getFullYear()}년 ${MONTH_NAMES[currentDate.getMonth()]}`}
        </div>

        {/* 다음 버튼 (주간/월간에 따라 다르게 동작) */}
        <button
          onClick={() => viewMode === 'month' ? navigateMonth(1) : navigateWeek(1)}
          className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"
        >
          <ChevronRight size={20} />
        </button>

        {/* 오늘 버튼 */}
        <button
          onClick={goToToday}
          className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-sm whitespace-nowrap shadow-md"
        >
          오늘
        </button>
      </div>
    </div>
  );
};

export default ViewControls;
