/**
 * ===================================================================================================
 * CalendarView.js - 월간 캘린더 뷰 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/calendar/CalendarView.js
 *
 * 🎯 주요 기능:
 *    - 월간 캘린더 그리드 표시
 *    - 일정, 예외, 개인 시간을 날짜별로 시각화
 *    - 휴무일 표시
 *    - 월 이동 및 오늘 날짜로 이동
 *    - 날짜 클릭 시 상세 정보 표시
 *    - 일정 개수 카운팅 및 병합
 *
 * 🔗 연결된 파일:
 *    - lucide-react - 아이콘 라이브러리 (ChevronLeft, ChevronRight)
 *
 * 💡 UI 위치:
 *    - 화면: 프로필 탭 > 일정 관리
 *    - 접근: 프로필 탭에서 자동 표시
 *    - 섹션: 월 선택, 캘린더 그리드
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 월간 캘린더 표시 방식 변경
 *    - 일정 표시 색상 변경: renderMonthView의 colorMap 수정
 *    - 캘린더 그리드 크기 변경: totalDays 값 수정 (현재 42 = 6주)
 *    - 일정 병합 로직 변경: getScheduleCount, getExceptionCount 함수 수정
 *
 * 📝 참고사항:
 *    - 일요일 시작 기준 (0=일요일, 6=토요일)
 *    - 일정은 파란색, 예외는 우선순위별 파란색 톤, 개인 시간은 빨간색으로 표시
 *    - 휴무일은 회색 배경에 "휴무일" 뱃지 표시
 *    - 최대 9개까지 막대로 표시, 초과 시 "+더보기" 표시
 *
 * ===================================================================================================
 */

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * CalendarView - 월간 캘린더 뷰 메인 컴포넌트
 *
 * @param {Object} props - 컴포넌트 props
 * @param {Array} props.schedule - 일정 배열
 * @param {Function} props.setSchedule - 일정 업데이트 함수
 * @param {boolean} props.readOnly - 읽기 전용 모드
 * @param {Array} props.exceptions - 예외 배열
 * @param {Array} props.personalTimes - 개인 시간 배열
 * @param {Function} props.onRemoveException - 예외 삭제 핸들러
 * @param {Function} props.onDateClick - 날짜 클릭 핸들러
 * @param {Date} props.selectedDate - 선택된 날짜
 * @param {Function} props.onShowAlert - 알림 표시 함수
 * @param {Function} props.onAutoSave - 자동 저장 함수
 * @param {Function} props.onMonthChange - 월 변경 핸들러
 *
 * @returns {JSX.Element} 월간 캘린더 UI
 */
