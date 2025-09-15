import React from 'react';

const TimeSlot = ({
  date, // New prop
  day, 
  time, 
  ownerInfo, 
  isSelected, 
  blockedInfo, 
  isBlocked, 
  isRoomOwner, 
  currentUser, 
  onSlotClick 
}) => {
  const handleClick = () => {
    onSlotClick(date, time); // Pass date object
  };

  return (
    <div
      key={`${date.toISOString().split('T')[0]}-${time}`}
      className={`col-span-1 border-l border-gray-200 h-10 flex items-center justify-center
        ${isBlocked ? 'bg-gray-300 cursor-not-allowed' : ''}
        ${isRoomOwner ? 'cursor-not-allowed opacity-60' : ''}
        ${!isBlocked && !ownerInfo && isSelected && !isRoomOwner ? 'bg-blue-200 border-2 border-blue-400' : ''}
        ${!isBlocked && !ownerInfo && !isSelected && currentUser && !isRoomOwner ? 'hover:bg-blue-50 cursor-pointer' : ''}
        ${!isBlocked && ownerInfo && currentUser && !isRoomOwner ? 'cursor-pointer hover:opacity-80' : ''}
        ${!isBlocked && !ownerInfo && !isSelected && !isRoomOwner ? '' : ''}
      `}
      style={!isBlocked && ownerInfo ? { backgroundColor: `${ownerInfo.color}20`, borderColor: ownerInfo.color } : {}}
      onClick={handleClick}
    >
      {isBlocked ? (
        <span className="text-xs text-gray-600 font-medium" title={`${blockedInfo.startTime} - ${blockedInfo.endTime}`}>
          {blockedInfo.name}
        </span>
      ) : (
        <>
          {ownerInfo && (
            <span className="text-xs font-medium px-1 py-0.5 rounded" style={{ color: ownerInfo.color, backgroundColor: `${ownerInfo.color}10` }}>
              {ownerInfo.name.length > 6 ? ownerInfo.name.substring(0, 4) + '...' : ownerInfo.name}
            </span>
          )}
          {!ownerInfo && isSelected && !isRoomOwner && (
            <span className="text-xs font-medium text-blue-700 px-1 py-0.5 rounded bg-blue-100">
              선택됨
            </span>
          )}
        </>
      )}
    </div>
  );
};

export default TimeSlot;
