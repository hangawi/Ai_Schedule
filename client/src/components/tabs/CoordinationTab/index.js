// CoordinationTab - Main component (Refactored)

import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '../../../config/firebaseConfig';
import { useCoordination } from '../../../hooks/useCoordination';
import { useCoordinationModals } from '../../../hooks/useCoordinationModals';
import { useTravelMode } from '../../../hooks/useTravelMode';
import { coordinationService } from '../../../services/coordinationService';

// Utils
import { translateEnglishDays } from '../../../utils';
import { isRoomOwner, calculateEndTime, days, getHourFromSettings, countActiveNegotiations } from '../../../utils/coordinationUtils';
import { getViewMode } from '../../../utils/coordinationModeUtils';
import {
  handleAutoResolveNegotiations,
  handleForceResolveNegotiation,
  handleResetCarryOverTimes,
  handleResetCompletedTimes,
  handleClearAllNegotiations,
  handleRunAutoSchedule
} from '../../../utils/coordinationHandlers';

// Components
import TimetableGrid from '../../timetable/TimetableGrid';
import CoordinationCalendarView from '../../calendar/CoordinationCalendarView';
import CoordinationDetailGrid from '../../calendar/CoordinationDetailGrid';
import MemberList from '../../coordination/MemberList';
import AutoSchedulerPanel from '../../scheduler/AutoSchedulerPanel';
import NegotiationSection from '../../coordination/NegotiationSection';

// Modals
import RoomCreationModal from '../../modals/RoomCreationModal';
import RoomJoinModal from '../../modals/RoomJoinModal';
import RoomManagementModal from '../../modals/RoomManagementModal';
import AssignSlotModal from '../../modals/AssignSlotModal';
import RequestSlotModal from '../../modals/RequestSlotModal';
import ChangeRequestModal from '../../modals/ChangeRequestModal';
import CustomAlertModal from '../../modals/CustomAlertModal';
import NotificationModal from '../../modals/NotificationModal';
import NegotiationModal from '../../modals/NegotiationModal';
import NegotiationConflictModal from '../../modals/NegotiationConflictModal';
import MemberStatsModal from '../../modals/MemberStatsModal';
import MemberScheduleModal from '../../modals/MemberScheduleModal';
// 4.txt: 연쇄 교환 요청 모달
import ChainExchangeRequestModal from '../../coordination/ChainExchangeRequestModal';

