/**
 * ===================================================================================================
 * useViewState.js - CoordinationTab 뷰 상태 관리 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/CoordinationTab/hooks
 *
 * 🎯 주요 기능:
 *    - 캘린더 뷰 모드 상태 관리 (월/주/일 뷰, 병합/상세 뷰)
 *    - 요청 뷰 모드 상태 관리 (보낸/받은 요청 전환)
 *    - 탭 선택 상태 관리 (소유/참여 방 탭)
 *    - 슬롯 선택 상태 관리 (다중 선택 지원)
 *    - 스케줄 옵션 관리 (표시 옵션, 필터 등)
 *    - 주 네비게이션 상태 관리
 *
 * 🔗 연결된 파일:
 *    - ../constants/index.js - 초기 상태 및 상수 정의
 *    - ../../../../utils/coordinationModeUtils.js - 뷰 모드 localStorage 관리
 *    - ../../../../utils/coordinationUtils.js - getCurrentWeekMonday 유틸리티
 *    - ../index.js - CoordinationTab 메인 컴포넌트에서 사용
 *    - ../components/TimetableControls.js - 뷰 모드 컨트롤 UI
 *
 * 💡 UI 위치:
 *    - 탭: 조율 탭 (CoordinationTab)
 *    - 섹션: 캘린더 뷰, 요청 관리 섹션, 탭 전환
 *    - 경로: 앱 실행 > 조율 탭 > 전체 화면
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 조율 탭의 모든 뷰 관련 상태 관리 로직 변경
 *    - 새로운 뷰 모드 추가: handleSetViewMode 함수 및 상수 수정
 *    - 슬롯 선택 로직 변경: handleSlotSelect 함수 수정
 *    - 초기 상태 변경: constants/index.js의 INITIAL_* 상수 수정
 *
 * 📝 참고사항:
 *    - 뷰 모드는 localStorage에 저장되어 재접속 시 유지됨
 *    - 슬롯 선택은 다중 선택 가능 (배열로 관리)
 *    - 모든 핸들러 함수는 useCallback으로 메모이제이션됨
 *
 * ===================================================================================================
 */

import { useState, useCallback } from 'react';
import {
  INITIAL_EXPANDED_SECTIONS,
  REQUEST_VIEW_MODES,
  TAB_TYPES,
  MODAL_DEFAULT_TABS,
  INITIAL_SCHEDULE_OPTIONS
} from '../constants';
import { getViewMode, saveViewMode } from '../../../../utils/coordinationModeUtils';
import { getCurrentWeekMonday } from '../../../../utils/coordinationUtils';

/**
 * useViewState - 뷰 상태 관리 훅
 *
 * @description CoordinationTab의 모든 뷰 관련 상태(캘린더, 요청, 탭, 슬롯 선택 등)를 관리하는 커스텀 훅
 * @returns {Object} 뷰 상태 및 제어 함수
 *
 * @returns {string} returns.viewMode - 현재 뷰 모드 ('month', 'week', 'day')
 * @returns {Function} returns.setViewMode - 뷰 모드 설정 함수 (localStorage에 저장)
 * @returns {Date} returns.selectedDate - 선택된 날짜
 * @returns {Function} returns.setSelectedDate - 선택된 날짜 설정 함수
 * @returns {boolean} returns.showDetailGrid - 상세 그리드 표시 여부
 * @returns {Function} returns.setShowDetailGrid - 상세 그리드 표시 상태 설정 함수
 * @returns {boolean} returns.showMerged - 병합 뷰 표시 여부
 * @returns {Function} returns.setShowMerged - 병합 뷰 상태 설정 함수
 * @returns {boolean} returns.showFullDay - 전체 일 표시 여부
 * @returns {Function} returns.setShowFullDay - 전체 일 표시 상태 설정 함수
 * @returns {Function} returns.handleDateClick - 날짜 클릭 핸들러 (상세 그리드 오픈)
 * @returns {Function} returns.handleCloseDetailGrid - 상세 그리드 닫기 핸들러
 *
 * @returns {string} returns.requestViewMode - 요청 뷰 모드 ('received', 'sent')
 * @returns {Function} returns.setRequestViewMode - 요청 뷰 모드 설정 함수
 * @returns {Object} returns.showAllRequests - 모든 요청 표시 여부 맵
 * @returns {Function} returns.setShowAllRequests - 모든 요청 표시 상태 설정 함수
 * @returns {Object} returns.expandedSections - 확장된 섹션 상태 맵
 * @returns {Function} returns.setExpandedSections - 확장된 섹션 상태 설정 함수
 *
 * @returns {string} returns.selectedTab - 선택된 탭 ('owned', 'joined')
 * @returns {Function} returns.setSelectedTab - 탭 선택 설정 함수
 *
 * @returns {string} returns.roomModalDefaultTab - 방 모달 기본 탭
 * @returns {Function} returns.setRoomModalDefaultTab - 방 모달 기본 탭 설정 함수
 *
 * @returns {Array} returns.selectedSlots - 선택된 슬롯 배열
 * @returns {Function} returns.setSelectedSlots - 선택된 슬롯 설정 함수
 * @returns {Function} returns.handleSlotSelect - 슬롯 선택/해제 토글 핸들러
 * @returns {Function} returns.clearSelectedSlots - 모든 슬롯 선택 해제 함수
 *
 * @returns {Object} returns.scheduleOptions - 스케줄 표시 옵션
 * @returns {Function} returns.setScheduleOptions - 스케줄 옵션 설정 함수
 *
 * @returns {Date} returns.currentWeekStartDate - 현재 주 시작 날짜 (월요일)
 * @returns {Function} returns.handleWeekChange - 주 변경 핸들러
 *
 * @example
 * const {
 *   viewMode,
 *   setViewMode,
 *   selectedSlots,
 *   handleSlotSelect
 * } = useViewState();
 * setViewMode('week'); // 주 뷰로 전환
 * handleSlotSelect({ date, day, startTime }); // 슬롯 선택/해제
 *
 * @note
 * - 뷰 모드 변경 시 localStorage에 자동 저장되어 재접속 시 유지
 * - 슬롯 선택 시 동일 슬롯 클릭하면 선택 해제됨 (토글 방식)
 * - 모든 핸들러 함수는 성능 최적화를 위해 useCallback 사용
 */
