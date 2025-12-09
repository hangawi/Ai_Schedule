/**
 * ===================================================================================================
 * MonthView.js - 타임테이블 월간 달력 뷰 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/timetable
 *
 * 🎯 주요 기능:
 *    - 월간 달력 형태로 타임슬롯 표시 (7x6 그리드)
 *    - 각 날짜별 배정된 타임슬롯 목록 표시 (멤버 이름 + 시작 시간)
 *    - 이전/다음 달 네비게이션 및 오늘로 이동 기능
 *    - 날짜 클릭 시 해당 날짜의 상세 뷰로 이동
 *    - 병합/분할 모드 지원 (연속 슬롯 병합 여부)
 *    - 이번 달/다른 달 날짜 구분 표시 (색상)
 *    - 오늘 날짜 하이라이트 (파란색 배경)
 *
 * 🔗 연결된 파일:
 *    - ../tabs/CoordinationTab/index.js - 이 컴포넌트를 렌더링하여 월간 뷰 제공
 *    - ../../utils/dateUtils.js - toLocalDateString 함수 사용
 *    - ../../utils/timetableHelpers.js - mergeConsecutiveTimeSlots 함수 사용
 *    - ./WeekView.js - 주간 뷰와 함께 사용 (뷰 모드 전환)
 *
 * 💡 UI 위치:
 *    - 탭: 조율 탭 (CoordinationTab)
 *    - 섹션: 타임테이블 영역 (월간 모드)
 *    - 경로: 앱 실행 > 조율 탭 > 월간 버튼 클릭
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 월간 달력 뷰의 UI와 동작이 변경됨
 *    - 달력 그리드 크기 변경: totalDays 상수 수정 (현재 42일 = 6주)
 *    - 셀 높이 변경: h-32 클래스 수정
 *    - 슬롯 표시 방식 변경: renderMonthGrid 함수 내 슬롯 렌더링 로직 수정
 *    - 네비게이션 버튼 스타일 변경: renderCalendarHeader 함수 수정
 *
 * 📝 참고사항:
 *    - 달력은 항상 일요일부터 시작 (dayNames 배열)
 *    - 총 42일(6주 x 7일)을 표시하여 월 전체를 포함
 *    - 일요일: 빨간색, 토요일: 파란색 텍스트
 *    - showMerged=true일 때 연속된 슬롯 병합 (같은 시간대)
 *    - 멤버 색상은 user.color + CC (80% 투명도)로 표시
 *    - calendarDates는 currentDate, timeSlots, showMerged 변경 시 재생성
 *
 * ===================================================================================================
 */

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toLocalDateString } from '../../utils/dateUtils';
import { mergeConsecutiveTimeSlots } from '../../utils/timetableHelpers';

/**
 * MonthView - 타임테이블 월간 달력 뷰 컴포넌트
 *
 * @description 월간 달력 형태로 타임슬롯을 표시하고, 날짜 클릭 시 상세 뷰로 이동
 *
 * @component
 *
 * @param {Object} props - 컴포넌트 props
 * @param {Array} props.timeSlots - 타임슬롯 배열
 *   - 구조: [{ _id, user, date, startTime, endTime, status, ... }]
 *   - date: 슬롯이 배정된 날짜 (Date 객체 또는 ISO 문자열)
 *   - user: 멤버 정보 (객체 또는 ID)
 *
 * @param {Array} props.members - 방 멤버 배열
 *   - 구조: [{ user: { _id, firstName, lastName, color, ... }, ... }]
 *   - user.color: 멤버별 색상 (hex 코드)
 *
 * @param {Object} props.roomData - 방 정보 (현재 미사용)
 *
 * @param {Object} props.currentUser - 현재 사용자 정보 (현재 미사용)
 *
 * @param {boolean} props.isRoomOwner - 방장 여부 (현재 미사용)
 *
 * @param {Function} props.onDateClick - 날짜 클릭 핸들러
 *   - 파라미터: date (Date 객체)
 *   - 동작: 해당 날짜의 상세 뷰로 전환
 *
 * @param {Date|string} props.initialStartDate - 초기 표시 날짜
 *   - 컴포넌트 마운트 시 이 날짜로 이동
 *   - 미지정 시 오늘 날짜 사용
 *
 * @param {boolean} props.showMerged - 병합 모드 여부
 *   - true: 연속된 슬롯 병합하여 표시
 *   - false: 모든 슬롯 개별 표시
 *
 * @returns {JSX.Element} 월간 달력 UI (헤더 + 그리드)
 *
 * @example
 * <MonthView
 *   timeSlots={timeSlots}
 *   members={members}
 *   roomData={roomData}
 *   currentUser={currentUser}
 *   isRoomOwner={isRoomOwner}
 *   onDateClick={handleDateClick}
 *   initialStartDate={new Date()}
 *   showMerged={true}
 * />
 *
 * @note
 * - 달력 구조: 7열 x 6행 (42일 고정)
 * - 첫 주는 이전 달 날짜를 포함할 수 있음 (회색 표시)
 * - 마지막 주는 다음 달 날짜를 포함할 수 있음 (회색 표시)
 * - 오늘 날짜: 파란색 배경 (bg-blue-100)
 * - 이번 달: 흰색 배경, 다른 달: 회색 배경
 * - 각 셀 높이: h-32 (128px)
 * - 슬롯 색상: 멤버 색상 + CC (80% 투명도)
 */
