import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CustomAlertModal from '../modals/CustomAlertModal';
import TimetableControls from './TimetableControls';
import WeekView from './WeekView';

const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

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

const TimetableGrid = ({ roomId, roomSettings, timeSlots, members, roomData, onSlotSelect, currentUser, isRoomOwner, onAssignSlot, onRequestSlot, onRemoveSlot, onDirectSubmit, selectedSlots, events, proposals, calculateEndTime }) => {

  // CustomAlert 상태
  const [customAlert, setCustomAlert] = useState({ show: false, message: '' });
  const showAlert = (message) => setCustomAlert({ show: true, message });
  const closeAlert = () => setCustomAlert({ show: false, message: '' });
  
  // 최근 요청 추적 (중복 방지)
  const [recentRequests, setRecentRequests] = useState(new Set());
  
  const [weekDates, setWeekDates] = useState([]);

  useEffect(() => {
    const today = new Date();
    // If it's Sunday, we want to show next week's calendar
    if (today.getUTCDay() === 0) {
      today.setUTCDate(today.getUTCDate() + 1);
    }
    const monday = getMondayOfCurrentWeek(today);

    const dates = [];
    const dayNamesKorean = ['월', '화', '수', '목', '금'];
    for (let i = 0; i < 5; i++) {
      const date = new Date(monday);
      date.setUTCDate(monday.getUTCDate() + i);
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const dayOfMonth = String(date.getUTCDate()).padStart(2, '0');
      dates.push(`${dayNamesKorean[i]} (${month}.${dayOfMonth})`);
    }
    setWeekDates(dates);
  }, []);

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

  // Use selectedSlots from props instead of internal state
  const currentSelectedSlots = useMemo(() => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    return selectedSlots?.map(slot => {
      const dayIndex = days.indexOf(slot.day);
      return {
        dayIndex,
        time: slot.startTime
      };
    }).filter(slot => slot.dayIndex !== -1) || [];
  }, [selectedSlots]);

  

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [slotToRequest, setSlotToRequest] = useState(null);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [slotToAssign, setSlotToAssign] = useState(null);

  const [showChangeRequestModal, setShowChangeRequestModal] = useState(false);
  const [slotToChange, setSlotToChange] = useState(null);


  // selectedSlots are now managed by parent component via props

  // Helper to get who booked a slot (based on Date object overlap)
  // Helper to get who booked a slot
  const getSlotOwner = useCallback((dayIndex, time) => {
    if (!timeSlots || !members || !time) return null;
    
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
  }, [timeSlots, members]);

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
        
        // 중복 교환 요청 확인 (로컬 및 서버 모두 체크)
        const requestKey = `${dayNames[dayIndex]}-${time}-${ownerInfo.actualUserId || ownerInfo.userId}`;
        
        // 1. 최근 요청 로컬 체크 (즉시 중복 방지)
        if (recentRequests.has(requestKey)) {
          showAlert('이미 이 시간대에 대한 교환 요청을 보냈습니다. 기존 요청이 처리될 때까지 기다려주세요.');
          return;
        }
        
        // 2. 서버 데이터 체크
        const existingSwapRequest = roomData?.requests?.find(request => {
          const requesterId = request.requester?.id || request.requester?._id || request.requester;
          return request.status === 'pending' &&
            request.type === 'slot_swap' &&
            (requesterId === currentUser?.id || requesterId?.toString() === currentUser?.id?.toString()) &&
            request.timeSlot?.day === dayNames[dayIndex] &&
            request.timeSlot?.startTime === time &&
            request.targetUserId === (ownerInfo.actualUserId || ownerInfo.userId);
        });

        if (existingSwapRequest) {
          showAlert('이미 이 시간대에 대한 교환 요청을 보냈습니다. 기존 요청이 처리될 때까지 기다려주세요.');
          return;
        }
        
        // 3. 요청 진행 - 로컬 상태에 추가
        setRecentRequests(prev => new Set([...prev, requestKey]));
        
        // 5초 후 로컬 상태에서 제거 (실제 서버 응답 시간 고려)
        setTimeout(() => {
          setRecentRequests(prev => {
            const newSet = new Set(prev);
            newSet.delete(requestKey);
            return newSet;
          });
        }, 5000);
        
        // Find the actual existing slot to get the subject
        const existingSlot = timeSlots.find(slot => 
          slot.day === dayNames[dayIndex] &&
          slot.startTime === time &&
          (slot.user === ownerInfo.actualUserId || slot.user === ownerInfo.userId || 
           slot.user?.toString() === ownerInfo.actualUserId || slot.user?.toString() === ownerInfo.userId)
        );

        setSlotToChange({ 
          dayIndex, 
          time, 
          currentOwner: ownerInfo.name, 
          targetUserId: ownerInfo.actualUserId || ownerInfo.userId,
          action: 'swap',
          targetSlot: { // This is the slot the target user is giving away
            day: dayNames[dayIndex], // dayNames is available
            startTime: time,
            endTime: calculateEndTime(time), // calculateEndTime is now available
            subject: existingSlot?.subject || '교환 대상', // Use existing subject or fallback
            user: ownerInfo.actualUserId || ownerInfo.userId // The current owner of this slot
          }
        });
        setShowChangeRequestModal(true);
      }
    } else { // Empty slot
      if (isRoomOwner) {
        // Room owner clicks empty slot - show assignment modal
        setSlotToAssign({ dayIndex, time });
        setShowAssignModal(true);
      } else {
        // Members can select empty slots
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        const isSelected = selectedSlots.some(s => s.day === days[dayIndex] && s.startTime === time);
        
        let newSelectedSlots;
        if (isSelected) {
          // Remove the slot
          newSelectedSlots = selectedSlots.filter(s => !(s.day === days[dayIndex] && s.startTime === time));
        } else {
          // Add the slot
          const [hour, minute] = time.split(':').map(Number);
          const endHour = minute === 30 ? hour + 1 : hour;
          const endMinute = minute === 30 ? 0 : minute + 30;
          
          const newSlot = {
            day: days[dayIndex],
            startTime: time,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
            subject: '새 일정'
          };
          newSelectedSlots = [...selectedSlots, newSlot];
        }
        
        onSlotSelect(newSelectedSlots);
      }
    }
  }, [getBlockedTimeInfo, getSlotOwner, currentUser, isRoomOwner, onRemoveSlot, calculateEndTime, selectedSlots, onSlotSelect, recentRequests, roomData?.requests, timeSlots]);

  // Function to handle assignment from modal
  const handleAssign = useCallback((memberId) => {
    if (slotToAssign && slotToAssign.time && memberId && onAssignSlot) {
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
  }, [slotToAssign, onAssignSlot, roomId]);

  // Function to handle request from modal
  const handleRequest = useCallback((message) => {
    if (slotToRequest && slotToRequest.time && onRequestSlot) {
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
  }, [slotToRequest, onRequestSlot, roomId]);

  // Function to handle change request from modal
  const handleChangeRequest = useCallback((message) => {
    if (slotToChange && slotToChange.time && onRequestSlot) {
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
            subject: (() => {
              // Find the existing slot for current user at this time
              const existingSlot = timeSlots.find(slot => 
                slot.day === dayNames[slotToChange.dayIndex] &&
                slot.startTime === slotToChange.time &&
                (slot.user === currentUser.id || slot.user?.toString() === currentUser.id?.toString())
              );
              return existingSlot?.subject || '요청자 시간';
            })()
          },
          targetUserId: slotToChange.targetUserId,
          targetSlot: slotToChange.targetSlot, // This is the slot the target user is giving away
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
            subject: (() => {
              // Find the existing slot for current user at this time
              const existingSlot = timeSlots.find(slot => 
                slot.day === dayNames[slotToChange.dayIndex] &&
                slot.startTime === slotToChange.time &&
                (slot.user === currentUser.id || slot.user?.toString() === currentUser.id?.toString())
              );
              return existingSlot?.subject || '변경 요청';
            })()
          },
          targetSlot: {
            day: dayNames[slotToChange.dayIndex],
            startTime: slotToChange.time,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
            subject: (() => {
              // Find the existing slot for current user at this time
              const existingSlot = timeSlots.find(slot => 
                slot.day === dayNames[slotToChange.dayIndex] &&
                slot.startTime === slotToChange.time &&
                (slot.user === currentUser.id || slot.user?.toString() === currentUser.id?.toString())
              );
              return existingSlot?.subject || '변경 대상';
            })(),
            user: currentUser.id
          },
          message: message || '시간 변경 요청합니다.',
        };
      }

      onRequestSlot(requestData);
      setShowChangeRequestModal(false);
      setSlotToChange(null);
    }
  }, [slotToChange, onRequestSlot, roomId, currentUser, timeSlots]);

  return (
    <div className="timetable-grid border border-gray-200 rounded-lg overflow-hidden">
      {/* Header Row (Days) */}
      <TimetableControls weekDates={weekDates} days={days} />

      {/* Time Rows */}
      <WeekView 
        filteredTimeSlotsInDay={filteredTimeSlotsInDay}
        days={days}
        getSlotOwner={getSlotOwner}
        isSlotSelected={isSlotSelected}
        getBlockedTimeInfo={getBlockedTimeInfo}
        isRoomOwner={isRoomOwner}
        currentUser={currentUser}
        handleSlotClick={handleSlotClick}
      />

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

      {/* CustomAlert Modal */}
      <CustomAlertModal
        isOpen={customAlert.show}
        onClose={closeAlert}
        title="알림"
        message={customAlert.message}
        type="warning"
        showCancel={false}
      />
    </div>
  );
};

export default TimetableGrid;
