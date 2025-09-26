import React from 'react';

const TimeSlot = ({
  date, // New prop
  day,
  time,
  ownerInfo,
  isSelected,
  blockedInfo,
  roomExceptionInfo, // New prop
  isBlocked, // This prop will now be derived from blockedInfo OR roomExceptionInfo
  isRoomOwner,
  currentUser,
  onSlotClick,
  showMerged = true // New prop for merged view
}) => {
  const isEffectivelyBlocked = isBlocked || !!roomExceptionInfo; // Combine existing blocked with new room exceptions


  const handleClick = () => {
    if (isEffectivelyBlocked) return; // Prevent clicks on blocked/exception slots
    onSlotClick(date, time); // Pass date object
  };

  return (
    <div
      key={`${date.toISOString().split('T')[0]}-${time}`}
      className={`col-span-1 border-l border-gray-200 h-8 flex items-center justify-center
        ${isEffectivelyBlocked ? 'bg-gray-300 cursor-not-allowed' : ''}
        ${!isEffectivelyBlocked && !ownerInfo && isSelected ? 'bg-blue-200 border-2 border-blue-400' : ''}
        ${!isEffectivelyBlocked && !ownerInfo && !isSelected && currentUser ? 'hover:bg-blue-50 cursor-pointer' : ''}
        ${!isEffectivelyBlocked && ownerInfo && currentUser ? 'cursor-pointer hover:opacity-80' : ''}
        ${!isEffectivelyBlocked && isRoomOwner && !ownerInfo ? 'cursor-pointer hover:bg-green-50' : ''}
      `}
      style={!isEffectivelyBlocked && ownerInfo ? { backgroundColor: `${ownerInfo.color}20`, borderColor: ownerInfo.color } :
             isEffectivelyBlocked && roomExceptionInfo ? { backgroundColor: '#FEEBC8', borderColor: '#F6AD55' } : {}
            }
      onClick={handleClick}
    >
      {isEffectivelyBlocked ? (
        <span className="text-xs text-gray-600 font-medium" title={roomExceptionInfo ? roomExceptionInfo.name : blockedInfo.name}>
          {roomExceptionInfo ? roomExceptionInfo.name : blockedInfo.name}
        </span>
      ) : (
        <>
          {ownerInfo && (
            <span
              className={`text-xs font-medium px-1 py-0.5 rounded ${
                ownerInfo.isNegotiation ? 'animate-pulse border border-orange-300' : ''
              } ${showMerged && ownerInfo.isMergedSlot ? 'border-2' : ''}`}
              style={{
                color: ownerInfo.color,
                backgroundColor: `${ownerInfo.color}${ownerInfo.isNegotiation ? '30' : '10'}`,
                ...(showMerged && ownerInfo.isMergedSlot ? {
                  borderColor: ownerInfo.color,
                  borderStyle: 'solid'
                } : {})
              }}
              title={ownerInfo.isNegotiation ?
                `협의 참여자: ${ownerInfo.negotiationData?.conflictingMembers?.map(cm => {
                  if (cm.user?.name) {
                    return cm.user.name;
                  } else if (cm.user?.firstName || cm.user?.lastName) {
                    return `${cm.user.firstName || ''} ${cm.user.lastName || ''}`.trim();
                  } else {
                    return '멤버';
                  }
                }).join(', ') || '알 수 없음'}` :
                (showMerged && ownerInfo.isMergedSlot && ownerInfo.mergedDuration ?
                  `${ownerInfo.subject || ownerInfo.name} - 병합됨 (${ownerInfo.mergedDuration}분)` :
                  ownerInfo.subject || ownerInfo.name)
              }
            >
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
