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

  // Handle both old and new room settings structure
  const getHourFromSettings = (setting, defaultValue) => {
    if (!setting) return parseInt(defaultValue);
    if (typeof setting === 'string') return parseInt(setting.split(':')[0]);
    if (typeof setting === 'number') return setting;
    return parseInt(defaultValue);
  };

  const scheduleStartHour = getHourFromSettings(
    roomSettings?.scheduleStart || roomSettings?.startHour, 
    '9'
  );
  const scheduleEndHour = getHourFromSettings(
    roomSettings?.scheduleEnd || roomSettings?.endHour, 
    '18'
  );

  for (let h = scheduleStartHour; h < scheduleEndHour; h++) {
    for (let m = 0; m < 60; m += 30) {
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      timeSlotsInDay.push(time);
    }
  }

  // Helper function to check if a time slot is blocked and return block info
  const getBlockedTimeInfo = (time) => {
    if (!roomSettings?.blockedTimes || roomSettings.blockedTimes.length === 0) {
      return null;
    }
    
    const blockedTime = roomSettings.blockedTimes.find(blockedTime => {
      return time >= blockedTime.startTime && time < blockedTime.endTime;
    });
    
    return blockedTime || null;
  };

  // Don't filter out blocked times - we want to show them as blocked
  const filteredTimeSlotsInDay = timeSlotsInDay;

  const [currentSelectedSlots, setCurrentSelectedSlots] = useState([]);

  // Calculate the Monday of the current week once
  const mondayOfCurrentWeek = useMemo(() => getMondayOfCurrentWeek(new Date()), []);

  // Effect to notify parent about selected slots (in new format)
  useEffect(() => {
    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const selectedSlots = currentSelectedSlots.map(slot => {
      const [hour, minute] = slot.time.split(':').map(Number);
      const endHour = minute === 30 ? hour + 1 : hour;
      const endMinute = minute === 30 ? 0 : minute + 30;
      
      return {
        day: dayNames[slot.dayIndex],
        startTime: slot.time,
        endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
        subject: '새 일정' // Default subject
      };
    });
    onSlotSelect(selectedSlots);
  }, [currentSelectedSlots, onSlotSelect]);

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
    if (!timeSlots || !members) return null;
    
    const [hour, minute] = time.split(':').map(Number);
    const slotStart = new Date(mondayOfCurrentWeek);
    slotStart.setDate(mondayOfCurrentWeek.getDate() + dayIndex);
    slotStart.setHours(hour, minute, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

    const bookedSlot = timeSlots.find(booked => {
      // Handle both old and new timeSlot structures
      let bookedStartTime, bookedEndTime;
      
      if (booked.startTime && booked.endTime) {
        // Old structure with Date objects
        bookedStartTime = new Date(booked.startTime);
        bookedEndTime = new Date(booked.endTime);
      } else if (booked.day && booked.startTime && booked.endTime) {
        // New structure with day strings and time strings
        const dayMap = { 'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3, 'friday': 4 };
        const bookedDayIndex = dayMap[booked.day.toLowerCase()];
        
        if (bookedDayIndex === dayIndex) {
          const [bookedHour, bookedMinute] = booked.startTime.split(':').map(Number);
          const [bookedEndHour, bookedEndMinute] = booked.endTime.split(':').map(Number);
          
          bookedStartTime = new Date(mondayOfCurrentWeek);
          bookedStartTime.setDate(mondayOfCurrentWeek.getDate() + bookedDayIndex);
          bookedStartTime.setHours(bookedHour, bookedMinute, 0, 0);
          
          bookedEndTime = new Date(mondayOfCurrentWeek);
          bookedEndTime.setDate(mondayOfCurrentWeek.getDate() + bookedDayIndex);
          bookedEndTime.setHours(bookedEndHour, bookedEndMinute, 0, 0);
        } else {
          return false; // Different day
        }
      } else {
        return false; // Invalid slot structure
      }

      // Check for overlap
      return (slotStart < bookedEndTime && slotEnd > bookedStartTime);
    });

    if (bookedSlot) {
      // Handle both old and new member structures
      const userId = bookedSlot.userId || bookedSlot.user?._id || bookedSlot.user;
      const member = members.find(m => {
        const memberId = m._id || m.user?._id;
        return memberId === userId;
      });
      
      if (member) {
        // Handle different member name structures
        const memberData = member.user || member;
        return memberData.name || `${memberData.firstName || ''} ${memberData.lastName || ''}`.trim() || '알 수 없음';
      }
      return '알 수 없음';
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
            const blockedInfo = getBlockedTimeInfo(time);
            const isBlocked = !!blockedInfo;
            
            return (
              <div
                key={`${day}-${time}`}
                className={`col-span-1 border-l border-gray-200 h-10 flex items-center justify-center
                  ${isBlocked ? 'bg-gray-300 cursor-not-allowed' : 'cursor-pointer'}
                  ${!isBlocked && owner ? 'bg-red-100' : ''}
                  ${!isBlocked && !owner && isSelected ? 'bg-blue-200' : ''}
                  ${!isBlocked && !owner && !isSelected ? 'hover:bg-gray-50' : ''}
                `}
                onClick={() => !isBlocked && handleSlotClick(dayIndex, time)}
              >
                {isBlocked ? (
                  <span className="text-xs text-gray-600 font-medium" title={`${blockedInfo.startTime} - ${blockedInfo.endTime}`}>
                    {blockedInfo.name}
                  </span>
                ) : (
                  owner && <span className="text-xs text-red-800">{owner}</span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default TimetableGrid;
