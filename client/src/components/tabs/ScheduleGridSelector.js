import React, { useState, useEffect } from 'react';

// Constants
const days = [
  { name: '월', dayOfWeek: 1 },
  { name: '화', dayOfWeek: 2 },
  { name: '수', dayOfWeek: 3 },
  { name: '목', dayOfWeek: 4 },
  { name: '금', dayOfWeek: 5 },
];

const timeSlots = [];
for (let h = 9; h < 18; h++) {
  for (let m = 0; m < 60; m += 30) {
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    timeSlots.push(time);
  }
}

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

const ScheduleGridSelector = ({ schedule, setSchedule, readOnly, exceptions = [], onRemoveException }) => {

  const [weekDates, setWeekDates] = useState([]);

  useEffect(() => {
    const today = new Date();
    const monday = getMondayOfCurrentWeek(today);

    const dates = [];
    const dayNamesKorean = ['월', '화', '수', '목', '금'];
    for (let i = 0; i < 5; i++) {
      const date = new Date(monday);
      date.setUTCDate(monday.getUTCDate() + i);
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const dayOfMonth = String(date.getUTCDate()).padStart(2, '0');
      dates.push({ fullDate: date, display: `${dayNamesKorean[i]} (${month}.${dayOfMonth})` });
    }
    setWeekDates(dates);
  }, []);

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

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
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
      <div className="timetable-grid border border-gray-200 rounded-lg overflow-auto" style={{ maxHeight: '500px' }}>
        <div className="grid grid-cols-6 bg-gray-100 sticky top-0 z-10">
          <div className="col-span-1 p-2 text-center font-semibold text-gray-700">시간</div>
          {weekDates.map((date, index) => (
            <div key={index} className="col-span-1 p-2 text-center font-semibold text-gray-700 border-l border-gray-200">
              {date.display}
            </div>
          ))}
        </div>

        {timeSlots.map(time => (
          <div key={time} className="grid grid-cols-6 border-b border-gray-200 last:border-b-0">
            <div className="col-span-1 p-2 text-center text-sm font-medium text-gray-600 flex items-center justify-center">
              {time}
            </div>
            {days.map((day, index) => {
              const slotInfo = getSlotInfo(day.dayOfWeek, time);
              const exception = getExceptionForSlot(weekDates[index]?.fullDate, time);
              const isExceptionSlot = !!exception;

              let slotClass = 'bg-white';
              if (isExceptionSlot) {
                slotClass = 'bg-gray-400';
              } else if (slotInfo) {
                slotClass = priorityConfig[slotInfo.priority]?.color || 'bg-blue-400';
              }

              let cursorClass = readOnly ? 'cursor-default' : 'cursor-pointer';
              if (isExceptionSlot) {
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
                  title={isExceptionSlot ? exception.title : (slotInfo ? priorityConfig[slotInfo.priority]?.label : '클릭하여 선택')}
                >
                  {isExceptionSlot ? (
                    <span className="text-xs text-white truncate px-1">{exception.title}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScheduleGridSelector;
