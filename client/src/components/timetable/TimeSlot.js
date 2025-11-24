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
        ${isEffectivelyBlocked ? 'cursor-not-allowed' : ''}
        ${!isEffectivelyBlocked && !ownerInfo && isSelected ? 'bg-blue-200 border-2 border-blue-400' : ''}
        ${!isEffectivelyBlocked && !ownerInfo && !isSelected && currentUser ? 'hover:bg-blue-50 cursor-pointer' : ''}
        ${!isEffectivelyBlocked && ownerInfo && currentUser ? 'cursor-pointer hover:opacity-80' : ''}
        ${!isEffectivelyBlocked && isRoomOwner && !ownerInfo ? 'cursor-pointer hover:bg-green-50' : ''}
      `}
      style={!isEffectivelyBlocked && ownerInfo ? { backgroundColor: `${ownerInfo.color}20`, borderColor: ownerInfo.color } :
             // 방장의 불가능한 시간 (non_preferred) - 연한 보라/라벤더
             isEffectivelyBlocked && blockedInfo?.ownerScheduleType === 'non_preferred' ? { backgroundColor: '#E9D5FF', borderColor: '#C084FC' } :
             // 방장의 개인시간 (personal) - 연한 주황/피치
             isEffectivelyBlocked && blockedInfo?.ownerScheduleType === 'personal' ? { backgroundColor: '#FED7AA', borderColor: '#FB923C' } :
             // 방장의 예외일정 (exception) - 연한 노란색
             isEffectivelyBlocked && blockedInfo?.ownerScheduleType === 'exception' ? { backgroundColor: '#FEF3C7', borderColor: '#FBBF24' } :
             // 그 외 roomException - 연한 청록
             isEffectivelyBlocked && roomExceptionInfo && !blockedInfo?.ownerScheduleType ? { backgroundColor: '#99F6E4', borderColor: '#2DD4BF' } :
             // 기타 blocked - 연한 회색 (fallback)
             isEffectivelyBlocked && !blockedInfo?.ownerScheduleType && !roomExceptionInfo ? { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' } : {}
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
              className={`text-xs font-medium px-1 py-0.5 rounded ${showMerged && ownerInfo.isMergedSlot ? 'border-2' : ''}`}
              style={{
                color: ownerInfo.textColor || ownerInfo.color,
                backgroundColor: `${ownerInfo.color}10`,
                ...(showMerged && ownerInfo.isMergedSlot ? {
                  borderColor: ownerInfo.color,
                  borderStyle: 'solid'
                } : {})
              }}
              title={ownerInfo.isTravel && ownerInfo.travelInfo ? `${ownerInfo.subject} (${ownerInfo.travelInfo.durationText})` :
                (showMerged && ownerInfo.isMergedSlot && ownerInfo.mergedDuration ?
                  `${ownerInfo.subject || ownerInfo.name} - 병합됨 (${ownerInfo.mergedDuration}분)` :
                  ownerInfo.subject || ownerInfo.name)
              }
            >
              {ownerInfo.isTravel ? ownerInfo.subject : (ownerInfo.name.length > 6 ? ownerInfo.name.substring(0, 4) + '...' : ownerInfo.name)}
              {ownerInfo.isTravel && ownerInfo.travelInfo && (
                <div className="text-xs text-gray-600">
                  {ownerInfo.travelInfo.durationText}
                </div>
              )}
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