// Local modules
import { syncOwnerPersonalTimes } from './utils/syncUtils';
import { useAlertState } from './hooks/useAlertState';
import { useRequests, useRoomExchangeCounts } from './hooks/useRequests';
import { useViewState } from './hooks/useViewState';
import { useNegotiationState } from './hooks/useNegotiationState';
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
    showNegotiationModal, setShowNegotiationModal, selectedNegotiation, setSelectedNegotiation,
    showNegotiationAlert, setShowNegotiationAlert, negotiationAlertData, setNegotiationAlertData,
    showConflictModal, setShowConflictModal, conflictNegotiation, setConflictNegotiation,
    currentWeekNegotiations, setCurrentWeekNegotiations
  } = useNegotiationState();

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
    showAssignModal, showRequestModal, showChangeRequestModal,
    slotToAssign, slotToRequest, slotToChange,
    openCreateRoomModal, closeCreateRoomModal,
    openJoinRoomModal, closeJoinRoomModal,
    openManageRoomModal, closeManageRoomModal,
    closeAssignModal, closeRequestModal, openChangeRequestModal, closeChangeRequestModal
  } = useCoordinationModals();

  // Travel mode
  const {
    travelMode,
    handleModeChange: handleTravelModeChange,
    isCalculating: isTravelCalculating,
    error: travelError,
    getCurrentScheduleData
  } = useTravelMode(currentRoom);

  // 방장 시간표 정보 캐시
  const [ownerScheduleCache, setOwnerScheduleCache] = useState(null);

  // Additional states
  const [roomModalDefaultTab, setRoomModalDefaultTab] = useState('info');
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDetailGrid, setShowDetailGrid] = useState(false);

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
        // 4.txt: 연쇄 교환 요청 로드
        loadChainExchangeRequests();
      }, 100);
    }
  }, [user?.id]);

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

  const handleAssignSlot = async (assignmentData) => {
    if (!currentRoom) return;
    await assignTimeSlot(assignmentData.roomId, assignmentData.day, assignmentData.startTime, assignmentData.endTime, assignmentData.userId);
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
  const handleAutoResolveNegotiationsCallback = useCallback(async () => {
    await handleAutoResolveNegotiations(currentRoom, fetchRoomDetails, showAlert);
  }, [currentRoom, fetchRoomDetails, showAlert]);

  const handleForceResolveNegotiationCallback = useCallback(async (negotiationId, method = 'random') => {
    await handleForceResolveNegotiation(currentRoom, negotiationId, fetchRoomDetails, showAlert, method);
  }, [currentRoom, fetchRoomDetails, showAlert]);

  const handleResetCarryOverTimesCallback = useCallback(async () => {
    await handleResetCarryOverTimes(currentRoom, fetchRoomDetails, setCurrentRoom, showAlert);
  }, [currentRoom, fetchRoomDetails, setCurrentRoom, showAlert]);

  const handleResetCompletedTimesCallback = useCallback(async () => {
    await handleResetCompletedTimes(currentRoom, fetchRoomDetails, setCurrentRoom, showAlert);
  }, [currentRoom, fetchRoomDetails, setCurrentRoom, showAlert]);

  const handleClearAllNegotiationsCallback = useCallback(async () => {
    await handleClearAllNegotiations(currentRoom, fetchRoomDetails, setCurrentRoom, showAlert);
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
    await handleRunAutoSchedule(currentRoom, currentWeekStartDate, user, scheduleOptions, setIsScheduling, setScheduleError, setUnassignedMembersInfo, setConflictSuggestions, setCurrentRoom, setNegotiationAlertData, setShowNegotiationAlert, showAlert, viewMode, travelMode);
  };

  const handleDeleteAllSlots = () => setShowDeleteConfirm(true);

  const executeDeleteAllSlots = async () => {
    if (!currentRoom?._id) return;
    try {
      const updatedRoom = await coordinationService.deleteAllTimeSlots(currentRoom._id);
      setCurrentRoom(updatedRoom);
      showAlert('시간표가 모두 삭제되었습니다.');
    } catch (error) {
      showAlert(`시간표 삭제에 실패했습니다: ${error.message}`, 'error');
    }
    setShowDeleteConfirm(false);
  };

  // Negotiation handlers
  const handleOpenNegotiation = useCallback((negotiationData) => {
    const otherActiveNegotiations = (currentRoom?.negotiations || []).filter(nego => {
      if (nego.status !== 'active' || nego._id === negotiationData._id) return false;
      if (negotiationData.weekStartDate && nego.weekStartDate && nego.weekStartDate !== negotiationData.weekStartDate) return false;
      return nego.conflictingMembers?.some(cm => {
        const cmUserId = cm.user?._id || cm.user?.id || cm.user;
        return cmUserId === user?.id || cmUserId?.toString() === user?.id?.toString();
      });
    });

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
      setConflictNegotiation(respondedNego);
      setShowConflictModal(true);
      return;
    }

    setSelectedNegotiation(negotiationData);
    setShowNegotiationModal(true);
  }, [currentRoom?.negotiations, user?.id]);

  const handleCloseNegotiation = useCallback(() => {
    setShowNegotiationModal(false);
    setSelectedNegotiation(null);
  }, []);

  const handleNegotiationRefresh = useCallback(async () => {
    if (currentRoom?._id) await fetchRoomDetails(currentRoom._id);
  }, [currentRoom?._id, fetchRoomDetails]);

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

  // Loading/Error states
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error} />;

  // Room view
  if (currentRoom) {
    const isOwner = isRoomOwner(user, currentRoom);
    const scheduleData = getCurrentScheduleData();

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

        <div className="flex flex-col lg:flex-row gap-4 w-full">
          {/* Left sidebar */}
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
                onClearAllNegotiations={handleClearAllNegotiationsCallback}
                onClearAllCarryOverHistories={handleClearAllCarryOverHistoriesCallback}
                onDeleteAllSlots={handleDeleteAllSlots}
                currentWeekStartDate={currentWeekStartDate}
                activeNegotiationsCount={countActiveNegotiations(currentRoom)}
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

            <NegotiationSection
              currentWeekNegotiations={currentWeekNegotiations}
              allNegotiations={currentRoom?.negotiations || []}
              user={user}
              onOpenNegotiation={handleOpenNegotiation}
              isOwner={isOwner}
              currentWeekStartDate={currentWeekStartDate}
            />
          </div>

          {/* Main content */}
          <div className="lg:w-3/4 w-full flex-grow min-w-0">
            <ScheduleErrorAlert scheduleError={scheduleError} />
            <UnassignedMembersAlert unassignedMembersInfo={unassignedMembersInfo} />
            <ConflictSuggestionsAlert conflictSuggestions={conflictSuggestions} />

            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 sm:p-4 mt-4">
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

              <TravelErrorAlert travelError={travelError} />

              {/* Timetable view */}
              {viewMode === 'week' ? (
                <TimetableGrid
                  key={`week-${effectiveShowFullDay ? 'full' : 'basic'}-${showMerged ? 'merged' : 'split'}-${travelMode}`}
                  roomId={currentRoom._id}
                  roomSettings={{ ...currentRoom.settings, startHour: effectiveShowFullDay ? 0 : scheduleStartHour, endHour: effectiveShowFullDay ? 24 : scheduleEndHour }}
                  timeSlots={scheduleData.timeSlots}
                  travelSlots={scheduleData.travelSlots || []}
                  travelMode={travelMode}
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
                  onCurrentWeekNegotiationsChange={setCurrentWeekNegotiations}
                  onOpenChangeRequestModal={openChangeRequestModal}
                />
              ) : (
                <CoordinationCalendarView
                  roomData={currentRoom}
                  timeSlots={scheduleData.timeSlots}
                  travelSlots={scheduleData.travelSlots || []}
                  travelMode={travelMode}
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
            slotInfo={slotToAssign}
            members={currentRoom.members}
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

        <NotificationModal
          isOpen={showNegotiationAlert}
          onClose={() => setShowNegotiationAlert(false)}
          type="info"
          title="협의가 필요한 시간대가 있습니다"
          message={negotiationAlertData ? `귀하가 참여해야 하는 ${negotiationAlertData.count}개의 협의가 있습니다.${negotiationAlertData.totalCount > negotiationAlertData.count ? ` (전체 ${negotiationAlertData.totalCount}개 중)` : ''} 시간표의 '협의중' 슬롯을 클릭하여 참여하세요. 24시간 후 자동으로 해결됩니다.` : ''}
        />

        <NegotiationModal
          isOpen={showNegotiationModal}
          onClose={handleCloseNegotiation}
          negotiation={selectedNegotiation}
          currentUser={user}
          roomId={currentRoom?._id}
          onRefresh={handleNegotiationRefresh}
        />

        <NegotiationConflictModal
          isOpen={showConflictModal}
          onClose={() => setShowConflictModal(false)}
          onNavigate={() => { setShowConflictModal(false); setSelectedNegotiation(conflictNegotiation); setShowNegotiationModal(true); }}
          respondedNegotiation={conflictNegotiation}
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
            travelMode={travelMode}
            members={currentRoom.members || []}
            currentUser={user}
            isRoomOwner={isOwner}
            roomData={currentRoom}
            showMerged={showMerged}
            onClose={handleCloseDetailGrid}
            onSlotSelect={null}
            selectedSlots={[]}
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

        {showMemberScheduleModal && selectedMemberId && (
          <MemberScheduleModal
            memberId={selectedMemberId}
            onClose={() => { setShowMemberScheduleModal(false); setSelectedMemberId(null); }}
          />
        )}

        {/* 4.txt: 연쇄 교환 요청 모달 */}
        <ChainExchangeRequestModal
          isOpen={showChainExchangeModal}
          onClose={() => { setShowChainExchangeModal(false); setSelectedChainRequest(null); }}
          request={selectedChainRequest}
          roomId={selectedChainRequest?.roomId}
          onRequestHandled={handleChainExchangeRequestHandled}
        />
      </div>
    );
  }

  // Room list view
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

      {/* 4.txt: 연쇄 교환 요청 모달 (Room list view에서도 표시) */}
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
