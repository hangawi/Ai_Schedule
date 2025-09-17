import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CustomAlertModal from '../modals/CustomAlertModal';
import TimetableControls from './TimetableControls';
import WeekView from './WeekView';

const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const dayNamesKorean = ['월', '화', '수', '목', '금'];

// Helper function to get the Monday of the current week
const getMondayOfCurrentWeek = (date) => {
  const d = new Date(date);
  const day = d.getUTCDay(); // Sunday - 0, Monday - 1, ..., Saturday - 6
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const TimetableGrid = ({
  roomId,
  roomSettings,
  timeSlots,
  members = [],
  roomData,
  onSlotSelect,
  currentUser,
  isRoomOwner,
  onAssignSlot,
  onRequestSlot,
  onRemoveSlot,
  onDirectSubmit,
  selectedSlots = [],
  events,
  proposals,
  calculateEndTime,
  onWeekChange, // New prop to pass current week start date to parent
  initialStartDate, // New prop to set the initial week to display
  onOpenNegotiation, // New prop to handle negotiation modal opening
  onCurrentWeekNegotiationsChange // New prop to pass current week negotiations to parent
}) => {

  // CustomAlert 상태
  const [customAlert, setCustomAlert] = useState({ show: false, message: '' });
  const showAlert = (message) => setCustomAlert({ show: true, message });
  const closeAlert = () => setCustomAlert({ show: false, message: '' });
  
  // 최근 요청 추적 (중복 방지)
  const [recentRequests, setRecentRequests] = useState(new Set());
  
  const [weekDates, setWeekDates] = useState([]);

  useEffect(() => {
    const today = new Date();
    // If it's Sunday, show next week's calendar starting Monday
    // This logic is already in getMondayOfCurrentWeek, but let's ensure today is a weekday for initial calculation
    let startDay = new Date(today);
    if (startDay.getUTCDay() === 0) { // If today is Sunday, start from tomorrow (Monday)
      startDay.setUTCDate(startDay.getUTCDate() + 1);
    } else if (startDay.getUTCDay() === 6) { // If today is Saturday, start from next Monday
      startDay.setUTCDate(startDay.getUTCDate() + 2);
    }

    const mondayOfCurrentWeek = getMondayOfCurrentWeek(startDay);

    const dates = [];
    let currentDay = new Date(mondayOfCurrentWeek);
    for (let i = 0; i < 5; i++) { // Generate 5 weekdays (Mon-Fri for current week)
      // Skip Saturday and Sunday
      while (currentDay.getUTCDay() === 0 || currentDay.getUTCDay() === 6) {
        currentDay.setUTCDate(currentDay.getUTCDate() + 1);
      }

      const month = String(currentDay.getUTCMonth() + 1).padStart(2, '0');
      const dayOfMonth = String(currentDay.getUTCDate()).padStart(2, '0');
      const dayName = dayNamesKorean[currentDay.getUTCDay() - 1]; // Monday is 1, so -1 for 0-indexed array
      dates.push({ fullDate: new Date(currentDay), display: `${dayName} (${month}.${dayOfMonth})` });

      currentDay.setUTCDate(currentDay.getUTCDate() + 1); // Move to the next day
    }
    setWeekDates(dates);

    // Call onWeekChange with the start date of the first week displayed
    if (onWeekChange && dates.length > 0) {
      const weekStartDate = dates[0].fullDate.toISOString().split('T')[0];
      onWeekChange(weekStartDate); // Pass YYYY-MM-DD format
    }
  }, [onWeekChange]);


  const days = ['월', '화', '수', '목', '금']; // Display labels (not used for logic)
  const timeSlotsInDay = []; // 30-minute intervals for one day

  // Handle both old and new room settings structure
  const getHourFromSettings = (setting, defaultValue) => {
    if (!setting) return parseInt(defaultValue, 10);
    if (typeof setting === 'string') return parseInt(String(setting).split(':')[0], 10);
    if (typeof setting === 'number') return setting;
    return parseInt(defaultValue, 10);
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

  // Helper function to check if a time slot is covered by a room exception
  const getRoomExceptionInfo = useCallback((date, time) => {
    if (!roomSettings?.roomExceptions || roomSettings.roomExceptions.length === 0) {
      return null;
    }

    const slotDateTime = new Date(date);
    slotDateTime.setHours(parseInt(time.split(':')[0]), parseInt(time.split(':')[1]), 0, 0);
    const slotEndTime = new Date(date);
    slotEndTime.setHours(parseInt(time.split(':')[0]), parseInt(time.split(':')[1]) + 30, 0, 0);

    const exception = roomSettings.roomExceptions.find(ex => {
      if (ex.type === 'daily_recurring') {
        const slotDayOfWeek = date.getUTCDay(); // 0 for Sunday, 1 for Monday, etc.
        if (slotDayOfWeek === ex.dayOfWeek) {
          return time >= ex.startTime && time < ex.endTime;
        }
      } else if (ex.type === 'date_specific') {
        const exStartDate = new Date(ex.startDate);
        const exEndDate = new Date(ex.endDate);
        
        // Check if the slot overlaps with the exception date range
        return (slotDateTime < exEndDate && slotEndTime > exStartDate);
      }
      return false;
    });

    return exception || null;
  }, [roomSettings?.roomExceptions]);

  // Don't filter out blocked times - we want to show them as blocked
  const filteredTimeSlotsInDay = timeSlotsInDay;

  // Use selectedSlots from props instead of internal state
  const currentSelectedSlots = useMemo(() => {
    // Expect incoming selectedSlots as objects: { day: 'monday', startTime: '09:00', ... }
    return (selectedSlots || []).map(slot => ({
      day: slot.day,
      startTime: slot.startTime
    })).filter(slot => !!slot.day && !!slot.startTime);
  }, [selectedSlots]);

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [slotToRequest, setSlotToRequest] = useState(null);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [slotToAssign, setSlotToAssign] = useState(null);

  const [showChangeRequestModal, setShowChangeRequestModal] = useState(false);
  const [slotToChange, setSlotToChange] = useState(null);

  // Helper to check if a slot is under negotiation
  const getNegotiationInfo = useCallback((date, time) => {
    if (!roomData?.negotiations || roomData.negotiations.length === 0) return null;

    const negotiation = roomData.negotiations.find(neg => {
      if (neg.status !== 'active') return false;

      const negDate = new Date(neg.slotInfo.date);
      const dateMatch = negDate.toISOString().split('T')[0] === date.toISOString().split('T')[0];
      const timeMatch = time.trim() === neg.slotInfo.startTime.trim();

      return dateMatch && timeMatch;
    });

    return negotiation || null;
  }, [roomData?.negotiations]);

  // Helper to get current week's negotiations
  const getCurrentWeekNegotiations = useCallback(() => {
    if (!roomData?.negotiations || !weekDates || weekDates.length === 0) return [];

    const currentWeekNegotiations = [];

    weekDates.forEach((dateInfo, dayIndex) => {
      timeSlotsInDay.forEach(time => {
        const negotiationInfo = getNegotiationInfo(dateInfo.fullDate, time);
        if (negotiationInfo) {
          currentWeekNegotiations.push({
            ...negotiationInfo,
            dayIndex,
            time,
            date: dateInfo.fullDate,
            dayDisplay: dateInfo.display
          });
        }
      });
    });

    return currentWeekNegotiations;
  }, [roomData?.negotiations, weekDates, getNegotiationInfo]);

  // Notify parent component about current week's negotiations
  useEffect(() => {
    if (onCurrentWeekNegotiationsChange) {
      const currentWeekNegotiations = getCurrentWeekNegotiations();
      onCurrentWeekNegotiationsChange(currentWeekNegotiations);
    }
  }, [getCurrentWeekNegotiations, onCurrentWeekNegotiationsChange]);

  // Helper to get who booked a slot (based on Date object overlap)
  const getSlotOwner = useCallback((date, time) => {
    if (!timeSlots || !members || !time || !date) return null;

    // Check if this slot is under negotiation first
    const negotiationInfo = getNegotiationInfo(date, time);
    if (negotiationInfo) {
      return {
        name: '협의중',
        color: '#F59E0B', // Orange color for negotiation
        userId: 'negotiation',
        actualUserId: 'negotiation',
        subject: '협의중',
        isNegotiation: true,
        negotiationData: negotiationInfo
      };
    }

    const bookedSlot = (timeSlots || []).find(booked => {
      // Defensive check for data integrity
      if (!booked || !booked.date || !booked.startTime) return false;

      // Robust comparison using date and time
      const bookedDate = new Date(booked.date);
      const dateMatch = bookedDate.toISOString().split('T')[0] === date.toISOString().split('T')[0];
      const timeMatch = time.trim() === booked.startTime.trim();

      return dateMatch && timeMatch;
    });

    // 방장의 개인 시간은 시간표에서 제외 (협의에 참여하지 않음)
    if (bookedSlot && isRoomOwner && currentUser) {
      let slotUserId = bookedSlot.userId || bookedSlot.user;
      if (typeof slotUserId === 'object' && slotUserId !== null) {
        slotUserId = slotUserId._id || slotUserId.id;
      }

      const currentUserId = currentUser.id || currentUser._id;

      // 방장의 슬롯이면 null 반환 (시간표에서 제외)
      if (slotUserId && currentUserId && slotUserId.toString() === currentUserId.toString()) {
        return null;
      }
    }

    if (bookedSlot) {
      let userId = bookedSlot.userId || bookedSlot.user;

      if (typeof userId === 'object' && userId !== null) {
        userId = userId._id || userId.id;
      }

      if (!userId && bookedSlot.user) {
        userId = bookedSlot.user._id || bookedSlot.user.id;
      }

      let member = null;

      if (userId) {
        member = (members || []).find(m => {
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
        member = (members || []).find(m => {
          return m.user?.email === bookedSlot.user.email;
        });
      }

      if (member) {
        const memberData = member.user || member;
        const memberName = memberData.name ||
                         `${memberData.firstName || ''} ${memberData.lastName || ''}`.trim() ||
                         `${bookedSlot.user?.firstName || ''} ${bookedSlot.user?.lastName || ''}`.trim() ||
                         '알 수 없음';

        const actualUserId = member.user?._id || member.user?.id || member._id || member.id;

        return {
          name: memberName,
          color: member.color || '#6B7280',
          userId: userId || bookedSlot.user?.email, // Use email as fallback identifier
          actualUserId: actualUserId,
          subject: bookedSlot.subject // Pass subject from bookedSlot
        };
      }

      return { name: '알 수 없음', color: '#6B7280', userId: null, subject: bookedSlot.subject };
    }

    return null;
  }, [timeSlots, members, getNegotiationInfo]);

  // Helper to check if a slot is selected by the current user (uses currentSelectedSlots)
  const isSlotSelected = (date, time) => {
    // Add defensive check for date
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      console.warn('isSlotSelected received an invalid date:', date);
      return false; // Or handle as appropriate
    }
    const dayKey = dayNames[date.getUTCDay() % 5];
    return currentSelectedSlots.some(s => s.day === dayKey && s.startTime === time);
  };

  // Function to handle slot click
  const handleSlotClick = useCallback((date, time) => {

    const isBlocked = !!getBlockedTimeInfo(time);
    const ownerInfo = getSlotOwner(date, time);
    const isOwnedByCurrentUser = ownerInfo && currentUser && (
      ownerInfo.userId === currentUser.id || 
      ownerInfo.userId === currentUser.email ||
      ownerInfo.userId === currentUser._id
    );
    

    if (isBlocked) {
      return;
    }

    if (ownerInfo) {
      // Check if this is a negotiation slot
      if (ownerInfo.isNegotiation) {
        // Open negotiation modal
        if (onOpenNegotiation) {
          onOpenNegotiation(ownerInfo.negotiationData);
        } else {
          showAlert('이 시간대는 현재 협의 중입니다. 협의가 완료될 때까지 기다려주세요.');
        }
        return;
      }

      if (isOwnedByCurrentUser) {
        if (onRemoveSlot && window.confirm('이 시간을 삭제하시겠습니까?')) {
          const [hour, minute] = time.split(':').map(Number);
          const endHour = minute === 30 ? hour + 1 : hour;
          const endMinute = minute === 30 ? 0 : minute + 30;

          onRemoveSlot({
            date: date, // Pass date object
            day: dayNames[date.getUTCDay() % 5],
            startTime: time,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`
          });
        }
      } else {
        const requestKey = `${date.toISOString().split('T')[0]}-${time}-${ownerInfo.actualUserId || ownerInfo.userId}`;
        
        if (recentRequests.has(requestKey)) {
          showAlert('이미 이 시간대에 대한 교환 요청을 보냈습니다. 기존 요청이 처리될 때까지 기다려주세요.');
          return;
        }
        
        const existingSwapRequest = (roomData?.requests || []).find(request => {
          const requesterId = request.requester?.id || request.requester?._id || request.requester;
          const requestDate = new Date(request.timeSlot?.date);
          return request.status === 'pending' &&
            request.type === 'slot_swap' &&
            (requesterId === currentUser?.id || requesterId?.toString() === currentUser?.id?.toString()) &&
            requestDate.toISOString().split('T')[0] === date.toISOString().split('T')[0] &&
            request.timeSlot?.startTime === time &&
            request.targetUserId === (ownerInfo.actualUserId || ownerInfo.userId);
        });

        if (existingSwapRequest) {
          showAlert('이미 이 시간대에 대한 교환 요청을 보냈습니다. 기존 요청이 처리될 때까지 기다려주세요.');
          return;
        }
        
        setRecentRequests(prev => new Set([...prev, requestKey]));
        
        setTimeout(() => {
          setRecentRequests(prev => {
            const newSet = new Set(prev);
            newSet.delete(requestKey);
            return newSet;
          });
        }, 5000);
        
        const existingSlot = (timeSlots || []).find(slot => 
          new Date(slot.date).toISOString().split('T')[0] === date.toISOString().split('T')[0] &&
          slot.startTime === time &&
          (slot.user === ownerInfo.actualUserId || slot.user === ownerInfo.userId || 
           slot.user?.toString() === ownerInfo.actualUserId || slot.user?.toString() === ownerInfo.userId)
        );

        setSlotToChange({ 
          date: date, // Pass date object
          time, 
          currentOwner: ownerInfo.name, 
          targetUserId: ownerInfo.actualUserId || ownerInfo.userId,
          action: 'swap',
          targetSlot: { 
            date: date, // Pass date object
            day: dayNames[date.getUTCDay() % 5],
            startTime: time,
            endTime: calculateEndTime ? calculateEndTime(time) : (() => {
              const [h, m] = time.split(':').map(Number);
              const eh = m === 30 ? h + 1 : h;
              const em = m === 30 ? 0 : m + 30;
              return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
            })(),
            subject: existingSlot?.subject || '교환 대상', 
            user: ownerInfo.actualUserId || ownerInfo.userId 
          }
        });
        setShowChangeRequestModal(true);
      }
    } else { // Empty slot
      if (isRoomOwner) {
        setSlotToAssign({ date: date, time }); // Pass date object
        setShowAssignModal(true);
      } else {
        const daysKey = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        const isSelected = (selectedSlots || []).some(s => s.day === daysKey[date.getUTCDay() % 5] && s.startTime === time);
        
        let newSelectedSlots;
        if (isSelected) {
          newSelectedSlots = (selectedSlots || []).filter(s => !(s.day === daysKey[date.getUTCDay() % 5] && s.startTime === time));
        }
        else {
          const [hour, minute] = time.split(':').map(Number);
          const endHour = minute === 30 ? hour + 1 : hour;
          const endMinute = minute === 30 ? 0 : minute + 30;
          
          const newSlot = {
            date: date, // Pass date object
            day: daysKey[date.getUTCDay() % 5],
            startTime: time,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
            subject: '새 일정'
          };
          newSelectedSlots = [...(selectedSlots || []), newSlot];
        }
        
        if (onSlotSelect) onSlotSelect(newSelectedSlots);
      }
    }
  }, [
    getBlockedTimeInfo,
    getSlotOwner,
    currentUser,
    isRoomOwner,
    onRemoveSlot,
    calculateEndTime,
    selectedSlots,
    onSlotSelect,
    recentRequests,
    roomData?.requests,
    timeSlots,
    onRequestSlot
  ]);

  // Function to handle assignment from modal
  const handleAssign = useCallback((memberId) => {
    if (slotToAssign && slotToAssign.time && memberId && onAssignSlot) {
      const [hour, minute] = slotToAssign.time.split(':').map(Number);
      const endHour = minute === 30 ? hour + 1 : hour;
      const endMinute = minute === 30 ? 0 : minute + 30;

      const assignmentData = {
        date: slotToAssign.date, // Pass date object
        day: dayNames[slotToAssign.date.getUTCDay() % 5],
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
          date: slotToRequest.date, // Pass date object
          day: dayNames[slotToRequest.date.getUTCDay() % 5],
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
            date: slotToChange.date, // Pass date object
            day: dayNames[slotToChange.date.getUTCDay() % 5],
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
            date: slotToChange.date, // Pass date object
            day: dayNames[slotToChange.date.getUTCDay() % 5],
            startTime: slotToChange.time,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
            subject: (() => {
              const existingSlot = (timeSlots || []).find(slot => 
                new Date(slot.date).toISOString().split('T')[0] === slotToChange.date.toISOString().split('T')[0] &&
                slot.startTime === slotToChange.time &&
                (slot.user === currentUser?.id || slot.user?.toString() === currentUser?.id?.toString())
              );
              return existingSlot?.subject || '요청자 시간';
            })()
          },
          targetUserId: slotToChange.targetUserId,
          targetSlot: slotToChange.targetSlot, 
          message: message || '시간 교환을 요청합니다.',
        };
      } else {
        // Original change request
        requestData = {
          roomId: roomId,
          type: 'time_change',
          timeSlot: {
            date: slotToChange.date, // Pass date object
            day: dayNames[slotToChange.date.getUTCDay() % 5],
            startTime: slotToChange.time,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
            subject: (() => {
              const existingSlot = (timeSlots || []).find(slot => 
                new Date(slot.date).toISOString().split('T')[0] === slotToChange.date.toISOString().split('T')[0] &&
                slot.startTime === slotToChange.time &&
                (slot.user === currentUser?.id || slot.user?.toString() === currentUser?.id?.toString())
              );
              return existingSlot?.subject || '변경 요청';
            })()
          },
          targetSlot: {
            date: slotToChange.date, // Pass date object
            day: dayNames[slotToChange.date.getUTCDay() % 5],
            startTime: slotToChange.time,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
            subject: (() => {
              const existingSlot = (timeSlots || []).find(slot => 
                new Date(slot.date).toISOString().split('T')[0] === slotToChange.date.toISOString().split('T')[0] &&
                slot.startTime === slotToChange.time &&
                (slot.user === currentUser?.id || slot.user?.toString() === currentUser?.id?.toString())
              );
              return existingSlot?.subject || '변경 대상';
            })(),
            user: currentUser?.id
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
        weekDates={weekDates} // Pass weekDates to WeekView
        days={days}
        getSlotOwner={getSlotOwner}
        isSlotSelected={isSlotSelected}
                getBlockedTimeInfo={getBlockedTimeInfo} 
        getRoomExceptionInfo={getRoomExceptionInfo} 
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
              {days[slotToAssign.date.getUTCDay() % 5]}요일 {slotToAssign.time} 시간을 누구에게 배정하시겠습니까?
            </p>
            <select className="w-full p-2 border rounded mb-4" onChange={(e) => handleAssign(e.target.value)} value="">
              <option value="">조원 선택</option>
              {(members || [])
                .filter(member => {
                  const memberId = member._id || member.user?._id || member.id || member.user?.id;
                  const currentUserId = currentUser?.id || currentUser?._id;
                  return memberId !== currentUserId; // 방장(현재 사용자) 제외
                })
                .map(member => (
                  <option key={member._id || member.user?._id || member.id || member.user?.id} value={member._id || member.user?._id || member.id || member.user?.id}>
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
              {days[slotToRequest.date.getUTCDay() % 5]}요일 {slotToRequest.time} 시간을 요청하시겠습니까?
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
                `${days[slotToChange.date.getUTCDay() % 5]}요일 ${slotToChange.time} 시간을 취소하시겠습니까?` :
               slotToChange.action === 'swap' ? 
                `${slotToChange.currentOwner}님의 ${days[slotToChange.date.getUTCDay() % 5]}요일 ${slotToChange.time} 시간과 교환을 요청하시겠습니까?` :
                `${days[slotToChange.date.getUTCDay() % 5]}요일 ${slotToChange.time} 시간을 변경 요청하시겠습니까?`
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
