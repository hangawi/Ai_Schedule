
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

const ScheduleGridSelector = ({ schedule, setSchedule }) => {

  const [weekDates, setWeekDates] = useState([]);

  useEffect(() => {
    const today = new Date();
    // If it's Sunday, we want to show next week's calendar (Monday is 1, Sunday is 0)
    // Adjust to Monday of the current week. If today is Sunday, getMondayOfCurrentWeek will return last Monday.
    // So if today is Sunday, we need to add 1 day to get to Monday, then calculate Monday of that week.
    // Or simply, if day is 0 (Sunday), make it 7 for calculation purposes to get previous Monday.
    const day = today.getUTCDay();
    const monday = getMondayOfCurrentWeek(today);

    const dates = [];
    const dayNamesKorean = ['월', '화', '수', '목', '금']; // Only for Mon-Fri
    for (let i = 0; i < 5; i++) { // Loop 5 times for Mon-Fri
      const date = new Date(monday);
      date.setUTCDate(monday.getUTCDate() + i);
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const dayOfMonth = String(date.getUTCDate()).padStart(2, '0');
      dates.push(`${dayNamesKorean[i]} (${month}.${dayOfMonth})`);
    }
    setWeekDates(dates);
  }, []);

  const handleSlotClick = (dayOfWeek, startTime) => {
    const [hour, minute] = startTime.split(':').map(Number);
    const endHour = minute === 30 ? hour + 1 : hour;
    const endMinute = minute === 30 ? 0 : 30;
    const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

    const isSelected = schedule.some(
      slot => slot.dayOfWeek === dayOfWeek && slot.startTime === startTime
    );

    if (isSelected) {
      // Deselect the slot
      setSchedule(
        schedule.filter(
          slot => !(slot.dayOfWeek === dayOfWeek && slot.startTime === startTime)
        )
      );
    } else {
      // Select the slot
      setSchedule([...schedule, { dayOfWeek, startTime, endTime }]);
    }
  };

  const isSlotSelected = (dayOfWeek, startTime) => {
    return schedule.some(
      slot => slot.dayOfWeek === dayOfWeek && slot.startTime === startTime
    );
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <h3 className="text-lg font-semibold mb-3">주간 반복 일정</h3>
      <p className="text-sm text-gray-600 mb-4">
        시간표에서 반복적으로 일정이 있는 시간대를 클릭하여 설정하세요. 파란색으로 표시된 시간이 고정 일정입니다.
      </p>
      <div className="timetable-grid border border-gray-200 rounded-lg overflow-auto" style={{ maxHeight: '500px' }}>
        {/* Header Row */}
        <div className="grid grid-cols-6 bg-gray-100 sticky top-0 z-10">
          <div className="col-span-1 p-2 text-center font-semibold text-gray-700">시간</div>
          {(weekDates.length > 0 ? weekDates : days.map(day => day.name)).map((dayDisplay, index) => (
            <div key={index} className="col-span-1 p-2 text-center font-semibold text-gray-700 border-l border-gray-200">
              {dayDisplay}
            </div>
          ))}
        </div>

        {/* Time Rows */}
        {timeSlots.map(time => (
          <div key={time} className="grid grid-cols-6 border-b border-gray-200 last:border-b-0">
            <div className="col-span-1 p-2 text-center text-sm font-medium text-gray-600 flex items-center justify-center">
              {time}
            </div>
            {days.map(day => {
              const isSelected = isSlotSelected(day.dayOfWeek, time);
              return (
                <div
                  key={`${day.dayOfWeek}-${time}`}
                  className={`col-span-1 border-l border-gray-200 h-8 flex items-center justify-center cursor-pointer hover:bg-blue-100 transition-colors
                    ${isSelected ? 'bg-blue-500' : 'bg-white'}
                  `}
                  onClick={() => handleSlotClick(day.dayOfWeek, time)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScheduleGridSelector;
