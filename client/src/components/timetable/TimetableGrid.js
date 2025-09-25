import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CustomAlertModal from '../modals/CustomAlertModal';
import TimetableControls from './TimetableControls';
import WeekView from './WeekView';

// Import utility functions
import {
  getMondayOfCurrentWeek,
  safeDateToISOString,
  generateWeekDates,
  getDayIndex,
  getBaseDate,
  createDayDisplay
} from '../../utils/dateUtils';
import {
  DAY_NAMES,
  DAY_NAMES_KOREAN,
  DAYS,
  DEFAULT_SCHEDULE_START_HOUR,
  DEFAULT_SCHEDULE_END_HOUR,
  REQUEST_TYPES,
  REQUEST_DEBOUNCE_TIME,
  CHANGE_ACTIONS,
  BUTTON_STYLES
} from '../../utils/timetableConstants';
import {
  getHourFromSettings,
  generateDayTimeSlots,
  getBlockedTimeInfo as getBlockedTimeInfoHelper,
  getRoomExceptionInfo as getRoomExceptionInfoHelper,
  getNegotiationInfo as getNegotiationInfoHelper,
  getSlotOwner as getSlotOwnerHelper,
  isSlotSelected as isSlotSelectedHelper,
  getCurrentWeekNegotiations as getCurrentWeekNegotiationsHelper
} from '../../utils/timetableHelpers';
import {
  hasExistingSwapRequest,
  isSlotOwnedByCurrentUser,
  isSlotInSelectedSlots,
  findExistingSlot,
  isRequestTooRecent
} from '../../utils/validationUtils';

// Legacy constants for backward compatibility
const dayNames = DAY_NAMES;
const dayNamesKorean = DAY_NAMES_KOREAN;

