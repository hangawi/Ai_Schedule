/**
 * ===================================================================================================
 * [파일명] CoordinationTab/index.js - '협업' 탭의 메인 컨테이너 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > [client/src/components/tabs/CoordinationTab/index.js]
 *
 * 🎯 주요 기능:
 *    - '협업' 기능의 전체적인 상태 관리 및 UI 렌더링을 담당하는 최상위 컴포넌트.
 *    - 사용자의 방 목록을 보여주거나, 특정 방에 들어갔을 때의 상세 뷰를 조건부로 렌더링.
 *    - 방 생성, 참여, 관리, 나가기 등 방 관련 모든 기능 조율.
 *    - 시간표 보기(주별/월별), 시간 제출, 자동 배정 실행, 스케줄 확정 등 스케줄링 관련 기능 총괄.
 *    - 교환 요청(일반/연쇄) 관리, 알림, 멤버 관리 등 모든 사용자 상호작용을 처리.
 *    - Socket.IO를 통한 실시간 이벤트 수신 및 폴링을 통한 데이터 동기화.
 *
 * 🔗 연결된 파일:
 *    - ./hooks/*: 대부분의 로직을 위임받는 커스텀 훅들 (useCoordination, useRequests, useViewState 등).
 *    - ./components/*: RoomHeader, MemberList 등 이 컴포넌트 내부에서 사용되는 UI 조각들.
 *    - ../../modals/*: 기능 수행에 필요한 모든 모달 컴포넌트들.
 *    - ../../services/coordinationService.js: 백엔드 API와 직접 통신.
 *    - ../../hooks/useCoordination.js: 핵심적인 백엔드 연동 로직을 담고 있는 훅.
 *
 * 💡 UI 위치:
 *    - [협업] 탭: 앱의 핵심 기능인 일정 조율을 수행하는 주 화면.
 *    - 초기에는 방 목록을 표시하고, 방을 선택하면 해당 방의 상세 관리 화면으로 전환됨.
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: '협업' 탭의 전체적인 동작 방식과 상태 흐름에 영향을 미칩니다.
 *    - 새로운 기능 추가: 관련된 상태와 핸들러를 적절한 커스텀 훅에 추가하거나 새로운 훅을 만들어 연결해야 합니다.
 *    - 데이터 흐름 변경: `useCoordination` 훅과 `useEffect` 훅들의 의존성 배열을 주의 깊게 수정해야 합니다.
 *    - UI 레이아웃 변경: `Room List View`와 `In-Room View`의 JSX 렌더링 부분을 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 컴포넌트는 '협업' 기능의 '갓 컴포넌트(God Component)' 역할을 하며, 수많은 상태와 로직을 관장합니다.
 *    - 복잡성을 관리하기 위해 대부분의 로직이 커스텀 훅으로 분리되어 있습니다. (useCoordination, useRequests 등)
 *    - 실시간 통신을 위해 Socket.IO를 사용하며, 보조적으로 5초마다 폴링하여 데이터를 동기화합니다.
 *    - 전역 이벤트를 사용하여 다른 컴포넌트와의 통신을 일부 수행합니다. (예: `restoreRoom` 이벤트)
 *
 * ===================================================================================================
 */
import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { auth } from '../../../config/firebaseConfig';
import { useCoordination } from '../../../hooks/useCoordination';
import { useCoordinationModals } from '../../../hooks/useCoordinationModals';
import { useTravelMode } from '../../../hooks/useTravelMode';
import { coordinationService } from '../../../services/coordinationService';

// Utils
import { translateEnglishDays } from '../../../utils';
import { isRoomOwner, calculateEndTime, days, getHourFromSettings } from '../../../utils/coordinationUtils';
import { getViewMode } from '../../../utils/coordinationModeUtils';
import {
  handleResetCarryOverTimes,
  handleResetCompletedTimes,
  handleRunAutoSchedule
} from '../../../utils/coordinationHandlers';

// Components
import TimetableGrid from '../../timetable/TimetableGrid';
import CoordinationCalendarView from '../../calendar/CoordinationCalendarView';
import CoordinationDetailGrid from '../../calendar/CoordinationDetailGrid';
import MemberList from '../../coordination/MemberList';
import AutoSchedulerPanel from '../../scheduler/AutoSchedulerPanel';
import AutoConfirmBanner from '../../coordination/AutoConfirmBanner';

