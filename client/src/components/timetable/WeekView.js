import React from 'react';
import TimeSlot from './TimeSlot';

const WeekView = ({ 
  filteredTimeSlotsInDay, 
  days, 
  getSlotOwner, 
  isSlotSelected, 
  getBlockedTimeInfo, 
  isRoomOwner, 
  currentUser, 
  handleSlotClick 
}) => {
  return (
    <>
      {filteredTimeSlotsInDay.map(time => (
        <div key={time} className="grid grid-cols-6 border-b border-gray-200 last:border-b-0">
          <div className="col-span-1 p-2 text-center text-sm font-medium text-gray-600 flex items-center justify-center">
            {time}
          </div>
          {days.map((day, dayIndex) => {
            const ownerInfo = getSlotOwner(dayIndex, time);
            const isSelected = isSlotSelected(dayIndex, time);
            const blockedInfo = getBlockedTimeInfo(time);
            const isBlocked = !!blockedInfo;
            
            return (
              <TimeSlot
                key={`${day}-${time}`}
                day={day}
                dayIndex={dayIndex}
                time={time}
                ownerInfo={ownerInfo}
                isSelected={isSelected}
                blockedInfo={blockedInfo}
                isBlocked={isBlocked}
                isRoomOwner={isRoomOwner}
                currentUser={currentUser}
                onSlotClick={handleSlotClick}
              />
            );
          })}
        </div>
      ))}
    </>
  );
};

export default WeekView;