import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Grid, Clock } from 'lucide-react';

// Constants
const days = [
  { name: '월', dayOfWeek: 1 },
  { name: '화', dayOfWeek: 2 },
  { name: '수', dayOfWeek: 3 },
  { name: '목', dayOfWeek: 4 },
  { name: '금', dayOfWeek: 5 },
];

const monthNames = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월'
];

const generateTimeSlots = (startHour = 0, endHour = 24) => {
  const slots = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 30) {
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      slots.push(time);
    }
  }
  return slots;
};

const timeSlots = generateTimeSlots(9, 18); // 기본 9시-18시

const priorityConfig = {
  3: { label: '선호', color: 'bg-blue-600', next: 2 },      // 선호 -> 보통
  2: { label: '보통', color: 'bg-blue-400', next: 1 },      // 보통 -> 조정 가능
  1: { label: '조정 가능', color: 'bg-blue-200', next: 0 }, // 조정 가능 -> 해제
};

// Helper function to get the Monday of the current week
const getMondayOfCurrentWeek = (date) => {
  const d = new Date(date);
  const day = d.getUTCDay(); // Sunday - 0, Monday - 1, ..., Saturday - 6
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMilliseconds(0);
  return d;
};

const ScheduleGridSelector = ({ schedule, setSchedule, readOnly, exceptions = [], onRemoveException, personalTimes = [] }) => {
  const [viewMode, setViewMode] = useState('week'); // 'week' or 'month'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weekDates, setWeekDates] = useState([]);
  const [monthDates, setMonthDates] = useState([]);
  const [timeRange, setTimeRange] = useState({ start: 9, end: 18 });
  const [showFullDay, setShowFullDay] = useState(false);

  useEffect(() => {
    if (viewMode === 'week') {
      const monday = getMondayOfCurrentWeek(currentDate);
      const dates = [];
      const dayNamesKorean = ['월', '화', '수', '목', '금'];
      for (let i = 0; i < 5; i++) {
        const date = new Date(monday);
        date.setUTCDate(monday.getUTCDate() + i);
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const dayOfMonth = String(date.getUTCDate()).padStart(2, '0');
        dates.push({
          fullDate: date,
          display: `${dayNamesKorean[i]} (${month}.${dayOfMonth})`,
          dayOfWeek: i + 1
        });
      }
      setWeekDates(dates);
    } else {
      // Month view
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      // Get first Monday to show
      const startDate = new Date(firstDay);
      const firstDayOfWeek = firstDay.getDay();
      const daysToSubtract = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
      startDate.setDate(firstDay.getDate() - daysToSubtract);

      const dates = [];
      const totalDays = 35; // 5 weeks * 7 days

      for (let i = 0; i < totalDays; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        const isCurrentMonth = date.getMonth() === month;
        const dayOfWeek = date.getDay();
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

        if (isWeekday) {
          dates.push({
            fullDate: date,
            display: date.getDate(),
            isCurrentMonth,
            dayOfWeek: dayOfWeek === 0 ? 7 : dayOfWeek
          });
        }
      }
      setMonthDates(dates);
    }
  }, [currentDate, viewMode]);

  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleSlotClick = (dayOfWeek, startTime) => {
    if (readOnly) return;

    const existingSlot = schedule.find(
      s => s.dayOfWeek === dayOfWeek && s.startTime === startTime
    );

    if (existingSlot) {
      const currentPriority = existingSlot.priority || 2;
      const nextPriority = priorityConfig[currentPriority].next;

      if (nextPriority === 0) {
        // Deselect by filtering based on day and time
        setSchedule(schedule.filter(s => 
          !(s.dayOfWeek === dayOfWeek && s.startTime === startTime)
        ));
      } else {
        // Update priority by mapping based on day and time
        setSchedule(schedule.map(s => 
          (s.dayOfWeek === dayOfWeek && s.startTime === startTime)
          ? { ...s, priority: nextPriority } 
          : s
        ));
      }
    } else {
      // Add new slot with default high priority
      const [hour, minute] = startTime.split(':').map(Number);
      const endHour = minute === 30 ? hour + 1 : hour;
      const endMinute = minute === 30 ? 0 : 30;
      const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
      setSchedule([...schedule, { dayOfWeek, startTime, endTime, priority: 3 }]);
    }
  };

  const getSlotInfo = (dayOfWeek, startTime) => {
    return schedule.find(
      s => s.dayOfWeek === dayOfWeek && s.startTime === startTime
    );
  };

  const getExceptionForSlot = (date, startTime) => {
    if (!date) return null;
    const slotStart = new Date(`${date.toISOString().split('T')[0]}T${startTime}:00.000Z`);
    for (const ex of exceptions) {
      const exStart = new Date(ex.startTime);
      const exEnd = new Date(ex.endTime);
      if (slotStart >= exStart && slotStart < exEnd) {
        return ex;
      }
    }
    return null;
  };

  const getPersonalTimeForSlot = (date, startTime) => {
    if (!date || !personalTimes) return null;
    const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay(); // Convert to 1-7
    const [hour, minute] = startTime.split(':').map(Number);
    const slotMinutes = hour * 60 + minute;

    for (const pt of personalTimes) {
      if (!pt.days.includes(dayOfWeek)) continue;

      const [startHour, startMin] = pt.startTime.split(':').map(Number);
      const [endHour, endMin] = pt.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      let endMinutes = endHour * 60 + endMin;

      // Handle overnight times (like sleep 22:00 - 08:00)
      if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60; // Add 24 hours
        // Check if slot is in the overnight period
        if (slotMinutes >= startMinutes || slotMinutes < (endMinutes - 24 * 60)) {
          return pt;
        }
      } else {
        // Normal time range within same day
        if (slotMinutes >= startMinutes && slotMinutes < endMinutes) {
          return pt;
        }
      }
    }
    return null;
  };

  const toggleTimeRange = () => {
    if (showFullDay) {
      setTimeRange({ start: 9, end: 18 });
      setShowFullDay(false);
    } else {
      setTimeRange({ start: 0, end: 24 });
      setShowFullDay(true);
    }
  };

  const getCurrentTimeSlots = () => {
    return generateTimeSlots(timeRange.start, timeRange.end);
  };

  const renderViewControls = () => (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-2">
        <button
          onClick={() => setViewMode('week')}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'week'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <Grid size={16} className="mr-1 inline" />
          주간
        </button>
        <button
          onClick={() => setViewMode('month')}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'month'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <Calendar size={16} className="mr-1 inline" />
          월간
        </button>

        <div className="border-l border-gray-300 pl-2 ml-2">
          <button
            onClick={toggleTimeRange}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              showFullDay
                ? 'bg-purple-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Clock size={16} className="mr-1 inline" />
            {showFullDay ? '24시간' : '근무시간'}
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={() => viewMode === 'week' ? navigateWeek(-1) : navigateMonth(-1)}
          className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="text-lg font-semibold min-w-40 text-center">
          {viewMode === 'week'
            ? `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월 ${Math.ceil(currentDate.getDate() / 7)}주차`
            : `${currentDate.getFullYear()}년 ${monthNames[currentDate.getMonth()]}`
          }
        </div>

        <button
          onClick={() => viewMode === 'week' ? navigateWeek(1) : navigateMonth(1)}
          className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"
        >
          <ChevronRight size={16} />
        </button>

        <button
          onClick={goToToday}
          className="px-3 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors text-sm"
        >
          오늘
        </button>
      </div>
    </div>
  );

  const renderMonthView = () => {
    const weeks = [];
    for (let i = 0; i < monthDates.length; i += 5) {
      weeks.push(monthDates.slice(i, i + 5));
    }

    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Month header */}
        <div className="grid grid-cols-6 bg-gray-100">
          <div className="p-2 text-center font-semibold text-gray-700">시간</div>
          {['월', '화', '수', '목', '금'].map((day) => (
            <div key={day} className="p-2 text-center font-semibold text-gray-700 border-l border-gray-200">
              {day}
            </div>
          ))}
        </div>

        {/* Month grid */}
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex}>
            {/* Date row */}
            <div className="grid grid-cols-6 border-b border-gray-200 bg-gray-50">
              <div className="p-2 text-center text-sm font-medium text-gray-600">
                {week[0] && `${week[0].fullDate.getMonth() + 1}/${week[0].fullDate.getDate()}`}
              </div>
              {week.map((date, index) => (
                <div
                  key={index}
                  className={`p-2 text-center text-sm border-l border-gray-200 ${
                    date.isCurrentMonth ? 'text-gray-800' : 'text-gray-400'
                  }`}
                >
                  {date.display}
                </div>
              ))}
            </div>

            {/* Time slots for this week */}
            {getCurrentTimeSlots().slice(0, showFullDay ? 12 : 6).map(time => ( // Show fewer time slots for month view
              <div key={time} className="grid grid-cols-6 border-b border-gray-200 last:border-b-0">
                <div className="p-1 text-center text-xs font-medium text-gray-600 flex items-center justify-center">
                  {time}
                </div>
                {week.map((date, dayIndex) => {
                  const slotInfo = getSlotInfo(date.dayOfWeek, time);
                  const exception = getExceptionForSlot(date.fullDate, time);
                  const personalTime = getPersonalTimeForSlot(date.fullDate, time);
                  const isExceptionSlot = !!exception;
                  const isPersonalTimeSlot = !!personalTime;

                  let slotClass = 'bg-white';
                  if (isExceptionSlot) {
                    slotClass = 'bg-gray-400';
                  } else if (isPersonalTimeSlot) {
                    slotClass = 'bg-red-300'; // Personal time color
                  } else if (slotInfo) {
                    slotClass = priorityConfig[slotInfo.priority]?.color || 'bg-blue-400';
                  }

                  let cursorClass = readOnly ? 'cursor-default' : 'cursor-pointer';
                  if (isExceptionSlot || isPersonalTimeSlot) {
                    cursorClass = 'cursor-not-allowed';
                  }

                  return (
                    <div
                      key={`${date.fullDate.toISOString()}-${time}`}
                      className={`border-l border-gray-200 h-6 flex items-center justify-center transition-colors ${slotClass} ${cursorClass} ${
                        !date.isCurrentMonth ? 'opacity-30' : ''
                      }`}
                      onClick={() => {
                        if (readOnly || !date.isCurrentMonth) return;
                        if (isExceptionSlot) {
                          onRemoveException?.(exception._id);
                        } else {
                          handleSlotClick(date.dayOfWeek, time);
                        }
                      }}
                      title={
                        isExceptionSlot
                          ? exception.title
                          : isPersonalTimeSlot
                          ? `개인시간: ${personalTime.title}`
                          : (slotInfo ? priorityConfig[slotInfo.priority]?.label : '클릭하여 선택')
                      }
                    >
                      {isExceptionSlot && (
                        <span className="text-xs text-white truncate px-1">{exception.title}</span>
                      )}
                      {isPersonalTimeSlot && (
                        <span className="text-xs text-white truncate px-1">{personalTime.title}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const renderWeekView = () => (
    <div className="timetable-grid border border-gray-200 rounded-lg overflow-auto" style={{ maxHeight: '500px' }}>
      <div className="grid grid-cols-6 bg-gray-100 sticky top-0 z-10">
        <div className="col-span-1 p-2 text-center font-semibold text-gray-700">시간</div>
        {weekDates.map((date, index) => (
          <div key={index} className="col-span-1 p-2 text-center font-semibold text-gray-700 border-l border-gray-200">
            {date.display}
          </div>
        ))}
      </div>

      {getCurrentTimeSlots().map(time => (
        <div key={time} className="grid grid-cols-6 border-b border-gray-200 last:border-b-0">
          <div className="col-span-1 p-2 text-center text-sm font-medium text-gray-600 flex items-center justify-center">
            {time}
          </div>
          {days.map((day, index) => {
            const slotInfo = getSlotInfo(day.dayOfWeek, time);
            const exception = getExceptionForSlot(weekDates[index]?.fullDate, time);
            const personalTime = getPersonalTimeForSlot(weekDates[index]?.fullDate, time);
            const isExceptionSlot = !!exception;
            const isPersonalTimeSlot = !!personalTime;

            let slotClass = 'bg-white';
            if (isExceptionSlot) {
              slotClass = 'bg-gray-400';
            } else if (isPersonalTimeSlot) {
              slotClass = 'bg-red-300'; // Personal time color
            } else if (slotInfo) {
              slotClass = priorityConfig[slotInfo.priority]?.color || 'bg-blue-400';
            }

            let cursorClass = readOnly ? 'cursor-default' : 'cursor-pointer';
            if (isExceptionSlot || isPersonalTimeSlot) {
              cursorClass = 'cursor-not-allowed';
            }

            return (
              <div
                key={`${day.dayOfWeek}-${time}`}
                className={`col-span-1 border-l border-gray-200 h-8 flex items-center justify-center transition-colors ${slotClass} ${cursorClass}`}
                onClick={() => {
                  if (readOnly) return;
                  if (isExceptionSlot) {
                    onRemoveException?.(exception._id);
                  } else {
                    handleSlotClick(day.dayOfWeek, time);
                  }
                }}
                title={
                  isExceptionSlot
                    ? exception.title
                    : isPersonalTimeSlot
                    ? `개인시간: ${personalTime.title}`
                    : (slotInfo ? priorityConfig[slotInfo.priority]?.label : '클릭하여 선택')
                }
              >
                {isExceptionSlot ? (
                  <span className="text-xs text-white truncate px-1">{exception.title}</span>
                ) : isPersonalTimeSlot ? (
                  <span className="text-xs text-white truncate px-1">{personalTime.title}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      {renderViewControls()}

      {!readOnly && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg flex items-center justify-center space-x-4">
          <span className="text-sm font-semibold text-gray-700">범례:</span>
          {Object.entries(priorityConfig).sort(([p1], [p2]) => p2 - p1).map(([priority, {label, color}]) => (
            <div key={priority} className="flex items-center">
              <div className={`w-4 h-4 rounded-full ${color} mr-2`}></div>
              <span className="text-sm text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      )}
      {viewMode === 'week' ? renderWeekView() : renderMonthView()}
    </div>
  );
};

export default ScheduleGridSelector;
