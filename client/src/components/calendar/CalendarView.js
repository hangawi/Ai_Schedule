import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

  const generateCalendarDates = () => {
    generateMonthDates();
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


  const goToToday = () => {
    setCurrentDate(new Date());
  };

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


  return (
    <div className="space-y-4">
      {renderCalendarHeader()}
      {renderMonthView()}
    </div>
  );
};

export default CalendarView;