export const useViewState = () => {
  // Calendar view states
  const [viewMode, setViewMode] = useState(() => getViewMode());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDetailGrid, setShowDetailGrid] = useState(false);
  const [showMerged, setShowMerged] = useState(true);
  const [showFullDay, setShowFullDay] = useState(false);

  // Request view states
  const [requestViewMode, setRequestViewMode] = useState(REQUEST_VIEW_MODES.RECEIVED);
  const [showAllRequests, setShowAllRequests] = useState({});
  const [expandedSections, setExpandedSections] = useState(INITIAL_EXPANDED_SECTIONS);

  // Tab state
  const [selectedTab, setSelectedTab] = useState(TAB_TYPES.OWNED);

  // Modal default tab
  const [roomModalDefaultTab, setRoomModalDefaultTab] = useState(MODAL_DEFAULT_TABS.INFO);

  // Slot selection
  const [selectedSlots, setSelectedSlots] = useState([]);

  // Schedule options
  const [scheduleOptions, setScheduleOptions] = useState(INITIAL_SCHEDULE_OPTIONS);

  // Week navigation
  const [currentWeekStartDate, setCurrentWeekStartDate] = useState(() => getCurrentWeekMonday());

  // View mode handlers
  const handleSetViewMode = useCallback((mode) => {
    setViewMode(mode);
    saveViewMode(mode);
  }, []);

  const handleDateClick = useCallback((date) => {
    setSelectedDate(date);
    setShowDetailGrid(true);
  }, []);

  const handleCloseDetailGrid = useCallback(() => {
    setShowDetailGrid(false);
    setSelectedDate(null);
  }, []);

  const handleSlotSelect = useCallback((slotData) => {
    setSelectedSlots(prev => {
      const isSelected = prev.some(slot =>
        slot.date.getTime() === slotData.date.getTime() &&
        slot.day === slotData.day &&
        slot.startTime === slotData.startTime
      );

      if (isSelected) {
        return prev.filter(slot =>
          !(slot.date.getTime() === slotData.date.getTime() &&
            slot.day === slotData.day &&
            slot.startTime === slotData.startTime)
        );
      } else {
        return [...prev, slotData];
      }
    });
  }, []);

  const clearSelectedSlots = useCallback(() => {
    setSelectedSlots([]);
  }, []);

  const handleWeekChange = useCallback((date) => {
    setCurrentWeekStartDate(date);
  }, []);

  return {
    // Calendar view
    viewMode,
    setViewMode: handleSetViewMode,
    selectedDate,
    setSelectedDate,
    showDetailGrid,
    setShowDetailGrid,
    showMerged,
    setShowMerged,
    showFullDay,
    setShowFullDay,
    handleDateClick,
    handleCloseDetailGrid,

    // Request view
    requestViewMode,
    setRequestViewMode,
    showAllRequests,
    setShowAllRequests,
    expandedSections,
    setExpandedSections,

    // Tab
    selectedTab,
    setSelectedTab,

    // Modal default tab
    roomModalDefaultTab,
    setRoomModalDefaultTab,

    // Slot selection
    selectedSlots,
    setSelectedSlots,
    handleSlotSelect,
    clearSelectedSlots,

    // Schedule options
    scheduleOptions,
    setScheduleOptions,

    // Week navigation
    currentWeekStartDate,
    handleWeekChange
  };
};
