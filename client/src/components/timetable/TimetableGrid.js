import React, { useState, useEffect, useCallback, useMemo } from 'react';

// Helper function to get the Monday of the current week
const getMondayOfCurrentWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // Sunday - 0, Monday - 1, ..., Saturday - 6
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  d.setMilliseconds(0);
  return d;
};

const TimetableGrid = ({ roomSettings, timeSlots, members, onSlotSelect }) => {
  const days = ['월', '화', '수', '목', '금'];
  const timeSlotsInDay = []; // 30-minute intervals for one day

  const scheduleStartHour = parseInt(roomSettings?.scheduleStart.split(':')[0] || '9');
  const scheduleEndHour = parseInt(roomSettings?.scheduleEnd.split(':')[0] || '18');
  const lunchStartHour = parseInt(roomSettings?.lunchStart.split(':')[0] || '12');
  const lunchEndHour = parseInt(roomSettings?.lunchEnd.split(':')[0] || '13');

  for (let h = scheduleStartHour; h < scheduleEndHour; h++) {
    for (let m = 0; m < 60; m += 30) {
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      timeSlotsInDay.push(time);
    }
  }

  const filteredTimeSlotsInDay = timeSlotsInDay.filter(slot => {
    const [hour, minute] = slot.split(':').map(Number);
    if (hour >= lunchStartHour && hour < lunchEndHour) {
      return false;
    }
    return true;
  });

  const [currentSelectedSlots, setCurrentSelectedSlots] = useState([]);

  // Calculate the Monday of the current week once
  const mondayOfCurrentWeek = useMemo(() => getMondayOfCurrentWeek(new Date()), []);

  // Effect to notify parent about selected slots (as Date objects)
  useEffect(() => {
    const selectedDateObjects = currentSelectedSlots.map(slot => {
      const [hour, minute] = slot.time.split(':').map(Number);
      const slotDate = new Date(mondayOfCurrentWeek);
      slotDate.setDate(mondayOfCurrentWeek.getDate() + slot.dayIndex); // Add days for Mon, Tue, etc.
      slotDate.setHours(hour, minute, 0, 0);
      return {
        startTime: slotDate,
        endTime: new Date(slotDate.getTime() + 30 * 60 * 1000) // 30-minute duration
      };
    });
    onSlotSelect(selectedDateObjects);
  }, [currentSelectedSlots, onSlotSelect, mondayOfCurrentWeek]);

  // Function to handle slot click
  const handleSlotClick = useCallback((dayIndex, time) => {
    const clickedSlotIdentifier = { dayIndex, time };

    setCurrentSelectedSlots(prev => {
      const isSelected = prev.some(s => s.dayIndex === dayIndex && s.time === time);
      if (isSelected) {
        return prev.filter(s => !(s.dayIndex === dayIndex && s.time === time));
      } else {
        return [...prev, clickedSlotIdentifier];
      }
    });
  }, []);

  // Helper to check if a slot is selected by the current user
  const isSlotSelected = (dayIndex, time) => {
    return currentSelectedSlots.some(s => s.dayIndex === dayIndex && s.time === time);
  };

  // Helper to get who booked a slot (based on Date object overlap)
  const getSlotOwner = useCallback((dayIndex, time) => {
    const [hour, minute] = time.split(':').map(Number);
    const slotStart = new Date(mondayOfCurrentWeek);
    slotStart.setDate(mondayOfCurrentWeek.getDate() + dayIndex);
    slotStart.setHours(hour, minute, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

    const bookedSlot = timeSlots?.find(booked => {
      const bookedStartTime = new Date(booked.startTime);
      const bookedEndTime = new Date(booked.endTime);

      // Check for overlap
      return (slotStart < bookedEndTime && slotEnd > bookedStartTime);
    });

    if (bookedSlot) {
      const member = members?.find(m => m._id === bookedSlot.userId);
      return member ? `${member.firstName} ${member.lastName}` : '알 수 없음';
    }
    return null;
  }, [timeSlots, members, mondayOfCurrentWeek]);

  return (
    <div className="timetable-grid border border-gray-200 rounded-lg overflow-hidden">
      {/* Header Row (Days) */}
      <div className="grid grid-cols-6 bg-gray-100 border-b border-gray-200">
        <div className="col-span-1 p-2 text-center font-semibold text-gray-700">시간</div>
        {days.map((day, index) => (
          <div key={day} className="col-span-1 p-2 text-center font-semibold text-gray-700 border-l border-gray-200">
            {day}
          </div>
        ))}
      </div>

      {/* Time Rows */}
      {filteredTimeSlotsInDay.map(time => (
        <div key={time} className="grid grid-cols-6 border-b border-gray-200 last:border-b-0">
          <div className="col-span-1 p-2 text-center text-sm font-medium text-gray-600 flex items-center justify-center">
            {time}
          </div>
          {days.map((day, dayIndex) => {
            const owner = getSlotOwner(dayIndex, time);
            const isSelected = isSlotSelected(dayIndex, time);
            return (
              <div
                key={`${day}-${time}`}
                className={`col-span-1 border-l border-gray-200 h-10 flex items-center justify-center cursor-pointer
                  ${owner ? 'bg-red-100' : isSelected ? 'bg-blue-200' : 'hover:bg-gray-50'}
                `}
                onClick={() => handleSlotClick(dayIndex, time)}
              >
                {owner && <span className="text-xs text-red-800">{owner}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default TimetableGrid;