const CalendarView = ({
  schedule,
  setSchedule,
  readOnly,
  exceptions = [],
  personalTimes = [],
  onRemoveException,
  onDateClick,
  selectedDate,
  onShowAlert,
  onAutoSave,
  onMonthChange
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDates, setCalendarDates] = useState([]);

  const monthNames = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'
  ];

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  useEffect(() => {
    generateCalendarDates();
    if (onMonthChange) {
      onMonthChange(currentDate);
    }
  }, [currentDate, schedule, exceptions, personalTimes]);

  useEffect(() => {
    const handleCalendarUpdate = (event) => {
      generateCalendarDates();
    };

    window.addEventListener('calendarUpdate', handleCalendarUpdate);
    return () => {
      window.removeEventListener('calendarUpdate', handleCalendarUpdate);
    };
  }, [schedule, exceptions, personalTimes]);

  /**
   * generateCalendarDates - 캘린더 날짜 데이터 생성
   */
  const generateCalendarDates = () => {
    generateMonthDates();
  };

  /**
   * generateMonthDates - 월간 캘린더 날짜 배열 생성
   *
   * @description 현재 월의 모든 날짜와 일정/예외/개인시간 정보를 포함한 배열 생성
   */
  const generateMonthDates = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);

    // 일요일부터 시작하도록 조정
    const firstDayOfWeek = firstDay.getDay();
    startDate.setDate(firstDay.getDate() - firstDayOfWeek);

    const dates = [];
    const totalDays = 42; // 6주 * 7일

    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const isCurrentMonth = date.getMonth() === month;
      const isToday = date.toDateString() === new Date().toDateString();
      const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();

      const hasPersonalTime = hasPersonalTimeForDate(date);

      const scheduleCount = getScheduleCount(date);
      const exceptionCount = getExceptionCount(date);
      const personalTimeCount = getPersonalTimeCount(date);

      // exception 정보도 가져오기
      const dateYear = date.getFullYear();
      const dateMonth = String(date.getMonth() + 1).padStart(2, '0');
      const dateDay = String(date.getDate()).padStart(2, '0');
      const dateStr = `${dateYear}-${dateMonth}-${dateDay}`;
      const dateExceptions = exceptions.filter(ex => ex.specificDate === dateStr && ex.title !== '휴무일' && !ex.isHoliday);

      dates.push({
        date: new Date(date),
        day: date.getDate(),
        isCurrentMonth,
        isToday,
        isSelected,
        hasSchedule: scheduleCount > 0,
        hasException: exceptionCount > 0,
        hasPersonalTime: personalTimeCount > 0,
        hasHoliday: hasHolidayForDate(date),
        scheduleCount,
        exceptionCount,
        personalTimeCount,
        totalCount: scheduleCount + exceptionCount + personalTimeCount,
        exceptions: dateExceptions
      });
    }

    setCalendarDates(dates);
  };


  const hasScheduleForDate = (date) => {
    const dayOfWeek = date.getDay();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    // defaultSchedule는 모두 가능한 시간이므로 isBlocked 체크 불필요
    return schedule.some(s => {
      // specificDate가 있으면 날짜로 비교, 없으면 dayOfWeek로 비교
      if (s.specificDate) {
        return s.specificDate === dateStr;
      } else {
        return s.dayOfWeek === dayOfWeek;
      }
    });
  };;
  const getScheduleCount = (date) => {
    const dayOfWeek = date.getDay();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const slots = schedule.filter(s => {
      if (s.specificDate) {
        return s.specificDate === dateStr;
      } else {
        return s.dayOfWeek === dayOfWeek;
      }
    });
    
    // 병합
    if (slots.length === 0) return 0;
    const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const merged = [];
    let current = { ...sorted[0] };
    
    for (let i = 1; i < sorted.length; i++) {
      const slot = sorted[i];
      if (current.endTime === slot.startTime && current.priority === slot.priority) {
        current.endTime = slot.endTime;
      } else {
        merged.push(current);
        current = { ...slot };
      }
    }
    merged.push(current);
    return merged.length;
  };;

  const getExceptionCount = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const exs = exceptions.filter(ex => {
      const exDateStr = ex.specificDate;
      return exDateStr === dateStr && ex.title !== '휴무일' && !ex.isHoliday;
    });
    
    // 병합
    if (exs.length === 0) return 0;
    const sorted = [...exs].sort((a, b) => {
      const aTime = a.startTime.includes('T') ? new Date(a.startTime).getHours() * 60 + new Date(a.startTime).getMinutes() : 
                    parseInt(a.startTime.split(':')[0]) * 60 + parseInt(a.startTime.split(':')[1]);
      const bTime = b.startTime.includes('T') ? new Date(b.startTime).getHours() * 60 + new Date(b.startTime).getMinutes() : 
                    parseInt(b.startTime.split(':')[0]) * 60 + parseInt(b.startTime.split(':')[1]);
      return aTime - bTime;
    });
    
    const merged = [];
    let current = { ...sorted[0] };
    
    for (let i = 1; i < sorted.length; i++) {
      const slot = sorted[i];
      const currentEnd = current.endTime.includes('T') ? 
        `${String(new Date(current.endTime).getHours()).padStart(2, '0')}:${String(new Date(current.endTime).getMinutes()).padStart(2, '0')}` : 
        current.endTime;
      const slotStart = slot.startTime.includes('T') ? 
        `${String(new Date(slot.startTime).getHours()).padStart(2, '0')}:${String(new Date(slot.startTime).getMinutes()).padStart(2, '0')}` : 
        slot.startTime;
      
      if (currentEnd === slotStart) {
        current.endTime = slot.endTime;
      } else {
        merged.push(current);
        current = { ...slot };
      }
    }
    merged.push(current);
    return merged.length;
  };;

  const getPersonalTimeCount = (date) => {
    const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const pts = personalTimes.filter(pt => {
      if (pt.isRecurring !== false && pt.days && pt.days.includes(dayOfWeek)) {
        return true;
      }
      if (pt.isRecurring === false && pt.specificDate) {
        return pt.specificDate === dateStr;
      }
      return false;
    });
    
    // personalTimes는 이미 개별 항목이므로 그대로 개수 반환
    return pts.length;
  };;

  const hasExceptionForDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const hasException = exceptions.some(ex => {
      // specificDate 필드를 사용해야 함 (startTime은 "10:00" 형식이므로 날짜가 아님)
      const exDateStr = ex.specificDate;
      const isMatch = exDateStr === dateStr && ex.title !== '휴무일' && !ex.isHoliday;

      return isMatch;
    });

    return hasException;
  };

  const hasHolidayForDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    return exceptions.some(ex => {
      // specificDate 필드를 사용해야 함
      const exDateStr = ex.specificDate;
      return exDateStr === dateStr && (ex.title === '휴무일' || ex.isHoliday);
    });
  };

  const hasPersonalTimeForDate = (date) => {
    // JavaScript getDay(): 0=일요일, 1=월요일, ..., 6=토요일
    // personalTimes.days: 1=월요일, 2=화요일, ..., 7=일요일
    const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
    // 로컬 날짜를 YYYY-MM-DD 형식으로 정확히 변환 (UTC 시간대 문제 방지)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    return personalTimes.some(pt => {
      // 반복되는 개인시간 체크
      if (pt.isRecurring !== false && pt.days && pt.days.includes(dayOfWeek)) {
        return true;
      }

      // 특정 날짜의 개인시간 체크
      if (pt.isRecurring === false && pt.specificDate) {
        // YYYY-MM-DD 형식의 문자열을 직접 비교 (시간대 문제 방지)
        const isMatch = pt.specificDate === dateStr;
        return isMatch;
      }

      return false;
    });
  };

  /**
   * navigateMonth - 월 이동 처리
   *
   * @param {number} direction - 이동 방향 (-1: 이전 달, 1: 다음 달)
   */
  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
    if (onMonthChange) {
      onMonthChange(newDate);
    }
  };

  /**
   * goToToday - 오늘 날짜로 이동
   */
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    if (onMonthChange) {
      onMonthChange(today);
    }
  };

  /**
   * handleDateClick - 날짜 클릭 처리
   *
   * @param {Date} date - 클릭한 날짜
   */
  const handleDateClick = (date) => {
    if (onDateClick) {
      onDateClick(date);
    }
  };


  const renderCalendarHeader = () => (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-4">
        <h2 className="text-xl font-semibold">
          {`${currentDate.getFullYear()}년 ${monthNames[currentDate.getMonth()]}`}
        </h2>

        <div className="flex items-center space-x-2">
          <button
onClick={() => navigateMonth(-1)}
            className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>

          <button
            onClick={goToToday}
            className="px-3 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors text-sm"
          >
            오늘
          </button>

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

  const renderMonthView = () => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* 요일 헤더 */}
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

      {/* 캘린더 그리드 */}
      <div className="grid grid-cols-7">
        {calendarDates.map((dateInfo, index) => (
          <div
            key={index}
            className={`
              h-20 border-r border-b border-gray-100 p-2 transition-colors
              ${dateInfo.hasHoliday ? 'bg-gray-200 text-gray-500' : ''}
              ${!dateInfo.hasHoliday && (dateInfo.isCurrentMonth ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 text-gray-400')}
              ${dateInfo.isToday && !dateInfo.hasHoliday ? 'bg-blue-100' : ''}
              ${dateInfo.isSelected && !dateInfo.hasHoliday ? 'bg-blue-200 ring-2 ring-blue-500' : ''}
              cursor-pointer
            `}
            onClick={() => handleDateClick(dateInfo.date)}
          >
            <div className="flex flex-col h-full">
              <div className={`text-sm font-medium mb-1 ${
                dateInfo.isToday && !dateInfo.hasHoliday ? 'text-blue-600' : ''
              }`}>
                {dateInfo.day}
              </div>

              {dateInfo.hasHoliday ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="bg-black text-white px-2 py-1 rounded-full text-xs font-bold shadow-md border border-gray-600 flex items-center justify-center min-h-[20px]">
                    휴무일
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-center space-y-1">
                  {dateInfo.scheduleCount > 0 && (
                    [...Array(Math.min(dateInfo.scheduleCount, 3))].map((_, i) => (
                      <div key={`schedule-${i}`} className="w-full h-1 bg-blue-500 rounded-full"></div>
                    ))
                  )}
                  {dateInfo.exceptionCount > 0 && dateInfo.exceptions && (
                    dateInfo.exceptions.slice(0, 3).map((ex, i) => {
                      const priority = ex.priority !== undefined ? ex.priority : 3;
                      const colorMap = {
                        3: 'bg-blue-600',
                        2: 'bg-blue-400',
                        1: 'bg-blue-200'
                      };
                      const color = colorMap[priority] || 'bg-blue-600';
                      return <div key={`exception-${i}`} className={`w-full h-1 ${color} rounded-full`}></div>;
                    })
                  )}
                  {dateInfo.personalTimeCount > 0 && (
                    [...Array(Math.min(dateInfo.personalTimeCount, 3))].map((_, i) => (
                      <div key={`personal-${i}`} className="w-full h-1 bg-red-500 rounded-full"></div>
                    ))
                  )}
                  {(dateInfo.scheduleCount + dateInfo.exceptionCount + dateInfo.personalTimeCount) > 9 && (
                    <div className="text-xs text-center text-gray-500">+더보기</div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      {renderCalendarHeader()}
      {renderMonthView()}
    </div>
  );
};

export default CalendarView;