// Helper functions are now imported from utility files

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
    // Use utility function to get base date
    const baseDate = getBaseDate(initialStartDate);

    // Generate week dates using utility function
    const dates = generateWeekDates(baseDate, dayNamesKorean);
    setWeekDates(dates);

    // Call onWeekChange with the start date of the first week displayed
    if (onWeekChange && dates.length > 0) {
      const weekStartDate = dates[0].fullDate.toISOString().split('T')[0];
      onWeekChange(weekStartDate); // Pass YYYY-MM-DD format
    }
  }, [onWeekChange, initialStartDate]);


  const days = DAYS; // Display labels (not used for logic)

  // Generate time slots using utility functions
  const scheduleStartHour = getHourFromSettings(
    roomSettings?.scheduleStart || roomSettings?.startHour,
    DEFAULT_SCHEDULE_START_HOUR.toString()
  );
  const scheduleEndHour = getHourFromSettings(
    roomSettings?.scheduleEnd || roomSettings?.endHour,
    DEFAULT_SCHEDULE_END_HOUR.toString()
  );

  const timeSlotsInDay = generateDayTimeSlots(scheduleStartHour, scheduleEndHour);


  // Helper function to check if a time slot is blocked and return block info
  const getBlockedTimeInfo = useCallback((time) => {
    return getBlockedTimeInfoHelper(time, roomSettings);
  }, [roomSettings?.blockedTimes]);

  // Helper function to check if a time slot is covered by a room exception
  const getRoomExceptionInfo = useCallback((date, time) => {
    return getRoomExceptionInfoHelper(date, time, roomSettings);
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
    return getNegotiationInfoHelper(date, time, roomData);
  }, [roomData?.negotiations]);

  // Helper to get current week's negotiations
  const getCurrentWeekNegotiations = useCallback(() => {
    return getCurrentWeekNegotiationsHelper(roomData, weekDates, timeSlotsInDay, getNegotiationInfo);
  }, [roomData?.negotiations, weekDates, getNegotiationInfo, timeSlotsInDay]);

  // Notify parent component about current week's negotiations
  useEffect(() => {
    if (onCurrentWeekNegotiationsChange) {
      const currentWeekNegotiations = getCurrentWeekNegotiations();
      onCurrentWeekNegotiationsChange(currentWeekNegotiations);
    }
  }, [getCurrentWeekNegotiations, onCurrentWeekNegotiationsChange]);

  // Helper to get who booked a slot (based on Date object overlap)
  const getSlotOwner = useCallback((date, time) => {
    return getSlotOwnerHelper(
      date,
      time,
      timeSlots,
      members,
      currentUser,
      isRoomOwner,
      getNegotiationInfo
    );
  }, [timeSlots, members, currentUser, isRoomOwner, getNegotiationInfo]);

  // Helper to check if a slot is selected by the current user (uses currentSelectedSlots)
  const isSlotSelected = (date, time) => {
    return isSlotSelectedHelper(date, time, currentSelectedSlots);
  };

  // Function to handle slot click
  const handleSlotClick = useCallback((date, time) => {

    const isBlocked = !!getBlockedTimeInfo(time);
    const ownerInfo = getSlotOwner(date, time);
    const isOwnedByCurrentUser = isSlotOwnedByCurrentUser(ownerInfo, currentUser);
    

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

          const dayIndex = getDayIndex(date);
          if (dayIndex === -1) return; // Weekend, skip

          onRemoveSlot({
            date: date, // Pass date object
            day: dayNames[dayIndex],
            startTime: time,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`
          });
        }
      } else {
        const requestKey = `${date.toISOString().split('T')[0]}-${time}-${ownerInfo.actualUserId || ownerInfo.userId}`;

        if (isRequestTooRecent(recentRequests, requestKey)) {
          showAlert('이미 이 시간대에 대한 교환 요청을 보냈습니다. 기존 요청이 처리될 때까지 기다려주세요.');
          return;
        }

        if (hasExistingSwapRequest(roomData?.requests, currentUser, date, time, ownerInfo.actualUserId || ownerInfo.userId)) {
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
        }, REQUEST_DEBOUNCE_TIME);

        const existingSlot = findExistingSlot(timeSlots, date, time, ownerInfo.actualUserId || ownerInfo.userId);

        // 정확한 날짜 표시를 위한 dayDisplay 생성
        const dayDisplay = createDayDisplay(date);

        setSlotToChange({
          date: date, // Pass date object
          time,
          currentOwner: ownerInfo.name,
          targetUserId: ownerInfo.actualUserId || ownerInfo.userId,
          action: CHANGE_ACTIONS.SWAP,
          dayDisplay: dayDisplay, // 정확한 날짜 표시
          targetSlot: {
            date: date, // Pass date object
            day: dayNames[getDayIndex(date)],
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
        const daysKey = DAY_NAMES;
        const dayIndex = getDayIndex(date);
        if (dayIndex === -1) return; // Weekend, skip
        const isSelected = isSlotInSelectedSlots(selectedSlots, daysKey[dayIndex], time);
        
        let newSelectedSlots;
        if (isSelected) {
          newSelectedSlots = (selectedSlots || []).filter(s => !(s.day === daysKey[dayIndex] && s.startTime === time));
        }
        else {
          const [hour, minute] = time.split(':').map(Number);
          const endHour = minute === 30 ? hour + 1 : hour;
          const endMinute = minute === 30 ? 0 : minute + 30;
          
          const newSlot = {
            date: date, // Pass date object
            day: daysKey[dayIndex],
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
        day: dayNames[getDayIndex(slotToAssign.date)],
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
        type: REQUEST_TYPES.TIME_REQUEST, // Or 'time_change' if applicable
        timeSlot: {
          date: slotToRequest.date, // Pass date object
          day: dayNames[getDayIndex(slotToRequest.date)],
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

      if (slotToChange.action === CHANGE_ACTIONS.RELEASE) {
        // Release own slot
        requestData = {
          roomId: roomId,
          type: REQUEST_TYPES.SLOT_RELEASE,
          timeSlot: {
            date: slotToChange.date, // Pass date object
            day: dayNames[getDayIndex(slotToChange.date)],
            startTime: slotToChange.time,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
          },
          message: message || '시간을 취소합니다.',
        };
      } else if (slotToChange.action === CHANGE_ACTIONS.SWAP) {
        // Request swap with another user
        requestData = {
          roomId: roomId,
          type: REQUEST_TYPES.SLOT_SWAP,
          timeSlot: {
            date: slotToChange.date, // Pass date object
            day: dayNames[getDayIndex(slotToChange.date)],
            startTime: slotToChange.time,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
            subject: (() => {
              const existingSlot = (timeSlots || []).find(slot => {
                const slotDateStr = safeDateToISOString(slot.date)?.split('T')[0];
                const changeSlotDateStr = safeDateToISOString(slotToChange.date)?.split('T')[0];
                return slotDateStr && changeSlotDateStr &&
                       slotDateStr === changeSlotDateStr &&
                       slot.startTime === slotToChange.time &&
                       (slot.user === currentUser?.id || slot.user?.toString() === currentUser?.id?.toString());
              });
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
          type: REQUEST_TYPES.TIME_CHANGE,
          timeSlot: {
            date: slotToChange.date, // Pass date object
            day: dayNames[getDayIndex(slotToChange.date)],
            startTime: slotToChange.time,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
            subject: (() => {
              const existingSlot = (timeSlots || []).find(slot => {
                const slotDateStr = safeDateToISOString(slot.date)?.split('T')[0];
                const changeSlotDateStr = safeDateToISOString(slotToChange.date)?.split('T')[0];
                return slotDateStr && changeSlotDateStr &&
                       slotDateStr === changeSlotDateStr &&
                       slot.startTime === slotToChange.time &&
                       (slot.user === currentUser?.id || slot.user?.toString() === currentUser?.id?.toString());
              });
              return existingSlot?.subject || '변경 요청';
            })()
          },
          targetSlot: {
            date: slotToChange.date, // Pass date object
            day: dayNames[getDayIndex(slotToChange.date)],
            startTime: slotToChange.time,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
            subject: (() => {
              const existingSlot = (timeSlots || []).find(slot => {
                const slotDateStr = safeDateToISOString(slot.date)?.split('T')[0];
                const changeSlotDateStr = safeDateToISOString(slotToChange.date)?.split('T')[0];
                return slotDateStr && changeSlotDateStr &&
                       slotDateStr === changeSlotDateStr &&
                       slot.startTime === slotToChange.time &&
                       (slot.user === currentUser?.id || slot.user?.toString() === currentUser?.id?.toString());
              });
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
              {days[getDayIndex(slotToAssign.date)]}요일 {slotToAssign.time} 시간을 누구에게 배정하시겠습니까?
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
              {days[getDayIndex(slotToRequest.date)]}요일 {slotToRequest.time} 시간을 요청하시겠습니까?
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
              {slotToChange.action === CHANGE_ACTIONS.RELEASE ? '시간 취소' :
               slotToChange.action === CHANGE_ACTIONS.SWAP ? '시간 교환 요청' : '시간 변경 요청'}
            </h3>
            <p className="mb-4">
              {slotToChange.action === CHANGE_ACTIONS.RELEASE ?
                `${days[getDayIndex(slotToChange.date)]}요일 ${slotToChange.time} 시간을 취소하시겠습니까?` :
               slotToChange.action === CHANGE_ACTIONS.SWAP ?
                `${slotToChange.currentOwner}님의 ${days[getDayIndex(slotToChange.date)]}요일 ${slotToChange.time} 시간과 교환을 요청하시겠습니까?` :
                `${days[getDayIndex(slotToChange.date)]}요일 ${slotToChange.time} 시간을 변경 요청하시겠습니까?`
              }
            </p>
            <textarea
              className="w-full p-2 border rounded mb-4"
              placeholder={
                slotToChange.action === CHANGE_ACTIONS.RELEASE ? '취소 사유를 입력하세요 (선택 사항)' :
                slotToChange.action === CHANGE_ACTIONS.SWAP ? '교환 요청 메시지를 입력하세요 (선택 사항)' :
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
                className={`px-4 py-2 text-white rounded-lg ${BUTTON_STYLES[slotToChange.action] || 'bg-purple-600 hover:bg-purple-700'}`}
              >
                {slotToChange.action === CHANGE_ACTIONS.RELEASE ? '시간 취소' :
                 slotToChange.action === CHANGE_ACTIONS.SWAP ? '교환 요청' :
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
