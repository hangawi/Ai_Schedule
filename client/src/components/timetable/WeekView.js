import React from 'react';
import TimeSlot from './TimeSlot';

const dayNamesKorean = ['월', '화', '수', '목', '금'];

const WeekView = ({ 
  filteredTimeSlotsInDay, 
  weekDates, 
  days, 
  getSlotOwner, 
  isSlotSelected, 
  getBlockedTimeInfo, 
  getRoomExceptionInfo, // New prop
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
          {weekDates.map((dateInfo, dayIndex) => { // Use dateInfo from weekDates
            const date = dateInfo.fullDate; // Extract fullDate object
            const ownerInfo = getSlotOwner(date, time);
            const isSelected = isSlotSelected(date, time);
            const blockedInfo = getBlockedTimeInfo(time);
            const roomExceptionInfo = getRoomExceptionInfo(date, time); // Get room exception info
            const isBlocked = !!blockedInfo;
            return (
              <TimeSlot
                key={`${date.toISOString().split('T')[0]}-${time}`}
                date={date} // Pass date object
                day={dayNamesKorean[dayIndex]} // Use dayIndex directly
                time={time}
                ownerInfo={ownerInfo}
                isSelected={isSelected}
                blockedInfo={blockedInfo}
                roomExceptionInfo={roomExceptionInfo} // Pass room exception info
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
