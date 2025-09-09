import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

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

const TimetableGrid = ({ roomId, roomSettings, timeSlots, members, onSlotSelect, currentUser, isRoomOwner, onAssignSlot, onRequestSlot, onRemoveSlot, onDirectSubmit, selectedSlots, events, proposals }) => {
  
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
  const getBlockedTimeInfo = useCallback((time) => {
    if (!roomSettings?.blockedTimes || roomSettings.blockedTimes.length === 0) {
      return null;
    }
    
    const blockedTime = roomSettings.blockedTimes.find(blockedTime => {
      return time >= blockedTime.startTime && time < blockedTime.endTime;
    });
    
    return blockedTime || null;
  }, [roomSettings?.blockedTimes]);

  // Don't filter out blocked times - we want to show them as blocked
  const filteredTimeSlotsInDay = timeSlotsInDay;

  const [currentSelectedSlots, setCurrentSelectedSlots] = useState([]);

  

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [slotToRequest, setSlotToRequest] = useState(null);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [slotToAssign, setSlotToAssign] = useState(null);

  const [showChangeRequestModal, setShowChangeRequestModal] = useState(false);
  const [slotToChange, setSlotToChange] = useState(null);

  // Calculate the Monday of the current week once
  const mondayOfCurrentWeek = useMemo(() => getMondayOfCurrentWeek(new Date()), []);

  // Effect to notify parent about selected slots (in new format)
  useEffect(() => {
    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const selectedSlots = currentSelectedSlots.map(slot => {
      if (!slot.time) return null;
      const [hour, minute] = slot.time.split(':').map(Number);
      const endHour = minute === 30 ? hour + 1 : hour;
      const endMinute = minute === 30 ? 0 : minute + 30;
      
      return {
        day: dayNames[slot.dayIndex],
        startTime: slot.time,
        endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
        subject: '새 일정' // Default subject
      };
    }).filter(slot => slot !== null);
    onSlotSelect(selectedSlots);
  }, [currentSelectedSlots, onSlotSelect]);

  // Helper to get who booked a slot (based on Date object overlap)
  // Helper to get who booked a slot (SIMPLIFIED FOR DEBUGGING)
  // Helper to get who booked a slot (SIMPLIFIED FOR DEBUGGING)
  const getSlotOwner = useCallback((dayIndex, time) => {
    if (!timeSlots || !members || !time) return null;
    
    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const currentDayName = dayNames[dayIndex];

    const bookedSlot = timeSlots.find(booked => {
      // Defensive check for data integrity
      if (!booked || !booked.day || !booked.startTime) return false;

      // Robust comparison
      const dayMatch = currentDayName.trim().toLowerCase() === booked.day.trim().toLowerCase();
      const timeMatch = time.trim() === booked.startTime.trim();

      return dayMatch && timeMatch;
    });

    if (bookedSlot) {
      // Extract userId from multiple possible sources (handle both id and _id)
      let userId = bookedSlot.userId || bookedSlot.user;
      
      if (typeof userId === 'object' && userId !== null) {
        userId = userId._id || userId.id;
      }
      
      // Try direct access to user._id and user.id if userId is still undefined
      if (!userId && bookedSlot.user) {
        userId = bookedSlot.user._id || bookedSlot.user.id;
      }
      
      // Since we don't have userId, try to match by email instead
      let member = null;
      
      if (userId) {
        // Find member with flexible matching - check both direct properties and user object
        member = members.find(m => {
          // Try multiple ways to match member ID
          const memberDirectId = m.id || m._id;
          const memberUserId = m.user?.id || m.user?._id;
          const memberUserIdString = m.user?._id?.toString() || m.user?.id?.toString();
          
          return (
            memberDirectId?.toString() === userId.toString() ||
            memberUserId?.toString() === userId.toString() ||
            memberUserIdString === userId.toString()
          );
        });
      } else if (bookedSlot.user && bookedSlot.user.email) {
        // Fallback: match by email if no userId available
        member = members.find(m => {
          return m.user?.email === bookedSlot.user.email;
        });
      }
      
      if (member) {
        // Extract name from member object (could be in user property or directly on member)
        const memberData = member.user || member;
        const memberName = memberData.name || 
                         `${memberData.firstName || ''} ${memberData.lastName || ''}`.trim() ||
                         // If member doesn't have name, try bookedSlot.user
                         `${bookedSlot.user?.firstName || ''} ${bookedSlot.user?.lastName || ''}`.trim() ||
                         '알 수 없음';
        
        const actualUserId = member.user?._id || member.user?.id || member._id || member.id;
        
        return {
          name: memberName,
          color: member.color || '#6B7280',
          userId: userId || bookedSlot.user?.email, // Use email as fallback identifier
          actualUserId: actualUserId // Real user ID for targeting
        };
      }
      
      return { name: '알 수 없음', color: '#6B7280', userId: null };
    }
    
    return null;
  }, [timeSlots, members, currentUser]);

  // Helper to check if a slot is selected by the current user
  const isSlotSelected = (dayIndex, time) => {
    return currentSelectedSlots.some(s => s.dayIndex === dayIndex && s.time === time);
  };

  // Function to handle slot click
  const handleSlotClick = useCallback((dayIndex, time) => {
    const isBlocked = !!getBlockedTimeInfo(time);
    const ownerInfo = getSlotOwner(dayIndex, time);
    // Check if current user owns this slot by ID or email
    const isOwnedByCurrentUser = ownerInfo && currentUser && (
      ownerInfo.userId === currentUser.id || 
      ownerInfo.userId === currentUser.email ||
      ownerInfo.userId === currentUser._id
    );
    

    if (isBlocked) { // Cannot interact with blocked slots
      return;
    }

    if (ownerInfo) {
      if (isOwnedByCurrentUser) {
        // User clicks on their own assigned slot - directly remove it
        if (onRemoveSlot && window.confirm('이 시간을 삭제하시겠습니까?')) {
          const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
          const [hour, minute] = time.split(':').map(Number);
          const endHour = minute === 30 ? hour + 1 : hour;
          const endMinute = minute === 30 ? 0 : minute + 30;
          
          onRemoveSlot({
            day: dayNames[dayIndex],
            startTime: time,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`
          });
        }
      } else {
        // User clicks on someone else's assigned slot - request swap
        
        setSlotToChange({ 
          dayIndex, 
          time, 
          currentOwner: ownerInfo.name, 
          targetUserId: ownerInfo.actualUserId || ownerInfo.userId,
          action: 'swap' 
        });
        setShowChangeRequestModal(true);
      }
    } else { // Empty slot
      if (!isRoomOwner) { // Only members can select empty slots
        const clickedSlotIdentifier = { dayIndex, time };
        setCurrentSelectedSlots(prev => {
          const isSelected = prev.some(s => s.dayIndex === dayIndex && s.time === time);
          if (isSelected) {
            return prev.filter(s => !(s.dayIndex === dayIndex && s.time === time));
          } else {
            return [...prev, clickedSlotIdentifier];
          }
        });
      }
      // If isRoomOwner is true, do nothing for empty slots (as per original logic)
    }
  }, [getBlockedTimeInfo, getSlotOwner, currentUser, isRoomOwner]);

  // Function to handle assignment from modal
  const handleAssign = (memberId) => {
    if (slotToAssign && slotToAssign.time && memberId && onAssignSlot) {
      const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
      const [hour, minute] = slotToAssign.time.split(':').map(Number);
      const endHour = minute === 30 ? hour + 1 : hour;
      const endMinute = minute === 30 ? 0 : minute + 30;

      const assignmentData = {
        day: dayNames[slotToAssign.dayIndex],
        startTime: slotToAssign.time,
        endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
        userId: memberId,
        roomId: roomId
      };
      onAssignSlot(assignmentData);
      setShowAssignModal(false);
      setSlotToAssign(null);
    }
  };

  // Function to handle request from modal
  const handleRequest = (message) => {
    if (slotToRequest && slotToRequest.time && onRequestSlot) {
      const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
      const [hour, minute] = slotToRequest.time.split(':').map(Number);
      const endHour = minute === 30 ? hour + 1 : hour;
      const endMinute = minute === 30 ? 0 : minute + 30;

      const requestData = {
        roomId: roomId,
        type: 'time_request', // Or 'time_change' if applicable
        timeSlot: {
          day: dayNames[slotToRequest.dayIndex],
          startTime: slotToRequest.time,
          endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
        },
        message: message || '시간 요청합니다.',
      };
      onRequestSlot(requestData);
      setShowRequestModal(false);
      setSlotToRequest(null);
    }
  };

  // Function to handle change request from modal
  const handleChangeRequest = (message) => {
    if (slotToChange && slotToChange.time && onRequestSlot) {
      const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
      const [hour, minute] = slotToChange.time.split(':').map(Number);
      const endHour = minute === 30 ? hour + 1 : hour;
      const endMinute = minute === 30 ? 0 : minute + 30;

      let requestData;

      if (slotToChange.action === 'release') {
        // Release own slot
        requestData = {
          roomId: roomId,
          type: 'slot_release',
          timeSlot: {
            day: dayNames[slotToChange.dayIndex],
            startTime: slotToChange.time,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
          },
          message: message || '시간을 취소합니다.',
        };
      } else if (slotToChange.action === 'swap') {
        // Request swap with another user
        requestData = {
          roomId: roomId,
          type: 'slot_swap',
          timeSlot: {
            day: dayNames[slotToChange.dayIndex],
            startTime: slotToChange.time,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
          },
          targetUserId: slotToChange.targetUserId,
          message: message || '시간 교환을 요청합니다.',
        };
      } else {
        // Original change request
        requestData = {
          roomId: roomId,
          type: 'time_change',
          timeSlot: {
            day: dayNames[slotToChange.dayIndex],
            startTime: slotToChange.time,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
          },
          targetSlot: {
            day: dayNames[slotToChange.dayIndex],
            startTime: slotToChange.time,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
            user: currentUser.id
          },
          message: message || '시간 변경 요청합니다.',
        };
      }

      onRequestSlot(requestData);
      setShowChangeRequestModal(false);
      setSlotToChange(null);
    }
  };

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
            const ownerInfo = getSlotOwner(dayIndex, time);
            const isSelected = isSlotSelected(dayIndex, time);
            const blockedInfo = getBlockedTimeInfo(time);
            const isBlocked = !!blockedInfo;
            
            return (
              <div
                key={`${day}-${time}`}
                className={`col-span-1 border-l border-gray-200 h-10 flex items-center justify-center
                  ${isBlocked ? 'bg-gray-300 cursor-not-allowed' : ''}
                  ${!isBlocked && !ownerInfo && isSelected && !isRoomOwner ? 'bg-blue-200 border-2 border-blue-400' : ''}
                  ${!isBlocked && !ownerInfo && !isSelected && currentUser && !isRoomOwner ? 'hover:bg-blue-50 cursor-pointer' : ''}
                  ${!isBlocked && ownerInfo && currentUser ? 'cursor-pointer hover:opacity-80' : ''}
                  ${!isBlocked && !ownerInfo && !isSelected && isRoomOwner ? 'cursor-default' : ''}
                `}
                style={!isBlocked && ownerInfo ? { backgroundColor: `${ownerInfo.color}20`, borderColor: ownerInfo.color } : {}}
                onClick={() => handleSlotClick(dayIndex, time)}
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
          })}
        </div>
      ))}

      {/* Assignment Modal Placeholder */}
      {showAssignModal && slotToAssign && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-lg font-bold mb-4">시간 배정</h3>
            <p className="mb-4">
              {days[slotToAssign.dayIndex]}요일 {slotToAssign.time} 시간을 누구에게 배정하시겠습니까?
            </p>
            <select className="w-full p-2 border rounded mb-4" onChange={(e) => handleAssign(e.target.value)}>
              <option value="">조원 선택</option>
              {members.map(member => (
                <option key={member._id || member.user?._id} value={member._id || member.user?._id}>
                  {member.user?.name || member.name || `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim()}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowAssignModal(false)}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Request Modal Placeholder */}
      {showRequestModal && slotToRequest && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-lg font-bold mb-4">시간 요청</h3>
            <p className="mb-4">
              {days[slotToRequest.dayIndex]}요일 {slotToRequest.time} 시간을 요청하시겠습니까?
            </p>
            <textarea
              className="w-full p-2 border rounded mb-4"
              placeholder="요청 메시지를 입력하세요 (선택 사항)"
              rows="3"
              id="requestMessage"
            ></textarea>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowRequestModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                취소
              </button>
              <button
                onClick={() => handleRequest(document.getElementById('requestMessage').value)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                요청하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Request Modal Placeholder */}
      {showChangeRequestModal && slotToChange && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-lg font-bold mb-4">
              {slotToChange.action === 'release' ? '시간 취소' : 
               slotToChange.action === 'swap' ? '시간 교환 요청' : '시간 변경 요청'}
            </h3>
            <p className="mb-4">
              {slotToChange.action === 'release' ? 
                `${days[slotToChange.dayIndex]}요일 ${slotToChange.time} 시간을 취소하시겠습니까?` :
               slotToChange.action === 'swap' ? 
                `${slotToChange.currentOwner}님의 ${days[slotToChange.dayIndex]}요일 ${slotToChange.time} 시간과 교환을 요청하시겠습니까?` :
                `${days[slotToChange.dayIndex]}요일 ${slotToChange.time} 시간을 변경 요청하시겠습니까?`
              }
            </p>
            <textarea
              className="w-full p-2 border rounded mb-4"
              placeholder={
                slotToChange.action === 'release' ? '취소 사유를 입력하세요 (선택 사항)' :
                slotToChange.action === 'swap' ? '교환 요청 메시지를 입력하세요 (선택 사항)' :
                '변경 요청 메시지를 입력하세요 (선택 사항)'
              }
              rows="3"
              id="changeRequestMessage"
            ></textarea>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowChangeRequestModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                취소
              </button>
              <button
                onClick={() => handleChangeRequest(document.getElementById('changeRequestMessage').value)}
                className={`px-4 py-2 text-white rounded-lg ${
                  slotToChange.action === 'release' ? 'bg-red-600 hover:bg-red-700' :
                  slotToChange.action === 'swap' ? 'bg-blue-600 hover:bg-blue-700' :
                  'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {slotToChange.action === 'release' ? '시간 취소' :
                 slotToChange.action === 'swap' ? '교환 요청' :
                 '변경 요청하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimetableGrid;