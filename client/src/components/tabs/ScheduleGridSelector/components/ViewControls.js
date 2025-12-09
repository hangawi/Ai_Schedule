/**
 * ===================================================================================================
 * ViewControls.js - 스케줄 그리드 뷰 컨트롤 버튼 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ScheduleGridSelector/components
 *
 * 🎯 주요 기능:
 *    - 뷰 모드 전환 버튼 (주간/월간)
 *    - 시간 범위 토글 버튼 (기본 9-18시 ↔ 24시간)
 *    - 병합/분할 모드 토글 버튼
 *    - 네비게이션 버튼 (이전/다음, 오늘)
 *    - 현재 날짜 표시 (YYYY년 MM월)
 *
 * 🔗 연결된 파일:
 *    - ../index.js - 이 컴포넌트를 렌더링하여 뷰 컨트롤 제공
 *    - ../constants/scheduleConstants.js - MONTH_NAMES 상수 사용
 *    - ../hooks/useViewMode.js - 뷰 모드 상태 관리
 *    - ../hooks/useWeekNavigation.js - 주간 네비게이션 함수
 *    - ../hooks/useMonthNavigation.js - 월간 네비게이션 함수
 *
 * 💡 UI 위치:
 *    - 탭: 프로필 탭
 *    - 섹션: 스케줄 그리드 상단 컨트롤 바
 *    - 경로: 앱 실행 > 프로필 탭 > 스케줄 그리드 > 상단 버튼들
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 뷰 컨트롤 버튼의 UI와 동작이 변경됨
 *    - 버튼 스타일 변경: className의 Tailwind 클래스 수정
 *    - 버튼 추가/제거: 버튼 섹션 추가/삭제
 *    - 아이콘 변경: lucide-react 아이콘 import 수정
 *
 * 📝 참고사항:
 *    - lucide-react 아이콘 사용 (Grid, Calendar, Clock, Merge, Split, ChevronLeft, ChevronRight)
 *    - 주간/월간 모드에 따라 네비게이션 함수 다르게 호출
 *    - 월간 뷰는 enableMonthView prop으로 활성화 제어
 *    - Tailwind CSS로 스타일링 (반응형 flex-wrap 사용)
 *
 * ===================================================================================================
 */

import React from 'react';
import { ChevronLeft, ChevronRight, Calendar, Grid, Clock, Merge, Split } from 'lucide-react';
import { MONTH_NAMES } from '../constants/scheduleConstants';

/**
 * ViewControls - 스케줄 그리드 뷰 컨트롤 버튼 컴포넌트
 *
 * @description 스케줄 그리드의 뷰 모드, 시간 범위, 병합 모드를 제어하는 버튼들을 렌더링
 * @param {Object} props - 컴포넌트 props
 * @param {string} props.viewMode - 현재 뷰 모드 ('week' | 'month')
 * @param {Function} props.setViewMode - 뷰 모드 설정 함수
 * @param {boolean} props.enableMonthView - 월간 뷰 활성화 여부
 * @param {boolean} props.showFullDay - 24시간 모드 여부
 * @param {Function} props.toggleTimeRange - 시간 범위 토글 함수
 * @param {boolean} props.showMerged - 병합 모드 여부
 * @param {Function} props.setShowMerged - 병합 모드 설정 함수
 * @param {Date} props.currentDate - 현재 날짜
 * @param {Function} props.navigateMonth - 월 네비게이션 함수 (direction: 1 | -1)
 * @param {Function} props.navigateWeek - 주 네비게이션 함수 (direction: 1 | -1)
 * @param {Function} props.goToToday - 오늘로 이동 함수
 * @returns {JSX.Element} 뷰 컨트롤 버튼 UI
 *
 * @example
 * <ViewControls
 *   viewMode="week"
 *   setViewMode={setViewMode}
 *   enableMonthView={false}
 *   showFullDay={false}
 *   toggleTimeRange={toggleTimeRange}
 *   showMerged={true}
 *   setShowMerged={setShowMerged}
 *   currentDate={new Date()}
 *   navigateMonth={navigateMonth}
 *   navigateWeek={navigateWeek}
 *   goToToday={goToToday}
 * />
 *
 * @note
 * - 왼쪽: 뷰 모드 버튼, 시간 범위 버튼, 병합/분할 버튼
 * - 오른쪽: 이전/다음 버튼, 현재 날짜, 오늘 버튼
 * - 주간 모드: 파란색, 월간 모드: 파란색, 24시간: 보라색, 병합: 초록색
 * - 월간 뷰 비활성화 시 "개발 중" 표시
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
