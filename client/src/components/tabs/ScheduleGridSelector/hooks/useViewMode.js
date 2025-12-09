/**
 * ===================================================================================================
 * useViewMode.js - 뷰 모드 상태 관리 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ScheduleGridSelector/hooks
 *
 * 🎯 주요 기능:
 *    - 뷰 모드 상태 관리 (주간/월간)
 *    - 시간 범위 상태 관리 (기본 9-18시 / 24시간)
 *    - 병합 모드 상태 관리 (병합/분할)
 *    - 각 모드 토글 함수 제공
 *
 * 🔗 연결된 파일:
 *    - ../index.js (ScheduleGridSelector) - 이 훅을 사용하여 뷰 모드 관리
 *    - ../components/ViewControls.js - 토글 버튼에서 상태 표시 및 변경
 *    - ../constants/scheduleConstants.js - VIEW_MODES, DEFAULT_TIME_RANGE 상수 사용
 *
 * 💡 UI 위치:
 *    - 탭: 프로필 탭
 *    - 섹션: 스케줄 그리드 상단 컨트롤 바
 *    - 경로: 앱 실행 > 프로필 탭 > 스케줄 그리드 > 뷰 모드 버튼
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 뷰 모드 기본값 및 토글 동작이 변경됨
 *    - 기본 뷰 모드 변경: useState 초기값 수정
 *    - 토글 로직 변경: toggle 함수들 수정
 *
 * 📝 참고사항:
 *    - viewMode 기본값: 'week' (주간 뷰)
 *    - showFullDay 기본값: false (9-18시 모드)
 *    - showMerged 기본값: true (병합 모드)
 *    - 각 상태는 독립적으로 관리됨
 *
 * ===================================================================================================
 */

import { useState } from 'react';
import { VIEW_MODES, DEFAULT_TIME_RANGE } from '../constants/scheduleConstants';

/**
 * useViewMode - 뷰 모드 관련 상태와 토글 함수를 관리하는 커스텀 훅
 *
 * @description 스케줄 그리드의 표시 모드를 관리하는 훅 (주간/월간, 시간범위, 병합/분할)
 * @param {Object} [initialTimeRange=null] - 초기 시간 범위 (옵션)
 * @returns {Object} 뷰 모드 상태 및 토글 함수들
 * @returns {string} return.viewMode - 현재 뷰 모드 ('week' | 'month')
 * @returns {Object} return.timeRange - 시간 범위 객체 ({ start, end })
 * @returns {boolean} return.showFullDay - 24시간 모드 여부
 * @returns {boolean} return.showMerged - 병합 모드 여부
 * @returns {Function} return.setViewMode - 뷰 모드 설정 함수
 * @returns {Function} return.setTimeRange - 시간 범위 설정 함수
 * @returns {Function} return.setShowFullDay - 24시간 모드 설정 함수
 * @returns {Function} return.setShowMerged - 병합 모드 설정 함수
 * @returns {Function} return.toggleTimeRange - 시간 범위 토글 함수
 * @returns {Function} return.toggleViewMode - 뷰 모드 토글 함수
 * @returns {Function} return.toggleMerged - 병합 모드 토글 함수
 *
 * @example
 * const {
 *   viewMode,
 *   showFullDay,
 *   showMerged,
 *   toggleTimeRange,
 *   toggleViewMode,
 *   toggleMerged
 * } = useViewMode();
 *
 * @note
 * - 모든 상태는 독립적으로 관리됨
 * - 초기값은 사용자 경험을 위해 최적화됨
 */
const useViewMode = (initialTimeRange = null) => {
  const [viewMode, setViewMode] = useState(VIEW_MODES.WEEK); // 'week', 'month'
  const [timeRange, setTimeRange] = useState(initialTimeRange || DEFAULT_TIME_RANGE.basic);
  const [showFullDay, setShowFullDay] = useState(false); // 항상 기본 모드로 시작
  const [showMerged, setShowMerged] = useState(true); // 항상 병합 모드로 시작

  /**
   * toggleTimeRange - 시간 범위 토글 (기본 9-18시 ↔ 24시간)
   *
   * @description 시간 범위를 토글하고 showFullDay 상태 변경
   *
   * @example
   * <button onClick={toggleTimeRange}>
   *   {showFullDay ? '24시간' : '기본'}
   * </button>
   *
   * @note
   * - false: 기본 모드 (9-18시)
   * - true: 24시간 모드 (0-24시)
   * - timeRange도 자동으로 변경됨
   */
  const toggleTimeRange = () => {
    const newShowFullDay = !showFullDay;
    setShowFullDay(newShowFullDay);
    setTimeRange(newShowFullDay ? DEFAULT_TIME_RANGE.full : DEFAULT_TIME_RANGE.basic);
  };

  /**
   * toggleViewMode - 뷰 모드 토글 (주간 ↔ 월간)
   *
   * @description 주간 뷰와 월간 뷰 사이를 토글
   *
   * @example
   * <button onClick={toggleViewMode}>
   *   {viewMode === 'week' ? '주간' : '월간'}
   * </button>
   *
   * @note
   * - 'week': 주간 뷰 (일주일 그리드)
   * - 'month': 월간 뷰 (달력 형태)
   */
  const toggleViewMode = () => {
    setViewMode(prev => prev === VIEW_MODES.WEEK ? VIEW_MODES.MONTH : VIEW_MODES.WEEK);
  };

  /**
   * toggleMerged - 병합 모드 토글 (병합 ↔ 분할)
   *
   * @description 시간표 표시 방식을 병합/분할 모드로 토글
   *
   * @example
   * <button onClick={toggleMerged}>
   *   {showMerged ? '병합' : '분할'}
   * </button>
   *
   * @note
   * - true: 병합 모드 (연속된 시간 블록으로 표시)
   * - false: 분할 모드 (10분 단위 세부 시간표)
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
