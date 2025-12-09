/**
 * ===================================================================================================
 * MonthView.js - 월간 달력 뷰 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ScheduleGridSelector/components
 *
 * 🎯 주요 기능:
 *    - 달력 형태로 한 달의 일정 표시 (주 단위 그리드)
 *    - 선호 일정/예외 일정/개인 일정 태그 표시
 *    - 날짜 클릭 시 세부 시간표 모달 오픈
 *    - 이전/다음 달 날짜도 희미하게 표시 (bg-gray-50)
 *    - 반복 일정 vs 특정 날짜 일정 구분
 *
 * 🔗 연결된 파일:
 *    - ../index.js - 이 컴포넌트를 렌더링하여 월간 뷰 제공
 *    - ./DateDetailModal.js - 날짜 클릭 시 오픈되는 모달
 *    - ../hooks/useDateDetail.js - 모달 상태 관리
 *
 * 💡 UI 위치:
 *    - 탭: 프로필 탭
 *    - 섹션: 스케줄 그리드 > 월간 뷰
 *    - 경로: 앱 실행 > 프로필 탭 > 스케줄 그리드 > 월간 버튼 클릭
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 월간 달력의 UI와 동작이 변경됨
 *    - 셀 크기 변경: min-h-[120px] 값 수정
 *    - 태그 색상 변경: bg-blue-100, bg-green-100, bg-purple-100 등 수정
 *    - 일정 판단 로직 변경: hasSchedule, hasException, hasPersonal 계산 수정
 *
 * 📝 참고사항:
 *    - 주는 일요일부터 시작 (0=일, 1=월, ..., 6=토)
 *    - 현재 달 날짜: bg-white, 이전/다음 달: bg-gray-50
 *    - 선호 일정: 파란색, 예외 일정: 초록색, 개인 일정: 보라색
 *    - specificDate 우선, 없으면 dayOfWeek로 반복 일정 판단
 *
 * ===================================================================================================
 */

import React from 'react';

/**
 * MonthView - 월간 달력 뷰 컴포넌트
 *
 * @description 한 달의 일정을 달력 형태로 표시하고 날짜 클릭 시 세부 시간표 모달 오픈
 * @param {Object} props - 컴포넌트 props
 * @param {Date} props.currentDate - 현재 선택된 날짜
 * @param {Array} props.allPersonalTimes - 개인 시간 배열 (personalTimes + fixedSchedules)
 * @param {Array} props.schedule - 기본 일정 (선호 시간, 반복 일정)
 * @param {Array} props.exceptions - 특정 날짜 예외 일정
 * @param {Function} props.onDateClick - 날짜 클릭 핸들러 (dayData 객체 전달)
 * @returns {JSX.Element} 월간 달력 UI
 *
 * @example
 * <MonthView
 *   currentDate={currentDate}
 *   allPersonalTimes={allPersonalTimes}
 *   schedule={schedule}
 *   exceptions={exceptions}
 *   onDateClick={openDateDetail}
 * />
 *
 * @note
 * - 각 날짜 셀에 선호/예외/개인 일정 태그 표시
 * - 날짜 클릭 시 DateDetailModal 오픈 (세부 시간표 확인)
 * - 이전/다음 달 날짜도 희미하게 표시 (bg-gray-50)
 * - 반복 일정: dayOfWeek로 판단, 특정 날짜: specificDate로 판단
 */
