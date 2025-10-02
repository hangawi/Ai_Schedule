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

// 연속된 시간대 병합 함수 (DetailTimeGrid와 동일)
const mergeConsecutiveTimeSlots = (slots) => {
  if (!slots || slots.length === 0) return [];

  // 날짜와 사용자별로 그룹화
  const groupedSlots = {};

  slots.forEach(slot => {
    const userId = slot.user?._id || slot.user;
    const dateKey = slot.date ? new Date(slot.date).toISOString().split('T')[0] : 'no-date';
    const key = `${userId}-${dateKey}`;

    if (!groupedSlots[key]) {
      groupedSlots[key] = [];
    }
    groupedSlots[key].push(slot);
  });

  const mergedSlots = [];

  Object.values(groupedSlots).forEach(userSlots => {
    const sortedSlots = userSlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    let currentGroup = null;

    for (const slot of sortedSlots) {
      if (currentGroup &&
          currentGroup.endTime === slot.startTime &&
          currentGroup.user === slot.user) {
        // 연속된 슬롯이므로 병합
        currentGroup.endTime = slot.endTime;
        currentGroup.isMerged = true;
        if (!currentGroup.originalSlots) {
          currentGroup.originalSlots = [{ ...currentGroup }];
        }
        currentGroup.originalSlots.push(slot);
      } else {
        // 새로운 그룹 시작
        if (currentGroup) {
          mergedSlots.push(currentGroup);
        }
        currentGroup = { ...slot };
        delete currentGroup.isMerged;
        delete currentGroup.originalSlots;
      }
    }

    if (currentGroup) {
      mergedSlots.push(currentGroup);
    }
  });

  return mergedSlots;
};

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
  onCurrentWeekNegotiationsChange, // New prop to pass current week negotiations to parent
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
    const merged = mergeConsecutiveTimeSlots(timeSlots);
    setMergedTimeSlots(merged);
  }, [timeSlots, showMerged]);

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
    if (onCurrentWeekNegotiationsChange && roomData?.negotiations) {
      const currentWeekNegotiations = getCurrentWeekNegotiations();
      onCurrentWeekNegotiationsChange(currentWeekNegotiations);
    }
  }, [roomData?.negotiations, weekDates]); // Only update when negotiations or week changes

  // Helper to get who booked a slot (based on Date object overlap)
  const getSlotOwner = useCallback((date, time) => {
    const slotsToUse = showMerged ? mergedTimeSlots : timeSlots;

    const baseOwnerInfo = getSlotOwnerHelper(
      date,
      time,
      slotsToUse,
      members,
      currentUser,
      isRoomOwner,
      getNegotiationInfo
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
  }, [timeSlots, mergedTimeSlots, members, currentUser, isRoomOwner, getNegotiationInfo, showMerged]);

  // Helper to check if a slot is selected by the current user (uses currentSelectedSlots)
  const isSlotSelected = (date, time) => {
    return isSlotSelectedHelper(date, time, currentSelectedSlots);
  };

  // Function to find merged block for a slot
  const findMergedBlock = useCallback((date, time, targetUserId) => {
    console.log('🔍 === FIND MERGED BLOCK CALLED ===');
    console.log('🔍 showMerged value:', showMerged);

    if (!showMerged) {
      console.log('🔍 RETURNING NULL - showMerged is false');
      return null;
    }

    const dayIndex = getDayIndex(date);
    if (dayIndex === -1) {
      console.log('🔍 RETURNING NULL - invalid day index');
      return null;
    }

    console.log('🔍 Finding merged block for:', {
      date: date.toDateString(),
      time,
      targetUserId,
      showMerged,
      totalTimeSlots: timeSlots?.length || 0
    });

    // Debug all timeSlots
    console.log('All timeSlots:', timeSlots?.map(slot => ({
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      userId: slot.user?._id || slot.user?.id || slot.user,
      user: slot.user
    })));

    // Find all slots belonging to the same user on the same day
    const daySlots = timeSlots?.filter(slot => {
      const slotDate = new Date(slot.date);
      const slotUserId = slot.user?._id || slot.user?.id || slot.user;
      const normalizedTargetUserId = targetUserId?._id || targetUserId?.id || targetUserId;

      console.log('Checking slot:', {
        slotDate: slotDate.toDateString(),
        targetDate: date.toDateString(),
        slotUserId,
        normalizedTargetUserId,
        originalTargetUserId: targetUserId,
        dateMatch: slotDate.toDateString() === date.toDateString(),
        userMatch: slotUserId === normalizedTargetUserId || slotUserId?.toString() === normalizedTargetUserId?.toString()
      });

      const matches = slotDate.toDateString() === date.toDateString() &&
             (slotUserId === normalizedTargetUserId || slotUserId?.toString() === normalizedTargetUserId?.toString());

      if (matches) {
        console.log('Found matching slot:', { startTime: slot.startTime, endTime: slot.endTime, userId: slotUserId });
      }
      return matches;
    }).sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (!daySlots?.length) {
      console.log('No slots found for user');
      return null;
    }

    console.log('All user slots for day:', daySlots.map(s => ({ start: s.startTime, end: s.endTime })));

    // Find the block that contains the clicked time
    const [hour, minute] = time.split(':').map(Number);
    const clickedMinutes = hour * 60 + minute;

    console.log('Clicked time in minutes:', clickedMinutes);

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
        console.log('Found clicked slot at index:', i, 'slot:', slot.startTime + '-' + slot.endTime);
        break;
      }
    }

    if (currentSlotIndex === -1) {
      console.log('Clicked time not in any slot');
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
        console.log('Extended block backwards to index:', i);
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
        console.log('Extended block forwards to index:', i);
      } else {
        break;
      }
    }

    const blockStart = daySlots[blockStartIndex].startTime;
    const blockEnd = daySlots[blockEndIndex].endTime;

    console.log('Final block:', { start: blockStart, end: blockEnd, startIndex: blockStartIndex, endIndex: blockEndIndex });

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
    console.log('🎯 === HANDLE SLOT CLICK START ===');
    console.log('🎯 showMerged prop value:', showMerged);
    console.log('🎯 Clicked:', { date: date.toDateString(), time });

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

        console.log('=== DUPLICATE CHECK START ===');
        console.log('Checking for existing requests:', {
          roomRequests: roomData?.requests?.length || 0,
          currentUser: currentUser?.id,
          date: date.toDateString(),
          time,
          targetUserId: ownerInfo.actualUserId || ownerInfo.userId
        });

        // Debug all room requests
        console.log('All room requests:', roomData?.requests?.map(req => ({
          id: req._id,
          type: req.type,
          status: req.status,
          requester: req.requester?._id || req.requester?.id || req.requester,
          targetUser: req.targetUser?._id || req.targetUser?.id || req.targetUser,
          timeSlot: req.timeSlot
        })));

        const hasDuplicate = hasExistingSwapRequest(roomData?.requests, currentUser, date, time, ownerInfo.actualUserId || ownerInfo.userId);
        console.log('=== DUPLICATE CHECK RESULT:', hasDuplicate, '===');

        if (hasDuplicate) {
          console.log('DUPLICATE FOUND - SHOWING ALERT');
          showAlert('이미 이 시간대에 대한 자리 요청을 보냈습니다. 기존 요청이 처리될 때까지 기다려주세요.');
          return;
        }

        console.log('NO DUPLICATE - PROCEEDING WITH REQUEST');

        const existingSlot = findExistingSlot(timeSlots, date, time, ownerInfo.actualUserId || ownerInfo.userId);

        // 정확한 날짜 표시를 위한 dayDisplay 생성
        const dayDisplay = createDayDisplay(date);

        // Check if in merged mode and find the block
        console.log('=== MERGE MODE CHECK START ===');
        console.log('showMerged:', showMerged);
        console.log('Attempting to find merged block for:', {
          date: date.toDateString(),
          time,
          targetUserId: ownerInfo.actualUserId || ownerInfo.userId
        });

        const mergedBlock = findMergedBlock(date, time, ownerInfo.actualUserId || ownerInfo.userId);
        console.log('=== MERGED BLOCK RESULT:', mergedBlock, '===');

        // Use block time range if in merged mode, otherwise use single slot
        const startTime = mergedBlock ? mergedBlock.startTime : time;
        const endTime = mergedBlock ? mergedBlock.endTime : (calculateEndTime ? calculateEndTime(time) : (() => {
          const [h, m] = time.split(':').map(Number);
          const eh = m === 30 ? h + 1 : h;
          const em = m === 30 ? 0 : m + 30;
          return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
        })());

        console.log('Final time range:', {
          originalTime: time,
          finalStartTime: startTime,
          finalEndTime: endTime,
          isBlockRequest: !!mergedBlock
        });

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

        console.log('=== SLOT DATA CREATED ===');
        console.log('Final slotData:', slotData);

        if (onOpenChangeRequestModal) {
          onOpenChangeRequestModal(slotData);
        } else {
          setSlotToChange(slotData);
          setShowChangeRequestModal(true);
        }
      }
          } else { // Empty slot
            if (isRoomOwner) {
              setSlotToAssign({ date: date, time }); // Pass date object
              setShowAssignModal(true);
            } else {
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
            }
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
