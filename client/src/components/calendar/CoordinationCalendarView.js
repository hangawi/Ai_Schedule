import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Grid, Clock, Users, Zap, Ban } from 'lucide-react';
import {
  getBlockedTimeInfo,
  getRoomExceptionInfo,
  generateDayTimeSlots
} from '../../utils/timetableHelpers';

const CoordinationCalendarView = ({
  roomData,
  timeSlots = [],
  members = [],
  currentUser,
  isRoomOwner,
  onDateClick,
  selectedDate,
  viewMode = 'month',
  onSlotSelect,
  selectedSlots = [],
  currentWeekStartDate,
  onWeekChange
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDates, setCalendarDates] = useState([]);

  const monthNames = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'
  ];

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  useEffect(() => {
    if (currentWeekStartDate) {
      setCurrentDate(new Date(currentWeekStartDate));
    }
  }, [currentWeekStartDate]);

  useEffect(() => {
    generateCalendarDates();
  }, [currentDate, viewMode]);

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
        slotsCount: getSlotCountForDate(date),
        hasAutoAssigned: hasAutoAssignedForDate(date),
        hasNegotiation: hasNegotiationForDate(date),
        hasBlockedTime: hasBlockedTimeForDate(date),
        blockedTimeCount: getBlockedTimeCountForDate(date)
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
        slotsCount: getSlotCountForDate(date),
        hasAutoAssigned: hasAutoAssignedForDate(date),
        hasNegotiation: hasNegotiationForDate(date),
        hasBlockedTime: hasBlockedTimeForDate(date),
        blockedTimeCount: getBlockedTimeCountForDate(date)
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

  const getSlotCountForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    const dayNameMap = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday'
    };
    const dayName = dayNameMap[dayOfWeek];

    return timeSlots.filter(slot => {
      // Check for slots with specific dates first
      if (slot.date) {
        try {
          const slotDate = new Date(slot.date).toISOString().split('T')[0];
          return slotDate === dateStr;
        } catch (e) {
          // Invalid date format, skip
          return false;
        }
      }

      // Check for recurring weekly slots by day name
      if (slot.day && slot.day.toLowerCase() === dayName) {
        return true;
      }

      return false;
    }).length;
  };

  const hasAutoAssignedForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    const dayNameMap = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday'
    };
    const dayName = dayNameMap[dayOfWeek];

    return timeSlots.some(slot => {
      const isAutoAssigned = slot.assignedBy || slot.subject === '자동 배정';
      if (!isAutoAssigned) return false;

      // Check for slots with specific dates first
      if (slot.date) {
        try {
          const slotDate = new Date(slot.date).toISOString().split('T')[0];
          return slotDate === dateStr;
        } catch (e) {
          return false;
        }
      }

      // Check for recurring weekly slots by day name
      if (slot.day && slot.day.toLowerCase() === dayName) {
        return true;
      }

      return false;
    });
  };

  const hasNegotiationForDate = (date) => {
    // 협의 중인 슬롯이 있는지 확인
    const dateStr = date.toISOString().split('T')[0];
    return roomData?.negotiations?.some(neg => {
      if (!neg.slotInfo?.date) return false;
      const negDate = new Date(neg.slotInfo.date).toISOString().split('T')[0];
      return negDate === dateStr && neg.status === 'active';
    });
  };

  // 차단된 시간이 있는 날짜인지 확인하는 함수
  const hasBlockedTimeForDate = (date) => {
    if (!roomData?.settings) return false;

    // 24시간 전체에서 차단된 시간 확인 (0-24시)
    const timeSlots = generateDayTimeSlots(0, 24);

    return timeSlots.some(time => {
      const blockedInfo = getBlockedTimeInfo(time, roomData.settings);
      const roomException = getRoomExceptionInfo(date, time, roomData.settings);
      return !!(blockedInfo || roomException);
    });
  };

  // 차단된 시간의 개수를 반환하는 함수 (시간 단위로 계산)
  const getBlockedTimeCountForDate = (date) => {
    if (!roomData?.settings) return 0;

    // 시간 단위로 확인 (0-23시)
    const blockedHours = new Set();

    for (let hour = 0; hour < 24; hour++) {
      // 해당 시간의 30분 단위 슬롯들을 확인
      const timeSlots = [`${hour.toString().padStart(2, '0')}:00`, `${hour.toString().padStart(2, '0')}:30`];

      for (const time of timeSlots) {
        const blockedInfo = getBlockedTimeInfo(time, roomData.settings);
        const roomException = getRoomExceptionInfo(date, time, roomData.settings);

        if (blockedInfo || roomException) {
          blockedHours.add(hour);
          break; // 해당 시간대에서 차단이 발견되면 다음 시간으로
        }
      }
    }

    return blockedHours.size;
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
    if (onWeekChange) {
      onWeekChange(newDate.toISOString().split('T')[0]);
    }
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
    if (onWeekChange) {
      const mondayOfNewWeek = getStartOfWeek(newDate);
      onWeekChange(mondayOfNewWeek.toISOString().split('T')[0]);
    }
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    if (onWeekChange) {
      const mondayOfThisWeek = getStartOfWeek(today);
      onWeekChange(mondayOfThisWeek.toISOString().split('T')[0]);
    }
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

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-1"></div>
            <span>수동 입력</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-green-500 mr-1"></div>
            <span>자동 배정</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-orange-500 mr-1"></div>
            <span>협의 중</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-purple-500 mr-1"></div>
            <span>방장 개인시간</span>
          </div>
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
              h-24 border-r border-b border-gray-100 p-2 cursor-pointer transition-colors
              ${dateInfo.isCurrentMonth ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 text-gray-400'}
              ${dateInfo.isToday ? 'bg-blue-100' : ''}
              ${dateInfo.isSelected ? 'bg-blue-200 ring-2 ring-blue-500' : ''}
            `}
            onClick={() => handleDateClick(dateInfo.date)}
          >
            <div className="flex flex-col h-full">
              <div className={`text-sm font-medium mb-1 ${
                dateInfo.isToday ? 'text-blue-600' : ''
              }`}>
                {dateInfo.day}
              </div>

              <div className="flex-1 flex flex-col space-y-1">
                {dateInfo.slotsCount > 0 && (
                  <div className="text-xs bg-blue-100 text-blue-800 px-1 rounded">
                    {dateInfo.slotsCount}개 슬롯
                  </div>
                )}
                {dateInfo.hasBlockedTime && (
                  <div className="w-full h-1 bg-purple-500 rounded-full"></div>
                )}
                {dateInfo.hasAutoAssigned && (
                  <div className="w-full h-1 bg-green-500 rounded-full"></div>
                )}
                {dateInfo.hasNegotiation && (
                  <div className="w-full h-1 bg-orange-500 rounded-full"></div>
                )}
              </div>
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
              border-r border-gray-100 last:border-r-0 p-3 cursor-pointer transition-colors
              ${dateInfo.isToday ? 'bg-blue-50' : 'hover:bg-gray-50'}
              ${dateInfo.isSelected ? 'bg-blue-200 ring-2 ring-blue-500' : ''}
            `}
            onClick={() => handleDateClick(dateInfo.date)}
          >
            <div className="space-y-2">
              {dateInfo.slotsCount > 0 && (
                <div className="p-2 bg-blue-100 text-blue-800 rounded text-xs flex items-center">
                  <Users size={12} className="mr-1" />
                  {dateInfo.slotsCount}개 슬롯
                </div>
              )}
              {dateInfo.hasBlockedTime && (
                <div className="w-full h-2 bg-purple-500 rounded-full"></div>
              )}
              {dateInfo.hasAutoAssigned && (
                <div className="p-2 bg-green-100 text-green-800 rounded text-xs flex items-center">
                  <Zap size={12} className="mr-1" />
                  자동 배정
                </div>
              )}
              {dateInfo.hasNegotiation && (
                <div className="p-2 bg-orange-100 text-orange-800 rounded text-xs flex items-center">
                  <Clock size={12} className="mr-1" />
                  협의 중
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
      {viewMode === 'month' ? renderMonthView() : renderWeekView()}
    </div>
  );
};

export default CoordinationCalendarView;