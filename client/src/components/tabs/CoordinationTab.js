import React, { useState, useEffect, useCallback } from 'react';
import TimetableGrid from '../timetable/TimetableGrid';
import CoordinationCalendarView from '../calendar/CoordinationCalendarView';
import CoordinationDetailGrid from '../calendar/CoordinationDetailGrid';
import RoomCreationModal from '../modals/RoomCreationModal';
import RoomJoinModal from '../modals/RoomJoinModal';
import RoomManagementModal from '../modals/RoomManagementModal';
import AssignSlotModal from '../modals/AssignSlotModal';
import RequestSlotModal from '../modals/RequestSlotModal';
import ChangeRequestModal from '../modals/ChangeRequestModal';
import AutoSchedulerPanel from '../scheduler/AutoSchedulerPanel';
import { useCoordination } from '../../hooks/useCoordination';
import { useCoordinationModals } from '../../hooks/useCoordinationModals';
import { useAuth } from '../../hooks/useAuth';
import { coordinationService } from '../../services/coordinationService';
import { userService } from '../../services/userService';
import { Calendar, Grid, PlusCircle, LogIn, Users, MessageSquare, Clock, RefreshCw, Merge, Split, X } from 'lucide-react';
import { translateEnglishDays } from '../../utils';
import CustomAlertModal from '../modals/CustomAlertModal';
import MemberScheduleModal from '../modals/MemberScheduleModal';
import NotificationModal from '../modals/NotificationModal';
import NegotiationModal from '../modals/NegotiationModal';
import NegotiationConflictModal from '../modals/NegotiationConflictModal';
import MemberStatsModal from '../modals/MemberStatsModal';

// Extracted components
import RoomList from '../coordination/RoomList';
import MemberList from '../coordination/MemberList';
import { RequestManagement, OwnerRequestsSection } from '../coordination/RequestManagement';
import NegotiationSection from '../coordination/NegotiationSection';

// Utilities
import {
  dayMap,
  days,
  getCurrentWeekMonday,
  calculateEndTime,
  getHourFromSettings,
  isRoomOwner,
  countActiveNegotiations
} from '../../utils/coordinationUtils';
import {
  handleAutoResolveNegotiations,
  handleForceResolveNegotiation,
  handleResetCarryOverTimes,
  handleResetCompletedTimes,
  handleRunAutoSchedule,
  handleCancelRequest,
  handleRequestWithUpdate,
  createChangeRequestData
} from '../../utils/coordinationHandlers';