// Modals
import RoomCreationModal from '../../modals/RoomCreationModal';
import RoomJoinModal from '../../modals/RoomJoinModal';
import RoomManagementModal from '../../modals/RoomManagementModal';
import RequestSlotModal from '../../modals/RequestSlotModal';
import ChangeRequestModal from '../../modals/ChangeRequestModal';
import CustomAlertModal from '../../modals/CustomAlertModal';
import NotificationModal from '../../modals/NotificationModal';
import MemberStatsModal from '../../modals/MemberStatsModal';
import MemberScheduleModal from '../../modals/MemberScheduleModal';

import ChainExchangeRequestModal from '../../coordination/ChainExchangeRequestModal';

// Local modules
import { syncOwnerPersonalTimes } from './utils/syncUtils';
import { useAlertState } from './hooks/useAlertState';
import { useRequests, useRoomExchangeCounts } from './hooks/useRequests';
import { useViewState } from './hooks/useViewState';
import { useSchedulerState, useMemberModalState } from './hooks/useSchedulerState';
import {
  createHandleRequestSlot,
  createHandleCancelRequest,
  createHandleRequestWithUpdate,
  createHandleRequestFromModal,
  createHandleChangeRequest
} from './handlers/requestHandlers';
import {
  RoomHeader,
  TimetableControls,
  RequestSection,
  RoomList,
  ScheduleErrorAlert,
  UnassignedMembersAlert,
  ConflictSuggestionsAlert,
  TravelErrorAlert,
  LoadingSpinner,
  ErrorDisplay
} from './components';

/**
 * [CoordinationTab]
 * @description '협업' 기능 전체를 관장하는 메인 컨테이너 컴포넌트.
 *              방 목록 뷰와 방 상세 뷰 사이를 전환하며, 모든 데이터 페칭, 상태 관리,
 *              사용자 상호작용 핸들링, 모달 관리 등을 총괄합니다.
 * @param {object} user - 현재 로그인된 사용자 정보 객체
 * @param {function} onExchangeRequestCountChange - 상위 컴포넌트로 교환 요청 개수 변경을 알리는 콜백 함수
 * @returns {JSX.Element} '협업' 탭의 JSX 엘리먼트
 */
