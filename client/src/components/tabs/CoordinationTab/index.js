/**
 * ===================================================================================================
 * [파일명] CoordinationTab/index.js - '협업' 탭의 메인 컨테이너 컴포넌트
 * ===================================================================================================
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
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
  handleRunAutoSchedule,
  handleValidateScheduleWithTransportMode
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
import OptimalTimeModal from '../../modals/OptimalTimeModal';

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
  WarningsAlert,
  TravelErrorAlert,
  LoadingSpinner,
  ErrorDisplay
} from './components';
import { Clock, Users, Mail, Settings, MessageSquare, X, Menu as MenuIcon, Info } from 'lucide-react';
import ChatBox from '../../chat/ChatBox';
import { useChatEnhanced } from '../../../hooks/useChat/enhanced';
import ConversationalRoomView from '../../coordination/ConversationalRoomView';

/**
 * [CoordinationTab]
 */
const CoordinationTab = ({ user, onExchangeRequestCountChange, hideHeader = false, initialClear = false, isMobile = false, onRoomStatusChange }) => {
  const { customAlert, showAlert, closeAlert } = useAlertState();
  const { sentRequests, receivedRequests, setSentRequests, setReceivedRequests, loadSentRequests, loadReceivedRequests, chainExchangeRequests, setChainExchangeRequests, loadChainExchangeRequests } = useRequests(user);

  const isConfirmingRef = useRef(false);
  const [renderKey, setRenderKey] = useState(0);
  const [mobileTab, setMobileTab] = useState('timetable');
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  const [showChainExchangeModal, setShowChainExchangeModal] = useState(false);
  const [selectedChainRequest, setSelectedChainRequest] = useState(null);

  const {
    myRooms, currentRoom, isLoading, error,
    setCurrentRoom, fetchMyRooms, fetchRoomDetails,
    createRoom, joinRoom, updateRoom, deleteRoom,
    submitTimeSlots, assignTimeSlot, removeTimeSlot,
    createRequest, cancelRequest, handleRequest,
    setAutoConfirmDuration
  } = useCoordination(user?.id, onExchangeRequestCountChange, loadSentRequests, showAlert, initialClear);

  useEffect(() => {
     if (onRoomStatusChange) {
        onRoomStatusChange(!!currentRoom);
     }
  }, [currentRoom, onRoomStatusChange]);

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
    warnings, setWarnings,
    showDeleteConfirm, setShowDeleteConfirm
  } = useSchedulerState();

  const {
    memberStatsModal, setMemberStatsModal, showMemberScheduleModal, setShowMemberScheduleModal,
    selectedMemberId, setSelectedMemberId
  } = useMemberModalState();

  const {
    showCreateRoomModal, showJoinRoomModal, showManageRoomModal,
    showRequestModal, showChangeRequestModal,
    slotToRequest, slotToChange,
    openCreateRoomModal, closeCreateRoomModal,
    openJoinRoomModal, closeJoinRoomModal,
    openManageRoomModal, closeManageRoomModal,
    closeRequestModal, openChangeRequestModal, closeChangeRequestModal
  } = useCoordinationModals();

  // 모바일 그룹 뷰의 커스텀 이벤트 리스너 추가
  useEffect(() => {
    const handleOpenCreateRoom = () => {
      console.log('🚀 [CoordinationTab] openCreateRoom 이벤트 수신');
      openCreateRoomModal();
    };
    const handleOpenJoinRoom = () => {
      console.log('🚀 [CoordinationTab] openJoinRoom 이벤트 수신');
      openJoinRoomModal();
    };

    window.addEventListener('openCreateRoom', handleOpenCreateRoom);
    window.addEventListener('openJoinRoom', handleOpenJoinRoom);

    return () => {
      window.removeEventListener('openCreateRoom', handleOpenCreateRoom);
      window.removeEventListener('openJoinRoom', handleOpenJoinRoom);
    };
  }, [openCreateRoomModal, openJoinRoomModal]);

  const isOwner = currentRoom && user ? isRoomOwner(user, currentRoom) : false;

  const {
    travelMode,
    handleModeChange: handleTravelModeChangeInternal,
    confirmTravelMode: confirmTravelModeInternal,
    isCalculating: isTravelCalculating,
    error: travelError,
    enhancedSchedule,
    getCurrentScheduleData,
    myTravelDuration
  } = useTravelMode(currentRoom, isOwner, user);

  const handleTravelModeChange = useCallback(async (newMode) => {
    if (newMode === 'normal') { await handleTravelModeChangeInternal(newMode); return; }
    if (!isOwner) { await handleTravelModeChangeInternal(newMode); return; }
    if (currentRoom) {
      try {
        await handleValidateScheduleWithTransportMode(currentRoom, newMode, showAlert, viewMode, currentWeekStartDate);
        await handleTravelModeChangeInternal(newMode);
      } catch (error) { showAlert('검증 오류', 'error'); }
    }
  }, [handleTravelModeChangeInternal, currentRoom, showAlert, viewMode, currentWeekStartDate, isOwner]);

  const handleConfirmTravelMode = useCallback(async () => {
    if (!isOwner) return;
    try {
      const scheduleData = getCurrentScheduleData();
      await coordinationService.applyTravelMode(currentRoom._id, travelMode, scheduleData);
      if (await confirmTravelModeInternal()) {
        showAlert('모드 적용됨', 'success');
        await fetchRoomDetails(currentRoom._id);
      }
    } catch (error) { showAlert(`실패: ${error.message}`, 'error'); }
  }, [confirmTravelModeInternal, travelMode, currentRoom, showAlert, isOwner, getCurrentScheduleData, fetchRoomDetails]);

  const [ownerScheduleCache, setOwnerScheduleCache] = useState(null);

  useEffect(() => {
    if (!isOwner && currentRoom?.currentTravelMode && travelMode !== currentRoom.currentTravelMode) {
      handleTravelModeChange(currentRoom.currentTravelMode);
    }
  }, [isOwner, currentRoom?.currentTravelMode, travelMode, handleTravelModeChange]);

  const [roomModalDefaultTab, setRoomModalDefaultTab] = useState('info');
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDetailGrid, setShowDetailGrid] = useState(false);
  const [showWalkingErrorModal, setShowWalkingErrorModal] = useState(false);
  const [walkingErrorMessage, setWalkingErrorMessage] = useState('');
  const [showOptimalTimeModal, setShowOptimalTimeModal] = useState(false);

  const scheduleStartHour = getHourFromSettings(currentRoom?.settings?.scheduleStart || currentRoom?.settings?.startHour, '9');
  const scheduleEndHour = getHourFromSettings(currentRoom?.settings?.scheduleEnd || currentRoom?.settings?.endHour, '18');
  const effectiveShowFullDay = showFullDay;

  const onRefreshExchangeCount = useCallback(() => loadRoomExchangeCounts(), [loadRoomExchangeCounts]);

  useEffect(() => {
    if (currentRoom && user) syncOwnerPersonalTimes(currentRoom, user, fetchRoomDetails, showAlert);
  }, [currentRoom?._id, user?.personalTimes, fetchRoomDetails, showAlert]);

  useEffect(() => {
    if (!currentRoom?._id) return;
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
    const socket = io(API_BASE_URL, { transports: ['websocket', 'polling'] });
    socket.emit('join-room', currentRoom._id);
    socket.on('schedule-confirmed', async () => {
      await fetchRoomDetails(currentRoom._id);
      window.dispatchEvent(new CustomEvent('refreshUser'));
      showAlert('일정이 확정되었습니다.', 'success');
    });
    return () => { socket.disconnect(); };
  }, [currentRoom?._id, fetchRoomDetails, showAlert]);

  // CustomEvent 리스너: 채팅에서 일정 확정 시 새로고침
  useEffect(() => {
    const handleScheduleConfirmed = async () => {
      if (currentRoom?._id) {
        await fetchRoomDetails(currentRoom._id);
        window.dispatchEvent(new CustomEvent('refreshUser'));
      }
    };

    window.addEventListener('schedule-confirmed', handleScheduleConfirmed);
    return () => window.removeEventListener('schedule-confirmed', handleScheduleConfirmed);
  }, [currentRoom?._id, fetchRoomDetails]);

  useEffect(() => {
    if (currentRoom?.owner?.defaultSchedule) {
      setOwnerScheduleCache({
        defaultSchedule: currentRoom.owner.defaultSchedule,
        scheduleExceptions: currentRoom.owner.scheduleExceptions,
        personalTimes: currentRoom.owner.personalTimes,
        _timestamp: Date.now()
      });
      setRenderKey(p => p + 1);
    }
  }, [currentRoom]);

  useEffect(() => {
    const handleClear = () => setCurrentRoom(null);
    const handleRestore = async (e) => { if (e.detail.roomId) await fetchRoomDetails(e.detail.roomId); };
    window.addEventListener('clearCurrentRoom', handleClear);
    window.addEventListener('restoreRoom', handleRestore);
    return () => {
      window.removeEventListener('clearCurrentRoom', handleClear);
      window.removeEventListener('restoreRoom', handleRestore);
    };
  }, [setCurrentRoom, fetchRoomDetails]);

  useEffect(() => {
    if (user?.id) {
      fetchMyRooms();
      loadRoomExchangeCounts();
      loadSentRequests();
      loadReceivedRequests();
      loadChainExchangeRequests();
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const pollInterval = setInterval(() => { loadSentRequests(); loadReceivedRequests(); loadChainExchangeRequests(); }, 5000);
    return () => clearInterval(pollInterval);
  }, [user?.id, loadSentRequests, loadReceivedRequests, loadChainExchangeRequests]);

  useEffect(() => {
    if (chainExchangeRequests.length > 0 && !showChainExchangeModal) {
      setSelectedChainRequest(chainExchangeRequests[0]);
      setShowChainExchangeModal(true);
    }
  }, [chainExchangeRequests, showChainExchangeModal]);

  const handleChainExchangeRequestHandled = async () => {
    await loadChainExchangeRequests();
    if (currentRoom?._id) { await fetchRoomDetails(currentRoom._id); }
    loadRoomExchangeCounts();
  };

  useEffect(() => {
    if (!onExchangeRequestCountChange) return;
    const count = currentRoom
      ? receivedRequests.filter(req => req.status === 'pending' && req.roomId === currentRoom?._id).length
      : receivedRequests.filter(req => req.status === 'pending').length;
    onExchangeRequestCountChange(count);
  }, [currentRoom, receivedRequests, onExchangeRequestCountChange]);

  const [eventAddedKey, setEventAddedKey] = useState(0);
  const [eventActions, setEventActions] = useState({ addEvent: async () => {}, deleteEvent: async () => {}, editEvent: async () => {} });
  const [pendingRequest, setPendingRequest] = useState(null);
  const chatEnhanced = useChatEnhanced(!!user, setEventAddedKey, eventActions);

  const handleChatMessage = async (message, context = {}) => {
     try {
        if (!chatEnhanced?.handleChatMessage) return { success: false, message: '준비 중...' };
        const res = await chatEnhanced.handleChatMessage(message, {
           context: 'coordination', roomId: currentRoom?._id, currentEvents: [], pendingRequest, ...context
        });
        if (res.needsConfirmation && res.pendingRequest) setPendingRequest(res.pendingRequest);
        else if (res.clearPending) setPendingRequest(null);
        if (currentRoom?._id) fetchRoomDetails(currentRoom._id, true);
        return res;
     } catch (e) { return { success: false, message: '오류 발생' }; }
  };

  const handleRequestSlot = createHandleRequestSlot(currentRoom, createRequest, fetchRoomDetails, loadSentRequests, showAlert, closeChangeRequestModal);
  const handleCancelRequestCallback = createHandleCancelRequest(setSentRequests, setReceivedRequests, cancelRequest, loadSentRequests, loadReceivedRequests, onRefreshExchangeCount, showAlert);
  const handleRequestWithUpdateCallback = createHandleRequestWithUpdate(handleRequest, currentRoom, fetchRoomDetails, loadReceivedRequests, loadSentRequests, loadRoomExchangeCounts, onRefreshExchangeCount, showAlert);

  const handleCreateRoom = async (d) => { await createRoom(d); closeCreateRoomModal(); fetchMyRooms(); };
  const handleJoinRoom = async (c) => { await joinRoom(c); closeJoinRoomModal(); fetchMyRooms(); };
  const handleRoomClick = async (r) => {
    if (r._id) { await fetchRoomDetails(r._id); window.history.pushState({ tab: 'coordination', roomState: 'inRoom', roomId: r._id }, '', '#coordination-room'); }
    else { setCurrentRoom(r); }
  };

  const handleBackToRoomList = () => { setCurrentRoom(null); window.history.pushState({ tab: 'coordination', roomState: null }, '', '#coordination'); };
  const handleLeaveRoom = async () => {
    if (window.confirm("방을 나가시겠습니까?")) {
      const token = await auth.currentUser?.getIdToken();
      await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/coordination/rooms/${currentRoom._id}/leave`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      setCurrentRoom(null); fetchMyRooms();
    }
  };

  const handleResetCarryOverTimesCallback = useCallback(async () => { await handleResetCarryOverTimes(currentRoom, fetchRoomDetails, setCurrentRoom, showAlert); }, [currentRoom, fetchRoomDetails, setCurrentRoom, showAlert]);
  const handleResetCompletedTimesCallback = useCallback(async () => { await handleResetCompletedTimes(currentRoom, fetchRoomDetails, setCurrentRoom, showAlert); }, [currentRoom, fetchRoomDetails, setCurrentRoom, showAlert]);
  const handleClearAllCarryOverHistoriesCallback = useCallback(async () => {
    if (window.confirm('초기화하시겠습니까?')) {
      const res = await coordinationService.clearAllCarryOverHistories(currentRoom._id);
      showAlert(res.msg, 'success'); setCurrentRoom(res.room);
    }
  }, [currentRoom, setCurrentRoom, showAlert]);

  const handleRunAutoScheduleCallback = async () => { await handleRunAutoSchedule(currentRoom, currentWeekStartDate, user, scheduleOptions, setIsScheduling, setScheduleError, setUnassignedMembersInfo, setConflictSuggestions, setWarnings, setCurrentRoom, showAlert, viewMode, travelMode); };
  const handleConfirmSchedule = async () => {
    if (isConfirmingRef.current) return;
    isConfirmingRef.current = true;
    try {
      await coordinationService.confirmSchedule(currentRoom._id, travelMode);
      showAlert('확정되었습니다.', 'success'); await fetchRoomDetails(currentRoom._id);
    } finally { isConfirmingRef.current = false; }
  };

  const executeDeleteAllSlots = async () => {
    if (!currentRoom?._id) return;
    try {
      await coordinationService.deleteAllTimeSlots(currentRoom._id);
      await handleTravelModeChangeInternal('normal');
      await fetchRoomDetails(currentRoom._id);
      showAlert('삭제되었습니다.');
    } catch (error) {
      showAlert(`실패: ${error.message}`, 'error');
    }
    setShowDeleteConfirm(false);
  };

  const openLogsModal = () => { setRoomModalDefaultTab('logs'); openManageRoomModal(); };
  const handleCloseManageRoomModal = () => { closeManageRoomModal(); setRoomModalDefaultTab('info'); };
  const handleMemberClick = (memberId) => { const member = currentRoom?.members?.find(m => (m.user._id || m.user.id) === memberId); if (member) setMemberStatsModal({ isOpen: true, member }); };
  const handleMemberScheduleClick = (memberId) => { setSelectedMemberId(memberId); setShowMemberScheduleModal(true); };
  const handleDateClick = (date) => { setSelectedDate(date); setShowDetailGrid(true); };
  const handleCloseDetailGrid = () => { setShowDetailGrid(false); setSelectedDate(null); };
  const handleCloseWalkingErrorModal = () => { setShowWalkingErrorModal(false); setWalkingErrorMessage(''); };

  const renderCommonModals = () => (
    <>
      {showManageRoomModal && currentRoom && (
        <RoomManagementModal room={currentRoom} onClose={handleCloseManageRoomModal} updateRoom={updateRoom} deleteRoom={deleteRoom} defaultTab={roomModalDefaultTab} onRoomUpdated={(updatedRoom) => { setCurrentRoom(updatedRoom); fetchMyRooms(); }} />
      )}
      {showRequestModal && slotToRequest && (
        <RequestSlotModal onClose={closeRequestModal} onRequest={createHandleRequestFromModal(currentRoom, slotToRequest, handleRequestSlot, closeRequestModal)} slotInfo={slotToRequest} />
      )}
      {showChangeRequestModal && slotToChange && (
        <ChangeRequestModal onClose={closeChangeRequestModal} onRequestChange={createHandleChangeRequest(currentRoom, slotToChange, handleRequestSlot)} slotToChange={slotToChange} />
      )}
      {showCreateRoomModal && (
        <RoomCreationModal onClose={closeCreateRoomModal} onCreateRoom={handleCreateRoom} ownerProfileSchedule={user ? { defaultSchedule: user.defaultSchedule, scheduleExceptions: user.scheduleExceptions, personalTimes: user.personalTimes } : null} />
      )}
      {showJoinRoomModal && (
        <RoomJoinModal onClose={closeJoinRoomModal} onJoinRoom={handleJoinRoom} />
      )}
      <CustomAlertModal isOpen={customAlert.show} onClose={closeAlert} title="알림" message={customAlert.message} type={customAlert.type || "warning"} showCancel={false} />
      <MemberStatsModal isOpen={memberStatsModal.isOpen} onClose={() => setMemberStatsModal({ isOpen: false, member: null })} member={memberStatsModal.member} isOwner={isOwner} currentRoom={currentRoom} />
      <CustomAlertModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} onConfirm={executeDeleteAllSlots} title="삭제" message="전체 삭제하시겠습니까?" type="danger" showCancel={true} />
      {showDetailGrid && selectedDate && (
        <CoordinationDetailGrid selectedDate={selectedDate} timeSlots={getCurrentScheduleData().timeSlots} travelSlots={getCurrentScheduleData().travelSlots || []} travelMode={getCurrentScheduleData().travelMode} members={currentRoom.members || []} currentUser={user} isRoomOwner={isOwner} roomData={currentRoom} showMerged={showMerged} onClose={handleCloseDetailGrid} selectedSlots={[]} onRequestSlot={handleRequestSlot} onRemoveSlot={async (s) => { await removeTimeSlot(currentRoom._id, s.day, s.startTime, s.endTime); await fetchRoomDetails(currentRoom._id); }} ownerOriginalSchedule={ownerScheduleCache} />
      )}
      {showMemberScheduleModal && selectedMemberId && ( <MemberScheduleModal memberId={selectedMemberId} onClose={() => setShowMemberScheduleModal(false)} /> )}
      <ChainExchangeRequestModal isOpen={showChainExchangeModal} onClose={() => setShowChainExchangeModal(false)} request={selectedChainRequest} roomId={selectedChainRequest?.roomId} onRequestHandled={handleChainExchangeRequestHandled} />
      <CustomAlertModal isOpen={showWalkingErrorModal} onClose={handleCloseWalkingErrorModal} title="도보 모드 사용 불가" message={walkingErrorMessage} type="warning" showCancel={false} />
      <OptimalTimeModal isOpen={showOptimalTimeModal} onClose={() => setShowOptimalTimeModal(false)} roomId={currentRoom?._id} />
    </>
  );

  if (currentRoom) {
    const scheduleData = getCurrentScheduleData();

    // 🚀 대화형 모드 분기 (Conversational Mode)
    if (currentRoom.mode === 'conversational') {
      return (
        <>
          <ConversationalRoomView
            currentRoom={currentRoom}
            user={user}
            isOwner={isOwner}
            isMobile={isMobile}
            onManageRoom={openManageRoomModal}
            onBackToRoomList={handleBackToRoomList}
            onLeaveRoom={handleLeaveRoom}
            onMemberClick={handleMemberClick}
            onMemberScheduleClick={handleMemberScheduleClick}
            onFindOptimalTime={() => setShowOptimalTimeModal(true)}
          />
          {renderCommonModals()}
        </>
      );
    }

    if (isMobile) {
      return (
        <div className="flex flex-col h-[calc(100vh-60px)] bg-gray-50 relative overflow-hidden">
          <RoomHeader currentRoom={currentRoom} user={user} isOwner={isOwner} onManageRoom={openManageRoomModal} onOpenLogs={openLogsModal} onBackToRoomList={handleBackToRoomList} onLeaveRoom={handleLeaveRoom} isMobile={true} />
          <div className="flex-1 overflow-y-auto pb-24 relative">
            {mobileTab === 'info' && (
               <div className="p-2 space-y-4">
                  {isOwner && (
                     <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex items-center">
                           <Settings size={18} className="text-blue-600 mr-2" />
                           <h3 className="font-bold text-blue-800">방 관리</h3>
                        </div>
                        <div className="p-3">
                           <AutoSchedulerPanel options={scheduleOptions} setOptions={setScheduleOptions} onRun={handleRunAutoScheduleCallback} isLoading={isScheduling} currentRoom={currentRoom} onResetCarryOverTimes={handleResetCarryOverTimesCallback} onResetCompletedTimes={handleResetCompletedTimesCallback} onClearAllCarryOverHistories={handleClearAllCarryOverHistoriesCallback} onDeleteAllSlots={() => setShowDeleteConfirm(true)} onConfirmSchedule={handleConfirmSchedule} currentWeekStartDate={currentWeekStartDate} setAutoConfirmDuration={setAutoConfirmDuration} isMobile={true} />
                        </div>
                     </div>
                  )}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                     <div className="bg-orange-50 px-4 py-3 border-b border-orange-100 flex items-center justify-between">
                        <div className="flex items-center">
                           <Mail size={18} className="text-orange-600 mr-2" />
                           <h3 className="font-bold text-orange-800">요청함</h3>
                        </div>
                        {receivedRequests.filter(r => r.status === 'pending').length > 0 && (
                           <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{receivedRequests.filter(r => r.status === 'pending').length}</span>
                        )}
                     </div>
                     <div className="p-3">
                        <RequestSection currentRoom={currentRoom} currentUser={user} requestViewMode={requestViewMode} setRequestViewMode={setRequestViewMode} receivedRequests={receivedRequests} sentRequests={sentRequests} showAllRequests={showAllRequests} setShowAllRequests={setShowAllRequests} expandedSections={expandedSections} setExpandedSections={setExpandedSections} handleRequestWithUpdate={handleRequestWithUpdateCallback} handleCancelRequest={handleCancelRequestCallback} isMobile={true} />
                     </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                     <div className="bg-green-50 px-4 py-3 border-b border-green-100 flex items-center">
                        <Users size={18} className="text-green-600 mr-2" />
                        <h3 className="font-bold text-green-800">멤버 목록</h3>
                     </div>
                     <div className="p-3">
                        <MemberList currentRoom={currentRoom} user={user} isOwner={isOwner} onMemberClick={handleMemberClick} onMemberScheduleClick={handleMemberScheduleClick} showAlert={showAlert} isMobile={true} />
                     </div>
                  </div>
               </div>
            )}
            {mobileTab === 'timetable' && (
              <div className="p-2">
                <ScheduleErrorAlert scheduleError={scheduleError} />
                <UnassignedMembersAlert unassignedMembersInfo={unassignedMembersInfo} />
                <ConflictSuggestionsAlert conflictSuggestions={conflictSuggestions} />
                {currentRoom?.autoConfirmAt && ( <AutoConfirmBanner key={new Date(currentRoom.autoConfirmAt).getTime()} autoConfirmAt={currentRoom.autoConfirmAt} isOwner={isOwner} /> )}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 overflow-hidden">
                  <TimetableControls viewMode={viewMode} setViewMode={setViewMode} showFullDay={showFullDay} setShowFullDay={setShowFullDay} showMerged={showMerged} setShowMerged={setShowMerged} travelMode={travelMode} onTravelModeChange={handleTravelModeChange} onConfirmTravelMode={handleConfirmTravelMode} isTravelCalculating={isTravelCalculating} currentRoom={currentRoom} isOwner={isOwner} scheduleStartHour={scheduleStartHour} scheduleEndHour={scheduleEndHour} isMobile={true} />
                  <TravelErrorAlert travelError={travelError} />
                  {viewMode === 'week' ? (
                    <TimetableGrid key={`week-${effectiveShowFullDay ? 'full' : 'basic'}-${showMerged ? 'merged' : 'split'}-${travelMode}-${renderKey}`} roomId={currentRoom._id} roomSettings={{ ...currentRoom.settings, startHour: effectiveShowFullDay ? 0 : scheduleStartHour, endHour: effectiveShowFullDay ? 24 : scheduleEndHour }} timeSlots={scheduleData.timeSlots} travelSlots={scheduleData.travelSlots || []} travelMode={scheduleData.travelMode} myTravelDuration={scheduleData.myTravelDuration} members={currentRoom.members || []} roomData={currentRoom} currentUser={user} isRoomOwner={isOwner} selectedSlots={[]} onSlotSelect={null} onWeekChange={handleWeekChange} ownerOriginalSchedule={ownerScheduleCache} initialStartDate={currentWeekStartDate} calculateEndTime={calculateEndTime} readOnly={isOwner} showMerged={showMerged} onOpenChangeRequestModal={openChangeRequestModal} isMobile={true} />
                  ) : (
                    <CoordinationCalendarView key={`calendar-${viewMode}-${renderKey}`} roomData={currentRoom} timeSlots={scheduleData.timeSlots} travelSlots={scheduleData.travelSlots || []} travelMode={scheduleData.travelMode} myTravelDuration={scheduleData.myTravelDuration} members={currentRoom.members || []} currentUser={user} isRoomOwner={isOwner} onDateClick={handleDateClick} selectedDate={selectedDate} viewMode={viewMode} currentWeekStartDate={currentWeekStartDate} onWeekChange={handleWeekChange} showFullDay={effectiveShowFullDay} showMerged={showMerged} ownerOriginalSchedule={ownerScheduleCache} isMobile={true} />
                  )}
                </div>
              </div>
            )}
            <button onClick={() => setIsChatOpen(!isChatOpen)} className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center z-50 active:bg-blue-700 transition-all border-4 border-white">
               {isChatOpen ? <X size={28} /> : <MessageSquare size={28} />}
            </button>
            {isChatOpen && (
               <div className="fixed bottom-24 right-4 z-40">
                  <ChatBox 
                     onSendMessage={handleChatMessage} 
                     currentTab="coordination" 
                     onEventUpdate={() => fetchRoomDetails(currentRoom._id, true)} 
                     forceOpen={true} 
                     isMobile={true} 
                  />
               </div>
            )}
          </div>
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-50 px-2 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <button onClick={() => setMobileTab('info')} className={`flex flex-col items-center justify-center w-1/2 h-full transition-colors ${mobileTab === 'info' ? 'text-blue-600' : 'text-gray-400'}`} >
              <Info size={24} /> <span className="text-xs mt-1 font-bold">정보</span>
            </button>
            <button onClick={() => setMobileTab('timetable')} className={`flex flex-col items-center justify-center w-1/2 h-full transition-colors ${mobileTab === 'timetable' ? 'text-blue-600' : 'text-gray-400'}`} >
              <Clock size={24} /> <span className="text-xs mt-1 font-bold">시간표</span>
            </button>
          </div>
          {renderCommonModals()}
        </div>
      );
    }

    return (
      <div className="p-1">
        <RoomHeader currentRoom={currentRoom} user={user} isOwner={isOwner} onManageRoom={openManageRoomModal} onOpenLogs={openLogsModal} onBackToRoomList={handleBackToRoomList} onLeaveRoom={handleLeaveRoom} />
        <div className="flex gap-2 items-start">
          <div className="flex-shrink-0 flex flex-col" style={{height: 'calc(100vh - 200px)'}}>
              <div className="invisible h-0 overflow-hidden whitespace-nowrap">00000000000000000000000000000000000000000000000000000000</div>
              {isOwner && (
                <AutoSchedulerPanel options={scheduleOptions} setOptions={setScheduleOptions} onRun={handleRunAutoScheduleCallback} isLoading={isScheduling} currentRoom={currentRoom} onResetCarryOverTimes={handleResetCarryOverTimesCallback} onResetCompletedTimes={handleResetCompletedTimesCallback} onClearAllCarryOverHistories={handleClearAllCarryOverHistoriesCallback} onDeleteAllSlots={() => setShowDeleteConfirm(true)} onConfirmSchedule={handleConfirmSchedule} currentWeekStartDate={currentWeekStartDate} setAutoConfirmDuration={setAutoConfirmDuration} />
              )}
              <MemberList currentRoom={currentRoom} user={user} isOwner={isOwner} onMemberClick={handleMemberClick} onMemberScheduleClick={handleMemberScheduleClick} showAlert={showAlert} />
              {!isOwner && (
                <RequestSection currentRoom={currentRoom} currentUser={user} requestViewMode={requestViewMode} setRequestViewMode={setRequestViewMode} receivedRequests={receivedRequests} sentRequests={sentRequests} showAllRequests={showAllRequests} setShowAllRequests={setShowAllRequests} expandedSections={expandedSections} setExpandedSections={setExpandedSections} handleRequestWithUpdate={handleRequestWithUpdateCallback} handleCancelRequest={handleCancelRequestCallback} />
              )}
            </div>
            <div className="flex-grow">
            <ScheduleErrorAlert scheduleError={scheduleError} />
            <UnassignedMembersAlert unassignedMembersInfo={unassignedMembersInfo} />
            <ConflictSuggestionsAlert conflictSuggestions={conflictSuggestions} />
            {currentRoom?.autoConfirmAt && ( <AutoConfirmBanner key={new Date(currentRoom.autoConfirmAt).getTime()} autoConfirmAt={currentRoom.autoConfirmAt} isOwner={isOwner} /> )}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 sm:p-4 w-full" style={{height: 'calc(100vh - 200px)', overflow: 'auto'}}>
              <TimetableControls viewMode={viewMode} setViewMode={setViewMode} showFullDay={showFullDay} setShowFullDay={setShowFullDay} showMerged={showMerged} setShowMerged={setShowMerged} travelMode={travelMode} onTravelModeChange={handleTravelModeChange} onConfirmTravelMode={handleConfirmTravelMode} isTravelCalculating={isTravelCalculating} currentRoom={currentRoom} isOwner={isOwner} scheduleStartHour={scheduleStartHour} scheduleEndHour={scheduleEndHour} />
              <TravelErrorAlert travelError={travelError} />
              {viewMode === 'week' ? (
                <TimetableGrid key={`week-${effectiveShowFullDay ? 'full' : 'basic'}-${showMerged ? 'merged' : 'split'}-${travelMode}-${renderKey}`} roomId={currentRoom._id} roomSettings={{ ...currentRoom.settings, startHour: effectiveShowFullDay ? 0 : scheduleStartHour, endHour: effectiveShowFullDay ? 24 : scheduleEndHour }} timeSlots={scheduleData.timeSlots} travelSlots={scheduleData.travelSlots || []} travelMode={scheduleData.travelMode} myTravelDuration={scheduleData.myTravelDuration} members={currentRoom.members || []} roomData={currentRoom} currentUser={user} isRoomOwner={isOwner} selectedSlots={[]} onSlotSelect={null} onWeekChange={handleWeekChange} ownerOriginalSchedule={ownerScheduleCache} initialStartDate={currentWeekStartDate} calculateEndTime={calculateEndTime} readOnly={isOwner} showMerged={showMerged} onOpenChangeRequestModal={openChangeRequestModal} isMobile={true} />
              ) : (
                <CoordinationCalendarView key={`calendar-${viewMode}-${renderKey}`} roomData={currentRoom} timeSlots={scheduleData.timeSlots} travelSlots={scheduleData.travelSlots || []} travelMode={scheduleData.travelMode} myTravelDuration={scheduleData.myTravelDuration} members={currentRoom.members || []} currentUser={user} isRoomOwner={isOwner} onDateClick={handleDateClick} selectedDate={selectedDate} viewMode={viewMode} currentWeekStartDate={currentWeekStartDate} onWeekChange={handleWeekChange} showFullDay={effectiveShowFullDay} showMerged={showMerged} ownerOriginalSchedule={ownerScheduleCache} isMobile={true} />
              )}
            </div>
          </div>
        </div>
        {renderCommonModals()}
      </div>
    );
  }

  return (
    <>
      <RoomList myRooms={myRooms} selectedTab={selectedTab} setSelectedTab={setSelectedTab} roomExchangeCounts={roomExchangeCounts} onRoomClick={handleRoomClick} onCreateRoom={openCreateRoomModal} onJoinRoom={openJoinRoomModal} hideHeader={hideHeader} />
      {renderCommonModals()}
    </>
  );
};

export default CoordinationTab;