const CoordinationTab = ({ onExchangeRequestCountChange, onRefreshExchangeCount }) => {
  const { user } = useAuth();
  const [roomExchangeCounts, setRoomExchangeCounts] = useState({});
  const [sentRequests, setSentRequests] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [ownerScheduleCache, setOwnerScheduleCache] = useState(null); // 방장 시간표 정보 캐시

  // Debug receivedRequests changes
  useEffect(() => {
  }, [receivedRequests]);

  const [customAlert, setCustomAlert] = useState({ show: false, message: '', type: 'warning' });
  const showAlert = (message, type = 'warning') => {
    setCustomAlert({ show: true, message, type });
  };
  const closeAlert = () => setCustomAlert({ show: false, message: '', type: 'warning' });

  // 방장 개인시간 동기화 함수
  const syncOwnerPersonalTimes = async () => {
    if (!currentRoom || !isRoomOwner(user, currentRoom)) {
      showAlert('방장만 개인시간을 동기화할 수 있습니다.');
      return;
    }

    try {
      // 현재 사용자의 개인시간 데이터 가져오기
      const ownerScheduleData = await userService.getUserSchedule();

      // 현재 방 세부정보 가져오기
      const roomData = await coordinationService.fetchRoomDetails(currentRoom._id);
      const existingSettings = roomData.settings || { roomExceptions: [] };

      // 기존의 방장 연동 예외들 제거 (isSynced: true인 것들)
      const nonSyncedExceptions = existingSettings.roomExceptions.filter(ex => !ex.isSynced);

      // 요일 매핑 (0: 일, 1: 월, ..., 6: 토)
      const dayOfWeekMap = {
        0: '일요일', 1: '월요일', 2: '화요일', 3: '수요일', 4: '목요일', 5: '금요일', 6: '토요일'
      };

      // 새로운 방장 시간표 예외들 생성 (불가능한 시간만 추가)
      const syncedExceptions = [];

      // defaultSchedule(가능한 시간)은 roomExceptions에 추가하지 않음
      // roomExceptions는 금지 시간이므로

      // scheduleExceptions을 roomExceptions으로 변환 (시간대별 병합)
      const scheduleExceptionGroups = {};
      (ownerScheduleData.scheduleExceptions || []).forEach(exception => {
        const startDate = new Date(exception.startTime);
        const dateKey = startDate.toISOString().split('T')[0]; // YYYY-MM-DD 형식
        const title = exception.title || '일정';
        const groupKey = `${dateKey}_${title}`;

        if (!scheduleExceptionGroups[groupKey]) {
          scheduleExceptionGroups[groupKey] = [];
        }
        scheduleExceptionGroups[groupKey].push(exception);
      });

      // 각 그룹별로 시간 범위 병합
      Object.values(scheduleExceptionGroups).forEach(group => {
        // 시작 시간 순으로 정렬
        group.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

        const mergedRanges = [];
        let currentRange = null;

        group.forEach(exception => {
          const startDate = new Date(exception.startTime);
          const endDate = new Date(exception.endTime);

          if (!currentRange) {
            currentRange = {
              title: exception.title || '일정',
              startTime: exception.startTime,
              endTime: exception.endTime,
              startDate: startDate,
              endDate: endDate
            };
          } else {
            // 현재 범위의 끝 시간과 새 예외의 시작 시간이 연속되는지 확인
            if (new Date(currentRange.endTime).getTime() === startDate.getTime()) {
              // 연속되므로 현재 범위 확장
              currentRange.endTime = exception.endTime;
              currentRange.endDate = endDate;
            } else {
              // 연속되지 않으므로 현재 범위를 완성하고 새 범위 시작
              mergedRanges.push(currentRange);
              currentRange = {
                title: exception.title || '일정',
                startTime: exception.startTime,
                endTime: exception.endTime,
                startDate: startDate,
                endDate: endDate
              };
            }
          }
        });

        // 마지막 범위 추가
        if (currentRange) {
          mergedRanges.push(currentRange);
        }

        // 병합된 범위들을 syncedExceptions에 추가
        mergedRanges.forEach(range => {
          const displayDate = range.startDate.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).replace(/\. /g, '.').replace(/\.$/, '');

          const displayStartTime = range.startDate.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit'
          });

          const displayEndTime = range.endDate.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit'
          });

          syncedExceptions.push({
            type: 'date_specific',
            name: `${displayDate} ${displayStartTime}~${displayEndTime} (방장)`,
            startTime: displayStartTime,
            endTime: displayEndTime,
            startDate: range.startTime,
            endDate: range.endTime,
            isSynced: true
          });
        });
      });

      // personalTimes을 roomExceptions으로 변환
      (ownerScheduleData.personalTimes || []).forEach(personalTime => {
        if (personalTime.isRecurring !== false && personalTime.days && personalTime.days.length > 0) {
          personalTime.days.forEach(dayOfWeek => {
            const jsDay = dayOfWeek === 7 ? 0 : dayOfWeek;

            // 시간을 분으로 변환하여 자정 넘나드는지 확인
            const [startHour, startMin] = personalTime.startTime.split(':').map(Number);
            const [endHour, endMin] = personalTime.endTime.split(':').map(Number);
            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;

            if (endMinutes <= startMinutes) {
              // 자정을 넘나드는 시간 (예: 23:00~07:00) 분할
              syncedExceptions.push({
                type: 'daily_recurring',
                name: `${personalTime.title || '개인시간'} (방장)`,
                dayOfWeek: jsDay,
                startTime: personalTime.startTime,
                endTime: '23:50',
                isPersonalTime: true,
                isSynced: true
              });

              syncedExceptions.push({
                type: 'daily_recurring',
                name: `${personalTime.title || '개인시간'} (방장)`,
                dayOfWeek: jsDay,
                startTime: '00:00',
                endTime: personalTime.endTime,
                isPersonalTime: true,
                isSynced: true
              });
            } else {
              // 일반적인 하루 내 시간
              syncedExceptions.push({
                type: 'daily_recurring',
                name: `${personalTime.title || '개인시간'} (방장)`,
                dayOfWeek: jsDay,
                startTime: personalTime.startTime,
                endTime: personalTime.endTime,
                isPersonalTime: true,
                isSynced: true
              });
            }
          });
        }
      });

      // 업데이트된 설정으로 방 업데이트
      const updatedSettings = {
        ...existingSettings,
        roomExceptions: [...nonSyncedExceptions, ...syncedExceptions]
      };

      await coordinationService.updateRoom(currentRoom._id, {
        settings: updatedSettings
      });

      // 현재 방 데이터 새로고침
      await fetchRoomDetails(currentRoom._id);

      showAlert(`방장 개인시간이 성공적으로 동기화되었습니다! (${syncedExceptions.length}개 항목)`);

    } catch (err) {
      console.error('방장 개인시간 동기화 실패:', err);
      showAlert(`개인시간 동기화에 실패했습니다: ${err.message}`);
    }
  };

  // State for the currently displayed week in TimetableGrid

  const [currentWeekStartDate, setCurrentWeekStartDate] = useState(getCurrentWeekMonday());
  const handleWeekChange = useCallback((date) => {
    setCurrentWeekStartDate(date);
  }, []);

  // Auto-scheduler State
  const [scheduleOptions, setScheduleOptions] = useState({
    minHoursPerWeek: 3,
    ownerFocusTime: 'none'
  });
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState(null);
  const [unassignedMembersInfo, setUnassignedMembersInfo] = useState(null);
  const [conflictSuggestions, setConflictSuggestions] = useState([]); // New state for unassigned members

  // Negotiation notification states
  const [showNegotiationAlert, setShowNegotiationAlert] = useState(false);

  // Member stats modal states
  const [memberStatsModal, setMemberStatsModal] = useState({ isOpen: false, member: null });
  const [negotiationAlertData, setNegotiationAlertData] = useState(null);

  // Negotiation modal states
  const [showNegotiationModal, setShowNegotiationModal] = useState(false);
  const [selectedNegotiation, setSelectedNegotiation] = useState(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictNegotiation, setConflictNegotiation] = useState(null);

  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteAllSlots = () => {
    setShowDeleteConfirm(true);
  };

  const executeDeleteAllSlots = async () => {
    if (!currentRoom?._id) return;
    try {
      const updatedRoom = await coordinationService.deleteAllTimeSlots(currentRoom._id);
      setCurrentRoom(updatedRoom);
      showAlert('시간표가 모두 삭제되었습니다.');
    } catch (error) {
      showAlert(`시간표 삭제에 실패했습니다: ${error.message}`);
    }
    setShowDeleteConfirm(false);
  };


  // Current week negotiations from timetable
  const [currentWeekNegotiations, setCurrentWeekNegotiations] = useState([]);



  const loadSentRequests = useCallback(async () => {
    if (!user?.id) return;
    try {
      const result = await coordinationService.getSentRequests();
      if (result.success) {
        setSentRequests(result.requests);
      }
    } catch (error) {
    }
  }, [user?.id]);

  const loadReceivedRequests = useCallback(async () => {
    if (!user?.id) return;
    try {
      const result = await coordinationService.getReceivedRequests();
      if (result.success) {
        setReceivedRequests(result.requests);
      }
    } catch (error) {
      console.error('Failed to load received requests:', error);
    }
  }, [user?.id]);

  const { currentRoom, createRoom, joinRoom, isLoading, error, submitTimeSlots, removeTimeSlot, myRooms, fetchMyRooms, fetchRoomDetails, setCurrentRoom, updateRoom, deleteRoom, assignTimeSlot, createRequest, handleRequest, cancelRequest } = useCoordination(user?.id, onRefreshExchangeCount, loadSentRequests, showAlert);

  // 방장 시간표 정보 캐시 (currentRoom이 변경될 때마다 업데이트, 단 owner 정보가 있을 때만)
  useEffect(() => {
    if (currentRoom?.owner?.defaultSchedule) {
      setOwnerScheduleCache({
        defaultSchedule: currentRoom.owner.defaultSchedule,
        scheduleExceptions: currentRoom.owner.scheduleExceptions,
        personalTimes: currentRoom.owner.personalTimes
      });
    }
  }, [currentRoom]);

  // Calculate room-specific request counts for displaying next to room names
  const getRoomRequestCount = useCallback((roomId) => {
    return receivedRequests.filter(req =>
      req.status === 'pending' && req.roomId === roomId
    ).length;
  }, [receivedRequests]);

  const loadRoomExchangeCounts = useCallback(async () => {
    if (!user?.id || !myRooms) return;

    // Calculate counts from local receivedRequests data
    const counts = {};

    // Include both owned and joined rooms
    const allRooms = [...(myRooms.owned || []), ...(myRooms.joined || [])];

    allRooms.forEach(room => {
      counts[room._id] = getRoomRequestCount(room._id);
    });

    setRoomExchangeCounts(counts);
  }, [user?.id, myRooms, getRoomRequestCount]);

  // Handle custom events for room navigation (from browser back/forward navigation)
  useEffect(() => {
    const handleClearCurrentRoom = () => {
      setCurrentRoom(null);
    };

    const handleRestoreRoom = async (event) => {
      const { roomId } = event.detail;
      if (roomId) {
        try {
          await fetchRoomDetails(roomId);
        } catch (error) {
          setCurrentRoom(null);
        }
      }
    };

    window.addEventListener('clearCurrentRoom', handleClearCurrentRoom);
    window.addEventListener('restoreRoom', handleRestoreRoom);

    return () => {
      window.removeEventListener('clearCurrentRoom', handleClearCurrentRoom);
      window.removeEventListener('restoreRoom', handleRestoreRoom);
    };
  }, [setCurrentRoom, fetchRoomDetails]);

  const {
    showCreateRoomModal, showJoinRoomModal, showManageRoomModal,
    showAssignModal, showRequestModal, showChangeRequestModal,
    slotToAssign, slotToRequest, slotToChange,
    openCreateRoomModal, closeCreateRoomModal,
    openJoinRoomModal, closeJoinRoomModal,
    openManageRoomModal, closeManageRoomModal,
    closeAssignModal,
    closeRequestModal,
    openChangeRequestModal,
    closeChangeRequestModal
  } = useCoordinationModals();

  // Handle auto-resolution of timeout negotiations
  const handleAutoResolveNegotiationsCallback = useCallback(async () => {
    await handleAutoResolveNegotiations(currentRoom, fetchRoomDetails, showAlert);
  }, [currentRoom, fetchRoomDetails, showAlert]);

  // Force resolve negotiation function
  const handleForceResolveNegotiationCallback = useCallback(async (negotiationId, method = 'random') => {
    await handleForceResolveNegotiation(currentRoom, negotiationId, fetchRoomDetails, showAlert, method);
  }, [currentRoom, fetchRoomDetails, showAlert]);

  // Reset carryover times function
  const handleResetCarryOverTimesCallback = useCallback(async () => {
    await handleResetCarryOverTimes(currentRoom, fetchRoomDetails, setCurrentRoom, showAlert);
  }, [currentRoom, fetchRoomDetails, setCurrentRoom, showAlert]);

  // Reset completed times function
  const handleResetCompletedTimesCallback = useCallback(async () => {
    await handleResetCompletedTimes(currentRoom, fetchRoomDetails, setCurrentRoom, showAlert);
  }, [currentRoom, fetchRoomDetails, setCurrentRoom, showAlert]);



  const handleClearAllCarryOverHistoriesCallback = useCallback(async () => {
    if (!currentRoom?._id) return;
    if (window.confirm('정말로 모든 멤버의 이월시간 내역을 삭제하고 이월시간을 0으로 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      try {
        const result = await coordinationService.clearAllCarryOverHistories(currentRoom._id);
        showAlert(result.msg, 'success');
        setCurrentRoom(result.room);
      } catch (error) {
        showAlert(`내역 삭제에 실패했습니다: ${error.message}`, 'error');
      }
    }
  }, [currentRoom, setCurrentRoom, showAlert]);


  // Auto-scheduling function
  const handleRunAutoScheduleCallback = async () => {
    await handleRunAutoSchedule(
      currentRoom,
      currentWeekStartDate,
      user,
      scheduleOptions,
      setIsScheduling,
      setScheduleError,
      setUnassignedMembersInfo,
      setConflictSuggestions,
      setCurrentRoom,
      setNegotiationAlertData,
      setShowNegotiationAlert,
      showAlert
    );
  };

  // Handle opening negotiation modal
  const handleOpenNegotiation = useCallback((negotiationData) => {
    // 💡 다른 협의에 이미 응답했는지 확인
    const otherActiveNegotiations = (currentRoom?.negotiations || []).filter(nego =>
      nego.status === 'active' &&
      nego._id !== negotiationData._id &&
      nego.conflictingMembers?.some(cm => {
        const cmUserId = cm.user?._id || cm.user?.id || cm.user;
        return cmUserId === user?.id || cmUserId?.toString() === user?.id?.toString();
      })
    );

    const hasRespondedToOther = otherActiveNegotiations.some(nego => {
      const memberInOtherNego = nego.conflictingMembers?.find(cm => {
        const cmUserId = cm.user?._id || cm.user?.id || cm.user;
        return cmUserId === user?.id || cmUserId?.toString() === user?.id?.toString();
      });
      return memberInOtherNego && memberInOtherNego.response && memberInOtherNego.response !== 'pending';
    });

    if (hasRespondedToOther) {
      const respondedNego = otherActiveNegotiations.find(nego => {
        const memberInOtherNego = nego.conflictingMembers?.find(cm => {
          const cmUserId = cm.user?._id || cm.user?.id || cm.user;
          return cmUserId === user?.id || cmUserId?.toString() === user?.id?.toString();
        });
        return memberInOtherNego && memberInOtherNego.response && memberInOtherNego.response !== 'pending';
      });

      // 💡 커스텀 모달 표시
      setConflictNegotiation(respondedNego);
      setShowConflictModal(true);
      return;
    }

    setSelectedNegotiation(negotiationData);
    setShowNegotiationModal(true);
  }, [currentRoom?.negotiations, user?.id]);

  // Handle closing negotiation modal
  const handleCloseNegotiation = useCallback(() => {
    setShowNegotiationModal(false);
    setSelectedNegotiation(null);
  }, []);

  // Handle negotiation refresh
  const handleNegotiationRefresh = useCallback(async () => {
    if (currentRoom?._id) {
      await fetchRoomDetails(currentRoom._id);
    }
  }, [currentRoom?._id, fetchRoomDetails]);

  const [selectedSlots, setSelectedSlots] = useState([]);
  const [selectedTab, setSelectedTab] = useState('owned');
  const [showMemberScheduleModal, setShowMemberScheduleModal] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(null);

  // Calendar view states
  const [viewMode, setViewMode] = useState('week'); // 'month' or 'week'
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDetailGrid, setShowDetailGrid] = useState(false);
  const [showMerged, setShowMerged] = useState(true); // 병합/분할 모드
  const [showFullDay, setShowFullDay] = useState(false); // true: 24시간(0~24시), false: 기본(9~18시)

  // Schedule time settings
  const scheduleStartHour = getHourFromSettings(
    currentRoom?.settings?.scheduleStart || currentRoom?.settings?.startHour,
    '9'
  );
  const scheduleEndHour = getHourFromSettings(
    currentRoom?.settings?.scheduleEnd || currentRoom?.settings?.endHour,
    '18'
  );

  // 모든 모드에서 24시간 토글 가능
  const effectiveShowFullDay = showFullDay;


  const handleMemberClick = (memberId) => {
    const member = currentRoom?.members?.find(m => (m.user._id || m.user.id) === memberId);
    if (member) {
      setMemberStatsModal({ isOpen: true, member });
    }
  };

  const handleMemberScheduleClick = (memberId) => {
    setSelectedMemberId(memberId);
    setShowMemberScheduleModal(true);
  };

  // Calendar view handlers
  const handleDateClick = (date) => {
    setSelectedDate(date);
    setShowDetailGrid(true);
  };

  const handleCloseDetailGrid = () => {
    setShowDetailGrid(false);
    setSelectedDate(null);
  };

  const handleSlotSelect = (slotData) => {
    setSelectedSlots(prev => {
      const isSelected = prev.some(slot =>
        slot.date.getTime() === slotData.date.getTime() &&
        slot.day === slotData.day &&
        slot.startTime === slotData.startTime
      );

      if (isSelected) {
        return prev.filter(slot =>
          !(slot.date.getTime() === slotData.date.getTime() &&
            slot.day === slotData.day &&
            slot.startTime === slotData.startTime)
        );
      } else {
        return [...prev, slotData];
      }
    });
  };
  
  const [requestViewMode, setRequestViewMode] = useState('received');
  const [showAllRequests, setShowAllRequests] = useState({});
  const [expandedSections, setExpandedSections] = useState({
    receivedProcessed: true,
    sentProcessed: true
  });
  

  const handleCancelRequestCallback = async (requestId) => {
    await handleCancelRequest(
      requestId,
      setSentRequests,
      setReceivedRequests,
      cancelRequest,
      loadSentRequests,
      loadReceivedRequests,
      onRefreshExchangeCount,
      showAlert
    );
  };

  // Alias for delete request button
  const handleDeleteRequest = handleCancelRequestCallback;

  const handleRequestWithUpdateCallback = async (requestId, action) => {
    try {
      await handleRequestWithUpdate(
        requestId,
        action,
        handleRequest,
        currentRoom,
        fetchRoomDetails,
        loadReceivedRequests,
        loadSentRequests,
        loadRoomExchangeCounts,
        onRefreshExchangeCount,
        showAlert
      );
    } catch (error) {
      console.error('❌ Failed to handle request:', error);
    }
  };
  
  // Update count based on current context
  useEffect(() => {
    if (!onExchangeRequestCountChange) return;

    if (currentRoom) {
      // Count pending requests in the current room only
      const exchangeRequestCount = receivedRequests.filter(req => {
        return req.status === 'pending' && req.roomId === currentRoom._id;
      }).length;

      onExchangeRequestCountChange(exchangeRequestCount);
    } else {
      // Count total pending requests across all rooms (for main tab)
      const totalPendingRequests = receivedRequests.filter(req => req.status === 'pending').length;

      onExchangeRequestCountChange(totalPendingRequests);
    }
  }, [currentRoom, receivedRequests, onExchangeRequestCountChange]);

  // Update room counts when receivedRequests changes
  useEffect(() => {
    if (receivedRequests.length > 0 && myRooms) {
      loadRoomExchangeCounts();
    }
  }, [receivedRequests.length, myRooms?.owned?.length, myRooms?.joined?.length]);

  const handleCreateRoom = async (roomData) => {
    await createRoom(roomData);
    closeCreateRoomModal();
    fetchMyRooms();
    // Note: currentRoom might not be immediately updated here due to async state updates
  };

  const handleJoinRoom = async (inviteCode) => {
    await joinRoom(inviteCode);
    closeJoinRoomModal();
    fetchMyRooms();
  };

  const handleSubmitSlots = async () => {
    if (!currentRoom || selectedSlots.length === 0) return;
    try {
      await submitTimeSlots(currentRoom._id, selectedSlots);
      setSelectedSlots([]);
      await fetchRoomDetails(currentRoom._id);
    } catch (error) {
    }
  };

  const handleAssignSlot = async (assignmentData) => {
    if (!currentRoom) return;
    await assignTimeSlot(
      assignmentData.roomId,
      assignmentData.day,
      assignmentData.startTime,
      assignmentData.endTime,
      assignmentData.userId
    );
  };

  const handleRequestSlot = async (requestData) => {
    if (!currentRoom) {
      return;
    }

    try {
      const result = await createRequest(requestData);

      // 요청 성공 시 새로고침하여 최신 데이터를 가져옴
      await fetchRoomDetails(currentRoom._id);
      await loadSentRequests();

      if (requestData.type === 'slot_swap') {
        showAlert('자리 교환 요청을 보냈습니다!');
      } else if (requestData.type === 'time_request') {
        showAlert('자리 요청을 보냈습니다!');
      } else if (requestData.type === 'slot_release') {
        showAlert('시간 취소 요청을 보냈습니다!');
      } else {
        showAlert('요청을 보냈습니다!');
      }

      // Close modal after successful request
      closeChangeRequestModal();
    } catch (error) {
      // Handle specific error types - prevent error propagation
      if (error.isDuplicate || error.message.includes('동일한 요청이 이미 존재합니다')) {
        showAlert('이미 이 시간대에 대한 자리 요청을 보냈습니다. 기존 요청이 처리될 때까지 기다려주세요.');
      } else {
        console.error('Request failed:', error);
        showAlert(`요청 전송에 실패했습니다: ${error.message}`, 'error');
      }

      // Close any open modals on error after a short delay to ensure alert shows
      setTimeout(() => {
        closeChangeRequestModal();
      }, 500);

      // Prevent error from bubbling up to error boundary
      return;
    }
  };


  const handleRoomClick = async (room) => {
    if (room._id) {
      try {
        await fetchRoomDetails(room._id);
        // Add room state to browser history when entering a room
        window.history.pushState({
          tab: 'coordination',
          roomState: 'inRoom',
          roomId: room._id
        }, '', '#coordination-room');
      } catch (error) {
        showAlert(`방 접근 실패: ${error.message || error}`);
      }
    } else {
      setCurrentRoom(room);
      // Add room state to browser history when entering a room
      window.history.pushState({
        tab: 'coordination',
        roomState: 'inRoom',
        roomId: room._id
      }, '', '#coordination-room');
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchMyRooms();
      setTimeout(() => {
        loadRoomExchangeCounts();
        loadSentRequests();
        loadReceivedRequests();
      }, 100);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!currentRoom && showManageRoomModal) {
      closeManageRoomModal();
    }
  }, [currentRoom, showManageRoomModal, closeManageRoomModal]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div></div>;
  }

  if (error) {
    return <div className="text-center text-red-500 bg-red-100 p-4 rounded-lg">오류 발생: {error}</div>;
  }

  if (currentRoom) {
    const isOwner = isRoomOwner(user, currentRoom);

    return (
      <div className="p-1">
        <div className="bg-white p-6 rounded-xl shadow-lg mb-6 border border-gray-200">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-800">{translateEnglishDays(currentRoom.name)}</h2>
              <p className="text-gray-500 mt-1">{translateEnglishDays(currentRoom.description || '방 설명이 없습니다.')}</p>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                <div className="flex items-center"><strong className="mr-2">초대코드:</strong> <span className="font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded">{currentRoom.inviteCode}</span></div>
                <div className="flex items-center"><strong className="mr-2">방장:</strong> {isOwner ? (user.name || `${user.firstName} ${user.lastName}`) : (currentRoom.owner?.name || `${currentRoom.owner?.firstName || ''} ${currentRoom.owner?.lastName || ''}`.trim() || '알 수 없음')}</div>
                <div className="flex items-center"><strong className="mr-2">멤버:</strong> {currentRoom.memberCount || currentRoom.members?.length || 0} / {currentRoom.maxMembers}명</div>
              </div>
            </div>
            {isOwner && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 flex gap-2">
                <button
                  onClick={openManageRoomModal}
                  className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-medium shadow-sm"
                >
                  방 관리
                </button>
                <button
                  onClick={syncOwnerPersonalTimes}
                  className="px-3 py-2 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors font-medium shadow-sm flex items-center"
                  title="내 프로필의 개인시간을 이 방에 동기화합니다"
                >
                  <RefreshCw size={14} className="mr-1" />
                  개인시간 동기화
                </button>
              </div>
            )}
          </div>
          
          <div className="mt-6 flex flex-wrap gap-3">
            {!isOwner && (
              <button
                onClick={handleSubmitSlots}
                className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
                disabled={selectedSlots.length === 0}
              >
                선택 시간표 제출 ({selectedSlots.length}개)
              </button>
            )} 
            <button
              onClick={() => {
                setCurrentRoom(null);
                // Add room list state to browser history when going back to room list
                window.history.pushState({
                  tab: 'coordination',
                  roomState: null
                }, '', '#coordination');
              }}
              className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors shadow-sm"
            >
              방 목록으로 돌아가기
            </button>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row gap-4 w-full">
          <div className="lg:w-1/4 w-full flex-shrink-0">
            {isOwner && (
              <AutoSchedulerPanel
                options={scheduleOptions}
                setOptions={setScheduleOptions}
                onRun={handleRunAutoScheduleCallback}
                isLoading={isScheduling}
                currentRoom={currentRoom}
                onAutoResolveNegotiations={handleAutoResolveNegotiationsCallback}
                onResetCarryOverTimes={handleResetCarryOverTimesCallback}
                onResetCompletedTimes={handleResetCompletedTimesCallback}
                onClearAllCarryOverHistories={handleClearAllCarryOverHistoriesCallback}
                onDeleteAllSlots={handleDeleteAllSlots}
                currentWeekStartDate={currentWeekStartDate}
                activeNegotiationsCount={countActiveNegotiations(currentRoom)}
              />
            )}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 sm:p-4">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <Users size={20} className="mr-2 text-blue-600" />
                조원 목록 ({(currentRoom.members || []).length}명)
              </h3>
              <div className="space-y-3">
                {(currentRoom.members || []).map((member, index) => {
                  const memberData = member.user || member;
                  const memberName = memberData.name || `${memberData.firstName || ''} ${memberData.lastName || ''}`.trim() || '알 수 없음';
                  const isCurrentUser = memberData._id === user?.id || memberData.id === user?.id;
                  let memberIsOwner = false;
                  if (currentRoom.owner) {
                    const ownerId = currentRoom.owner._id || currentRoom.owner.id || currentRoom.owner;
                    const memberId = memberData._id || memberData.id;
                    memberIsOwner = (ownerId === memberId);
                  }
                  
                  return (
                    <div
                      key={memberData._id || index}
                      className={`flex items-center p-3 rounded-lg border ${
                        memberIsOwner
                          ? 'bg-red-50 border-red-200 ring-2 ring-red-100'
                          : isCurrentUser
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full mr-3 flex-shrink-0 ${
                          memberIsOwner ? 'ring-2 ring-red-300' : ''
                        }`}
                        style={{ backgroundColor: member.color || '#6B7280' }}
                      ></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center">
                          <span className={`text-sm font-medium truncate ${
                            memberIsOwner 
                              ? 'text-red-900 font-bold' 
                              : isCurrentUser 
                                ? 'text-blue-900' 
                                : 'text-gray-900'
                          }`}>
                            {memberIsOwner && '👑 '}
                            {memberName}
                            {isCurrentUser && ' (나)'}
                          </span>
                          {memberIsOwner && (
                            <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full flex-shrink-0 font-semibold">
                              방장
                            </span>
                          )}
                          {!memberIsOwner && (member.carryOver > 0 || (() => {
                            if (!currentRoom?.negotiations) return false;
                            const activeNegotiations = currentRoom.negotiations.filter(neg =>
                              neg.status === 'active' &&
                              neg.conflictingMembers &&
                              Array.isArray(neg.conflictingMembers) &&
                              neg.conflictingMembers.length > 1
                            );
                            return activeNegotiations.length > 0;
                          })()) && (
                            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full flex-shrink-0 font-semibold ${
                              member.carryOver > 0
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              이월: {member.carryOver || 0}시간
                            </span>
                          )}
                          {!memberIsOwner && member.totalProgressTime > 0 && (
                            <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full flex-shrink-0 font-semibold">
                              완료: {member.totalProgressTime}시간
                            </span>
                          )}
                        </div>
                        <div className={`text-xs mt-1 ${
                          memberIsOwner ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          {new Date(member.joinedAt || new Date()).toLocaleDateString('ko-KR')} 참여
                        </div>
                      </div>

                      {/* 버튼들 */}
                      {isOwner && (
                        <div className="flex flex-col gap-1 ml-2">
                          <button
                            onClick={() => handleMemberClick(memberData._id || memberData.id)}
                            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                          >
                            통계
                          </button>
                          <button
                            onClick={() => handleMemberScheduleClick(memberData._id || memberData.id)}
                            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                          >
                            시간표
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!isOwner && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-md font-semibold text-gray-800 flex items-center">
                    <Users size={16} className="mr-2 text-blue-600" />
                    자리 요청관리
                  </h4>
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setRequestViewMode('received')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        requestViewMode === 'received' 
                          ? 'bg-blue-500 text-white' 
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      받은 요청
                    </button>
                    <button
                      onClick={() => setRequestViewMode('sent')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        requestViewMode === 'sent' 
                          ? 'bg-blue-500 text-white' 
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      보낸 요청
                    </button>
                  </div>
                </div>

                {requestViewMode === 'received' && (
                  <div>
                    {(() => {
                      const pendingReceived = receivedRequests.filter(req => req.status === 'pending' && req.roomId === currentRoom._id);
                      const processedReceived = receivedRequests.filter(req => req.status !== 'pending' && req.roomId === currentRoom._id);

                      return (
                        <>
                          {pendingReceived.length > 0 && (
                            <div className="mb-4">
                              <h5 className="text-sm font-medium text-gray-700 mb-2">대기 중인 요청</h5>
                              <div className="space-y-2">
                                {pendingReceived
                                  .slice(0, showAllRequests['receivedPending'] ? undefined : 3)
                                  .map((request, index) => {
                                    const requesterData = request.requester;
                                    const requesterName = requesterData?.name || `${requesterData?.firstName || ''} ${requesterData?.lastName || ''}`.trim() || '알 수 없음';
                                    return (
                                      <div key={request._id || index} className="p-2 bg-blue-500 border border-blue-600 rounded-lg relative">
                                        <div className="flex justify-between items-center mb-1">
                                          <div className="text-xs font-semibold text-white">{requesterName}</div>
                                          <div className="text-xs font-medium text-blue-100">
                                            {request.type === 'time_request' ? '자리 요청' : request.type === 'slot_swap' ? '교환 요청' : '알 수 없는 요청'}
                                          </div>
                                        </div>
                                        <div className="text-xs font-medium text-blue-100 mb-2">
                                          {(dayMap[request.timeSlot?.day.toLowerCase()] || request.timeSlot?.day)} {request.timeSlot?.startTime}-{request.timeSlot?.endTime}
                                        </div>
                                        {request.message && (
                                          <p className="text-xs text-white italic mb-2 line-clamp-2">"{request.message}"</p>
                                        )}
                                        <div className="flex justify-end space-x-2 mt-2">
                                          <button
                                            onClick={() => handleRequestWithUpdateCallback(request._id, 'approved')}
                                            className="px-3 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600"
                                          >
                                            승인
                                          </button>
                                          <button
                                            onClick={() => handleRequestWithUpdateCallback(request._id, 'rejected')}
                                            className="px-3 py-1 text-xs bg-red-500 text-white rounded-md hover:bg-red-600"
                                          >
                                            거절
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                {pendingReceived.length > 3 && !showAllRequests['receivedPending'] && (
                                  <button
                                    onClick={() => setShowAllRequests(prev => ({ ...prev, receivedPending: true }))}
                                    className="text-xs text-blue-500 hover:text-blue-600 text-center w-full"
                                  >
                                    +{pendingReceived.length - 3}개 더 보기
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {pendingReceived.length === 0 && (
                             <div className="mb-4">
                               <h5 className="text-sm font-medium text-gray-700 mb-2">대기 중인 요청</h5>
                               <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
                                 <p className="text-xs text-gray-500">받은 요청이 없습니다</p>
                               </div>
                             </div>
                          )}

                          {processedReceived.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="text-sm font-medium text-gray-700">처리된 요청</h5>
                                <button
                                  onClick={() => setExpandedSections(prev => ({ ...prev, receivedProcessed: !prev.receivedProcessed }))}
                                  className="text-xs text-gray-500 hover:text-gray-700"
                                >
                                  {expandedSections['receivedProcessed'] ? '접기' : '펼치기'}
                                </button>
                              </div>
                              {expandedSections['receivedProcessed'] && (
                                <div className="space-y-2">
                                  {processedReceived
                                    .slice(0, showAllRequests['receivedProcessed'] ? undefined : 3)
                                    .map((request, index) => {
                                      const requesterData = request.requester;
                                      const requesterName = requesterData?.name || `${requesterData?.firstName || ''} ${requesterData?.lastName || ''}`.trim() || '알 수 없음';
                                      return (
                                        <div key={request._id || index} className={`p-2 border rounded-lg ${
                                          request.status === 'approved' ? 'bg-green-50 border-green-200' :
                                          request.status === 'cancelled' ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200'
                                        }`}>
                                          <div className="flex justify-between items-center mb-1">
                                            <div className={`text-xs font-medium ${
                                              request.status === 'approved' ? 'text-green-900' :
                                              request.status === 'cancelled' ? 'text-gray-900' : 'text-red-900'
                                            }`}>{requesterName}</div>
                                            <div className="flex items-center space-x-2">
                                              <div className={`text-xs px-2 py-1 rounded-full ${
                                                request.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                request.status === 'cancelled' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'
                                              }`}>
                                                {request.status === 'approved' ? '승인됨' :
                                                 request.status === 'cancelled' ? '취소됨' : '거절됨'}
                                              </div>
                                              <button
                                                onClick={() => handleCancelRequestCallback(request._id)}
                                                className="text-xs text-gray-400 hover:text-red-500"
                                                title="내역 삭제"
                                              >
                                                ✕
                                              </button>
                                            </div>
                                          </div>
                                          <div className={`text-xs mb-2 ${
                                            request.status === 'approved' ? 'text-green-700' :
                                            request.status === 'cancelled' ? 'text-gray-700' : 'text-red-700'
                                          }`}>
                                            {(dayMap[request.timeSlot?.day.toLowerCase()] || request.timeSlot?.day)} {request.timeSlot?.startTime}-{request.timeSlot?.endTime}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  {processedReceived.length > 3 && !showAllRequests['receivedProcessed'] && (
                                    <button
                                      onClick={() => setShowAllRequests(prev => ({ ...prev, receivedProcessed: true }))}
                                      className="text-xs text-gray-500 hover:text-gray-600 text-center w-full"
                                    >
                                      +{processedReceived.length - 3}개 더 보기
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {requestViewMode === 'sent' && (
                  <div>
                    {(() => {
                      const currentRoomSentRequests = sentRequests.filter(req => req.roomId === currentRoom._id);
                      const pendingRequests = currentRoomSentRequests.filter(req => req.status === 'pending');
                      const processedRequests = currentRoomSentRequests.filter(req => req.status !== 'pending');

                      return (
                        <>
                          {pendingRequests.length > 0 && (
                            <div className="mb-4">
                              <h5 className="text-sm font-medium text-gray-700 mb-2">대기 중인 요청</h5>
                              <div className="space-y-2">
                                {pendingRequests
                                  .slice(0, showAllRequests['sentPending'] ? undefined : 3)
                                  .map((request, index) => {
                                    const targetUserData = request.targetUser;
                                    const targetUserName = targetUserData?.name || `${targetUserData?.firstName || ''} ${targetUserData?.lastName || ''}`.trim() || '방장';
                                    return (
                                      <div key={request._id || index} className="p-2 bg-gray-50 border border-gray-200 rounded-lg relative">
                                        <div className="flex justify-between items-center mb-1">
                                          <div className="text-xs font-semibold text-gray-800 !text-gray-800">
                                            To: {targetUserName}
                                          </div>
                                          <div className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 !text-yellow-800 font-medium">
                                            대기중
                                          </div>
                                        </div>
                                        <div className="text-xs font-medium text-gray-700 !text-gray-700 mb-2">
                                          {(dayMap[request.timeSlot?.day.toLowerCase()] || request.timeSlot?.day)} {request.timeSlot?.startTime}-{request.timeSlot?.endTime}
                                        </div>
                                        {request.message && (
                                          <p className="text-xs text-white italic mb-2 line-clamp-2">"{request.message}"</p>
                                        )}
                                        <div className="flex justify-end">
                                          <button
                                            onClick={() => handleCancelRequestCallback(request._id)}
                                            className="px-3 py-1 text-xs bg-gray-500 text-white rounded-md hover:bg-gray-600"
                                          >
                                            요청 취소
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                {pendingRequests.length > 3 && !showAllRequests['sentPending'] && (
                                  <button
                                    onClick={() => setShowAllRequests(prev => ({...prev, sentPending: true}))}
                                    className="text-xs text-blue-500 hover:text-blue-600 text-center w-full"
                                  >
                                    +{pendingRequests.length - 3}개 더 보기
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {pendingRequests.length === 0 && (
                             <div className="mb-4">
                               <h5 className="text-sm font-medium text-gray-700 mb-2">대기 중인 요청</h5>
                               <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
                                 <p className="text-xs text-gray-500">보낸 요청이 없습니다</p>
                               </div>
                             </div>
                          )}

                          {processedRequests.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="text-sm font-medium text-gray-700">처리된 요청</h5>
                                <button
                                  onClick={() => setExpandedSections(prev => ({...prev, sentProcessed: !prev.sentProcessed}))}
                                  className="text-xs text-gray-500 hover:text-gray-700"
                                >
                                  {expandedSections['sentProcessed'] ? '접기' : '펼치기'}
                                </button>
                              </div>
                              {expandedSections['sentProcessed'] && (
                                <div className="space-y-2">
                                  {processedRequests
                                    .slice(0, showAllRequests['sentProcessed'] ? undefined : 3)
                                    .map((request, index) => {
                                      const targetUserData = request.targetUser;
                                      const targetUserName = targetUserData?.name || `${targetUserData?.firstName || ''} ${targetUserData?.lastName || ''}`.trim() || '방장';
                                      return (
                                        <div key={request._id || index} className={`p-2 border rounded-lg ${
                                          request.status === 'approved' ? 'bg-green-50 border-green-200' :
                                          request.status === 'cancelled' ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200'
                                        }`}>
                                          <div className="flex justify-between items-center mb-1">
                                            <div className={`text-xs font-medium ${
                                              request.status === 'approved' ? 'text-green-900' :
                                              request.status === 'cancelled' ? 'text-gray-900' : 'text-red-900'
                                            }`}>
                                              To: {targetUserName}
                                            </div>
                                            <div className="flex items-center space-x-2">
                                              <div className={`text-xs px-2 py-1 rounded-full ${
                                                request.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                request.status === 'cancelled' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'
                                              }`}>
                                                {request.status === 'approved' ? '승인됨' :
                                                 request.status === 'cancelled' ? '취소됨' : '거절됨'}
                                              </div>
                                              <button
                                                onClick={() => handleCancelRequestCallback(request._id)}
                                                className="text-xs text-gray-400 hover:text-red-500"
                                                title="내역 삭제"
                                              >
                                                ✕
                                              </button>
                                            </div>
                                          </div>
                                          <div className={`text-xs mb-2 ${
                                            request.status === 'approved' ? 'text-green-700' :
                                            request.status === 'cancelled' ? 'text-gray-700' : 'text-red-700'
                                          }`}>
                                            {(dayMap[request.timeSlot?.day.toLowerCase()] || request.timeSlot?.day)} {request.timeSlot?.startTime}-{request.timeSlot?.endTime}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  {processedRequests.length > 3 && !showAllRequests['sentProcessed'] && (
                                    <button
                                      onClick={() => setShowAllRequests(prev => ({...prev, sentProcessed: true}))}
                                      className="text-xs text-gray-500 hover:text-gray-600 text-center w-full"
                                    >
                                      +{processedRequests.length - 3}개 더 보기
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
              )}
            </div>

            <NegotiationSection
              currentWeekNegotiations={currentWeekNegotiations}
              user={user}
              onOpenNegotiation={handleOpenNegotiation}
              isOwner={isOwner}
            />
          </div>

          <div className="lg:w-3/4 w-full flex-grow min-w-0">
            {scheduleError && 
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4" role="alert">
                <strong className="font-bold">오류!</strong>
                <span className="block sm:inline"> {scheduleError}</span>
              </div>
            }
            {unassignedMembersInfo && unassignedMembersInfo.length > 0 && (
              <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mt-4" role="alert">
                <strong className="font-bold">알림!</strong>
                <p className="block sm:inline"> 다음 멤버들은 최소 할당 시간을 채우지 못했습니다:</p>
                <ul className="list-disc list-inside mt-2">
                  {unassignedMembersInfo.map((info, index) => (
                    <li key={index}>멤버 ID: {info.memberId}, 부족 시간: {info.neededHours}시간</li>
                  ))}
                </ul>
                <p className="text-sm mt-2">이들은 협의가 필요하거나 다음 주로 이월될 수 있습니다.</p>
              </div>
            )}
            {conflictSuggestions && conflictSuggestions.length > 0 && (
              <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded relative mt-4" role="alert">
                {conflictSuggestions.map((suggestion, index) => (
                  <div key={index} className="mb-4 last:mb-0">
                    <strong className="font-bold">{suggestion.title}</strong>
                    <div className="mt-2 text-sm whitespace-pre-line">
                      {suggestion.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 sm:p-4 mt-4">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-bold text-gray-800 flex items-center">
                  <Calendar size={20} class="mr-2 text-green-600" />
                  시간표 ({showFullDay ? '00' : String(scheduleStartHour).padStart(2, '0')}:00 - {showFullDay ? '24' : String(scheduleEndHour).padStart(2, '0')}:00)
                </h3>
                <div class="flex items-center space-x-2">
                  {viewMode === 'month' && (
                    <div class="flex items-center space-x-4 text-xs text-gray-600 mr-4">
                      <div class="flex items-center">
                        <div class="w-3 h-3 rounded-sm bg-white border mr-1"></div>
                        <span>가능 시간</span>
                      </div>
                      <div class="flex items-center">
                        <div class="w-3 h-3 rounded-sm bg-blue-500 mr-1"></div>
                        <span>배정 시간</span>
                      </div>
                      <div class="flex items-center">
                        <div class="w-3 h-3 rounded-sm bg-red-500 mr-1"></div>
                        <span>금지 시간</span>
                      </div>
                      <div class="flex items-center">
                        <div class="w-3 h-3 rounded-sm bg-yellow-500 mr-1"></div>
                        <span>협의 중</span>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => setShowFullDay(!showFullDay)}
                    class={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      showFullDay
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <Clock size={16} class="mr-1 inline" />
                    {showFullDay ? '24시간' : '기본'}
                  </button>
                  <button
                    onClick={() => setShowMerged(!showMerged)}
                    class={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      showMerged
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {showMerged ? (
                      <>
                        <Split size={16} class="mr-1 inline" />
                        분할
                      </>
                    ) : (
                      <>
                        <Merge size={16} class="mr-1 inline" />
                        병합
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setViewMode('week')}
                    class={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      viewMode === 'week'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <Grid size={16} class="mr-1 inline" />
                    주간
                  </button>
                  <button
                    onClick={() => setViewMode('month')}
                    class={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      viewMode === 'month'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <Calendar size={16} class="mr-1 inline" />
                    월간
                  </button>

                </div>
              </div>

              {viewMode === 'grid' && !isOwner ? (
                <TimetableGrid
                  roomId={currentRoom._id}
                  roomSettings={{
                    ...currentRoom.settings, // Include all room settings (roomExceptions, blockedTimes, etc.)
                    startHour: effectiveShowFullDay ? 0 : scheduleStartHour,
                    endHour: effectiveShowFullDay ? 24 : scheduleEndHour
                  }}
                  timeSlots={currentRoom.timeSlots || []}
                  members={currentRoom.members || []}
                  roomData={currentRoom}
                  currentUser={user}
                  isRoomOwner={false}
                  selectedSlots={selectedSlots}
                  onSlotSelect={handleSlotSelect}
                  onWeekChange={handleWeekChange}
                  initialStartDate={currentWeekStartDate}
                  calculateEndTime={calculateEndTime}
                  showMerged={showMerged}
                  onOpenChangeRequestModal={openChangeRequestModal}
                />
              ) : viewMode === 'week' ? (
                <TimetableGrid
                  key={`week-${effectiveShowFullDay ? 'full' : 'basic'}-${showMerged ? 'merged' : 'split'}`} // Force re-render on state change
                  roomId={currentRoom._id}
                  roomSettings={{
                    ...currentRoom.settings,
                    startHour: effectiveShowFullDay ? 0 : scheduleStartHour,
                    endHour: effectiveShowFullDay ? 24 : scheduleEndHour
                  }}
                  timeSlots={currentRoom.timeSlots || []}
                  members={currentRoom.members || []}
                  roomData={currentRoom}
                  currentUser={user}
                  isRoomOwner={isOwner}
                  selectedSlots={selectedSlots}
                  onSlotSelect={isOwner ? null : handleSlotSelect}
                  onWeekChange={handleWeekChange}
                  ownerOriginalSchedule={ownerScheduleCache}
                  initialStartDate={currentWeekStartDate}
                  calculateEndTime={calculateEndTime}
                  readOnly={isOwner}
                  showMerged={showMerged}
                  onCurrentWeekNegotiationsChange={setCurrentWeekNegotiations}
                  onOpenChangeRequestModal={openChangeRequestModal}
                />
              ) : (
                <CoordinationCalendarView
                  roomData={currentRoom}
                  timeSlots={currentRoom.timeSlots || []}
                  members={currentRoom.members || []}
                  currentUser={user}
                  isRoomOwner={isOwner}
                  onDateClick={handleDateClick}
                  selectedDate={selectedDate}
                  viewMode={viewMode}
                  currentWeekStartDate={currentWeekStartDate}
                  onWeekChange={handleWeekChange}
                  showFullDay={effectiveShowFullDay}
                  showMerged={showMerged}
                  ownerOriginalSchedule={ownerScheduleCache}
                />
              )}
            </div>
          </div>
        </div>
        {showManageRoomModal && currentRoom && (
          <RoomManagementModal
            room={currentRoom}
            onClose={closeManageRoomModal}
            updateRoom={updateRoom}
            deleteRoom={deleteRoom}
            onRoomUpdated={(updatedRoom) => {
              setCurrentRoom(updatedRoom);
              fetchMyRooms();
            }}
          />
        )}
        {showAssignModal && slotToAssign && (
          <AssignSlotModal
            onClose={closeAssignModal}
            onAssign={(memberId) => {
              handleAssignSlot({
                roomId: currentRoom._id,
                day: days[slotToAssign.dayIndex - 1],
                startTime: slotToAssign.time,
                endTime: calculateEndTime(slotToAssign.time),
                userId: memberId
              });
              closeAssignModal();
            }}
            slotInfo={{
              ...slotToAssign,
              day: dayMap[days[slotToAssign.dayIndex - 1]]
            }}
            members={currentRoom.members}
          />
        )}
        {showRequestModal && slotToRequest && (
          <RequestSlotModal
            onClose={closeRequestModal}
            onRequest={(message) => {
              // date 계산: slotToRequest.date가 있으면 사용, 없으면 dayIndex로부터 계산
              const calculateDateFromDayIndex = (dayIndex) => {
                const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
                const targetDayName = daysOfWeek[dayIndex - 1];
                const dayNameToIndex = {
                  'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5
                };
                const targetDayOfWeek = dayNameToIndex[targetDayName];

                const currentDate = new Date();
                const currentDay = currentDate.getDay(); // 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
                const diff = targetDayOfWeek - currentDay;
                const targetDate = new Date(currentDate);
                targetDate.setDate(currentDate.getDate() + (diff >= 0 ? diff : diff + 7));
                return targetDate.toISOString().split('T')[0]; // YYYY-MM-DD 형식
              };

              const requestDate = slotToRequest.date
                ? (slotToRequest.date instanceof Date
                    ? slotToRequest.date.toISOString().split('T')[0]
                    : slotToRequest.date)
                : calculateDateFromDayIndex(slotToRequest.dayIndex);

              handleRequestSlot({
                roomId: currentRoom._id,
                type: 'time_request',
                timeSlot: {
                  day: days[slotToRequest.dayIndex - 1],
                  date: requestDate,
                  startTime: slotToRequest.time,
                  endTime: calculateEndTime(slotToRequest.time),
                },
                message: message
              });
              closeRequestModal();
            }}
            slotInfo={{
              ...slotToRequest,
              day: dayMap[days[slotToRequest.dayIndex - 1]]
            }}
          />
        )}
        {showChangeRequestModal && slotToChange && (
          <ChangeRequestModal
            onClose={closeChangeRequestModal}
            onRequestChange={(message, requestType) => {
              let requestData;

              // Helper function to get correct day index from Date object
              const getDayIndex = (date) => {
                const dayOfWeek = date.getUTCDay(); // 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
                // We want Monday=0, Tuesday=1, Wednesday=2, Thursday=3, Friday=4
                if (dayOfWeek === 0) return -1; // Sunday, not valid
                if (dayOfWeek === 6) return -1; // Saturday, not valid
                return dayOfWeek - 1; // Monday(1)->0, Tuesday(2)->1, etc.
              };

              // slotToChange.date가 있으면 해당 날짜의 day를 계산
              const dayKey = slotToChange.date
                ? days[getDayIndex(slotToChange.date)]
                : days[slotToChange.dayIndex - 1];

              // date 필드 계산
              const calculateDateFromDayIndex = (dayIndex) => {
                const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
                const targetDayName = daysOfWeek[dayIndex - 1];
                const dayNameToIndex = {
                  'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5
                };
                const targetDayOfWeek = dayNameToIndex[targetDayName];

                const currentDate = new Date();
                const currentDay = currentDate.getDay();
                const diff = targetDayOfWeek - currentDay;
                const targetDate = new Date(currentDate);
                targetDate.setDate(currentDate.getDate() + (diff >= 0 ? diff : diff + 7));
                return targetDate.toISOString().split('T')[0];
              };

              const requestDate = slotToChange.date
                ? (slotToChange.date instanceof Date
                    ? slotToChange.date.toISOString().split('T')[0]
                    : slotToChange.date)
                : calculateDateFromDayIndex(slotToChange.dayIndex);

              const actionType = requestType || slotToChange.action || 'request';

              if (actionType === 'release') {
                requestData = {
                  roomId: currentRoom._id,
                  type: 'slot_release',
                  timeSlot: {
                    day: dayKey,
                    date: requestDate,
                    startTime: slotToChange.startTime || slotToChange.time,
                    endTime: slotToChange.endTime || calculateEndTime(slotToChange.time),
                  },
                  message: message || '시간을 취소합니다.',
                };
              } else {
                // 모든 다른 요청은 시간 양보 요청으로 처리
                // slotToChange에서 직접 startTime, endTime 사용
                const startTime = slotToChange.startTime || slotToChange.time;
                const endTime = slotToChange.endTime || (slotToChange.isBlockRequest && slotToChange.targetSlot
                  ? slotToChange.targetSlot.endTime
                  : calculateEndTime(slotToChange.time));

                requestData = {
                  roomId: currentRoom._id,
                  type: 'time_request',
                  timeSlot: {
                    day: dayKey,
                    date: requestDate,
                    startTime: startTime,
                    endTime: endTime,
                  },
                  targetUserId: slotToChange.targetUserId,
                  message: message || (slotToChange.isBlockRequest ? '블록 자리를 요청합니다.' : '자리를 요청합니다.'),
                  isBlockRequest: slotToChange.isBlockRequest, // 블록 요청 플래그 추가
                };
              }

              handleRequestSlot(requestData);
              // closeChangeRequestModal will be called inside handleRequestSlot
            }}
            slotToChange={slotToChange} // 전체 객체를 전달 (dayDisplay 포함)
          />
        )}

        <CustomAlertModal
            isOpen={customAlert.show}
            onClose={closeAlert}
            title="알림"
            message={customAlert.message}
            type={customAlert.type || "warning"}
            showCancel={false}
        />

        {/* Negotiation Alert Modal */}
        <NotificationModal
          isOpen={showNegotiationAlert}
          onClose={() => setShowNegotiationAlert(false)}
          type="info"
          title="협의가 필요한 시간대가 있습니다"
          message={negotiationAlertData ?
            `귀하가 참여해야 하는 ${negotiationAlertData.count}개의 협의가 있습니다.${negotiationAlertData.totalCount > negotiationAlertData.count ? ` (전체 ${negotiationAlertData.totalCount}개 중)` : ''} 시간표의 '협의중' 슬롯을 클릭하여 참여하세요. 24시간 후 자동으로 해결됩니다.` :
            ''
          }
        />

        {/* Negotiation Modal */}
        <NegotiationModal
          isOpen={showNegotiationModal}
          onClose={handleCloseNegotiation}
          negotiation={selectedNegotiation}
          currentUser={user}
          roomId={currentRoom?._id}
          onRefresh={handleNegotiationRefresh}
        />

        {/* Negotiation Conflict Modal */}
        <NegotiationConflictModal
          isOpen={showConflictModal}
          onClose={() => setShowConflictModal(false)}
          onNavigate={() => {
            setShowConflictModal(false);
            setSelectedNegotiation(conflictNegotiation);
            setShowNegotiationModal(true);
          }}
          respondedNegotiation={conflictNegotiation}
        />

        {/* Member Stats Modal */}
        <MemberStatsModal
          isOpen={memberStatsModal.isOpen}
          onClose={() => setMemberStatsModal({ isOpen: false, member: null })}
          member={memberStatsModal.member}
          isOwner={currentRoom && user && (currentRoom.owner._id === user.id || currentRoom.owner === user.id)}
          currentRoom={currentRoom}
        />

        <CustomAlertModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={executeDeleteAllSlots}
          title="시간표 전체 삭제"
          message="정말로 모든 시간표를 삭제하시겠습니까? 자동 배정으로 생성된 시간표와 협의 내역이 모두 사라지며, 이 작업은 되돌릴 수 없습니다."
          type="danger"
          confirmText="삭제"
          cancelText="취소"
          showCancel={true}
        />

        {/* Detail Grid Modal */}
        {showDetailGrid && selectedDate && (
          <CoordinationDetailGrid
            selectedDate={selectedDate}
            timeSlots={currentRoom.timeSlots || []}
            members={currentRoom.members || []}
            currentUser={user}
            isRoomOwner={isOwner}
            roomData={currentRoom}
            showMerged={showMerged}
            onClose={handleCloseDetailGrid}
            onSlotSelect={handleSlotSelect}
            selectedSlots={selectedSlots}
            onAssignSlot={handleAssignSlot}
            onRequestSlot={handleRequestSlot}
            onRemoveSlot={async (slotData) => {
              await removeTimeSlot(currentRoom._id, slotData.day, slotData.startTime, slotData.endTime);
              await fetchRoomDetails(currentRoom._id);
            }}
            onOpenNegotiation={handleOpenNegotiation}
            ownerOriginalSchedule={ownerScheduleCache}
          />
        )}

        {/* Member Schedule Modal - 방 안에서도 보여야 하므로 여기에 위치 */}
        {showMemberScheduleModal && selectedMemberId && (
          <MemberScheduleModal
            memberId={selectedMemberId}
            onClose={() => {
              setShowMemberScheduleModal(false);
              setSelectedMemberId(null);
            }}
          />
        )}
      </div>
  );
  }

  return (
    <div className="bg-slate-50 p-4 sm:p-6 rounded-lg min-h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2 sm:mb-0">일정 맞추기</h2>
        <div className="flex space-x-3">
          <button
            onClick={openCreateRoomModal}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center transition-all shadow-md hover:shadow-lg"
          >
            <PlusCircle size={18} className="mr-2" />
            새 조율방 생성
          </button>
          <button
            onClick={openJoinRoomModal}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center transition-all shadow-md hover:shadow-lg"
          >
            <LogIn size={18} className="mr-2" />
            조율방 참여
          </button>
        </div>
      </div>

      {(myRooms?.owned?.length > 0 || myRooms?.joined?.length > 0) && (
        <div className="mb-6">
          <div className="flex space-x-2 border-b border-gray-200 mb-4">
            <button
              onClick={() => setSelectedTab('owned')}
              className={`px-4 py-2 font-semibold transition-colors ${selectedTab === 'owned' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              내가 만든 방 ({myRooms?.owned?.length || 0})
            </button>
            <button
              onClick={() => setSelectedTab('joined')}
              className={`px-4 py-2 font-semibold transition-colors ${selectedTab === 'joined' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              참여 중인 방 ({myRooms?.joined?.length || 0})
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {(selectedTab === 'owned' ? myRooms.owned : myRooms.joined).map(room => (
              <div
                key={room._id}
                className="bg-white p-5 rounded-xl shadow-lg cursor-pointer hover:shadow-2xl transition-all duration-300 border border-gray-200 hover:border-blue-400 transform hover:-translate-y-1"
                onClick={() => handleRoomClick(room)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center">
                    <h4 className="text-lg font-bold text-gray-900 truncate pr-2">{translateEnglishDays(room.name)}</h4>
                    {roomExchangeCounts[room._id] > 0 && (
                      <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] h-5 flex items-center justify-center">
                        {roomExchangeCounts[room._id]}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${selectedTab === 'owned' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                    {selectedTab === 'owned' ? '방장' : '멤버'}
                  </span>
                </div>
                {room.description && (
                  <p className="text-gray-600 text-sm mb-4 h-10 line-clamp-2">{translateEnglishDays(room.description)}</p>
                )}
                <div className="space-y-2 text-sm text-gray-700 border-t pt-4 mt-4">
                  <div className="flex items-center"><Users size={14} className="mr-2 text-gray-400"/><span>멤버: {room.memberCount || room.members?.length || 0} / {room.maxMembers}명</span></div>
                  <div className="flex items-center"><Calendar size={14} className="mr-2 text-gray-400"/><span>생성일: {new Date(room.createdAt).toLocaleDateString()}</span></div>
                  <div className="flex items-center"><strong className="text-gray-500 mr-2">Code:</strong><span className="font-mono bg-gray-100 text-gray-800 px-2 py-0.5 rounded">{room.inviteCode}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!(myRooms?.owned?.length > 0 || myRooms?.joined?.length > 0) && (
        <div className="text-center py-16 bg-white rounded-lg shadow-md border">
          <div className="text-gray-400 text-8xl mb-6">📅</div>
          <h3 className="text-2xl font-bold text-gray-700 mb-4">시간표 조율을 시작해보세요!</h3>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            팀 프로젝트나 스터디 그룹의 시간을 효율적으로 조율할 수 있습니다.
            방을 만들거나 기존 방에 참여해보세요.
          </p>
        </div>
      )}

      {showCreateRoomModal && (
        <RoomCreationModal
          onClose={closeCreateRoomModal}
          onCreateRoom={handleCreateRoom}
          ownerProfileSchedule={user ? {
            defaultSchedule: user.defaultSchedule,
            scheduleExceptions: user.scheduleExceptions,
            personalTimes: user.personalTimes
          } : null}
        />
      )}
      {showJoinRoomModal && (
        <RoomJoinModal onClose={closeJoinRoomModal} onJoinRoom={handleJoinRoom} />
      )}
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


export default CoordinationTab;