const MonthView = ({
  currentDate,
  allPersonalTimes,
  schedule,
  exceptions,
  onDateClick
}) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 월의 첫날과 마지막날
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // 월의 첫 주 일요일부터 시작 (헤더와 맞춤)
  const startDate = new Date(firstDay);
  const startDayOfWeek = firstDay.getDay();
  startDate.setDate(startDate.getDate() - startDayOfWeek); // 일요일부터 시작

  // 월의 마지막 주 토요일까지
  const endDate = new Date(lastDay);
  const endDayOfWeek = lastDay.getDay();
  endDate.setDate(endDate.getDate() + (6 - endDayOfWeek)); // 토요일까지

  const weeks = [];
  let currentWeek = [];

  /**
   * 달력 날짜 생성 루프
   *
   * @description 월의 첫 주 일요일부터 마지막 주 토요일까지 날짜 객체 생성
   *
   * @process
   * 1. startDate부터 endDate까지 반복
   * 2. 각 날짜에 대해 YYYY-MM-DD 문자열 생성
   * 3. hasSchedule: schedule 배열에서 specificDate 또는 dayOfWeek로 확인
   * 4. hasException: exceptions 배열에서 specificDate로 확인
   * 5. hasPersonal: allPersonalTimes에서 specificDate 또는 반복 일정으로 확인
   * 6. 토요일이면 currentWeek를 weeks에 추가하고 초기화
   *
   * @note
   * - isCurrentMonth: 현재 달인지 여부 (스타일링용)
   * - hasSchedule/hasException/hasPersonal: 태그 표시 여부
   * - specificDate 우선, 없으면 dayOfWeek로 반복 일정 판단
   * - days 배열의 7은 0(일요일)으로 변환
   */
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const date = new Date(d);
    const dayOfWeek = date.getDay();

    // 일~토 모두 표시
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    // 해당 날짜의 일정 확인
    const hasSchedule = schedule.some(s => {
      // 🔧 수정: specificDate가 있으면 그 날짜에만 적용
      if (s.specificDate) {
        return s.specificDate === dateStr;
      } else {
        return s.dayOfWeek === dayOfWeek;
      }
    });
    const hasException = exceptions.some(e => e.specificDate === dateStr);
    const hasPersonal = allPersonalTimes.some(p => {
      const personalDays = p.days || [];

      // ⭐ specificDate가 있으면 정확한 날짜로 비교
      if (p.specificDate && p.isRecurring === false) {
        const scheduleDate = new Date(p.specificDate);
        const scheduleDateStr = `${scheduleDate.getFullYear()}-${String(scheduleDate.getMonth() + 1).padStart(2, '0')}-${String(scheduleDate.getDate()).padStart(2, '0')}`;
        return dateStr === scheduleDateStr;
      }

      // 반복 일정인 경우 요일로 비교
      const convertedDays = personalDays.map(day => day === 7 ? 0 : day);
      const isRecurring = p.isRecurring !== false;
      return isRecurring && convertedDays.includes(dayOfWeek);
    });

    currentWeek.push({
      date,
      dayOfWeek,
      isCurrentMonth: date.getMonth() === month,
      hasSchedule,
      hasException,
      hasPersonal,
      dateStr
    });

    if (dayOfWeek === 6 && currentWeek.length === 7) { // 토요일이면 현재 주 완료
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  /**
   * handleDateClick - 날짜 클릭 핸들러
   *
   * @description 날짜 셀 클릭 시 해당 날짜의 세부 시간표 모달 오픈
   * @param {Object} dayData - 날짜 정보 객체
   * @param {Date} dayData.date - 날짜 객체
   * @param {number} dayData.dayOfWeek - 요일 (0=일, 1=월, ..., 6=토)
   * @param {boolean} dayData.isCurrentMonth - 현재 달 여부
   * @param {boolean} dayData.hasSchedule - 선호 일정 여부
   * @param {boolean} dayData.hasException - 예외 일정 여부
   * @param {boolean} dayData.hasPersonal - 개인 일정 여부
   * @param {string} dayData.dateStr - 날짜 문자열 (YYYY-MM-DD)
   *
   * @note
   * - blocks는 모달 내에서 실시간으로 생성됨
   * - onDateClick prop으로 부모 컴포넌트에 전달
   * - DateDetailModal이 오픈됨
   */
  const handleDateClick = (dayData) => {
    // 날짜 정보만 저장 (blocks는 모달 내에서 실시간으로 생성)
    onDateClick(dayData);
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-inner" style={{ minHeight: '500px' }}>
      {/* 헤더: 요일 */}
      <div className="grid grid-cols-7 bg-gray-100 border-b border-gray-200">
        {['일', '월', '화', '수', '목', '금', '토'].map(day => (
          <div key={day} className="p-4 text-center font-semibold text-gray-700 border-r border-gray-200 last:border-r-0">
            {day}
          </div>
        ))}
      </div>

      {/* 본문: 주별 날짜 그리드 */}
      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="grid grid-cols-7 border-b border-gray-200 last:border-b-0">
          {week.map((day, dayIndex) => (
            <div
              key={dayIndex}
              onClick={() => handleDateClick(day)}
              className={`p-3 min-h-[120px] border-r border-gray-200 last:border-r-0 ${
                day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
              } hover:bg-blue-50 transition-colors cursor-pointer`}
              title={`${day.date.getMonth() + 1}/${day.date.getDate()} - 클릭하여 세부 시간표 보기`}
            >
              {/* 날짜 숫자 */}
              <div className={`text-base font-medium mb-2 ${
                day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
              }`}>
                {day.date.getDate()}
              </div>

              {/* 일정 태그들 */}
              <div className="space-y-1">
                {day.hasSchedule && (
                  <div className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded truncate">
                    선호 일정
                  </div>
                )}
                {day.hasException && (
                  <div className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded truncate">
                    선호 일정
                  </div>
                )}
                {day.hasPersonal && (
                  <div className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded truncate">
                    개인 일정
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default MonthView;
