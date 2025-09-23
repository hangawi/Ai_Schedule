import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Grid, Clock, Copy, RotateCcw } from 'lucide-react';

const CalendarView = ({
  schedule,
  setSchedule,
  readOnly,
  exceptions = [],
  personalTimes = [],
  onRemoveException,
  onDateClick,
  selectedDate,
  viewMode = 'month', // 'month' or 'week'
  onShowAlert,
  onAutoSave
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
  }, [currentDate, viewMode, schedule, exceptions, personalTimes]);

  useEffect(() => {
    const handleCalendarUpdate = (event) => {
      console.log('Calendar update triggered:', event.detail);
      generateCalendarDates();
    };

    window.addEventListener('calendarUpdate', handleCalendarUpdate);
    return () => {
      window.removeEventListener('calendarUpdate', handleCalendarUpdate);
    };
  }, [schedule, exceptions, personalTimes]);

  const generateCalendarDates = () => {
    if (viewMode === 'month') {
      generateMonthDates();
    } else {
      generateWeekDates();
    }
  };

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

      dates.push({
        date: new Date(date),
        day: date.getDate(),
        isCurrentMonth,
        isToday,
        isSelected,
        hasSchedule: hasScheduleForDate(date),
        hasException: hasExceptionForDate(date),
        hasPersonalTime: hasPersonalTimeForDate(date),
        hasBlockedTime: hasBlockedTimeForDate(date),
        hasHoliday: hasHolidayForDate(date)
      });
    }

    setCalendarDates(dates);
  };

  const generateWeekDates = () => {
    const startOfWeek = getStartOfWeek(currentDate);
    const dates = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const isToday = date.toDateString() === new Date().toDateString();
      const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();

      dates.push({
        date: new Date(date),
        day: date.getDate(),
        isCurrentMonth: true,
        isToday,
        isSelected,
        hasSchedule: hasScheduleForDate(date),
        hasException: hasExceptionForDate(date),
        hasPersonalTime: hasPersonalTimeForDate(date),
        hasBlockedTime: hasBlockedTimeForDate(date),
        hasHoliday: hasHolidayForDate(date)
      });
    }

    setCalendarDates(dates);
  };

  const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // 일요일부터 시작
    return new Date(d.setDate(diff));
  };

  const hasScheduleForDate = (date) => {
    const dayOfWeek = date.getDay();
    return schedule.some(s => s.dayOfWeek === dayOfWeek && !s.isBlocked);
  };

  const hasBlockedTimeForDate = (date) => {
    const dayOfWeek = date.getDay();
    return schedule.some(s => s.dayOfWeek === dayOfWeek && s.isBlocked);
  };

  const hasExceptionForDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const hasException = exceptions.some(ex => {
      const exStartTime = new Date(ex.startTime);
      const exYear = exStartTime.getFullYear();
      const exMonth = String(exStartTime.getMonth() + 1).padStart(2, '0');
      const exDay = String(exStartTime.getDate()).padStart(2, '0');
      const exDateStr = `${exYear}-${exMonth}-${exDay}`;
      const isMatch = exDateStr === dateStr && ex.title !== '휴무일' && !ex.isHoliday;

      if (isMatch) {
        console.log(`예외 일정 발견 - 날짜: ${dateStr}, 제목: ${ex.title}`);
      }

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
      const exStartTime = new Date(ex.startTime);
      const exYear = exStartTime.getFullYear();
      const exMonth = String(exStartTime.getMonth() + 1).padStart(2, '0');
      const exDay = String(exStartTime.getDate()).padStart(2, '0');
      const exDateStr = `${exYear}-${exMonth}-${exDay}`;
      return exDateStr === dateStr && (ex.title === '휴무일' || ex.isHoliday);
    });
  };

  const hasPersonalTimeForDate = (date) => {
    const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
    return personalTimes.some(pt => {
      return pt.days && pt.days.includes(dayOfWeek);
    });
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateClick = (date) => {
    if (onDateClick) {
      onDateClick(date);
    }
  };

  const copyFromPreviousWeek = () => {
    const currentWeekStart = getStartOfWeek(currentDate);
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(currentWeekStart.getDate() - 7);

    // 이전 주 스케줄을 현재 주로 복사
    const previousWeekSchedule = [];
    for (let i = 0; i < 7; i++) {
      const dayOfWeek = i === 6 ? 0 : i + 1; // 일요일을 0으로 변환
      const scheduleForDay = schedule.filter(s => s.dayOfWeek === dayOfWeek);

      scheduleForDay.forEach(s => {
        const currentDayOfWeek = i === 6 ? 0 : i + 1;
        // 현재 주에 동일한 시간대가 없는 경우만 추가
        const exists = schedule.some(existing =>
          existing.dayOfWeek === currentDayOfWeek &&
          existing.startTime === s.startTime
        );

        if (!exists) {
          previousWeekSchedule.push({
            ...s,
            dayOfWeek: currentDayOfWeek
          });
        }
      });
    }

    if (previousWeekSchedule.length > 0) {
      setSchedule([...schedule, ...previousWeekSchedule]);
      onShowAlert && onShowAlert(`이전 주 스케줄에서 ${previousWeekSchedule.length}개 시간대를 복사했습니다.`, '복사 완료');

      // 즉시 저장
      if (onAutoSave) {
        onAutoSave();
      }
    } else {
      onShowAlert && onShowAlert('복사할 새로운 시간대가 없습니다.', '알림');
    }
  };

  const copyToNextWeek = () => {
    const currentWeekStart = getStartOfWeek(currentDate);
    const nextWeek = new Date(currentDate);
    nextWeek.setDate(currentDate.getDate() + 7);

    // 현재 주 스케줄을 복사할 내용으로 설정
    const currentWeekSchedule = [];
    for (let i = 0; i < 7; i++) {
      const dayOfWeek = i === 6 ? 0 : i + 1;
      const scheduleForDay = schedule.filter(s => s.dayOfWeek === dayOfWeek);
      currentWeekSchedule.push(...scheduleForDay);
    }

    if (currentWeekSchedule.length > 0) {
      // 다음 주로 날짜 이동
      setCurrentDate(nextWeek);
      onShowAlert && onShowAlert(`다음 주로 이동했습니다. 현재 주 스케줄을 그대로 사용할 수 있습니다.`, '복사 준비');
    } else {
      onShowAlert && onShowAlert('복사할 스케줄이 없습니다.', '알림');
    }
  };

  const clearCurrentWeek = () => {
    // 현재 주 스케줄 초기화
    const currentWeekStart = getStartOfWeek(currentDate);
    const weekDays = [];

    for (let i = 0; i < 7; i++) {
      weekDays.push(i === 6 ? 0 : i + 1); // 일요일을 0으로 변환
    }

    const filteredSchedule = schedule.filter(s => !weekDays.includes(s.dayOfWeek));
    const removedCount = schedule.length - filteredSchedule.length;

    setSchedule(filteredSchedule);
    onShowAlert && onShowAlert(`현재 주에서 ${removedCount}개 시간대를 삭제했습니다.`, '초기화 완료');

    // 즉시 저장
    if (onAutoSave) {
      onAutoSave();
    }
  };

  const renderCalendarHeader = () => (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-4">
        <h2 className="text-xl font-semibold">
          {viewMode === 'month'
            ? `${currentDate.getFullYear()}년 ${monthNames[currentDate.getMonth()]}`
            : `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월 ${Math.ceil(currentDate.getDate() / 7)}주차`
          }
        </h2>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => viewMode === 'month' ? navigateMonth(-1) : navigateWeek(-1)}
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
            onClick={() => viewMode === 'month' ? navigateMonth(1) : navigateWeek(1)}
            className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {!readOnly && viewMode === 'week' && (
        <div className="flex items-center space-x-2">
          <button
            onClick={copyFromPreviousWeek}
            className="px-3 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors text-sm flex items-center"
          >
            <Copy size={14} className="mr-1" />
            이전주 복사
          </button>
          <button
            onClick={copyToNextWeek}
            className="px-3 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors text-sm flex items-center"
          >
            <Copy size={14} className="mr-1" />
            다음주 복사
          </button>
          <button
            onClick={clearCurrentWeek}
            className="px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors text-sm flex items-center"
          >
            <RotateCcw size={14} className="mr-1" />
            초기화
          </button>
        </div>
      )}
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
              ${!readOnly || !dateInfo.hasHoliday ? 'cursor-pointer' : 'cursor-not-allowed'}
            `}
            onClick={() => (!dateInfo.hasHoliday || !readOnly) && handleDateClick(dateInfo.date)}
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
                <div className="flex-1 flex flex-col space-y-1">
                  {dateInfo.hasSchedule && (
                    <div className="w-full h-1 bg-blue-500 rounded-full"></div>
                  )}
                  {dateInfo.hasException && (
                    <div className="w-full h-1 bg-green-500 rounded-full"></div>
                  )}
                  {dateInfo.hasPersonalTime && (
                    <div className="w-full h-1 bg-red-500 rounded-full"></div>
                  )}
                  {dateInfo.hasBlockedTime && (
                    <div className="w-full h-1 bg-gray-400 rounded-full"></div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderWeekView = () => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
        {calendarDates.map((dateInfo, index) => (
          <div
            key={index}
            className={`p-4 text-center border-r border-gray-200 last:border-r-0 ${
              index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-700'
            }`}
          >
            <div className="text-sm text-gray-500">
              {dayNames[index]}
            </div>
            <div className={`text-lg font-semibold mt-1 ${
              dateInfo.isToday ? 'text-blue-600' : ''
            }`}>
              {dateInfo.day}
            </div>
          </div>
        ))}
      </div>

      {/* 주간 뷰 콘텐츠 */}
      <div className="grid grid-cols-7 min-h-96">
        {calendarDates.map((dateInfo, index) => (
          <div
            key={index}
            className={`
              border-r border-gray-100 last:border-r-0 p-3 transition-colors
              ${dateInfo.hasHoliday ? 'bg-gray-200 text-gray-500' : ''}
              ${!dateInfo.hasHoliday && (dateInfo.isToday ? 'bg-blue-50' : 'hover:bg-gray-50')}
              ${dateInfo.isSelected && !dateInfo.hasHoliday ? 'bg-blue-200 ring-2 ring-blue-500' : ''}
              ${!readOnly || !dateInfo.hasHoliday ? 'cursor-pointer' : 'cursor-not-allowed'}
            `}
            onClick={() => (!dateInfo.hasHoliday || !readOnly) && handleDateClick(dateInfo.date)}
          >
            <div className="space-y-2">
              {dateInfo.hasHoliday ? (
                <div className="p-2 flex items-center justify-center h-full">
                  <div className="bg-black text-white px-3 py-2 rounded-full text-xs font-bold shadow-lg border border-gray-600 flex items-center justify-center min-h-[24px]">
                    휴무일
                  </div>
                </div>
              ) : (
                <>
                  {dateInfo.hasSchedule && (
                    <div className="p-2 bg-blue-100 text-blue-800 rounded text-xs">
                      기본 일정
                    </div>
                  )}
                  {dateInfo.hasException && (
                    <div className="p-2 bg-green-100 text-green-800 rounded text-xs">
                      추가 일정
                    </div>
                  )}
                  {dateInfo.hasPersonalTime && (
                    <div className="p-2 bg-red-100 text-red-800 rounded text-xs">
                      개인 시간
                    </div>
                  )}
                  {dateInfo.hasBlockedTime && (
                    <div className="p-2 flex items-center justify-center">
                      <div className="bg-black text-white px-2 py-1 rounded-full text-xs font-bold shadow-md border border-gray-600 flex items-center justify-center min-h-[20px]">
                        휴무일
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {renderCalendarHeader()}
      {viewMode === 'month' ? renderMonthView() : renderWeekView()}
    </div>
  );
};

export default CalendarView;
