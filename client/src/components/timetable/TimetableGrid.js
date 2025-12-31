/**
 * ===================================================================================================
 * TimetableGrid.js - 타임테이블 메인 그리드 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/timetable
 *
 * 🎯 주요 기능:
 *    - 타임테이블 그리드의 메인 컴포넌트로 전체 시간표 UI 관리
 *    - 주간 날짜 생성 및 평일 5일 표시 (월~금)
 *    - 슬롯 소유자 추적 및 병합 블록 감지
 *    - 슬롯 클릭 처리 (선택/삭제/교환 요청)
 *    - 차단 시간 및 방 예외 시간 확인
 *    - 중복 요청 방지 및 요청 이력 추적
 *    - 시간 요청/교환/취소 모달 관리
 *    - 병합 모드/일반 모드 지원
 *
 * 🔗 연결된 파일:
 *    - ./TimetableControls.js - 헤더 행 (시간 + 요일)
 *    - ./WeekView.js - 시간 행들 (그리드 본문)
 *    - ../modals/CustomAlertModal.js - 알림 모달
 *    - ../../utils/dateUtils.js - 날짜 관련 유틸리티
 *    - ../../utils/timetableConstants.js - 상수 정의
 *    - ../../utils/timetableHelpers.js - 헬퍼 함수
 *    - ../../utils/validationUtils.js - 검증 함수
 *
 * 💡 UI 위치:
 *    - 탭: 조율 탭 (CoordinationTab) 또는 시간표 관리
 *    - 섹션: 타임테이블 그리드 전체 영역
 *    - 경로: 앱 실행 > 조율 탭 > 시간표 그리드
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 타임테이블의 전체 동작 로직이 변경됨
 *    - 슬롯 선택 로직 변경: handleSlotClick 함수 수정
 *    - 병합 블록 탐지 변경: findMergedBlock 함수 수정
 *    - 요청 처리 변경: handleRequest, handleChangeRequest 함수 수정
 *    - 차단 시간 로직 변경: getBlockedTimeInfo 함수 수정
 *
 * 📝 참고사항:
 *    - 평일만 표시 (월~금, 5일)
 *    - 10분 단위 시간 슬롯
 *    - Date 객체 기반 날짜 처리
 *    - 병합 모드: 연속된 슬롯을 하나의 블록으로 표시
 *    - 일반 모드: 개별 10분 슬롯으로 표시
 *    - 방장은 교환 요청 불가
 *    - 중복 요청 방지 (REQUEST_DEBOUNCE_TIME)
 *    - 슬롯 소유자 확인 후 삭제/교환 가능
 *
 * ===================================================================================================
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CustomAlertModal from '../modals/CustomAlertModal';
import TimetableControls from './TimetableControls';
import WeekView from './WeekView';

// ===================================================================================================
// 📌 섹션 1: 유틸리티 임포트
// ===================================================================================================
//
// 이 섹션에서는 날짜, 상수, 헬퍼, 검증 관련 유틸리티를 임포트합니다.
//
// 📝 임포트 종류:
//    - dateUtils: 날짜 생성, 변환, 인덱스 계산
//    - timetableConstants: DAY_NAMES, REQUEST_TYPES, CHANGE_ACTIONS 등 상수
//    - timetableHelpers: 시간 슬롯 생성, 소유자 확인, 병합 등 헬퍼
//    - validationUtils: 중복 요청 확인, 슬롯 소유 확인 등 검증
//
// ===================================================================================================

// Import utility functions
import {
  hasExistingSwapRequest,
  isSlotOwnedByCurrentUser,
  isSlotInSelectedSlots,
  findExistingSlot,
  isRequestTooRecent
} from '../../utils/validationUtils';

// Import constants
import {
  DAY_NAMES,
  DAY_NAMES_KOREAN,
  DAYS,
  REQUEST_TYPES,
  CHANGE_ACTIONS,
  BUTTON_STYLES,
  DEFAULT_SCHEDULE_START_HOUR,
  DEFAULT_SCHEDULE_END_HOUR
} from '../../utils/timetableConstants';

// Import helper functions
import {
  generateDayTimeSlots,
  getBlockedTimeInfo as getBlockedTimeInfoHelper,
  getRoomExceptionInfo as getRoomExceptionInfoHelper,
  getSlotOwner as getSlotOwnerHelper,
  isSlotSelected as isSlotSelectedHelper,
  mergeConsecutiveTimeSlots,
  getHourFromSettings
} from '../../utils/timetableHelpers';

// Import date utilities
import {
  getBaseDate,
  generateWeekDates,
  getDayIndex,
  createDayDisplay,
  safeDateToISOString
} from '../../utils/dateUtils';

// Helper functions are now imported from utility files

/**
 * TimetableGrid - 타임테이블 메인 그리드 컴포넌트
 *
 * @description 타임테이블의 메인 컴포넌트로 헤더, 시간 행, 모달 등 전체 UI를 통합 관리하며,
 *              슬롯 선택, 교환 요청, 차단 시간 처리 등의 핵심 로직을 담당
 *
 * @component
 *
 * @param {Object} props - 컴포넌트 props
 * @param {string} props.roomId - 방 ID
 * @param {Object} props.roomSettings - 방 설정 정보
 *   - blockedTimes: 차단된 시간 목록
 *   - roomExceptions: 방 예외 시간 목록
 *   - startHour: 시작 시간 (기본값: 9)
 *   - endHour: 종료 시간 (기본값: 18)
 * @param {Array} props.timeSlots - 시간 슬롯 배열
 *   - 구조: [{ date: Date, startTime: "09:00", endTime: "09:10", user: userId, ... }, ...]
 * @param {Array} props.travelSlots - 이동 시간 슬롯 배열 (기본값: [])
 * @param {string} props.travelMode - 이동 모드 ('normal', 'travel', 등)
 * @param {Array} props.members - 방 멤버 배열 (기본값: [])
 * @param {Object} props.roomData - 방 데이터 (요청 목록 등)
 *   - requests: 교환/취소 요청 목록
 * @param {Function} props.onSlotSelect - 슬롯 선택 시 호출되는 콜백
 * @param {Object} props.currentUser - 현재 사용자 정보
 * @param {boolean} props.isRoomOwner - 현재 사용자가 방장인지 여부
 * @param {Function} props.onRequestSlot - 슬롯 요청 시 호출되는 콜백
 * @param {Function} props.onRemoveSlot - 슬롯 삭제 시 호출되는 콜백
 * @param {Function} props.onDirectSubmit - 직접 제출 시 호출되는 콜백
 * @param {Array} props.selectedSlots - 선택된 슬롯 배열 (기본값: [])
 * @param {Array} props.events - 이벤트 배열
 * @param {Array} props.proposals - 제안 배열
 * @param {Function} props.calculateEndTime - 종료 시간 계산 함수
 * @param {Function} props.onWeekChange - 주 변경 시 호출되는 콜백
 * @param {Date} props.initialStartDate - 초기 시작 날짜
 * @param {boolean} props.showMerged - 병합 모드 여부 (기본값: true)
 * @param {Object} props.ownerOriginalSchedule - 방장의 원본 시간표 데이터 (기본값: null)
 * @param {Function} props.onOpenChangeRequestModal - 변경 요청 모달 열기 함수
 *
 * @returns {JSX.Element} 타임테이블 그리드 UI (헤더 + 시간 행 + 모달)
 *
 * @example
 * <TimetableGrid
 *   roomId="room123"
 *   roomSettings={{ startHour: 9, endHour: 18, blockedTimes: [...] }}
 *   timeSlots={[...]}
 *   currentUser={{ id: 'user1', name: '홍길동' }}
 *   isRoomOwner={false}
 *   onSlotSelect={(slot) => console.log('선택:', slot)}
 *   onRequestSlot={(data) => console.log('요청:', data)}
 *   showMerged={true}
 * />
 *
 * @note
 * - 평일만 표시 (월~금)
 * - 10분 단위 시간 슬롯
 * - 병합 모드: 연속된 슬롯을 블록으로 묶어 표시
 * - 일반 모드: 개별 슬롯으로 표시
 * - 방장은 교환 요청 불가
 * - 중복 요청 방지 메커니즘
 */
