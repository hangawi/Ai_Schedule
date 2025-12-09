/**
 * ===================================================================================================
 * index.js - ScheduleGridSelector 메인 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ScheduleGridSelector
 *
 * 🎯 주요 기능:
 *    - 스케줄 그리드 UI의 최상위 컴포넌트 (모든 하위 컴포넌트 통합)
 *    - 주간/월간 뷰 모드 전환 및 병합/분할 모드 제어
 *    - 커스텀 훅을 통한 상태 관리 (날짜, 뷰 모드, 시간 범위, 모달)
 *    - 핸들러 팩토리 패턴으로 이벤트 핸들러 생성 및 주입
 *    - 조건부 렌더링으로 적절한 뷰 컴포넌트 표시
 *    - 선호 일정, 예외 일정, 개인 일정 통합 관리
 *
 * 🔗 연결된 파일:
 *    - ../ProfileTab/index.js - 이 컴포넌트를 렌더링하여 스케줄 그리드 제공
 *    - ./constants/scheduleConstants.js - PRIORITY_CONFIG 등 상수 import
 *    - ./hooks/useWeekNavigation.js - 주간 네비게이션 상태
 *    - ./hooks/useMonthNavigation.js - 월간 네비게이션 상태
 *    - ./hooks/useViewMode.js - 뷰 모드 상태 (주간/월간, 시간범위, 병합)
 *    - ./hooks/useTimeSlots.js - 시간 슬롯 및 개인 시간 병합
 *    - ./hooks/useDateDetail.js - 날짜 상세 모달 상태
 *    - ./handlers/navigationHandlers.js - 핸들러 팩토리 함수들
 *    - ./components/ViewControls.js - 상단 컨트롤 버튼
 *    - ./components/MergedWeekView.js - 병합 모드 주간 뷰
 *    - ./components/DetailedWeekView.js - 분할 모드 주간 뷰
 *    - ./components/MonthView.js - 월간 달력 뷰
 *    - ./components/DateDetailModal.js - 날짜 상세 모달
 *
 * 💡 UI 위치:
 *    - 탭: 프로필 탭
 *    - 섹션: 스케줄 그리드 (메인 영역)
 *    - 경로: 앱 실행 > 프로필 탭 > 스케줄 그리드
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 스케줄 그리드 전체의 구조와 동작이 변경됨
 *    - 새 기능 추가: 해당 기능의 커스텀 훅을 만들고 여기서 사용
 *    - 새 뷰 모드 추가: viewMode 값 추가 및 조건부 렌더링 수정
 *    - 핸들러 추가: handlers/navigationHandlers.js에 팩토리 함수 추가
 *    - 기본값 변경: props의 defaultValue 수정 (예: defaultShowMerged)
 *
 * 📝 참고사항:
 *    - 컴포넌트 구조: Hooks → Handlers → Rendering
 *    - 커스텀 훅으로 관심사 분리 (날짜, 뷰, 슬롯, 모달)
 *    - 핸들러 팩토리 패턴으로 의존성 주입 (테스트 용이)
 *    - 조건부 렌더링: 월간 뷰 OR (주간 뷰 → 병합 OR 분할)
 *    - readOnly 모드는 현재 미사용 (향후 편집 기능 추가 대비)
 *    - initialTimeRange는 useViewMode에서 초기 시간 범위 설정용
 *
 * ===================================================================================================
 */

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
 * ScheduleGridSelector - 스케줄 그리드 메인 컴포넌트
 *
 * @description 일정 선택 그리드의 최상위 컴포넌트로, 주간/월간 뷰 전환, 병합/분할 모드 제어,
 *              선호 일정/예외 일정/개인 일정 통합 표시를 담당
 *
 * @component
 *
 * @param {Object} props - 컴포넌트 props
 * @param {Array} props.schedule - 기본 일정 (선호 시간, 반복 일정)
 *   - 구조: [{ dayOfWeek, timeSlots, priority, ... }]
 *   - dayOfWeek: 0=일, 1=월, ..., 6=토
 *   - specificDate가 있으면 특정 날짜 일정, 없으면 반복 일정
 *
 * @param {Array} props.exceptions - 예외 일정 (특정 날짜의 우선순위 변경)
 *   - 구조: [{ specificDate, timeSlots, priority, ... }]
 *   - schedule보다 우선순위 높음 (덮어쓰기)
 *
 * @param {Array} props.personalTimes - 개인 시간 배열 (사용자가 추가한 일정)
 *   - 구조: [{ days, startTime, endTime, title, color, isRecurring, ... }]
 *   - days: [1,2,3] (1=월, 7=일), isRecurring: true=반복, false=특정날짜
 *
 * @param {Array} props.fixedSchedules - 고정 일정 배열 (OCR로 추출된 학원 일정 등)
 *   - 구조: [{ days, startTime, endTime, title, instructor, type, backgroundColor, ... }]
 *   - personalTimes와 병합되어 allPersonalTimes로 관리됨
 *   - 기본값: []
 *
 * @param {boolean} props.readOnly - 읽기 전용 모드 (편집 불가)
 *   - true: 편집 불가 (현재 기본값, 향후 편집 기능 추가 시 사용)
 *   - false: 편집 가능 (미구현)
 *   - 기본값: true
 *
 * @param {boolean} props.enableMonthView - 월간 뷰 활성화 여부
 *   - true: 월간 뷰 버튼 활성화
 *   - false: 월간 뷰 버튼 비활성화 ("개발 중" 표시)
 *   - 기본값: false
 *
 * @param {boolean} props.showViewControls - 뷰 컨트롤 표시 여부
 *   - true: 상단 컨트롤 버튼 표시 (주간/월간, 시간범위, 병합/분할, 네비게이션)
 *   - false: 컨트롤 숨김 (다른 컴포넌트에서 임베드 시 사용)
 *   - 기본값: true
 *
 * @param {Object} props.initialTimeRange - 초기 시간 범위 설정
 *   - 구조: { start: 9, end: 18 }
 *   - null이면 기본값 사용 (9-18시)
 *   - 기본값: null
 *
 * @param {boolean} props.defaultShowMerged - 기본 병합 모드 여부
 *   - true: 초기 렌더링 시 병합 모드
 *   - false: 초기 렌더링 시 분할 모드 (10분 단위 그리드)
 *   - 기본값: true
 *
 * @returns {JSX.Element} 스케줄 그리드 UI (컨트롤 + 뷰 + 모달)
 *
 * @example
 * // 기본 사용
 * <ScheduleGridSelector
 *   schedule={schedule}
 *   exceptions={exceptions}
 *   personalTimes={personalTimes}
 *   fixedSchedules={fixedSchedules}
 * />
 *
 * @example
 * // 월간 뷰 활성화, 분할 모드로 시작
 * <ScheduleGridSelector
 *   schedule={schedule}
 *   exceptions={exceptions}
 *   personalTimes={personalTimes}
 *   fixedSchedules={fixedSchedules}
 *   enableMonthView={true}
 *   defaultShowMerged={false}
 * />
 *
 * @note
 * - 컴포넌트 구조: Hooks (상태) → Handlers (이벤트) → Rendering (UI)
 * - 커스텀 훅으로 관심사 분리:
 *   - useWeekNavigation: 주간 날짜 관리
 *   - useMonthNavigation: 월간 날짜 관리
 *   - useViewMode: 뷰 모드, 시간 범위, 병합 모드 관리
 *   - useTimeSlots: 개인 시간 병합 및 시간 슬롯 생성
 *   - useDateDetail: 날짜 상세 모달 상태 관리
 * - 핸들러 팩토리 패턴으로 의존성 주입 (테스트 및 재사용 용이)
 * - 조건부 렌더링: 월간 뷰 OR (주간 뷰 → 병합 OR 분할)
 * - allPersonalTimes: personalTimes + fixedSchedules 병합 (중복 제거, 색상 우선순위)
 * - PRIORITY_CONFIG: 우선순위별 색상 및 레이블 설정 (constants/scheduleConstants.js)
 *
 * @architecture
 * 1. 커스텀 훅 초기화
 *    - useWeekNavigation: currentDate, weekDates, navigateWeek, goToToday
 *    - useMonthNavigation: navigateMonth (currentDate, setCurrentDate 공유)
 *    - useViewMode: viewMode, timeRange, showFullDay, showMerged, toggle 함수들
 *    - useTimeSlots: allPersonalTimes, getCurrentTimeSlots (시간 슬롯 생성)
 *    - useDateDetail: selectedDateForDetail, showDateDetailModal, open/close 함수
 *
 * 2. 핸들러 팩토리 생성
 *    - weekHandlers: 주간 네비게이션 핸들러 (prev, next)
 *    - monthHandlers: 월간 네비게이션 핸들러 (prev, next)
 *    - viewHandlers: 뷰 모드 토글 핸들러 (시간범위, 뷰모드, 병합)
 *    - dateClickHandler: 날짜 클릭 핸들러 (모달 오픈)
 *
 * 3. 조건부 렌더링
 *    - ViewControls: 상단 컨트롤 버튼 (showViewControls가 true일 때만)
 *    - MonthView: viewMode === 'month'일 때
 *    - MergedWeekView: viewMode === 'week' && showMerged === true일 때
 *    - DetailedWeekView: viewMode === 'week' && showMerged === false일 때
 *    - DateDetailModal: 항상 렌더링 (show prop으로 표시 제어)
 *
 * @dataflow
 * Props → Hooks → State → Handlers → Components
 *
 * 1. Props 전달
 *    - schedule, exceptions, personalTimes, fixedSchedules
 *    - readOnly, enableMonthView, showViewControls
 *    - initialTimeRange, defaultShowMerged
 *
 * 2. Hooks에서 State 생성
 *    - currentDate (주간/월간 모두 사용)
 *    - weekDates (주간 뷰용 7일 배열)
 *    - viewMode, timeRange, showFullDay, showMerged
 *    - allPersonalTimes (personalTimes + fixedSchedules 병합)
 *    - selectedDateForDetail, showDateDetailModal
 *
 * 3. Handlers 생성 (State 변경 함수들)
 *    - navigateWeek, navigateMonth, goToToday
 *    - toggleTimeRange, toggleViewMode, toggleMerged
 *    - openDateDetail, closeDateDetail
 *
 * 4. Components에 전달
 *    - ViewControls: State + Handlers
 *    - MonthView/WeekView: State + Data (schedule, exceptions, allPersonalTimes)
 *    - DateDetailModal: State + Handlers + Data
 *
 * @performance
 * - 커스텀 훅에서 useMemo, useCallback 사용으로 불필요한 재렌더링 방지
 * - allPersonalTimes는 personalTimes, fixedSchedules 변경 시에만 재계산
 * - getCurrentTimeSlots는 showFullDay, timeRange 변경 시에만 재계산
 * - 핸들러 함수들은 팩토리로 생성하여 의존성 최소화
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
  // ===================================================================================================
  // 📌 섹션 1: 커스텀 훅 - 상태 관리
  // ===================================================================================================
  //
  // 이 섹션에서는 스케줄 그리드의 모든 상태를 커스텀 훅으로 관리합니다.
  // 각 훅은 하나의 관심사에 집중하여 코드 재사용성과 테스트 용이성을 높입니다.
  //
  // 📝 훅 목록:
  //    1. useWeekNavigation - 주간 네비게이션 (currentDate, weekDates, navigateWeek, goToToday)
  //    2. useMonthNavigation - 월간 네비게이션 (navigateMonth)
  //    3. useViewMode - 뷰 모드 관리 (viewMode, timeRange, showFullDay, showMerged, toggle 함수들)
  //    4. useTimeSlots - 시간 슬롯 및 개인 시간 병합 (allPersonalTimes, getCurrentTimeSlots)
  //    5. useDateDetail - 날짜 상세 모달 상태 (selectedDateForDetail, showDateDetailModal, open/close)
  //
  // 📌 주의사항:
  //    - currentDate는 useWeekNavigation에서 관리하고, useMonthNavigation과 공유됨
  //    - setCurrentDate를 useMonthNavigation에 전달하여 월간 네비게이션 시 날짜 변경
  //    - timeRange는 useViewMode에서 관리하고, useTimeSlots에 전달됨
  //    - allPersonalTimes는 personalTimes + fixedSchedules를 병합한 결과
  //
  // ===================================================================================================

  /**
   * 주간 네비게이션 훅
   *
   * @description 주간 뷰의 날짜 관리 및 네비게이션 함수 제공
   *
   * @returns {Object} 주간 네비게이션 상태 및 함수
   * @returns {Date} currentDate - 현재 선택된 날짜 (주의 기준점)
   * @returns {Function} setCurrentDate - 날짜 설정 함수 (월간 네비게이션과 공유)
   * @returns {Array} weekDates - 주간 날짜 배열 (일~토 7일)
   *   - 각 요소: { fullDate, display, dayOfWeek }
   *   - display: "월 (12.9)" 형식
   * @returns {Function} navigateWeek - 주간 네비게이션 함수 (direction: 1 | -1)
   * @returns {Function} goToToday - 오늘로 이동 함수
   *
   * @note
   * - weekDates는 항상 일요일부터 시작 (0=일, 1=월, ..., 6=토)
   * - currentDate가 변경되면 weekDates도 자동 재계산
   * - setCurrentDate는 useMonthNavigation에 전달되어 월간 네비게이션에서도 사용
   */
  const {
    currentDate,
    setCurrentDate,
    weekDates,
    navigateWeek,
    goToToday
  } = useWeekNavigation();

  /**
   * 월간 네비게이션 훅
   *
   * @description 월간 뷰의 날짜 관리 및 네비게이션 함수 제공
   *
   * @param {Date} currentDate - 현재 선택된 날짜 (useWeekNavigation과 공유)
   * @param {Function} setCurrentDate - 날짜 설정 함수 (useWeekNavigation과 공유)
   *
   * @returns {Object} 월간 네비게이션 함수
   * @returns {Function} navigateMonth - 월간 네비게이션 함수 (direction: 1 | -1)
   *   - direction: 1 (다음 달), -1 (이전 달)
   *   - currentDate를 기준으로 월 단위로 이동
   *
   * @note
   * - currentDate와 setCurrentDate를 useWeekNavigation과 공유
   * - 월간 네비게이션 시 currentDate가 변경되면 weekDates도 자동 업데이트
   * - 예: 12월에서 navigateMonth(1) 호출 시 → 다음 해 1월로 이동
   */
  const { navigateMonth } = useMonthNavigation(currentDate, setCurrentDate);

  /**
   * 뷰 모드 훅
   *
   * @description 뷰 모드, 시간 범위, 병합 모드 관리 및 토글 함수 제공
   *
   * @param {Object} initialTimeRange - 초기 시간 범위 설정 (null이면 기본값)
   *
   * @returns {Object} 뷰 모드 상태 및 함수
   * @returns {string} viewMode - 현재 뷰 모드 ('week' | 'month')
   * @returns {Object} timeRange - 현재 시간 범위 { start, end }
   * @returns {boolean} showFullDay - 24시간 모드 여부 (true: 0-24시, false: 9-18시)
   * @returns {boolean} showMerged - 병합 모드 여부 (true: 병합, false: 10분 단위 분할)
   * @returns {Function} setViewMode - 뷰 모드 설정 함수
   * @returns {Function} setTimeRange - 시간 범위 설정 함수
   * @returns {Function} setShowFullDay - 24시간 모드 설정 함수
   * @returns {Function} setShowMerged - 병합 모드 설정 함수
   * @returns {Function} toggleTimeRange - 시간 범위 토글 함수 (9-18시 ↔ 24시간)
   * @returns {Function} toggleViewMode - 뷰 모드 토글 함수 (주간 ↔ 월간)
   * @returns {Function} toggleMerged - 병합 모드 토글 함수 (병합 ↔ 분할)
   *
   * @note
   * - timeRange는 useTimeSlots에 전달되어 시간 슬롯 생성에 사용
   * - timeRange는 allPersonalTimes의 종료 시간에 따라 자동 조정됨 (useTimeSlots에서)
   * - 기본값: viewMode='week', showFullDay=false, showMerged=defaultShowMerged
   */
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

  /**
   * 시간 슬롯 및 개인 시간 병합 훅
   *
   * @description personalTimes와 fixedSchedules를 병합하고, 시간 슬롯 생성 함수 제공
   *
   * @param {Array} personalTimes - 개인 시간 배열
   * @param {Array} fixedSchedules - 고정 일정 배열 (OCR 추출 데이터)
   * @param {boolean} showFullDay - 24시간 모드 여부
   * @param {Object} timeRange - 현재 시간 범위
   * @param {Function} setTimeRange - 시간 범위 설정 함수 (자동 조정용)
   *
   * @returns {Object} 병합된 개인 시간 및 슬롯 생성 함수
   * @returns {Array} allPersonalTimes - 병합된 개인 시간 배열
   *   - personalTimes + fixedSchedules 병합
   *   - 중복 제거 (같은 시간, 같은 제목)
   *   - 색상 우선순위: OCR backgroundColor > sourceImageIndex > 기본 보라색
   * @returns {Function} getCurrentTimeSlots - 시간 슬롯 배열 생성 함수
   *   - showFullDay, timeRange에 따라 시간 슬롯 생성
   *   - 10분 단위 슬롯 (예: 09:00, 09:10, ..., 17:50)
   *
   * @note
   * - allPersonalTimes는 personalTimes, fixedSchedules 변경 시에만 재계산 (useMemo)
   * - getCurrentTimeSlots는 showFullDay, timeRange 변경 시에만 재계산 (useCallback)
   * - timeRange는 allPersonalTimes의 종료 시간에 따라 자동 조정됨
   * - 예: 개인 일정이 20시에 끝나면 timeRange.end가 자동으로 20으로 조정
   */
  const {
    allPersonalTimes,
    getCurrentTimeSlots
  } = useTimeSlots(personalTimes, fixedSchedules, showFullDay, timeRange, setTimeRange);

  /**
   * 날짜 상세 모달 훅
   *
   * @description 날짜 클릭 시 표시되는 상세 모달의 상태 관리
   *
   * @returns {Object} 모달 상태 및 제어 함수
   * @returns {Object} selectedDateForDetail - 선택된 날짜 정보
   *   - date: Date 객체
   *   - dayOfWeek: 0-6 (일-토)
   *   - isCurrentMonth: 현재 달 여부
   *   - hasSchedule, hasException, hasPersonal: 일정 존재 여부
   *   - dateStr: YYYY-MM-DD 형식
   * @returns {boolean} showDateDetailModal - 모달 표시 여부
   * @returns {Function} openDateDetail - 모달 열기 함수 (날짜 정보 전달)
   * @returns {Function} closeDateDetail - 모달 닫기 함수
   * @returns {Function} setSelectedDateForDetail - 선택된 날짜 설정 함수
   * @returns {Function} setShowDateDetailModal - 모달 표시 설정 함수
   *
   * @note
   * - 주로 MonthView에서 날짜 클릭 시 사용
   * - DateDetailModal에 show, selectedDate, onClose를 전달
   * - selectedDateForDetail은 날짜 클릭 시 설정되고, 모달 닫기 시 null로 초기화
   */
  const {
    selectedDateForDetail,
    showDateDetailModal,
    openDateDetail,
    closeDateDetail,
    setSelectedDateForDetail,
    setShowDateDetailModal
  } = useDateDetail();

  // ===================================================================================================
  // 📌 섹션 2: 핸들러 팩토리 - 이벤트 핸들러 생성
  // ===================================================================================================
  //
  // 이 섹션에서는 팩토리 패턴을 사용하여 이벤트 핸들러를 생성합니다.
  // 팩토리 함수에 의존성을 주입하여 테스트 용이성과 재사용성을 높입니다.
  //
  // 📝 핸들러 목록:
  //    1. weekHandlers - 주간 네비게이션 핸들러 (prev, next)
  //    2. monthHandlers - 월간 네비게이션 핸들러 (prev, next)
  //    3. viewHandlers - 뷰 모드 토글 핸들러 (시간범위, 뷰모드, 병합)
  //    4. dateClickHandler - 날짜 클릭 핸들러 (모달 오픈)
  //
  // 📌 주의사항:
  //    - 핸들러 팩토리는 handlers/navigationHandlers.js에 정의됨
  //    - 각 팩토리는 의존성을 주입받아 핸들러 객체 또는 함수 반환
  //    - 이 방식으로 의존성을 명확히 하고, 테스트 시 mock 주입 가능
  //
  // ===================================================================================================

  /**
   * 주간 네비게이션 핸들러 생성
   *
   * @description navigateWeek 함수를 주입받아 주간 네비게이션 핸들러 생성
   *
   * @param {Function} navigateWeek - 주간 네비게이션 함수 (direction: 1 | -1)
   *
   * @returns {Object} 주간 네비게이션 핸들러
   * @returns {Function} navigateWeek - 원본 함수 (그대로 반환)
   * @returns {Function} handlePrevWeek - 이전 주로 이동
   * @returns {Function} handleNextWeek - 다음 주로 이동
   *
   * @note
   * - createWeekHandlers는 handlers/navigationHandlers.js에 정의
   * - 팩토리 패턴으로 의존성 주입 (테스트 용이)
   */
  const weekHandlers = createWeekHandlers(navigateWeek);

  /**
   * 월간 네비게이션 핸들러 생성
   *
   * @description navigateMonth 함수를 주입받아 월간 네비게이션 핸들러 생성
   *
   * @param {Function} navigateMonth - 월간 네비게이션 함수 (direction: 1 | -1)
   *
   * @returns {Object} 월간 네비게이션 핸들러
   * @returns {Function} navigateMonth - 원본 함수 (그대로 반환)
   * @returns {Function} handlePrevMonth - 이전 달로 이동
   * @returns {Function} handleNextMonth - 다음 달로 이동
   *
   * @note
   * - createMonthHandlers는 handlers/navigationHandlers.js에 정의
   * - 팩토리 패턴으로 의존성 주입 (테스트 용이)
   */
  const monthHandlers = createMonthHandlers(navigateMonth);

  /**
   * 뷰 모드 토글 핸들러 생성
   *
   * @description 뷰 모드 관련 토글 함수들을 주입받아 핸들러 생성
   *
   * @param {Function} toggleTimeRange - 시간 범위 토글 함수
   * @param {Function} toggleViewMode - 뷰 모드 토글 함수
   * @param {Function} toggleMerged - 병합 모드 토글 함수
   *
   * @returns {Object} 뷰 모드 토글 핸들러
   * @returns {Function} handleToggleTimeRange - 시간 범위 토글 핸들러
   * @returns {Function} handleToggleViewMode - 뷰 모드 토글 핸들러
   * @returns {Function} handleToggleMerged - 병합 모드 토글 핸들러
   *
   * @note
   * - createViewHandlers는 handlers/navigationHandlers.js에 정의
   * - 팩토리 패턴으로 의존성 주입 (테스트 용이)
   * - 현재는 handleToggleTimeRange만 ViewControls에서 사용 중
   */
  const viewHandlers = createViewHandlers(toggleTimeRange, toggleViewMode, toggleMerged);

  /**
   * 날짜 클릭 핸들러 생성
   *
   * @description openDateDetail 함수를 주입받아 날짜 클릭 핸들러 생성
   *
   * @param {Function} openDateDetail - 날짜 상세 모달 열기 함수
   *
   * @returns {Function} 날짜 클릭 핸들러
   *   - 파라미터: dayData (날짜 정보 객체)
   *   - 동작: openDateDetail(dayData) 호출
   *
   * @note
   * - createDateClickHandler는 handlers/navigationHandlers.js에 정의
   * - 팩토리 패턴으로 의존성 주입 (테스트 용이)
   * - MonthView의 onDateClick prop으로 전달됨
   */
  const dateClickHandler = createDateClickHandler(openDateDetail);

  // ===================================================================================================
  // 📌 섹션 3: 렌더링 - 조건부 UI 표시
  // ===================================================================================================
  //
  // 이 섹션에서는 현재 상태에 따라 적절한 UI 컴포넌트를 렌더링합니다.
  //
  // 📝 렌더링 구조:
  //    1. ViewControls - 상단 컨트롤 버튼 (showViewControls가 true일 때만)
  //    2. 메인 뷰 렌더링 (조건부)
  //       - viewMode === 'month': MonthView
  //       - viewMode === 'week':
  //         - showMerged === true: MergedWeekView
  //         - showMerged === false: DetailedWeekView
  //    3. DateDetailModal - 날짜 상세 모달 (항상 렌더링, show prop으로 표시 제어)
  //
  // 📌 주의사항:
  //    - 각 컴포넌트에 필요한 props만 전달 (과도한 prop drilling 방지)
  //    - 공통 props: schedule, exceptions, allPersonalTimes, priorityConfig
  //    - ViewControls: 모든 상태 및 핸들러 전달 (컨트롤 버튼 역할)
  //    - MonthView: 날짜 클릭 핸들러 전달 (onDateClick)
  //    - WeekView: 시간 슬롯 생성 함수 전달 (getCurrentTimeSlots)
  //    - DateDetailModal: 모달 제어 함수 및 모든 데이터 전달
  //
  // ===================================================================================================

  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-6">
      {/* ========== ViewControls: 상단 컨트롤 버튼 ========== */}
      {/*
       * 뷰 모드 전환, 시간 범위 토글, 병합 모드 토글, 네비게이션 버튼을 제공
       *
       * @renders ViewControls
       * @condition showViewControls === true
       *
       * @props
       * - viewMode: 현재 뷰 모드 ('week' | 'month')
       * - setViewMode: 뷰 모드 설정 함수
       * - enableMonthView: 월간 뷰 활성화 여부 (false면 "개발 중" 표시)
       * - showFullDay: 24시간 모드 여부
       * - toggleTimeRange: 시간 범위 토글 핸들러 (viewHandlers에서 가져옴)
       * - showMerged: 병합 모드 여부
       * - setShowMerged: 병합 모드 설정 함수
       * - currentDate: 현재 날짜 (표시용)
       * - navigateMonth: 월간 네비게이션 함수 (monthHandlers에서 가져옴)
       * - navigateWeek: 주간 네비게이션 함수 (weekHandlers에서 가져옴)
       * - goToToday: 오늘로 이동 함수
       *
       * @note
       * - 왼쪽: 뷰 모드 버튼, 시간 범위 버튼, 병합 버튼
       * - 오른쪽: 이전/다음 버튼, 현재 날짜, 오늘 버튼
       * - 주간/월간 모드에 따라 네비게이션 함수 다르게 호출
       */}
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

      {/* ========== 메인 뷰 렌더링 (조건부) ========== */}
      {/*
       * viewMode에 따라 MonthView 또는 WeekView 렌더링
       * WeekView는 showMerged에 따라 MergedWeekView 또는 DetailedWeekView 렌더링
       *
       * @structure
       * - viewMode === 'month': MonthView
       * - viewMode === 'week':
       *   - showMerged === true: MergedWeekView (병합 모드, 연속 블록)
       *   - showMerged === false: DetailedWeekView (분할 모드, 10분 단위 그리드)
       */}
      {viewMode === 'month' ? (
        /* ========== MonthView: 월간 달력 뷰 ========== */
        /*
         * 한 달의 일정을 달력 형태로 표시하고, 날짜 클릭 시 상세 모달 오픈
         *
         * @renders MonthView
         * @condition viewMode === 'month'
         *
         * @props
         * - currentDate: 현재 날짜 (달력 기준 월)
         * - allPersonalTimes: 병합된 개인 시간 배열 (personalTimes + fixedSchedules)
         * - schedule: 기본 일정 (선호 시간)
         * - exceptions: 예외 일정
         * - onDateClick: 날짜 클릭 핸들러 (dateClickHandler, 모달 오픈)
         *
         * @note
         * - 각 날짜 셀에 선호/예외/개인 일정 태그 표시
         * - 날짜 클릭 시 DateDetailModal 오픈
         * - 이전/다음 달 날짜도 희미하게 표시
         */
        <MonthView
          currentDate={currentDate}
          allPersonalTimes={allPersonalTimes}
          schedule={schedule}
          exceptions={exceptions}
          onDateClick={dateClickHandler}
        />
      ) : (
        /* ========== 주간 뷰 (병합 / 분할) ========== */
        /*
         * showMerged에 따라 MergedWeekView 또는 DetailedWeekView 렌더링
         *
         * @structure
         * - showMerged === true: MergedWeekView (병합 모드)
         * - showMerged === false: DetailedWeekView (분할 모드)
         *
         * @note
         * - 공통 props: allPersonalTimes, schedule, exceptions, weekDates, getCurrentTimeSlots, priorityConfig
         * - MergedWeekView: 연속 블록 병합, 겹침 처리 (세로 분할)
         * - DetailedWeekView: 10분 단위 그리드, 우선순위 기반 색상 표시
         */
        showMerged ? (
          /* ========== MergedWeekView: 병합 모드 주간 뷰 ========== */
          /*
           * 같은 제목의 연속 블록을 병합하여 표시 (겹침은 세로로 분할)
           *
           * @renders MergedWeekView
           * @condition viewMode === 'week' && showMerged === true
           *
           * @props
           * - allPersonalTimes: 병합된 개인 시간 배열
           * - schedule: 기본 일정
           * - exceptions: 예외 일정
           * - weekDates: 주간 날짜 배열 (일~토 7일)
           * - getCurrentTimeSlots: 시간 슬롯 배열 생성 함수
           * - showFullDay: 24시간 모드 여부 (사용 안 함, getCurrentTimeSlots에 반영됨)
           * - priorityConfig: 우선순위별 색상 및 레이블 설정
           *
           * @note
           * - 병합 키: title + instructor + type + sourceImageIndex
           * - 겹치는 블록은 세로로 분할 (overlapIndex, overlapCount)
           * - 1분 = 1.6px로 블록 높이 계산
           * - 60분 이상: 4줄 표시 (학원/과목/반/시간)
           * - 60분 미만: 2줄 표시 (과목/시간)
           */
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
          /* ========== DetailedWeekView: 분할 모드 주간 뷰 ========== */
          /*
           * 10분 단위 그리드로 일정 표시 (우선순위 기반 색상)
           *
           * @renders DetailedWeekView
           * @condition viewMode === 'week' && showMerged === false
           *
           * @props
           * - allPersonalTimes: 병합된 개인 시간 배열
           * - schedule: 기본 일정
           * - exceptions: 예외 일정
           * - weekDates: 주간 날짜 배열 (일~토 7일)
           * - getCurrentTimeSlots: 시간 슬롯 배열 생성 함수
           * - priorityConfig: 우선순위별 색상 및 레이블 설정
           *
           * @note
           * - 10분 단위 셀로 구성 (TIME_SLOT_INTERVAL = 10)
           * - 우선순위: exceptionSlot > personalSlot > recurringSlot
           * - 개인 일정 색상: hex + CC (80% 투명도)
           * - Tailwind 클래스 → hex 변환 (20+ 색상)
           */
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

      {/* ========== DateDetailModal: 날짜 상세 모달 ========== */}
      {/*
       * 특정 날짜의 세부 시간표를 모달로 표시 (MonthView에서 날짜 클릭 시 오픈)
       *
       * @renders DateDetailModal
       * @condition 항상 렌더링 (show prop으로 표시 제어)
       *
       * @props
       * - show: 모달 표시 여부 (showDateDetailModal)
       * - onClose: 모달 닫기 핸들러 (closeDateDetail)
       * - selectedDate: 선택된 날짜 정보 (selectedDateForDetail)
       * - allPersonalTimes: 병합된 개인 시간 배열
       * - schedule: 기본 일정
       * - exceptions: 예외 일정
       * - getCurrentTimeSlots: 시간 슬롯 배열 생성 함수
       * - showFullDay: 24시간 모드 여부
       * - setShowFullDay: 24시간 모드 설정 함수 (모달 내 토글)
       * - showMerged: 병합 모드 여부
       * - setShowMerged: 병합 모드 설정 함수 (모달 내 토글)
       * - priorityConfig: 우선순위별 색상 및 레이블 설정
       *
       * @note
       * - 모달 내에서 병합/분할 모드 전환 가능
       * - 병합 모드: 연속 블록으로 표시
       * - 분할 모드: 10분 단위 그리드로 표시
       * - "빈 시간" vs "불가능 시간" 분류 (priority >= 2: 빈 시간, < 2: 불가능)
       */}
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