const MonthView = ({
  timeSlots,
  members,
  roomData,
  currentUser,
  isRoomOwner,
  onDateClick,
  initialStartDate,
  showMerged
}) => {
  // ===================================================================================================
  // 📌 섹션 1: State 관리
  // ===================================================================================================
  //
  // 이 섹션에서는 월간 달력의 상태를 관리합니다.
  //
  // 📝 State 목록:
  //    1. currentDate - 현재 표시 중인 월의 기준 날짜
  //    2. calendarDates - 달력에 표시할 날짜 정보 배열 (42일)
  //
  // ===================================================================================================

  /**
   * currentDate - 현재 표시 중인 월의 기준 날짜
   *
   * @type {Date}
   * @description 달력 헤더에 표시되는 "YYYY년 MM월"의 기준이 되는 날짜
   *
   * @note
   * - 네비게이션 버튼 클릭 시 월 단위로 변경됨
   * - initialStartDate prop이 있으면 초기값으로 사용
   * - 기본값: new Date() (오늘 날짜)
   */
  const [currentDate, setCurrentDate] = useState(new Date());

  /**
   * calendarDates - 달력에 표시할 날짜 정보 배열
   *
   * @type {Array<Object>}
   * @description 42일(6주 x 7일)의 날짜 정보와 각 날짜의 타임슬롯 목록
   *
   * @structure
   * [
   *   {
   *     date: Date 객체,
   *     day: 날짜 숫자 (1-31),
   *     isCurrentMonth: 이번 달 여부,
   *     isToday: 오늘 날짜 여부,
   *     slots: 해당 날짜의 타임슬롯 배열 (병합/분할 모드에 따라 다름)
   *   },
   *   ...
   * ]
   *
   * @note
   * - currentDate, timeSlots, showMerged 변경 시 재생성됨 (useEffect)
   * - generateCalendarDates 함수에서 계산됨
   * - slots는 showMerged=true일 때 연속된 슬롯이 병합됨
   */
  const [calendarDates, setCalendarDates] = useState([]);

  // ===================================================================================================
  // 📌 섹션 2: 상수 정의
  // ===================================================================================================
  //
  // 이 섹션에서는 컴포넌트에서 사용하는 상수를 정의합니다.
  //
  // 📝 상수 목록:
  //    1. monthNames - 월 이름 배열 (1월 ~ 12월)
  //    2. dayNames - 요일 이름 배열 (일 ~ 토)
  //
  // ===================================================================================================

  /**
   * monthNames - 월 이름 배열 (한글)
   *
   * @type {string[]}
   * @description 달력 헤더에 표시할 월 이름 (1월 ~ 12월)
   *
   * @note
   * - 인덱스 0 = 1월, 인덱스 11 = 12월
   * - currentDate.getMonth() 값을 인덱스로 사용
   */
  const monthNames = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'
  ];

  /**
   * dayNames - 요일 이름 배열 (한글)
   *
   * @type {string[]}
   * @description 달력 헤더에 표시할 요일 이름 (일 ~ 토)
   *
   * @note
   * - 인덱스 0 = 일요일, 인덱스 6 = 토요일
   * - Date.getDay() 값과 일치
   * - 일요일: 빨간색 텍스트, 토요일: 파란색 텍스트
   */
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  // ===================================================================================================
  // 📌 섹션 3: useEffect Hooks
  // ===================================================================================================
  //
  // 이 섹션에서는 컴포넌트의 사이드 이펙트를 관리합니다.
  //
  // 📝 useEffect 목록:
  //    1. initialStartDate 처리 - 초기 날짜 설정
  //    2. calendarDates 생성 - 달력 날짜 배열 생성
  //
  // ===================================================================================================

  /**
   * initialStartDate 처리 Effect
   *
   * @description initialStartDate prop이 변경되면 currentDate를 해당 날짜로 설정
   *
   * @dependencies [initialStartDate]
   *
   * @note
   * - 컴포넌트 마운트 시 또는 initialStartDate 변경 시 실행
   * - 특정 날짜로 달력을 초기화하고 싶을 때 사용
   * - 예: 자동 배정 결과의 시작 날짜로 이동
   */
  useEffect(() => {
    if (initialStartDate) {
      setCurrentDate(new Date(initialStartDate));
    }
  }, [initialStartDate]);

  /**
   * calendarDates 생성 Effect
   *
   * @description currentDate, timeSlots, showMerged 변경 시 달력 날짜 배열 재생성
   *
   * @dependencies [currentDate, timeSlots, showMerged]
   *
   * @note
   * - generateCalendarDates 함수 호출하여 calendarDates 업데이트
   * - currentDate: 월 변경 시
   * - timeSlots: 타임슬롯 추가/삭제/변경 시
   * - showMerged: 병합 모드 토글 시
   */
  useEffect(() => {
    generateCalendarDates();
  }, [currentDate, timeSlots, showMerged]);

  // ===================================================================================================
  // 📌 섹션 4: 헬퍼 함수
  // ===================================================================================================
  //
  // 이 섹션에서는 컴포넌트 내부에서 사용하는 유틸리티 함수들을 정의합니다.
  //
  // 📝 함수 목록:
  //    1. generateCalendarDates - 달력 날짜 배열 생성
  //    2. getSlotsForDate - 특정 날짜의 타임슬롯 필터링
  //    3. navigateMonth - 월 네비게이션
  //    4. goToToday - 오늘로 이동
  //    5. handleDateClick - 날짜 클릭 핸들러
  //
  // ===================================================================================================

  /**
   * generateCalendarDates - 달력 날짜 배열 생성
   *
   * @description currentDate 기준으로 42일(6주)의 날짜 정보 배열 생성
   *
   * @process
   * 1. currentDate의 년/월 추출
   * 2. 해당 월의 첫날과 마지막날 계산
   * 3. 첫날의 요일을 고려하여 시작 날짜 계산 (이전 달 포함)
   * 4. 42일 동안 반복:
   *    - 날짜 정보 생성 (date, day, isCurrentMonth, isToday)
   *    - 해당 날짜의 타임슬롯 필터링 (getSlotsForDate)
   *    - showMerged=true면 연속 슬롯 병합 (mergeConsecutiveTimeSlots)
   * 5. calendarDates 상태 업데이트
   *
   * @note
   * - 총 42일 고정 (6주 x 7일)
   * - 이전 달/다음 달 날짜도 포함 (isCurrentMonth=false)
   * - 오늘 날짜는 isToday=true로 표시
   * - showMerged 모드에 따라 슬롯 병합 여부 결정
   * - toLocalDateString으로 날짜 비교 (시간 무시)
   */
  const generateCalendarDates = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);

    // 달력 시작 날짜 계산 (첫날의 요일만큼 이전 날짜로 이동)
    const firstDayOfWeek = firstDay.getDay();
    startDate.setDate(firstDay.getDate() - firstDayOfWeek);

    const dates = [];
    const totalDays = 42; // 6주 * 7일

    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const isCurrentMonth = date.getMonth() === month;
      const isToday = toLocalDateString(date) === toLocalDateString(new Date());

      // 해당 날짜의 타임슬롯 필터링
      let slotsForDate = getSlotsForDate(date);
      // 병합 모드일 때 연속 슬롯 병합
      if (showMerged) {
        slotsForDate = mergeConsecutiveTimeSlots(slotsForDate);
      }

      dates.push({
        date: new Date(date),
        day: date.getDate(),
        isCurrentMonth,
        isToday,
        slots: slotsForDate,
      });
    }

    setCalendarDates(dates);
  };

  /**
   * getSlotsForDate - 특정 날짜의 타임슬롯 필터링
   *
   * @description 주어진 날짜에 배정된 타임슬롯만 반환
   *
   * @param {Date} date - 필터링할 날짜
   *
   * @returns {Array<Object>} 해당 날짜의 타임슬롯 배열
   *
   * @process
   * 1. 주어진 날짜를 toLocalDateString으로 변환 (YYYY-MM-DD)
   * 2. timeSlots 배열 필터링:
   *    - slot.date가 있으면 toLocalDateString으로 변환
   *    - 변환된 날짜가 주어진 날짜와 같은지 비교
   * 3. 필터링된 슬롯 배열 반환
   *
   * @note
   * - toLocalDateString 사용으로 시간 부분 무시
   * - slot.date가 없는 슬롯은 제외됨
   * - 반환된 배열은 병합되지 않은 원본 슬롯
   */
  const getSlotsForDate = (date) => {
    const dateStr = toLocalDateString(date);
    return timeSlots.filter(slot => {
      if (slot.date) {
        const slotDate = toLocalDateString(new Date(slot.date));
        return slotDate === dateStr;
      }
      return false;
    });
  };

  /**
   * navigateMonth - 월 네비게이션
   *
   * @description 현재 월에서 direction만큼 월 이동
   *
   * @param {number} direction - 이동 방향 (1: 다음 달, -1: 이전 달)
   *
   * @example
   * navigateMonth(1);  // 다음 달로 이동
   * navigateMonth(-1); // 이전 달로 이동
   *
   * @note
   * - currentDate를 복사하여 월 변경
   * - setCurrentDate 호출 시 useEffect에서 calendarDates 재생성
   * - 연도 경계 넘어갈 때 자동 처리 (12월 → 1월, 1월 → 12월)
   */
  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  /**
   * goToToday - 오늘로 이동
   *
   * @description currentDate를 오늘 날짜로 설정
   *
   * @note
   * - 네비게이션 후 "오늘" 버튼으로 빠르게 복귀
   * - setCurrentDate 호출 시 useEffect에서 calendarDates 재생성
   */
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  /**
   * handleDateClick - 날짜 클릭 핸들러
   *
   * @description 날짜 셀 클릭 시 onDateClick prop 호출
   *
   * @param {Date} date - 클릭된 날짜
   *
   * @note
   * - onDateClick prop이 있을 때만 호출
   * - 일반적으로 상세 뷰로 전환하거나 모달 오픈에 사용
   */
  const handleDateClick = (date) => {
    if (onDateClick) {
      onDateClick(date);
    }
  };

  // ===================================================================================================
  // 📌 섹션 5: 렌더링 함수
  // ===================================================================================================
  //
  // 이 섹션에서는 UI를 렌더링하는 함수들을 정의합니다.
  //
  // 📝 함수 목록:
  //    1. renderCalendarHeader - 달력 헤더 렌더링
  //    2. renderMonthGrid - 달력 그리드 렌더링
  //
  // ===================================================================================================

  /**
   * renderCalendarHeader - 달력 헤더 렌더링
   *
   * @description 월 제목, 네비게이션 버튼, 오늘 버튼을 포함하는 헤더 렌더링
   *
   * @returns {JSX.Element} 헤더 UI
   *
   * @structure
   * - 왼쪽: 월 제목 (YYYY년 MM월)
   * - 중앙: 네비게이션 버튼 (이전 달, 오늘, 다음 달)
   *
   * @note
   * - 이전/다음 버튼: ChevronLeft, ChevronRight 아이콘 사용
   * - 오늘 버튼: 파란색 배경 (bg-blue-500)
   * - 네비게이션 버튼: 회색 배경 (bg-gray-200)
   */
  const renderCalendarHeader = () => (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-4">
        {/* 월 제목 */}
        <h2 className="text-xl font-semibold">
          {`${currentDate.getFullYear()}년 ${monthNames[currentDate.getMonth()]}`}
        </h2>

        {/* 네비게이션 버튼 */}
        <div className="flex items-center space-x-2">
          {/* 이전 달 버튼 */}
          <button
            onClick={() => navigateMonth(-1)}
            className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>

          {/* 오늘 버튼 */}
          <button
            onClick={goToToday}
            className="px-3 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors text-sm"
          >
            오늘
          </button>

          {/* 다음 달 버튼 */}
          <button
            onClick={() => navigateMonth(1)}
            className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  /**
   * renderMonthGrid - 달력 그리드 렌더링
   *
   * @description 요일 헤더와 날짜 셀들로 구성된 달력 그리드 렌더링
   *
   * @returns {JSX.Element} 달력 그리드 UI
   *
   * @structure
   * 1. 요일 헤더 (7열)
   *    - 일요일: 빨간색 (text-red-500)
   *    - 토요일: 파란색 (text-blue-500)
   *    - 평일: 회색 (text-gray-700)
   *
   * 2. 날짜 셀 (7열 x 6행 = 42셀)
   *    - 이번 달: 흰색 배경, hover 시 파란색 (bg-white, hover:bg-blue-50)
   *    - 다른 달: 회색 배경, 회색 텍스트 (bg-gray-50, text-gray-400)
   *    - 오늘: 파란색 배경 (bg-blue-100)
   *    - 각 셀 높이: h-32 (128px)
   *    - 클릭 가능 (cursor-pointer)
   *
   * 3. 각 날짜 셀 내부
   *    - 날짜 숫자 (상단)
   *    - 타임슬롯 목록 (스크롤 가능)
   *      - 멤버 색상 배경 + CC (80% 투명도)
   *      - 시작 시간 + 멤버 이름 표시
   *
   * @note
   * - calendarDates 배열을 map으로 렌더링
   * - 각 슬롯의 멤버 정보는 members 배열에서 찾음
   * - 멤버를 찾지 못하면 "Unknown" 표시
   * - 슬롯이 많으면 overflow-y-auto로 스크롤
   */
  const renderMonthGrid = () => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* ========== 요일 헤더 ========== */}
      {/*
       * @description 요일 이름을 표시하는 헤더 행
       *
       * @structure
       * - 7개 열 (일 ~ 토)
       * - 일요일: 빨간색, 토요일: 파란색, 평일: 회색
       */}
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
        {dayNames.map((dayName, index) => (
          <div
            key={index}
            className={`p-3 text-center text-sm font-medium ${
              index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-700'
            }`}
          >
            {dayName}
          </div>
        ))}
      </div>

      {/* ========== 날짜 셀 그리드 ========== */}
      {/*
       * @description 42개의 날짜 셀로 구성된 달력 본문
       *
       * @structure
       * - 7열 x 6행 (42개 셀)
       * - 각 셀: 날짜 숫자 + 타임슬롯 목록
       * - 클릭 시 handleDateClick 호출
       */}
      <div className="grid grid-cols-7">
        {calendarDates.map((dateInfo, index) => (
          <div
            key={index}
            className={`
              h-32 border-r border-b border-gray-100 p-2 cursor-pointer transition-colors
              ${dateInfo.isCurrentMonth ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 text-gray-400'}
              ${dateInfo.isToday ? 'bg-blue-100' : ''}
            `}
            onClick={() => handleDateClick(dateInfo.date)}
          >
            <div className="flex flex-col h-full">
              {/* 날짜 숫자 */}
              <div className={`text-sm font-medium mb-1 ${dateInfo.isToday ? 'text-blue-600' : ''}`}>
                {dateInfo.day}
              </div>

              {/* 타임슬롯 목록 */}
              <div className="flex-1 overflow-y-auto text-xs">
                {dateInfo.slots.map(slot => {
                  // 멤버 정보 찾기
                  const member = members.find(m => m.user._id === (slot.user._id || slot.user));
                  const userName = member ? `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim() : 'Unknown';
                  return (
                    <div key={slot._id} className="p-1 rounded mb-1 flex items-center" style={{ backgroundColor: (member?.user.color || '#E0E0E0') + 'CC', color: '#000000' }}>
                      <span className="font-semibold mr-1">{slot.startTime}</span>
                      <span>{userName}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ===================================================================================================
  // 📌 섹션 6: 메인 렌더링
  // ===================================================================================================
  //
  // 이 섹션에서는 컴포넌트의 최종 UI를 렌더링합니다.
  //
  // 📝 렌더링 구조:
  //    1. renderCalendarHeader() - 월 제목 및 네비게이션
  //    2. renderMonthGrid() - 달력 그리드
  //
  // ===================================================================================================

  return (
    <div>
      {renderCalendarHeader()}
      {renderMonthGrid()}
    </div>
  );
};

export default MonthView;
