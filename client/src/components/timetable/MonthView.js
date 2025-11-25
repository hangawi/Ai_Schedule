import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toLocalDateString } from '../../utils/dateUtils';
import { mergeConsecutiveTimeSlots } from '../../utils/timetableHelpers';

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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDates, setCalendarDates] = useState([]);

  const monthNames = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'
  ];

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  useEffect(() => {
    if (initialStartDate) {
      setCurrentDate(new Date(initialStartDate));
    }
  }, [initialStartDate]);

  useEffect(() => {
    generateCalendarDates();
  }, [currentDate, timeSlots, showMerged]);

  const generateCalendarDates = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);

    const firstDayOfWeek = firstDay.getDay();
    startDate.setDate(firstDay.getDate() - firstDayOfWeek);

    const dates = [];
    const totalDays = 42; // 6주 * 7일

    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const isCurrentMonth = date.getMonth() === month;
      const isToday = toLocalDateString(date) === toLocalDateString(new Date());

      let slotsForDate = getSlotsForDate(date);
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

  const renderMonthGrid = () => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
              <div className={`text-sm font-medium mb-1 ${dateInfo.isToday ? 'text-blue-600' : ''}`}>
                {dateInfo.day}
              </div>

              <div className="flex-1 overflow-y-auto text-xs">
                {dateInfo.slots.map(slot => {
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

  return (
    <div>
      {renderCalendarHeader()}
      {renderMonthGrid()}
    </div>
  );
};

export default MonthView;
