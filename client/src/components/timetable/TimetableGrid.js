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
  getSlotOwner as getSlotOwnerHelper,
  isSlotSelected as isSlotSelectedHelper,
  mergeConsecutiveTimeSlots
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
  travelSlots = [],
  travelMode, // Add travelMode to props
  members = [],
  roomData,
  onSlotSelect,
  currentUser,
  isRoomOwner,
  onRequestSlot,
  onRemoveSlot,
  onDirectSubmit,
  selectedSlots = [],
  events,
  proposals,
  calculateEndTime,
  onWeekChange, // New prop to pass current week start date to parent
  initialStartDate, // New prop to set the initial week to display
  showMerged = true, // New prop for merged view
  ownerOriginalSchedule = null, // 방장의 원본 시간표 데이터
  onOpenChangeRequestModal // New prop to open change request modal
}) => {
  const ownerSlots = timeSlots?.filter(slot => slot.userId === currentUser?.id || slot.user === currentUser?.id);

  // CustomAlert 상태
  const [customAlert, setCustomAlert] = useState({ show: false, message: '' });
  const showAlert = (message) => setCustomAlert({ show: true, message });
  const closeAlert = () => setCustomAlert({ show: false, message: '' });
  
  // 최근 요청 추적 (중복 방지)
  const [recentRequests, setRecentRequests] = useState(new Set());

  const [weekDates, setWeekDates] = useState([]);

  // 병합된 슬롯들을 추적하는 상태
  const [mergedTimeSlots, setMergedTimeSlots] = useState([]);

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

  // timeSlots가 변경될 때마다 병합된 슬롯 업데이트
  useEffect(() => {
    if (travelMode !== 'normal') {
      setMergedTimeSlots(timeSlots);
      return;
    }
    const merged = mergeConsecutiveTimeSlots(timeSlots);
    setMergedTimeSlots(merged);
  }, [timeSlots, showMerged, travelMode]);

  const days = DAYS; // Display labels (not used for logic)

  // Generate time slots using utility functions
  // Use startHour/endHour first (passed from parent), then fall back to scheduleStart/scheduleEnd
  const scheduleStartHour = getHourFromSettings(
    roomSettings?.startHour,
    DEFAULT_SCHEDULE_START_HOUR.toString()
  );
  const scheduleEndHour = getHourFromSettings(
    roomSettings?.endHour,
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

  const [showChangeRequestModal, setShowChangeRequestModal] = useState(false);
  const [slotToChange, setSlotToChange] = useState(null);

  // Helper to get who booked a slot (based on Date object overlap)
  const getSlotOwner = useCallback((date, time) => {
    const slotsToUse = showMerged ? mergedTimeSlots : timeSlots;

    const baseOwnerInfo = getSlotOwnerHelper(
      date,
      time,
      slotsToUse,
      members,
      currentUser,
      isRoomOwner
    );

    // 병합 모드에서 병합된 슬롯인지 확인
    if (showMerged && baseOwnerInfo) {
      const mergedSlot = mergedTimeSlots.find(slot => {
        const slotDate = slot.date ? new Date(slot.date).toISOString().split('T')[0] : null;
        const currentDate = date.toISOString().split('T')[0];

        return slotDate === currentDate &&
               (slot.user === baseOwnerInfo.actualUserId || slot.user?._id === baseOwnerInfo.actualUserId) &&
               time >= slot.startTime && time < slot.endTime;
      });

      if (mergedSlot && mergedSlot.isMerged) {
        return {
          ...baseOwnerInfo,
          isMergedSlot: true,
          mergedDuration: mergedSlot.originalSlots?.length * 10 || 10 // 10분 단위
        };
      }
    }

    return baseOwnerInfo;
  }, [timeSlots, mergedTimeSlots, members, currentUser, isRoomOwner, showMerged]);

  // Helper to check if a slot is selected by the current user (uses currentSelectedSlots)
  const isSlotSelected = (date, time) => {
    return isSlotSelectedHelper(date, time, currentSelectedSlots);
  };

  // Function to find merged block for a slot
  const findMergedBlock = useCallback((date, time, targetUserId) => {
    if (!showMerged) {
      return null;
    }

    const dayIndex = getDayIndex(date);
    if (dayIndex === -1) {
      return null;
    }

    // Find all slots belonging to the same user on the same day
    const daySlots = timeSlots?.filter(slot => {
      const slotDate = new Date(slot.date);
      const slotUserId = slot.user?._id || slot.user?.id || slot.user;
      const normalizedTargetUserId = targetUserId?._id || targetUserId?.id || targetUserId;

      const matches = slotDate.toDateString() === date.toDateString() &&
             (slotUserId === normalizedTargetUserId || slotUserId?.toString() === normalizedTargetUserId?.toString());

      return matches;
    }).sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (!daySlots?.length) {
      return null;
    }

    // Find the block that contains the clicked time
    const [hour, minute] = time.split(':').map(Number);
    const clickedMinutes = hour * 60 + minute;

    // Find which slot contains the clicked time
    let currentSlotIndex = -1;
    for (let i = 0; i < daySlots.length; i++) {
      const slot = daySlots[i];
      const [slotHour, slotMinute] = slot.startTime.split(':').map(Number);
      const [endHour, endMinute] = slot.endTime.split(':').map(Number);

      const slotStartMinutes = slotHour * 60 + slotMinute;
      const slotEndMinutes = endHour * 60 + endMinute;

      if (clickedMinutes >= slotStartMinutes && clickedMinutes < slotEndMinutes) {
        currentSlotIndex = i;
        break;
      }
    }

    if (currentSlotIndex === -1) {
      return null;
    }

    // Find the start of the consecutive block (go backwards)
    let blockStartIndex = currentSlotIndex;
    for (let i = currentSlotIndex - 1; i >= 0; i--) {
      const currentSlot = daySlots[i + 1];
      const prevSlot = daySlots[i];

      const [currentStartHour, currentStartMinute] = currentSlot.startTime.split(':').map(Number);
      const [prevEndHour, prevEndMinute] = prevSlot.endTime.split(':').map(Number);

      const currentStartMinutes = currentStartHour * 60 + currentStartMinute;
      const prevEndMinutes = prevEndHour * 60 + prevEndMinute;

      if (prevEndMinutes === currentStartMinutes) {
        blockStartIndex = i;
      } else {
        break;
      }
    }

    // Find the end of the consecutive block (go forwards)
    let blockEndIndex = currentSlotIndex;
    for (let i = currentSlotIndex + 1; i < daySlots.length; i++) {
      const currentSlot = daySlots[i - 1];
      const nextSlot = daySlots[i];

      const [currentEndHour, currentEndMinute] = currentSlot.endTime.split(':').map(Number);
      const [nextStartHour, nextStartMinute] = nextSlot.startTime.split(':').map(Number);

      const currentEndMinutes = currentEndHour * 60 + currentEndMinute;
      const nextStartMinutes = nextStartHour * 60 + nextStartMinute;

      if (currentEndMinutes === nextStartMinutes) {
        blockEndIndex = i;
      } else {
        break;
      }
    }

    const blockStart = daySlots[blockStartIndex].startTime;
    const blockEnd = daySlots[blockEndIndex].endTime;

    // 병합모드에서는 단일 슬롯도 블록 전체 시간으로 반환
    return {
      startTime: blockStart,
      endTime: blockEnd,
      date: date,
      day: dayNames[dayIndex]
    };
  }, [timeSlots, showMerged, getDayIndex, dayNames]);

  // Function to handle slot click
  const handleSlotClick = useCallback((date, time) => {
    const isBlocked = !!getBlockedTimeInfo(time);
    const ownerInfo = getSlotOwner(date, time);
    const isOwnedByCurrentUser = isSlotOwnedByCurrentUser(ownerInfo, currentUser);
    

    if (isBlocked) {
      return;
    }

    if (ownerInfo) {
      if (isOwnedByCurrentUser) {
        if (onRemoveSlot && window.confirm('이 시간을 삭제하시겠습니까?')) {
          const [hour, minute] = time.split(':').map(Number);
          const endHour = minute >= 50 ? hour + 1 : hour;
          const endMinute = minute >= 50 ? 0 : minute + 10;

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
        // 방장은 다른 사람의 시간에 대해 교환 요청을 할 수 없음
        if (isRoomOwner) {
          showAlert('방장은 시간표 교환요청을 할 수 없습니다.');
          return;
        }

        const requestKey = `${date.toISOString().split('T')[0]}-${time}-${ownerInfo.actualUserId || ownerInfo.userId}`;

        if (isRequestTooRecent(recentRequests, requestKey)) {
          showAlert('이미 이 시간대에 대한 자리 요청을 보냈습니다. 기존 요청이 처리될 때까지 기다려주세요.');
          return;
        }

        const hasDuplicate = hasExistingSwapRequest(roomData?.requests, currentUser, date, time, ownerInfo.actualUserId || ownerInfo.userId);

        if (hasDuplicate) {
          showAlert('이미 이 시간대에 대한 자리 요청을 보냈습니다. 기존 요청이 처리될 때까지 기다려주세요.');
          return;
        }

        const existingSlot = findExistingSlot(timeSlots, date, time, ownerInfo.actualUserId || ownerInfo.userId);

        // 정확한 날짜 표시를 위한 dayDisplay 생성
        const dayDisplay = createDayDisplay(date);

        // Check if in merged mode and find the block
        const mergedBlock = findMergedBlock(date, time, ownerInfo.actualUserId || ownerInfo.userId);

        // Use block time range if in merged mode, otherwise use single slot
        const startTime = mergedBlock ? mergedBlock.startTime : time;
        const endTime = mergedBlock ? mergedBlock.endTime : (calculateEndTime ? calculateEndTime(time) : (() => {
          const [h, m] = time.split(':').map(Number);
          const eh = m === 30 ? h + 1 : h;
          const em = m === 30 ? 0 : m + 30;
          return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
        })());

        const slotData = {
          date: date, // Pass date object
          startTime: startTime, // 블록 시작 시간
          endTime: endTime, // 블록 종료 시간
          time: startTime, // 하위 호환성을 위해 유지
          currentOwner: ownerInfo.name,
          targetUserId: ownerInfo.actualUserId || ownerInfo.userId,
          action: 'request',
          dayDisplay: dayDisplay, // 정확한 날짜 표시
          isBlockRequest: !!mergedBlock, // Flag to indicate block request
          targetSlot: {
            date: date, // Pass date object
            day: dayNames[getDayIndex(date)],
            startTime: startTime,
            endTime: endTime,
            subject: existingSlot?.subject || (mergedBlock ? '블록 요청' : '자리 요청'),
            user: ownerInfo.actualUserId || ownerInfo.userId
          }
        };

        if (onOpenChangeRequestModal) {
          onOpenChangeRequestModal(slotData);
        } else {
          setSlotToChange(slotData);
          setShowChangeRequestModal(true);
        }
      }
          } else { // Empty slot
            const daysKey = DAY_NAMES;
            const dayIndex = getDayIndex(date);
            if (dayIndex === -1) return; // Weekend, skip

            const [hour, minute] = time.split(':').map(Number);
            const endHour = minute >= 50 ? hour + 1 : hour;
            const endMinute = minute >= 50 ? 0 : minute + 10;

            const newSlot = {
              date: date, // Pass date object
              day: daysKey[dayIndex],
              startTime: time,
              endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
              subject: '새 일정'
            };

            if (onSlotSelect) onSlotSelect(newSlot);
          }  }, [
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
          date: slotToRequest.date ? (slotToRequest.date instanceof Date ? slotToRequest.date.toISOString() : slotToRequest.date) : undefined,
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
            date: slotToChange.date ? (slotToChange.date instanceof Date ? slotToChange.date.toISOString() : slotToChange.date) : undefined,
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
            date: slotToChange.date ? (slotToChange.date instanceof Date ? slotToChange.date.toISOString() : slotToChange.date) : undefined,
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
            date: slotToChange.date ? (slotToChange.date instanceof Date ? slotToChange.date.toISOString() : slotToChange.date) : undefined,
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
        travelSlots={travelSlots}
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
        showMerged={showMerged}
        ownerOriginalSchedule={ownerOriginalSchedule}
        travelMode={travelMode} // Pass travelMode down
      />

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
