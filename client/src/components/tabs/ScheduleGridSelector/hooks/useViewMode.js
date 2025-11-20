import { useState } from 'react';
import { VIEW_MODES, DEFAULT_TIME_RANGE } from '../constants/scheduleConstants';

/**
 * 뷰 모드 관련 상태와 토글 함수를 관리하는 커스텀 훅
 * @param {Object} initialTimeRange - 초기 시간 범위 (옵션)
 * @returns {Object} 뷰 모드 상태 및 토글 함수들
 */
const useViewMode = (initialTimeRange = null) => {
  const [viewMode, setViewMode] = useState(VIEW_MODES.WEEK); // 'week', 'month'
  const [timeRange, setTimeRange] = useState(initialTimeRange || DEFAULT_TIME_RANGE.basic);
  const [showFullDay, setShowFullDay] = useState(false); // 항상 기본 모드로 시작
  const [showMerged, setShowMerged] = useState(true); // 항상 병합 모드로 시작

  /**
   * 시간 범위 토글 (기본 9-18시 ↔ 24시간)
   */
  const toggleTimeRange = () => {
    const newShowFullDay = !showFullDay;
    setShowFullDay(newShowFullDay);
    setTimeRange(newShowFullDay ? DEFAULT_TIME_RANGE.full : DEFAULT_TIME_RANGE.basic);
  };

  /**
   * 뷰 모드 토글 (주간 ↔ 월간)
   */
  const toggleViewMode = () => {
    setViewMode(prev => prev === VIEW_MODES.WEEK ? VIEW_MODES.MONTH : VIEW_MODES.WEEK);
  };

  /**
   * 병합 모드 토글 (병합 ↔ 분할)
   */
  const toggleMerged = () => {
    setShowMerged(prev => !prev);
  };

  return {
    // 상태
    viewMode,
    timeRange,
    showFullDay,
    showMerged,

    // Setters
    setViewMode,
    setTimeRange,
    setShowFullDay,
    setShowMerged,

    // 토글 함수
    toggleTimeRange,
    toggleViewMode,
    toggleMerged
  };
};

export default useViewMode;