const CoordinationTab = ({ user, onExchangeRequestCountChange }) => {
  // Custom hooks - order matters for dependencies
  const { customAlert, showAlert, closeAlert } = useAlertState();
  const { sentRequests, receivedRequests, setSentRequests, setReceivedRequests, loadSentRequests, loadReceivedRequests, chainExchangeRequests, setChainExchangeRequests, loadChainExchangeRequests } = useRequests(user);

  // 4.txt: 연쇄 교환 요청 모달 상태
  const [showChainExchangeModal, setShowChainExchangeModal] = useState(false);
  const [selectedChainRequest, setSelectedChainRequest] = useState(null);

  

  const {
    myRooms, currentRoom, isLoading, error,
    setCurrentRoom, fetchMyRooms, fetchRoomDetails,
    createRoom, joinRoom, updateRoom, deleteRoom,
    submitTimeSlots, assignTimeSlot, removeTimeSlot,
    createRequest, cancelRequest, handleRequest
  } = useCoordination(user?.id, onExchangeRequestCountChange, loadSentRequests, showAlert);
  const { roomExchangeCounts, setRoomExchangeCounts, loadRoomExchangeCounts, getRoomRequestCount } = useRoomExchangeCounts(user, myRooms, receivedRequests);

  const {
    viewMode, setViewMode, showFullDay, setShowFullDay, showMerged, setShowMerged,
    selectedSlots, setSelectedSlots, selectedTab, setSelectedTab,
    requestViewMode, setRequestViewMode, showAllRequests, setShowAllRequests,
    expandedSections, setExpandedSections, scheduleOptions, setScheduleOptions,
    currentWeekStartDate, handleWeekChange
  } = useViewState();


  const {
    isScheduling, setIsScheduling, scheduleError, setScheduleError,
    unassignedMembersInfo, setUnassignedMembersInfo, conflictSuggestions, setConflictSuggestions,
    showDeleteConfirm, setShowDeleteConfirm
  } = useSchedulerState();

  const {
    memberStatsModal, setMemberStatsModal, showMemberScheduleModal, setShowMemberScheduleModal,
    selectedMemberId, setSelectedMemberId
  } = useMemberModalState();

  // Coordination modals
  const {
    showCreateRoomModal, showJoinRoomModal, showManageRoomModal,
    showRequestModal, showChangeRequestModal,
    slotToRequest, slotToChange,
    openCreateRoomModal, closeCreateRoomModal,
    openJoinRoomModal, closeJoinRoomModal,
    openManageRoomModal, closeManageRoomModal,
    closeRequestModal, openChangeRequestModal, closeChangeRequestModal
  } = useCoordinationModals();

  // Travel mode - 방장 여부 확인
  const isOwner = currentRoom && user ? isRoomOwner(user, currentRoom) : false;

  const {
    travelMode,
    handleModeChange: handleTravelModeChange,
    isCalculating: isTravelCalculating,
    error: travelError,
    getCurrentScheduleData
  } = useTravelMode(currentRoom, isOwner);

  // 방장 시간표 정보 캐시
  const [ownerScheduleCache, setOwnerScheduleCache] = useState(null);

  // ✨ 조원일 때 방장의 currentTravelMode 자동 동기화
  useEffect(() => {
    if (!isOwner && currentRoom?.currentTravelMode && travelMode !== currentRoom.currentTravelMode) {
      console.log(`🔄 [조원 동기화] 방장의 이동수단 모드 적용: ${currentRoom.currentTravelMode}`);
      handleTravelModeChange(currentRoom.currentTravelMode);
    }
  }, [isOwner, currentRoom?.currentTravelMode, travelMode, handleTravelModeChange]);

  // Additional states
  const [roomModalDefaultTab, setRoomModalDefaultTab] = useState('info');
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDetailGrid, setShowDetailGrid] = useState(false);
  const [showWalkingErrorModal, setShowWalkingErrorModal] = useState(false);
  const [walkingErrorMessage, setWalkingErrorMessage] = useState('');

  // Schedule time settings
  const scheduleStartHour = getHourFromSettings(currentRoom?.settings?.scheduleStart || currentRoom?.settings?.startHour, '9');
  const scheduleEndHour = getHourFromSettings(currentRoom?.settings?.scheduleEnd || currentRoom?.settings?.endHour, '18');
  const effectiveShowFullDay = showFullDay;

  // Refresh callback
  const onRefreshExchangeCount = useCallback(() => loadRoomExchangeCounts(), [loadRoomExchangeCounts]);

  // Sync owner personal times
  useEffect(() => {
    if (currentRoom && user) {
      syncOwnerPersonalTimes(currentRoom, user, fetchRoomDetails, showAlert);
    }
  }, [currentRoom?._id, user?.personalTimes, fetchRoomDetails, showAlert]);

  /**
   * [useEffect - Socket.io 연결 및 실시간 업데이트]
   * @description `currentRoom`이 존재할 때 Socket.IO 서버에 연결하고 해당 방의 'join-room' 이벤트를 emit합니다.
   *              서버로부터 'schedule-confirmed' (자동 확정 완료) 이벤트를 수신하면, 방 정보를 다시 불러와 UI를 업데이트합니다.
   *              컴포넌트 언마운트 시 소켓 연결을 해제하는 클린업 함수를 포함합니다.
   */
  useEffect(() => {
    if (!currentRoom?._id) return;

    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
    const socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling']
    });

    // 방에 참여
    socket.emit('join-room', currentRoom._id);
    console.log(`📡 Socket joined room: ${currentRoom._id}`);

    // 자동 확정 이벤트 수신
    socket.on('schedule-confirmed', async (data) => {
      console.log('📡 Schedule confirmed event received:', data);
      
      // 방 정보 다시 가져오기
      try {
        await fetchRoomDetails(currentRoom._id);
        showAlert('자동배정 시간이 확정되었습니다! 페이지가 업데이트되었습니다.', 'success');
      } catch (error) {
        console.error('Failed to refresh room after auto-confirm:', error);
      }
    });

    // cleanup
    return () => {
      socket.emit('leave-room', currentRoom._id);
      socket.disconnect();
      console.log(`📡 Socket disconnected from room: ${currentRoom._id}`);
    };
  }, [currentRoom?._id, fetchRoomDetails, showAlert]);

  // 방장 시간표 정보 캐시 업데이트
  useEffect(() => {
    if (currentRoom?.owner?.defaultSchedule) {
      setOwnerScheduleCache({
        defaultSchedule: currentRoom.owner.defaultSchedule,
        scheduleExceptions: currentRoom.owner.scheduleExceptions,
        personalTimes: currentRoom.owner.personalTimes
      });
    } else {
      setOwnerScheduleCache(null);
    }
  }, [currentRoom]);

  // Room navigation event handlers
  useEffect(() => {
    const handleClearCurrentRoom = () => setCurrentRoom(null);
    const handleRestoreRoom = async (event) => {
      const { roomId } = event.detail;
      if (roomId) {
        try { await fetchRoomDetails(roomId); }
        catch { setCurrentRoom(null); }
      }
    };
    const handleCoordinationUpdate = async (event) => {
      const { type, roomId } = event.detail;
      if (type === 'timeSwap' && currentRoom?._id && roomId === currentRoom._id) {
        try {
          await fetchRoomDetails(currentRoom._id);
        } catch (error) {
          console.error('Failed to refresh room after time swap:', error);
        }
      }
    };
    window.addEventListener('clearCurrentRoom', handleClearCurrentRoom);
    window.addEventListener('restoreRoom', handleRestoreRoom);
    window.addEventListener('coordinationUpdate', handleCoordinationUpdate);
    return () => {
      window.removeEventListener('clearCurrentRoom', handleClearCurrentRoom);
      window.removeEventListener('restoreRoom', handleRestoreRoom);
      window.removeEventListener('coordinationUpdate', handleCoordinationUpdate);
    };
  }, [setCurrentRoom, fetchRoomDetails, currentRoom]);

  // Initial data load
  useEffect(() => {
    if (user?.id) {
      fetchMyRooms();
      setTimeout(() => {
        loadRoomExchangeCounts();
        loadSentRequests();
        loadReceivedRequests();
        loadChainExchangeRequests();
      }, 100);
    }
  }, [user?.id]);

  /**
   * [useEffect - Polling for requests]
   * @description 5초마다 주기적으로 서버에 새로운 요청(일반/연쇄)이 있는지 폴링하여 데이터를 동기화합니다.
   *              주로 사용자가 다른 기기에서 요청을 수락했을 때의 상태 변경을 감지하기 위해 사용됩니다.
   */
  useEffect(() => {
    if (!user?.id) return;

    const pollInterval = setInterval(() => {
      loadSentRequests();
      loadReceivedRequests();
      loadChainExchangeRequests();
    }, 5000); // 5초마다 새로고침

    return () => clearInterval(pollInterval);
  }, [user?.id, loadSentRequests, loadReceivedRequests, loadChainExchangeRequests]);

  // 4.txt: 연쇄 교환 요청이 있으면 자동으로 모달 표시
  useEffect(() => {
    if (chainExchangeRequests.length > 0 && !showChainExchangeModal) {
      const firstRequest = chainExchangeRequests[0];
      setSelectedChainRequest(firstRequest);
      setShowChainExchangeModal(true);
    }
  }, [chainExchangeRequests]);

  // 4.txt: 연쇄 교환 요청 처리 완료 핸들러
  const handleChainExchangeRequestHandled = async () => {
    await loadChainExchangeRequests();
    if (currentRoom?._id) {
      await fetchRoomDetails(currentRoom._id);
    }
    loadRoomExchangeCounts();
  };

  // Update exchange count
  useEffect(() => {
    if (!onExchangeRequestCountChange) return;
    const count = currentRoom
      ? receivedRequests.filter(req => req.status === 'pending' && req.roomId === currentRoom?._id).length
      : receivedRequests.filter(req => req.status === 'pending').length;
    onExchangeRequestCountChange(count);
  }, [currentRoom, receivedRequests, onExchangeRequestCountChange]);

  // Update room counts
  useEffect(() => {
    if (receivedRequests.length > 0 && myRooms) loadRoomExchangeCounts();
  }, [receivedRequests.length, myRooms?.owned?.length, myRooms?.joined?.length]);

  // Close manage modal when no room
  useEffect(() => {
    if (!currentRoom && showManageRoomModal) closeManageRoomModal();
  }, [currentRoom, showManageRoomModal, closeManageRoomModal]);

  // Re-apply travel mode after scheduling
  useEffect(() => {
    if (travelMode !== 'normal' && currentRoom?.timeSlots?.length > 0) {
      setTimeout(() => handleTravelModeChange(travelMode), 100);
    }
  }, [currentRoom?.timeSlots]);

  // 확정된 이동수단 모드 자동 적용
  useEffect(() => {
    if (currentRoom?.confirmedTravelMode && currentRoom.confirmedTravelMode !== 'normal') {
      console.log(`✅ [확정된 모드 자동 적용] ${currentRoom.confirmedTravelMode}`);
      handleTravelModeChange(currentRoom.confirmedTravelMode);
    }
  }, [currentRoom?._id, currentRoom?.confirmedTravelMode]);

  // Watch for walking mode validation errors and show modal
  useEffect(() => {
    if (travelError && travelError.includes('도보 이동 시간이 1시간을 초과')) {
      setWalkingErrorMessage(travelError);
      setShowWalkingErrorModal(true);
    }
  }, [travelError]);

  // Handler factories
  const handleRequestSlot = createHandleRequestSlot(currentRoom, createRequest, fetchRoomDetails, loadSentRequests, showAlert, closeChangeRequestModal);
  const handleCancelRequestCallback = createHandleCancelRequest(setSentRequests, setReceivedRequests, cancelRequest, loadSentRequests, loadReceivedRequests, onRefreshExchangeCount, showAlert);
  const handleRequestWithUpdateCallback = createHandleRequestWithUpdate(handleRequest, currentRoom, fetchRoomDetails, loadReceivedRequests, loadSentRequests, loadRoomExchangeCounts, onRefreshExchangeCount, showAlert);

  // Room handlers
  const handleCreateRoom = async (roomData) => {
    await createRoom(roomData);
    closeCreateRoomModal();
    fetchMyRooms();
  };

  const handleJoinRoom = async (inviteCode) => {
    await joinRoom(inviteCode);
    closeJoinRoomModal();
    fetchMyRooms();
  };

  const handleRoomClick = async (room) => {
    if (room._id) {
      try {
        await fetchRoomDetails(room._id);
        window.history.pushState({ tab: 'coordination', roomState: 'inRoom', roomId: room._id }, '', '#coordination-room');
      } catch (error) {
        showAlert(`방 접근 실패: ${error.message || error}`);
      }
    } else {
      setCurrentRoom(room);
      window.history.pushState({ tab: 'coordination', roomState: 'inRoom', roomId: room._id }, '', '#coordination-room');
    }
  };

  // Slot handlers
  const handleSubmitSlots = async () => {
    if (!currentRoom || selectedSlots.length === 0) return;
    try {
      await submitTimeSlots(currentRoom._id, selectedSlots);
      setSelectedSlots([]);
      await fetchRoomDetails(currentRoom._id);
    } catch (error) {}
  };


  const handleSlotSelect = (slotData) => {
    setSelectedSlots(prev => {
      const isSelected = prev.some(slot =>
        slot.date.getTime() === slotData.date.getTime() &&
        slot.day === slotData.day &&
        slot.startTime === slotData.startTime
      );
      return isSelected
        ? prev.filter(slot => !(slot.date.getTime() === slotData.date.getTime() && slot.day === slotData.day && slot.startTime === slotData.startTime))
        : [...prev, slotData];
    });
  };

  // Navigation handlers
  const handleBackToRoomList = () => {
    setCurrentRoom(null);
    window.history.pushState({ tab: 'coordination', roomState: null }, '', '#coordination');
  };

  const handleLeaveRoom = async () => {
    if (window.confirm("정말로 이 방을 나가시겠습니까? 배정된 모든 시간이 삭제됩니다.")) {
      try {
        const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
        const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${currentRoom._id}/leave`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
          }
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.msg || 'Failed to leave room');
        }
        alert("방에서 나갔습니다.");
        setCurrentRoom(null);
        fetchMyRooms();
        window.history.pushState({ tab: 'coordination', roomState: null }, '', '#coordination');
      } catch (error) {
        alert(`방 나가기 실패: ${error.message}`);
      }
    }
  };

  // Auto-scheduling callbacks
  const handleResetCarryOverTimesCallback = useCallback(async () => {
    await handleResetCarryOverTimes(currentRoom, fetchRoomDetails, setCurrentRoom, showAlert);
  }, [currentRoom, fetchRoomDetails, setCurrentRoom, showAlert]);

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

  const handleRunAutoScheduleCallback = async () => {
    await handleRunAutoSchedule(currentRoom, currentWeekStartDate, user, scheduleOptions, setIsScheduling, setScheduleError, setUnassignedMembersInfo, setConflictSuggestions, setCurrentRoom, showAlert, viewMode, travelMode);
  };

  const handleDeleteAllSlots = () => setShowDeleteConfirm(true);

  const handleConfirmSchedule = async (skipConfirm = false) => {
    if (!currentRoom?._id) return;

    const autoAssignedSlots = currentRoom.timeSlots?.filter(slot =>
      slot.assignedBy && slot.status === 'confirmed'
    ) || [];

    if (autoAssignedSlots.length === 0) {
      showAlert('확정할 자동배정 시간이 없습니다.');
      return;
    }

    if (!skipConfirm) {
      if (!window.confirm(`${autoAssignedSlots.length}개의 자동배정 시간을 개인일정으로 확정하시겠습니까?`)) {
        return;
      }
    }

    try {
      // travelMode를 함께 전달
      const result = await coordinationService.confirmSchedule(currentRoom._id, travelMode);

      showAlert(
        `${result.confirmedSlotsCount}개의 시간이 ${result.affectedMembersCount}명의 조원과 방장의 개인일정으로 확정되었습니다.`,
        'success'
      );

      await fetchRoomDetails(currentRoom._id);

    } catch (error) {
      showAlert(`확정 처리 실패: ${error.message}`, 'error');
    }
  };

  const executeDeleteAllSlots = async () => {
    if (!currentRoom?._id) return;
    try {
      const updatedRoom = await coordinationService.deleteAllTimeSlots(currentRoom._id);
      setCurrentRoom(updatedRoom);
      handleTravelModeChange('normal'); // 교통수단 상태 초기화
      showAlert('시간표가 모두 삭제되었습니다.');
    } catch (error) {
      showAlert(`시간표 삭제에 실패했습니다: ${error.message}`, 'error');
    }
    setShowDeleteConfirm(false);
  };

  // Modal handlers
  const openLogsModal = () => {
    setRoomModalDefaultTab('logs');
    openManageRoomModal();
  };

  const handleCloseManageRoomModal = () => {
    closeManageRoomModal();
    setRoomModalDefaultTab('info');
  };

  const handleMemberClick = (memberId) => {
    const member = currentRoom?.members?.find(m => (m.user._id || m.user.id) === memberId);
    if (member) setMemberStatsModal({ isOpen: true, member });
  };

  const handleMemberScheduleClick = (memberId) => {
    setSelectedMemberId(memberId);
    setShowMemberScheduleModal(true);
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    setShowDetailGrid(true);
  };

  const handleCloseDetailGrid = () => {
    setShowDetailGrid(false);
    setSelectedDate(null);
  };

  const handleCloseWalkingErrorModal = () => {
    setShowWalkingErrorModal(false);
    setWalkingErrorMessage('');
  };

  // Loading/Error states
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error} />;

  // In-Room View
  if (currentRoom) {
    // isOwner는 이미 167번 줄에서 계산됨
    const scheduleData = getCurrentScheduleData();
    
    console.log('🔍 [CoordinationTab] scheduleData:', {
      timeSlots개수: scheduleData.timeSlots?.length,
      travelSlots개수: scheduleData.travelSlots?.length,
      travelMode: scheduleData.travelMode,
      '수업_샘플': scheduleData.timeSlots?.filter(s => !s.isTravel).slice(0, 3).map(s => ({
        시작: s.startTime,
        종료: s.endTime
      }))
    });

    return (
      <div className="p-1">
        <RoomHeader
          currentRoom={currentRoom}
          user={user}
          isOwner={isOwner}
          onManageRoom={openManageRoomModal}
          onOpenLogs={openLogsModal}
          onBackToRoomList={handleBackToRoomList}
          onLeaveRoom={handleLeaveRoom}
        />

        <div className="flex gap-2 items-start">
          <div className="flex-shrink-0 flex flex-col" style={{height: 'calc(100vh - 200px)'}}>
              <div className="invisible h-0 overflow-hidden whitespace-nowrap">
                00000000000000000000000000000000000000000000000000000000
              </div>

              {isOwner && (
                <AutoSchedulerPanel
                  options={scheduleOptions}
                  setOptions={setScheduleOptions}
                  onRun={handleRunAutoScheduleCallback}
                  isLoading={isScheduling}
                  currentRoom={currentRoom}
                  onResetCarryOverTimes={handleResetCarryOverTimesCallback}
                  onResetCompletedTimes={handleResetCompletedTimesCallback}
                  onClearAllCarryOverHistories={handleClearAllCarryOverHistoriesCallback}
                  onDeleteAllSlots={handleDeleteAllSlots}
                  onConfirmSchedule={handleConfirmSchedule}
                  currentWeekStartDate={currentWeekStartDate}
                />
              )}
              <MemberList
                currentRoom={currentRoom}
                user={user}
                isOwner={isOwner}
                onMemberClick={handleMemberClick}
                onMemberScheduleClick={handleMemberScheduleClick}
                showAlert={showAlert}
              />

              {!isOwner && (
                <RequestSection
                  currentRoom={currentRoom}
                  currentUser={user}
                  requestViewMode={requestViewMode}
                  setRequestViewMode={setRequestViewMode}
                  receivedRequests={receivedRequests}
                  sentRequests={sentRequests}
                  showAllRequests={showAllRequests}
                  setShowAllRequests={setShowAllRequests}
                  expandedSections={expandedSections}
                  setExpandedSections={setExpandedSections}
                  handleRequestWithUpdate={handleRequestWithUpdateCallback}
                  handleCancelRequest={handleCancelRequestCallback}
                />
              )}
            </div>

            <div className="flex-grow">
            <ScheduleErrorAlert scheduleError={scheduleError} />
            <UnassignedMembersAlert unassignedMembersInfo={unassignedMembersInfo} />
            <ConflictSuggestionsAlert conflictSuggestions={conflictSuggestions} />

            {currentRoom?.autoConfirmAt && (
              <AutoConfirmBanner
                autoConfirmAt={currentRoom.autoConfirmAt}
                isOwner={isOwner}
              />
            )}

            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 sm:p-4 w-full" style={{height: 'calc(100vh - 200px)', overflow: 'auto'}}>
              <TimetableControls
                viewMode={viewMode}
                setViewMode={setViewMode}
                showFullDay={showFullDay}
                setShowFullDay={setShowFullDay}
                showMerged={showMerged}
                setShowMerged={setShowMerged}
                travelMode={travelMode}
                onTravelModeChange={handleTravelModeChange}
                isTravelCalculating={isTravelCalculating}
                currentRoom={currentRoom}
                isOwner={isOwner}
                scheduleStartHour={scheduleStartHour}
                scheduleEndHour={scheduleEndHour}
              />

              <TravelErrorAlert travelError={travelError && !travelError.includes('도보 이동 시간이 1시간을 초과') ? travelError : null} />

              {viewMode === 'week' ? (
                <TimetableGrid
                  key={`week-${effectiveShowFullDay ? 'full' : 'basic'}-${showMerged ? 'merged' : 'split'}-${travelMode}`}
                  roomId={currentRoom._id}
                  roomSettings={{ ...currentRoom.settings, startHour: effectiveShowFullDay ? 0 : scheduleStartHour, endHour: effectiveShowFullDay ? 24 : scheduleEndHour }}
                  timeSlots={scheduleData.timeSlots}
                  travelSlots={scheduleData.travelSlots || []}
                  travelMode={scheduleData.travelMode}
                  members={currentRoom.members || []}
                  roomData={currentRoom}
                  currentUser={user}
                  isRoomOwner={isOwner}
                  selectedSlots={[]}
                  onSlotSelect={null}
                  onWeekChange={handleWeekChange}
                  ownerOriginalSchedule={ownerScheduleCache}
                  initialStartDate={currentWeekStartDate}
                  calculateEndTime={calculateEndTime}
                  readOnly={isOwner}
                  showMerged={showMerged}
                  onOpenChangeRequestModal={openChangeRequestModal}
                />
              ) : (
                <CoordinationCalendarView
                  roomData={currentRoom}
                  timeSlots={scheduleData.timeSlots}
                  travelSlots={scheduleData.travelSlots || []}
                  travelMode={scheduleData.travelMode}
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

        {/* Modals */}
        {showManageRoomModal && currentRoom && (
          <RoomManagementModal
            room={currentRoom}
            onClose={handleCloseManageRoomModal}
            updateRoom={updateRoom}
            deleteRoom={deleteRoom}
            defaultTab={roomModalDefaultTab}
            onRoomUpdated={(updatedRoom) => { setCurrentRoom(updatedRoom); fetchMyRooms(); }}
          />
        )}


        {showRequestModal && slotToRequest && (
          <RequestSlotModal
            onClose={closeRequestModal}
            onRequest={createHandleRequestFromModal(currentRoom, slotToRequest, handleRequestSlot, closeRequestModal)}
            slotInfo={slotToRequest}
          />
        )}

        {showChangeRequestModal && slotToChange && (
          <ChangeRequestModal
            onClose={closeChangeRequestModal}
            onRequestChange={createHandleChangeRequest(currentRoom, slotToChange, handleRequestSlot)}
            slotToChange={slotToChange}
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

        {showDetailGrid && selectedDate && (
          <CoordinationDetailGrid
            selectedDate={selectedDate}
            timeSlots={scheduleData.timeSlots}
                  travelSlots={scheduleData.travelSlots || []}
                  travelMode={scheduleData.travelMode}
            members={currentRoom.members || []}
            currentUser={user}
            isRoomOwner={isOwner}
            roomData={currentRoom}
            showMerged={showMerged}
            onClose={handleCloseDetailGrid}
            onSlotSelect={null}
            selectedSlots={[]}
            onRequestSlot={handleRequestSlot}
            onRemoveSlot={async (slotData) => {
              await removeTimeSlot(currentRoom._id, slotData.day, slotData.startTime, slotData.endTime);
              await fetchRoomDetails(currentRoom._id);
            }}
            ownerOriginalSchedule={ownerScheduleCache}
          />
        )}

        {showMemberScheduleModal && selectedMemberId && (
          <MemberScheduleModal
            memberId={selectedMemberId}
            onClose={() => { setShowMemberScheduleModal(false); setSelectedMemberId(null); }}
          />
        )}

        <ChainExchangeRequestModal
          isOpen={showChainExchangeModal}
          onClose={() => { setShowChainExchangeModal(false); setSelectedChainRequest(null); }}
          request={selectedChainRequest}
          roomId={selectedChainRequest?.roomId}
          onRequestHandled={handleChainExchangeRequestHandled}
        />

        <CustomAlertModal
          isOpen={showWalkingErrorModal}
          onClose={handleCloseWalkingErrorModal}
          title="도보 모드 사용 불가"
          message={walkingErrorMessage}
          type="warning"
          showCancel={false}
        />
      </div>
    );
  }

  // Room List View
  return (
    <>
      <RoomList
        myRooms={myRooms}
        selectedTab={selectedTab}
        setSelectedTab={setSelectedTab}
        roomExchangeCounts={roomExchangeCounts}
        onRoomClick={handleRoomClick}
        onCreateRoom={openCreateRoomModal}
        onJoinRoom={openJoinRoomModal}
      />

      {showCreateRoomModal && (
        <RoomCreationModal
          onClose={closeCreateRoomModal}
          onCreateRoom={handleCreateRoom}
          ownerProfileSchedule={user ? { defaultSchedule: user.defaultSchedule, scheduleExceptions: user.scheduleExceptions, personalTimes: user.personalTimes } : null}
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

      <ChainExchangeRequestModal
        isOpen={showChainExchangeModal}
        onClose={() => { setShowChainExchangeModal(false); setSelectedChainRequest(null); }}
        request={selectedChainRequest}
        roomId={selectedChainRequest?.roomId}
        onRequestHandled={handleChainExchangeRequestHandled}
      />
    </>
  );
};

export default CoordinationTab;