const TimetableGrid = ({
  roomId,
  roomSettings,
  timeSlots,
  travelSlots = [],
  travelMode, // Add travelMode to props
  myTravelDuration = 0, // 🆕 나의 이동시간 (조원용)
  members = [],
  roomData,
  onSlotSelect,
  currentUser,
  isRoomOwner,
  onRequestSlot,
  onRemoveSlot,
  onDirectSubmit,
  selectedSlots = [],
  events,
  proposals,
  calculateEndTime,
  onWeekChange, // New prop to pass current week start date to parent
  initialStartDate, // New prop to set the initial week to display
  showMerged = true, // New prop for merged view
  ownerOriginalSchedule = null, // 방장의 원본 시간표 데이터
  onOpenChangeRequestModal // New prop to open change request modal
}) => {
  // ===================================================================================================
  // 📌 섹션 3: 상태 초기화
  // ===================================================================================================
  //
  // 이 섹션에서는 컴포넌트의 상태를 초기화합니다.
  //
  // 📝 상태 목록:
  //    - customAlert: 커스텀 알림 모달 상태 (show, message)
  //    - recentRequests: 최근 요청 추적 Set (중복 방지)
  //    - weekDates: 주간 날짜 배열 (월~금)
  //    - mergedTimeSlots: 병합된 시간 슬롯 배열
  //    - showRequestModal: 시간 요청 모달 표시 여부
  //    - slotToRequest: 요청할 슬롯 데이터
  //    - showChangeRequestModal: 변경 요청 모달 표시 여부
  //    - slotToChange: 변경할 슬롯 데이터
  //
  // ===================================================================================================

  /**
   * ownerSlots - 현재 사용자가 소유한 슬롯 배열
   *
   * @type {Array}
   * @description timeSlots에서 현재 사용자의 슬롯만 필터링
   *
   * @note
   * - userId 또는 user 필드로 소유자 확인
   * - currentUser.id와 비교
   */
  const ownerSlots = timeSlots?.filter(slot => slot.userId === currentUser?.id || slot.user === currentUser?.id);

  /**
   * customAlert - 커스텀 알림 모달 상태
   *
   * @type {Object}
   * @property {boolean} show - 모달 표시 여부
   * @property {string} message - 표시할 메시지
   *
   * @description
   * - showAlert: 알림 표시 함수
   * - closeAlert: 알림 닫기 함수
   */
  // CustomAlert 상태
  const [customAlert, setCustomAlert] = useState({ show: false, message: '' });
  const showAlert = (message) => setCustomAlert({ show: true, message });
  const closeAlert = () => setCustomAlert({ show: false, message: '' });

  /**
   * recentRequests - 최근 요청 추적 Set
   *
   * @type {Set}
   * @description 중복 요청 방지를 위한 최근 요청 키 추적
   *
   * @note
   * - 요청 키 형식: "${date}-${time}-${targetUserId}"
   * - REQUEST_DEBOUNCE_TIME 이내 중복 요청 차단
   */
  // 최근 요청 추적 (중복 방지)
  const [recentRequests, setRecentRequests] = useState(new Set());

  /**
   * weekDates - 주간 날짜 배열
   *
   * @type {Array}
   * @description 주간 뷰에 표시할 날짜 배열 (월~금)
   *
   * @note
   * - 구조: [{ display: "월 (12.9)", fullDate: Date, dayOfWeek: 1 }, ...]
   * - generateWeekDates 유틸리티로 생성
   */
  const [weekDates, setWeekDates] = useState([]);

  /**
   * mergedTimeSlots - 병합된 슬롯 배열
   *
   * @type {Array}
   * @description 연속된 슬롯을 병합한 배열
   *
   * @note
   * - showMerged가 true일 때 사용
   * - mergeConsecutiveTimeSlots 함수로 생성
   * - 각 슬롯에 isMerged, originalSlots 등의 속성 추가
   */
  // 병합된 슬롯들을 추적하는 상태
  const [mergedTimeSlots, setMergedTimeSlots] = useState([]);

  // ===================================================================================================
  // 📌 섹션 4: 주간 날짜 생성 (useEffect)
  // ===================================================================================================
  //
  // 이 섹션에서는 컴포넌트 마운트 시 또는 initialStartDate 변경 시 주간 날짜를 생성합니다.
  //
  // 📝 로직:
  //    1. getBaseDate로 기준 날짜 계산 (initialStartDate 또는 현재 주의 월요일)
  //    2. generateWeekDates로 주간 날짜 배열 생성 (월~금)
  //    3. weekDates 상태 업데이트
  //    4. onWeekChange 콜백 호출 (주 시작 날짜 전달)
  //
  // ===================================================================================================

  useEffect(() => {
    // Use utility function to get base date
    const baseDate = getBaseDate(initialStartDate);

    // Generate week dates using utility function
    const dates = generateWeekDates(baseDate, DAY_NAMES_KOREAN);
    setWeekDates(dates);

    // Call onWeekChange with the start date of the first week displayed
    if (onWeekChange && dates.length > 0) {
      const weekStartDate = dates[0].fullDate.toISOString().split('T')[0];
      onWeekChange(weekStartDate); // Pass YYYY-MM-DD format
    }
  }, [onWeekChange, initialStartDate]);

  // ===================================================================================================
  // 📌 섹션 5: 시간 슬롯 병합 (useEffect)
  // ===================================================================================================
  //
  // 이 섹션에서는 timeSlots가 변경될 때마다 병합된 슬롯을 업데이트합니다.
  //
  // 📝 로직:
  //    1. travelMode가 'normal'이 아니면 병합하지 않고 원본 사용
  //    2. showMerged가 true이면 mergeConsecutiveTimeSlots로 병합
  //    3. mergedTimeSlots 상태 업데이트
  //
  // ===================================================================================================

  // timeSlots가 변경될 때마다 병합된 슬롯 업데이트
  useEffect(() => {
    // 이동시간 모드에서도 병합 수행 (10분 단위 슬롯을 연속된 블록으로 합침)
    const merged = mergeConsecutiveTimeSlots(timeSlots);
    setMergedTimeSlots(merged);
  }, [timeSlots, showMerged, travelMode]);

  // ===================================================================================================
  // 📌 섹션 6: 시간 슬롯 생성
  // ===================================================================================================
  //
  // 이 섹션에서는 하루 동안의 시간 슬롯 목록을 생성합니다.
  //
  // 📝 로직:
  //    1. roomSettings에서 startHour, endHour 추출 (없으면 기본값 사용)
  //    2. getHourFromSettings로 시작/종료 시간 계산
  //    3. generateDayTimeSlots로 10분 단위 시간 슬롯 배열 생성
  //    4. filteredTimeSlotsInDay: 차단 시간도 표시하기 위해 필터링하지 않음
  //
  // ===================================================================================================

  /**
   * days - 요일 표시 라벨 배열
   *
   * @type {Array}
   * @description 헤더에 표시할 요일 이름 (월, 화, 수, 목, 금, 토, 일)
   *
   * @note
   * - DAYS 상수에서 가져옴
   * - 로직에는 사용하지 않고 표시용
   */
  const days = DAYS; // Display labels (not used for logic)

  /**
   * scheduleStartHour - 스케줄 시작 시간
   *
   * @type {number}
   * @description 타임테이블의 시작 시간 (0~23)
   *
   * @note
   * - roomSettings.startHour 우선 사용
   * - 없으면 DEFAULT_SCHEDULE_START_HOUR (9) 사용
   */
  /**
   * scheduleEndHour - 스케줄 종료 시간
   *
   * @type {number}
   * @description 타임테이블의 종료 시간 (0~23)
   *
   * @note
   * - roomSettings.endHour 우선 사용
   * - 없으면 DEFAULT_SCHEDULE_END_HOUR (18) 사용
   */
  // Generate time slots using utility functions
  // Use startHour/endHour first (passed from parent), then fall back to scheduleStart/scheduleEnd
  const scheduleStartHour = getHourFromSettings(
    roomSettings?.startHour,
    DEFAULT_SCHEDULE_START_HOUR.toString()
  );
  const scheduleEndHour = getHourFromSettings(
    roomSettings?.endHour,
    DEFAULT_SCHEDULE_END_HOUR.toString()
  );

  /**
   * timeSlotsInDay - 하루 동안의 시간 슬롯 배열
   *
   * @type {Array<string>}
   * @description 10분 단위로 생성된 시간 문자열 배열
   *
   * @example
   * ["09:00", "09:10", "09:20", ..., "17:50", "18:00"]
   *
   * @note
   * - scheduleStartHour부터 scheduleEndHour까지
   * - 10분 간격 ("00", "10", "20", "30", "40", "50")
   */
  const timeSlotsInDay = generateDayTimeSlots(scheduleStartHour, scheduleEndHour);


  // ===================================================================================================
  // 📌 섹션 7: 헬퍼 함수 (useCallback)
  // ===================================================================================================
  //
  // 이 섹션에서는 타임테이블 그리드에서 사용하는 헬퍼 함수들을 정의합니다.
  //
  // 📝 함수 목록:
  //    - getBlockedTimeInfo: 차단된 시간 정보 반환
  //    - getRoomExceptionInfo: 방 예외 시간 정보 반환
  //    - getSlotOwner: 슬롯 소유자 정보 반환 (병합 여부 포함)
  //    - isSlotSelected: 슬롯 선택 여부 확인
  //    - findMergedBlock: 병합된 블록 찾기
  //
  // ===================================================================================================

  /**
   * getBlockedTimeInfo - 차단된 시간 정보 반환
   *
   * @function
   * @param {string} time - 시간 문자열 (예: "09:00")
   * @returns {Object|null} 차단 정보 객체 또는 null
   *   - name: 차단 사유 이름
   *   - type: 차단 유형 (예: "non_preferred", "personal", "exception")
   *
   * @description
   * - roomSettings.blockedTimes를 확인하여 해당 시간이 차단되었는지 확인
   * - getBlockedTimeInfoHelper 유틸리티 함수 사용
   *
   * @note
   * - useCallback으로 메모이제이션
   * - roomSettings.blockedTimes 변경 시에만 재생성
   */
  // Helper function to check if a time slot is blocked and return block info
  const getBlockedTimeInfo = useCallback((time) => {
    return getBlockedTimeInfoHelper(time, roomSettings);
  }, [roomSettings?.blockedTimes]);

  /**
   * getRoomExceptionInfo - 방 예외 시간 정보 반환
   *
   * @function
   * @param {Date} date - 날짜 객체
   * @param {string} time - 시간 문자열 (예: "09:00")
   * @returns {Object|null} 예외 정보 객체 또는 null
   *   - name: 예외 사유 이름
   *   - 기타 예외 관련 정보
   *
   * @description
   * - roomSettings.roomExceptions를 확인하여 해당 날짜/시간에 방 예외가 있는지 확인
   * - getRoomExceptionInfoHelper 유틸리티 함수 사용
   *
   * @note
   * - useCallback으로 메모이제이션
   * - roomSettings.roomExceptions 변경 시에만 재생성
   */
  // Helper function to check if a time slot is covered by a room exception
  const getRoomExceptionInfo = useCallback((date, time) => {
    return getRoomExceptionInfoHelper(date, time, roomSettings);
  }, [roomSettings?.roomExceptions]);

  /**
   * filteredTimeSlotsInDay - 필터링된 시간 슬롯 배열
   *
   * @type {Array<string>}
   * @description 차단된 시간도 표시하기 위해 필터링하지 않음
   *
   * @note
   * - timeSlotsInDay와 동일
   * - 차단된 시간은 UI에서 시각적으로 구분하여 표시
   */
  // Don't filter out blocked times - we want to show them as blocked
  const filteredTimeSlotsInDay = timeSlotsInDay;

  /**
   * currentSelectedSlots - 현재 선택된 슬롯 배열
   *
   * @type {Array}
   * @description selectedSlots props를 정규화한 배열
   *
   * @note
   * - useMemo로 메모이제이션
   * - 구조: [{ day: 'monday', startTime: '09:00' }, ...]
   * - day와 startTime이 모두 있는 슬롯만 포함
   */
  // Use selectedSlots from props instead of internal state
  const currentSelectedSlots = useMemo(() => {
    // Expect incoming selectedSlots as objects: { day: 'monday', startTime: '09:00', ... }
    return (selectedSlots || []).map(slot => ({
      day: slot.day,
      startTime: slot.startTime
    })).filter(slot => !!slot.day && !!slot.startTime);
  }, [selectedSlots]);

  /**
   * showRequestModal - 시간 요청 모달 표시 여부
   *
   * @type {boolean}
   * @description 시간 요청 모달을 표시할지 여부
   */
  /**
   * slotToRequest - 요청할 슬롯 데이터
   *
   * @type {Object|null}
   * @description 시간 요청 모달에서 사용할 슬롯 데이터
   */
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [slotToRequest, setSlotToRequest] = useState(null);

  /**
   * showChangeRequestModal - 변경 요청 모달 표시 여부
   *
   * @type {boolean}
   * @description 변경/교환/취소 요청 모달을 표시할지 여부
   */
  /**
   * slotToChange - 변경할 슬롯 데이터
   *
   * @type {Object|null}
   * @description 변경 요청 모달에서 사용할 슬롯 데이터
   */
  const [showChangeRequestModal, setShowChangeRequestModal] = useState(false);
  const [slotToChange, setSlotToChange] = useState(null);

  /**
   * getSlotOwner - 슬롯 소유자 정보 반환
   *
   * @function
   * @param {Date} date - 날짜 객체
   * @param {string} time - 시간 문자열 (예: "09:00")
   * @returns {Object|null} 소유자 정보 객체 또는 null
   *   - name: 소유자 이름
   *   - userId: 소유자 ID
   *   - actualUserId: 실제 사용자 ID
   *   - isMergedSlot: 병합된 슬롯 여부 (showMerged가 true일 때)
   *   - mergedDuration: 병합된 슬롯의 총 길이 (분 단위)
   *
   * @description
   * 1. showMerged에 따라 mergedTimeSlots 또는 timeSlots 사용
   * 2. getSlotOwnerHelper 유틸리티로 기본 소유자 정보 획득
   * 3. 병합 모드에서는 mergedTimeSlots에서 병합 여부 확인
   * 4. 병합된 슬롯이면 isMergedSlot, mergedDuration 추가
   *
   * @note
   * - useCallback으로 메모이제이션
   * - timeSlots, mergedTimeSlots, showMerged 등 변경 시 재생성
   */
  // Helper to get who booked a slot (based on Date object overlap)
  const getSlotOwner = useCallback((date, time) => {
    const slotsToUse = showMerged ? mergedTimeSlots : timeSlots;

    const baseOwnerInfo = getSlotOwnerHelper(
      date,
      time,
      slotsToUse,
      members,
      currentUser,
      isRoomOwner
    );

    // 병합 모드에서 병합된 슬롯인지 확인
    if (showMerged && baseOwnerInfo) {
      const mergedSlot = mergedTimeSlots.find(slot => {
        const slotDate = slot.date ? new Date(slot.date).toISOString().split('T')[0] : null;
        const currentDate = date.toISOString().split('T')[0];

        return slotDate === currentDate &&
               (slot.user === baseOwnerInfo.actualUserId || slot.user?._id === baseOwnerInfo.actualUserId) &&
               time >= slot.startTime && time < slot.endTime;
      });

      if (mergedSlot && mergedSlot.isMerged) {
        return {
          ...baseOwnerInfo,
          isMergedSlot: true,
          mergedDuration: mergedSlot.originalSlots?.length * 10 || 10 // 10분 단위
        };
      }
    }

    return baseOwnerInfo;
  }, [timeSlots, mergedTimeSlots, members, currentUser, isRoomOwner, showMerged]);

  /**
   * isSlotSelected - 슬롯 선택 여부 확인
   *
   * @function
   * @param {Date} date - 날짜 객체
   * @param {string} time - 시간 문자열 (예: "09:00")
   * @returns {boolean} 선택 여부
   *
   * @description
   * - isSlotSelectedHelper 유틸리티로 currentSelectedSlots와 비교
   * - date와 time이 currentSelectedSlots에 포함되면 true
   *
   * @note
   * - 일반 함수 (useCallback 사용 안 함)
   */
  // Helper to check if a slot is selected by the current user (uses currentSelectedSlots)
  const isSlotSelected = (date, time) => {
    return isSlotSelectedHelper(date, time, currentSelectedSlots);
  };

  /**
   * findMergedBlock - 병합된 블록 찾기
   *
   * @function
   * @param {Date} date - 날짜 객체
   * @param {string} time - 시간 문자열 (예: "09:00")
   * @param {string} targetUserId - 대상 사용자 ID
   * @returns {Object|null} 병합된 블록 정보 또는 null
   *   - startTime: 블록 시작 시간
   *   - endTime: 블록 종료 시간
   *   - date: 날짜 객체
   *   - day: 요일 이름 (영어)
   *
   * @description
   * 1. showMerged가 false이면 null 반환
   * 2. 해당 날짜의 대상 사용자 슬롯들을 시작 시간 순으로 정렬
   * 3. 클릭한 시간이 포함된 슬롯 찾기
   * 4. 역방향으로 탐색하여 연속된 블록의 시작 찾기
   * 5. 정방향으로 탐색하여 연속된 블록의 끝 찾기
   * 6. 블록 시작/종료 시간 반환
   *
   * @note
   * - useCallback으로 메모이제이션
   * - 연속된 슬롯 판단: 이전 슬롯의 endTime === 현재 슬롯의 startTime
   * - 분 단위 계산으로 정확한 연속성 확인
   */
  // Function to find merged block for a slot
  const findMergedBlock = useCallback((date, time, targetUserId) => {
    if (!showMerged) {
      return null;
    }

    const dayIndex = getDayIndex(date);
    if (dayIndex === -1) {
      return null;
    }

    // Find all slots belonging to the same user on the same day
    const daySlots = timeSlots?.filter(slot => {
      const slotDate = new Date(slot.date);
      const slotUserId = slot.user?._id || slot.user?.id || slot.user;
      const normalizedTargetUserId = targetUserId?._id || targetUserId?.id || targetUserId;

      const matches = slotDate.toDateString() === date.toDateString() &&
             (slotUserId === normalizedTargetUserId || slotUserId?.toString() === normalizedTargetUserId?.toString());

      return matches;
    }).sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (!daySlots?.length) {
      return null;
    }

    // Find the block that contains the clicked time
    const [hour, minute] = time.split(':').map(Number);
    const clickedMinutes = hour * 60 + minute;

    // Find which slot contains the clicked time
    let currentSlotIndex = -1;
    for (let i = 0; i < daySlots.length; i++) {
      const slot = daySlots[i];
      const [slotHour, slotMinute] = slot.startTime.split(':').map(Number);
      const [endHour, endMinute] = slot.endTime.split(':').map(Number);

      const slotStartMinutes = slotHour * 60 + slotMinute;
      const slotEndMinutes = endHour * 60 + endMinute;

      if (clickedMinutes >= slotStartMinutes && clickedMinutes < slotEndMinutes) {
        currentSlotIndex = i;
        break;
      }
    }

    if (currentSlotIndex === -1) {
      return null;
    }

    // Find the start of the consecutive block (go backwards)
    let blockStartIndex = currentSlotIndex;
    for (let i = currentSlotIndex - 1; i >= 0; i--) {
      const currentSlot = daySlots[i + 1];
      const prevSlot = daySlots[i];

      const [currentStartHour, currentStartMinute] = currentSlot.startTime.split(':').map(Number);
      const [prevEndHour, prevEndMinute] = prevSlot.endTime.split(':').map(Number);

      const currentStartMinutes = currentStartHour * 60 + currentStartMinute;
      const prevEndMinutes = prevEndHour * 60 + prevEndMinute;

      if (prevEndMinutes === currentStartMinutes) {
        blockStartIndex = i;
      } else {
        break;
      }
    }

    // Find the end of the consecutive block (go forwards)
    let blockEndIndex = currentSlotIndex;
    for (let i = currentSlotIndex + 1; i < daySlots.length; i++) {
      const currentSlot = daySlots[i - 1];
      const nextSlot = daySlots[i];

      const [currentEndHour, currentEndMinute] = currentSlot.endTime.split(':').map(Number);
      const [nextStartHour, nextStartMinute] = nextSlot.startTime.split(':').map(Number);

      const currentEndMinutes = currentEndHour * 60 + currentEndMinute;
      const nextStartMinutes = nextStartHour * 60 + nextStartMinute;

      if (currentEndMinutes === nextStartMinutes) {
        blockEndIndex = i;
      } else {
        break;
      }
    }

    const blockStart = daySlots[blockStartIndex].startTime;
    const blockEnd = daySlots[blockEndIndex].endTime;

    // 병합모드에서는 단일 슬롯도 블록 전체 시간으로 반환
    return {
      startTime: blockStart,
      endTime: blockEnd,
      date: date,
      day: DAY_NAMES[dayIndex]
    };
  }, [timeSlots, showMerged, getDayIndex, DAY_NAMES]);

  // ===================================================================================================
  // 📌 섹션 8: 슬롯 클릭 핸들러
  // ===================================================================================================
  //
  // 이 섹션에서는 슬롯 클릭 시 호출되는 핸들러 함수를 정의합니다.
  //
  // 📝 로직:
  //    1. 차단된 시간이면 아무 동작 없음
  //    2. 슬롯에 소유자가 있으면:
  //       a. 현재 사용자 소유: 삭제 확인 후 onRemoveSlot 호출
  //       b. 다른 사용자 소유:
  //          - 방장이면 알림 표시 (방장은 교환 요청 불가)
  //          - 중복 요청 확인 (recentRequests, roomData.requests)
  //          - 병합 블록 찾기 (showMerged가 true일 때)
  //          - 교환 요청 모달 열기
  //    3. 빈 슬롯이면: onSlotSelect 호출 (새 일정 생성)
  //
  // ===================================================================================================

  /**
   * handleSlotClick - 슬롯 클릭 핸들러
   *
   * @function
   * @param {Date} date - 클릭한 슬롯의 날짜
   * @param {string} time - 클릭한 슬롯의 시간 (예: "09:00")
   * @returns {void}
   *
   * @description
   * 슬롯 클릭 시 호출되며, 슬롯의 상태에 따라 다른 동작 수행:
   * 1. 차단된 시간: 아무 동작 없음
   * 2. 본인 슬롯: 삭제 확인 모달 → onRemoveSlot
   * 3. 다른 사용자 슬롯: 교환 요청 모달 (방장은 불가)
   * 4. 빈 슬롯: onSlotSelect (새 일정)
   *
   * @note
   * - useCallback으로 메모이제이션
   * - 중복 요청 방지 로직 포함
   * - 병합 모드에서는 블록 단위로 교환 요청
   */
  // Function to handle slot click
  const handleSlotClick = useCallback((date, time) => {
    const isBlocked = !!getBlockedTimeInfo(time);
    const ownerInfo = getSlotOwner(date, time);
    const isOwnedByCurrentUser = isSlotOwnedByCurrentUser(ownerInfo, currentUser);


    if (isBlocked) {
      return;
    }

    if (ownerInfo) {
      if (isOwnedByCurrentUser) {
        if (onRemoveSlot && window.confirm('이 시간을 삭제하시겠습니까?')) {
          const [hour, minute] = time.split(':').map(Number);
          const endHour = minute >= 50 ? hour + 1 : hour;
          const endMinute = minute >= 50 ? 0 : minute + 10;

          const dayIndex = getDayIndex(date);
          if (dayIndex === -1) return; // Weekend, skip

          onRemoveSlot({
            date: date, // Pass date object
            day: DAY_NAMES[dayIndex],
            startTime: time,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`
          });
        }
      } else {
        // 방장은 다른 사람의 시간에 대해 교환 요청을 할 수 없음
        if (isRoomOwner) {
          showAlert('방장은 시간표 교환요청을 할 수 없습니다.');
          return;
        }

        const requestKey = `${date.toISOString().split('T')[0]}-${time}-${ownerInfo.actualUserId || ownerInfo.userId}`;

        if (isRequestTooRecent(recentRequests, requestKey)) {
          showAlert('이미 이 시간대에 대한 자리 요청을 보냈습니다. 기존 요청이 처리될 때까지 기다려주세요.');
          return;
        }

        const hasDuplicate = hasExistingSwapRequest(roomData?.requests, currentUser, date, time, ownerInfo.actualUserId || ownerInfo.userId);

        if (hasDuplicate) {
          showAlert('이미 이 시간대에 대한 자리 요청을 보냈습니다. 기존 요청이 처리될 때까지 기다려주세요.');
          return;
        }

        const existingSlot = findExistingSlot(timeSlots, date, time, ownerInfo.actualUserId || ownerInfo.userId);

        // 정확한 날짜 표시를 위한 dayDisplay 생성
        const dayDisplay = createDayDisplay(date);

        // Check if in merged mode and find the block
        const mergedBlock = findMergedBlock(date, time, ownerInfo.actualUserId || ownerInfo.userId);

        // Use block time range if in merged mode, otherwise use single slot
        const startTime = mergedBlock ? mergedBlock.startTime : time;
        const endTime = mergedBlock ? mergedBlock.endTime : (calculateEndTime ? calculateEndTime(time) : (() => {
          const [h, m] = time.split(':').map(Number);
          const eh = m === 30 ? h + 1 : h;
          const em = m === 30 ? 0 : m + 30;
          return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
        })());

        const slotData = {
          date: date, // Pass date object
          startTime: startTime, // 블록 시작 시간
          endTime: endTime, // 블록 종료 시간
          time: startTime, // 하위 호환성을 위해 유지
          currentOwner: ownerInfo.name,
          targetUserId: ownerInfo.actualUserId || ownerInfo.userId,
          action: 'request',
          dayDisplay: dayDisplay, // 정확한 날짜 표시
          isBlockRequest: !!mergedBlock, // Flag to indicate block request
          targetSlot: {
            date: date, // Pass date object
            day: DAY_NAMES[getDayIndex(date)],
            startTime: startTime,
            endTime: endTime,
            subject: existingSlot?.subject || (mergedBlock ? '블록 요청' : '자리 요청'),
            user: ownerInfo.actualUserId || ownerInfo.userId
          }
        };

        if (onOpenChangeRequestModal) {
          onOpenChangeRequestModal(slotData);
        } else {
          setSlotToChange(slotData);
          setShowChangeRequestModal(true);
        }
      }
          } else { // Empty slot
            const daysKey = DAY_NAMES;
            const dayIndex = getDayIndex(date);
            if (dayIndex === -1) return; // Weekend, skip

            const [hour, minute] = time.split(':').map(Number);
            const endHour = minute >= 50 ? hour + 1 : hour;
            const endMinute = minute >= 50 ? 0 : minute + 10;

            const newSlot = {
              date: date, // Pass date object
              day: daysKey[dayIndex],
              startTime: time,
              endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
              subject: '새 일정'
            };

            if (onSlotSelect) onSlotSelect(newSlot);
          }  }, [
    getBlockedTimeInfo,
    getSlotOwner,
    currentUser,
    isRoomOwner,
    onRemoveSlot,
    calculateEndTime,
    selectedSlots,
    onSlotSelect,
    recentRequests,
    roomData?.requests,
    timeSlots,
    onRequestSlot
  ]);

  // ===================================================================================================
  // 📌 섹션 9: 모달 핸들러
  // ===================================================================================================
  //
  // 이 섹션에서는 시간 요청 및 변경 요청 모달의 핸들러 함수들을 정의합니다.
  //
  // 📝 함수 목록:
  //    - handleRequest: 시간 요청 처리
  //    - handleChangeRequest: 시간 변경/교환/취소 요청 처리
  //
  // ===================================================================================================

  /**
   * handleRequest - 시간 요청 핸들러
   *
   * @function
   * @param {string} message - 요청 메시지
   * @returns {void}
   *
   * @description
   * 시간 요청 모달에서 "요청하기" 버튼 클릭 시 호출:
   * 1. slotToRequest에서 시간 정보 추출
   * 2. 종료 시간 계산 (30분 또는 다음 정각)
   * 3. requestData 생성 (roomId, type, timeSlot, message)
   * 4. onRequestSlot 콜백 호출
   * 5. 모달 닫기 및 상태 초기화
   *
   * @note
   * - useCallback으로 메모이제이션
   * - REQUEST_TYPES.TIME_REQUEST 사용
   */
  // Function to handle request from modal
  const handleRequest = useCallback((message) => {
    if (slotToRequest && slotToRequest.time && onRequestSlot) {
      const [hour, minute] = slotToRequest.time.split(':').map(Number);
      const endHour = minute === 30 ? hour + 1 : hour;
      const endMinute = minute === 30 ? 0 : minute + 30;

      const requestData = {
        roomId: roomId,
        type: REQUEST_TYPES.TIME_REQUEST, // Or 'time_change' if applicable
        timeSlot: {
          date: slotToRequest.date ? (slotToRequest.date instanceof Date ? slotToRequest.date.toISOString() : slotToRequest.date) : undefined,
          day: DAY_NAMES[getDayIndex(slotToRequest.date)],
          startTime: slotToRequest.time,
          endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
        },
        message: message || '시간 요청합니다.',
      };
      onRequestSlot(requestData);
      setShowRequestModal(false);
      setSlotToRequest(null);
    }
  }, [slotToRequest, onRequestSlot, roomId]);

  /**
   * handleChangeRequest - 시간 변경/교환/취소 요청 핸들러
   *
   * @function
   * @param {string} message - 요청 메시지
   * @returns {void}
   *
   * @description
   * 변경 요청 모달에서 "요청하기" 버튼 클릭 시 호출:
   * 1. slotToChange.action에 따라 요청 타입 결정
   * 2. CHANGE_ACTIONS.RELEASE: SLOT_RELEASE (시간 취소)
   * 3. CHANGE_ACTIONS.SWAP: SLOT_SWAP (시간 교환)
   * 4. 기타: TIME_CHANGE (시간 변경)
   * 5. requestData 생성 (action별로 다른 구조)
   * 6. onRequestSlot 콜백 호출
   * 7. 모달 닫기 및 상태 초기화
   *
   * @note
   * - useCallback으로 메모이제이션
   * - RELEASE: timeSlot만 전달
   * - SWAP: timeSlot + targetUserId + targetSlot 전달
   * - CHANGE: timeSlot + targetSlot 전달
   */
  // Function to handle change request from modal
  const handleChangeRequest = useCallback((message) => {
    if (slotToChange && slotToChange.time && onRequestSlot) {
      const [hour, minute] = slotToChange.time.split(':').map(Number);
      const endHour = minute === 30 ? hour + 1 : hour;
      const endMinute = minute === 30 ? 0 : minute + 30;

      let requestData;

      if (slotToChange.action === CHANGE_ACTIONS.RELEASE) {
        // Release own slot
        requestData = {
          roomId: roomId,
          type: REQUEST_TYPES.SLOT_RELEASE,
          timeSlot: {
            date: slotToChange.date ? (slotToChange.date instanceof Date ? slotToChange.date.toISOString() : slotToChange.date) : undefined,
            day: DAY_NAMES[getDayIndex(slotToChange.date)],
            startTime: slotToChange.time,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
          },
          message: message || '시간을 취소합니다.',
        };
      } else if (slotToChange.action === CHANGE_ACTIONS.SWAP) {
        // Request swap with another user
        requestData = {
          roomId: roomId,
          type: REQUEST_TYPES.SLOT_SWAP,
          timeSlot: {
            date: slotToChange.date ? (slotToChange.date instanceof Date ? slotToChange.date.toISOString() : slotToChange.date) : undefined,
            day: DAY_NAMES[getDayIndex(slotToChange.date)],
            startTime: slotToChange.time,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
            subject: (() => {
              const existingSlot = (timeSlots || []).find(slot => {
                const slotDateStr = safeDateToISOString(slot.date)?.split('T')[0];
                const changeSlotDateStr = safeDateToISOString(slotToChange.date)?.split('T')[0];
                return slotDateStr && changeSlotDateStr &&
                       slotDateStr === changeSlotDateStr &&
                       slot.startTime === slotToChange.time &&
                       (slot.user === currentUser?.id || slot.user?.toString() === currentUser?.id?.toString());
              });
              return existingSlot?.subject || '요청자 시간';
            })()
          },
          targetUserId: slotToChange.targetUserId,
          targetSlot: slotToChange.targetSlot,
          message: message || '시간 교환을 요청합니다.',
        };
      } else {
        // Original change request
        requestData = {
          roomId: roomId,
          type: REQUEST_TYPES.TIME_CHANGE,
          timeSlot: {
            date: slotToChange.date ? (slotToChange.date instanceof Date ? slotToChange.date.toISOString() : slotToChange.date) : undefined,
            day: DAY_NAMES[getDayIndex(slotToChange.date)],
            startTime: slotToChange.time,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
            subject: (() => {
              const existingSlot = (timeSlots || []).find(slot => {
                const slotDateStr = safeDateToISOString(slot.date)?.split('T')[0];
                const changeSlotDateStr = safeDateToISOString(slotToChange.date)?.split('T')[0];
                return slotDateStr && changeSlotDateStr &&
                       slotDateStr === changeSlotDateStr &&
                       slot.startTime === slotToChange.time &&
                       (slot.user === currentUser?.id || slot.user?.toString() === currentUser?.id?.toString());
              });
              return existingSlot?.subject || '변경 요청';
            })()
          },
          targetSlot: {
            date: slotToChange.date, // Pass date object
            day: DAY_NAMES[getDayIndex(slotToChange.date)],
            startTime: slotToChange.time,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
            subject: (() => {
              const existingSlot = (timeSlots || []).find(slot => {
                const slotDateStr = safeDateToISOString(slot.date)?.split('T')[0];
                const changeSlotDateStr = safeDateToISOString(slotToChange.date)?.split('T')[0];
                return slotDateStr && changeSlotDateStr &&
                       slotDateStr === changeSlotDateStr &&
                       slot.startTime === slotToChange.time &&
                       (slot.user === currentUser?.id || slot.user?.toString() === currentUser?.id?.toString());
              });
              return existingSlot?.subject || '변경 대상';
            })(),
            user: currentUser?.id
          },
          message: message || '시간 변경 요청합니다.',
        };
      }

      onRequestSlot(requestData);
      setShowChangeRequestModal(false);
      setSlotToChange(null);
    }
  }, [slotToChange, onRequestSlot, roomId, currentUser, timeSlots]);

  // ===================================================================================================
  // 📌 섹션 10: 렌더링
  // ===================================================================================================
  //
  // 이 섹션에서는 타임테이블 그리드 UI를 렌더링합니다.
  //
  // 📝 렌더링 구조:
  //    1. TimetableControls: 헤더 행 (시간 + 요일)
  //    2. WeekView: 시간 행들 (그리드 본문)
  //    3. Request Modal: 시간 요청 모달
  //    4. Change Request Modal: 변경/교환/취소 요청 모달
  //    5. CustomAlert Modal: 알림 모달
  //
  // ===================================================================================================

  return (
    <div className="timetable-grid border border-gray-200 rounded-lg overflow-hidden">
      {/* ========== 헤더 행 (요일) ========== */}
      {/*
       * @component TimetableControls
       * @description 타임테이블의 헤더 행 (시간 + 월~금)
       *
       * @props
       * - weekDates: 주간 날짜 배열 (월~금)
       * - days: 요일 이름 배열 (fallback)
       */}
      {/* Header Row (Days) */}
      <TimetableControls weekDates={weekDates} days={days} />

      {/* ========== 시간 행들 (그리드 본문) ========== */}
      {/*
       * @component WeekView
       * @description 타임테이블의 시간 행들 (10분 단위 그리드)
       *
       * @props
       * - travelSlots: 이동 시간 슬롯 배열
       * - filteredTimeSlotsInDay: 하루 동안의 시간 슬롯 배열
       * - weekDates: 주간 날짜 배열
       * - days: 요일 이름 배열
       * - getSlotOwner: 슬롯 소유자 확인 함수
       * - isSlotSelected: 슬롯 선택 여부 확인 함수
       * - getBlockedTimeInfo: 차단 시간 정보 반환 함수
       * - getRoomExceptionInfo: 방 예외 정보 반환 함수
       * - isRoomOwner: 방장 여부
       * - currentUser: 현재 사용자 정보
       * - handleSlotClick: 슬롯 클릭 핸들러
       * - showMerged: 병합 모드 여부
       * - ownerOriginalSchedule: 방장 원본 시간표
       * - travelMode: 이동 모드
       */}
      {/* Time Rows */}
      <WeekView
        travelSlots={travelSlots}
        timeSlots={timeSlots}
        filteredTimeSlotsInDay={filteredTimeSlotsInDay}
        weekDates={weekDates} // Pass weekDates to WeekView
        days={days}
        getSlotOwner={getSlotOwner}
        isSlotSelected={isSlotSelected}
                getBlockedTimeInfo={getBlockedTimeInfo}
        getRoomExceptionInfo={getRoomExceptionInfo}
        isRoomOwner={isRoomOwner}
        currentUser={currentUser}
        handleSlotClick={handleSlotClick}
        showMerged={showMerged}
        ownerOriginalSchedule={ownerOriginalSchedule}
        travelMode={travelMode} // Pass travelMode down
        myTravelDuration={myTravelDuration} // 🆕 Pass myTravelDuration down
        isConfirmed={!!roomData?.confirmedAt} // 🆕 확정 여부 전달
      />

      {/* ========== 시간 요청 모달 ========== */}
      {/*
       * @description 빈 슬롯 클릭 시 표시되는 시간 요청 모달
       *
       * @content
       * - 제목: "시간 요청"
       * - 메시지: "{요일}요일 {시간} 시간을 요청하시겠습니까?"
       * - 입력: 요청 메시지 (선택 사항)
       * - 버튼: "취소", "요청하기"
       *
       * @note
       * - showRequestModal이 true일 때만 표시
       * - slotToRequest에 요청할 슬롯 정보 저장
       */}
      {/* Request Modal Placeholder */}
      {showRequestModal && slotToRequest && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-lg font-bold mb-4">시간 요청</h3>
            <p className="mb-4">
              {days[getDayIndex(slotToRequest.date)]}요일 {slotToRequest.time} 시간을 요청하시겠습니까?
            </p>
            <textarea
              className="w-full p-2 border rounded mb-4"
              placeholder="요청 메시지를 입력하세요 (선택 사항)"
              rows="3"
              id="requestMessage"
            ></textarea>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowRequestModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                취소
              </button>
              <button
                onClick={() => handleRequest(document.getElementById('requestMessage').value)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                요청하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== 변경 요청 모달 ========== */}
      {/*
       * @description 다른 사용자의 슬롯 클릭 시 표시되는 변경/교환/취소 요청 모달
       *
       * @content
       * - 제목: action에 따라 "시간 취소" / "시간 교환 요청" / "시간 변경 요청"
       * - 메시지: action에 따라 다른 메시지
       * - 입력: 요청 메시지 (선택 사항)
       * - 버튼: "취소", action에 따라 "시간 취소" / "교환 요청" / "변경 요청하기"
       *
       * @note
       * - showChangeRequestModal이 true일 때만 표시
       * - slotToChange에 변경할 슬롯 정보 및 action 저장
       * - CHANGE_ACTIONS.RELEASE: 시간 취소
       * - CHANGE_ACTIONS.SWAP: 시간 교환
       * - 기타: 시간 변경
       */}
      {/* Change Request Modal Placeholder */}
      {showChangeRequestModal && slotToChange && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-lg font-bold mb-4">
              {slotToChange.action === CHANGE_ACTIONS.RELEASE ? '시간 취소' :
               slotToChange.action === CHANGE_ACTIONS.SWAP ? '시간 교환 요청' : '시간 변경 요청'}
            </h3>
            <p className="mb-4">
              {slotToChange.action === CHANGE_ACTIONS.RELEASE ?
                `${days[getDayIndex(slotToChange.date)]}요일 ${slotToChange.time} 시간을 취소하시겠습니까?` :
               slotToChange.action === CHANGE_ACTIONS.SWAP ?
                `${slotToChange.currentOwner}님의 ${days[getDayIndex(slotToChange.date)]}요일 ${slotToChange.time} 시간과 교환을 요청하시겠습니까?` :
                `${days[getDayIndex(slotToChange.date)]}요일 ${slotToChange.time} 시간을 변경 요청하시겠습니까?`
              }
            </p>
            <textarea
              className="w-full p-2 border rounded mb-4"
              placeholder={
                slotToChange.action === CHANGE_ACTIONS.RELEASE ? '취소 사유를 입력하세요 (선택 사항)' :
                slotToChange.action === CHANGE_ACTIONS.SWAP ? '교환 요청 메시지를 입력하세요 (선택 사항)' :
                '변경 요청 메시지를 입력하세요 (선택 사항)'
              }
              rows="3"
              id="changeRequestMessage"
            ></textarea>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowChangeRequestModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                취소
              </button>
              <button
                onClick={() => handleChangeRequest(document.getElementById('changeRequestMessage').value)}
                className={`px-4 py-2 text-white rounded-lg ${BUTTON_STYLES[slotToChange.action] || 'bg-purple-600 hover:bg-purple-700'}`}
              >
                {slotToChange.action === CHANGE_ACTIONS.RELEASE ? '시간 취소' :
                 slotToChange.action === CHANGE_ACTIONS.SWAP ? '교환 요청' :
                 '변경 요청하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== CustomAlert 모달 ========== */}
      {/*
       * @component CustomAlertModal
       * @description 알림 메시지를 표시하는 커스텀 모달
       *
       * @props
       * - isOpen: 모달 열림 여부 (customAlert.show)
       * - onClose: 모달 닫기 함수 (closeAlert)
       * - title: 모달 제목 ("알림")
       * - message: 표시할 메시지 (customAlert.message)
       * - type: 모달 타입 ("warning")
       * - showCancel: 취소 버튼 표시 여부 (false)
       *
       * @note
       * - showAlert 함수로 메시지 설정
       * - 방장 교환 요청 제한, 중복 요청 등에 사용
       */}
      {/* CustomAlert Modal */}
      <CustomAlertModal
        isOpen={customAlert.show}
        onClose={closeAlert}
        title="알림"
        message={customAlert.message}
        type="warning"
        showCancel={false}
      />
    </div>
  );
};

export default TimetableGrid;
