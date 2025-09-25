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
import { Calendar, Grid, PlusCircle, LogIn, Users, MessageSquare, Clock } from 'lucide-react';
import { translateEnglishDays } from '../../utils';
import CustomAlertModal from '../modals/CustomAlertModal';
import MemberScheduleModal from '../modals/MemberScheduleModal';
import NotificationModal from '../modals/NotificationModal';
import NegotiationModal from '../modals/NegotiationModal';
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

  const [customAlert, setCustomAlert] = useState({ show: false, message: '' });
  const showAlert = (message) => setCustomAlert({ show: true, message });
  const closeAlert = () => setCustomAlert({ show: false, message: '' });

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


  const loadRoomExchangeCounts = useCallback(async () => {
    if (!user?.id) return;
    try {
      const result = await coordinationService.getRoomExchangeCounts();
      if (result.success) {
        setRoomExchangeCounts(result.roomCounts);
      }
    } catch (error) {
    }
  }, [user?.id]);

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
    }
  }, [user?.id]);

  const { currentRoom, createRoom, joinRoom, isLoading, error, submitTimeSlots, removeTimeSlot, myRooms, fetchMyRooms, fetchRoomDetails, setCurrentRoom, updateRoom, deleteRoom, assignTimeSlot, createRequest, handleRequest, cancelRequest } = useCoordination(user?.id, onRefreshExchangeCount, loadSentRequests, showAlert);

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
    setSelectedNegotiation(negotiationData);
    setShowNegotiationModal(true);
  }, []);

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
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'week'
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDetailGrid, setShowDetailGrid] = useState(false);

  const handleMemberClick = (memberId) => {
    const member = currentRoom?.members?.find(m => (m.user._id || m.user.id) === memberId);
    if (member) {
      setMemberStatsModal({ isOpen: true, member });
    }
  };

  const handleMemberScheduleClick = (memberId) => {
    console.log('handleMemberScheduleClick called with memberId:', memberId);
    console.log('Current room members:', currentRoom?.members?.map(m => ({ id: m.user._id || m.user.id, name: m.user.name })));
    setSelectedMemberId(memberId);
    setShowMemberScheduleModal(true);
    console.log('MemberScheduleModal state set:', { selectedMemberId: memberId, showMemberScheduleModal: true });

    // 상태 업데이트 후 강제 리렌더링을 위한 작은 지연
    setTimeout(() => {
      console.log('After timeout - Modal states:', { selectedMemberId, showMemberScheduleModal });
    }, 100);
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
        slot.date === slotData.date &&
        slot.day === slotData.day &&
        slot.startTime === slotData.startTime
      );

      if (isSelected) {
        return prev.filter(slot =>
          !(slot.date === slotData.date &&
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
  const [expandedSections, setExpandedSections] = useState({});
  

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

  const handleRequestWithUpdateCallback = async (requestId, action) => {
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
  };
  
  useEffect(() => {
    if (!currentRoom || !onExchangeRequestCountChange) return;
    
    const exchangeRequestCount = (currentRoom.requests || []).filter(req => {
      if (req.status !== 'pending') return false;
      if (req.type !== 'slot_swap') return false;
      if (!req.targetUser) return false;
      const targetUserId = req.targetUser._id || req.targetUser;
      const currentUserId = user?.id;
      return targetUserId === currentUserId || targetUserId?.toString() === currentUserId?.toString();
    }).length;
    
    onExchangeRequestCountChange(exchangeRequestCount);
  }, [currentRoom, user?.id, user?.email, onExchangeRequestCountChange]);

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
    if (!currentRoom) return;
    await createRequest(requestData);
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
  }, [user?.id, fetchMyRooms, loadRoomExchangeCounts, loadSentRequests, loadReceivedRequests]);

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

    const scheduleStartHour = getHourFromSettings(
      currentRoom.settings?.scheduleStart || currentRoom.settings?.startHour,
      '9'
    );
    const scheduleEndHour = getHourFromSettings(
      currentRoom.settings?.scheduleEnd || currentRoom.settings?.endHour,
      '18'
    );
    

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
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1">
                <button
                  onClick={openManageRoomModal}
                  className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-medium shadow-sm"
                >
                  방 관리
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 px-2 sm:px-4 lg:px-6">
          <div className="lg:col-span-1">
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
              
              {isOwner && (currentRoom.requests || []).filter(req => req.status === 'pending' && ['time_request', 'time_change'].includes(req.type)).length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h4 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
                    <Calendar size={16} className="mr-2 text-orange-600" />
                    대기 중인 요청 ({(currentRoom.requests || []).filter(req => req.status === 'pending' && ['time_request', 'time_change'].includes(req.type)).length}건)
                  </h4>
                  <div className="space-y-2">
                    {(currentRoom.requests || []).filter(req => req.status === 'pending' && ['time_request', 'time_change'].includes(req.type)).slice(0, 3).map((request, index) => {
                      const requesterData = request.requester;
                      const requesterName = requesterData?.name || `${requesterData?.firstName || ''} ${requesterData?.lastName || ''}`.trim() || '알 수 없음';
                      
                      return (
                        <div key={request._id || index} className="p-2 bg-orange-50 border border-orange-200 rounded-lg">
                          <div className="flex justify-between items-center mb-1">
                            <div className="text-xs font-medium text-orange-900">{requesterName}</div>
                            <div className="text-xs text-orange-600">{request.type === 'time_request' ? '시간 요청' : '시간 변경'}</div>
                          </div>
                          <div className="text-xs text-orange-700 mb-2">
                            {(dayMap[request.timeSlot?.day.toLowerCase()] || request.timeSlot?.day)} {request.timeSlot?.startTime}-{request.timeSlot?.endTime}
                          </div>
                          {request.message && (
                            <p className="text-xs text-gray-600 italic mb-2 line-clamp-2">"{request.message}"</p>
                          )}
                          <div className="flex justify-end space-x-2 mt-2">
                            <button
                              onClick={() => handleRequestWithUpdate(request._id, 'approved')}
                              className="px-3 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600"
                            >
                              승인
                            </button>
                            <button
                              onClick={() => handleRequestWithUpdate(request._id, 'rejected')}
                              className="px-3 py-1 text-xs bg-red-500 text-white rounded-md hover:bg-red-600"
                            >
                              거절
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {(currentRoom.requests || []).filter(req => req.status === 'pending' && ['time_request', 'time_change'].includes(req.type)).length > 3 && (
                      <div className="text-xs text-gray-500 text-center">
                        +{(currentRoom.requests || []).filter(req => req.status === 'pending' && ['time_request', 'time_change'].includes(req.type)).length - 3}개 더
                      </div>
                    )}
                  </div>
                </div>
              )}

              
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-md font-semibold text-gray-800 flex items-center">
                    <Users size={16} className="mr-2 text-blue-600" />
                    교환요청 관리
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
                                      <div key={request._id || index} className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                                        <div className="flex justify-between items-center mb-1">
                                          <div className="text-xs font-medium text-blue-900">{requesterName}</div>
                                          <div className="text-xs text-blue-600">
                                            {request.type === 'slot_swap' ? '교환 요청' : '알 수 없는 요청'}
                                          </div>
                                        </div>
                                        <div className="text-xs text-blue-700 mb-2">
                                          {(dayMap[request.timeSlot?.day.toLowerCase()] || request.timeSlot?.day)} {request.timeSlot?.startTime}-{request.timeSlot?.endTime}
                                        </div>
                                        {request.message && (
                                          <p className="text-xs text-gray-600 italic mb-2 line-clamp-2">"{request.message}"</p>
                                        )}
                                        <div className="flex justify-end space-x-2 mt-2">
                                          <button
                                            onClick={() => handleRequestWithUpdate(request._id, 'approved')}
                                            className="px-3 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600"
                                          >
                                            승인
                                          </button>
                                          <button
                                            onClick={() => handleRequestWithUpdate(request._id, 'rejected')}
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
                                                onClick={() => handleCancelRequest(request._id)}
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
                                      <div key={request._id || index} className="p-2 bg-gray-50 border border-gray-200 rounded-lg">
                                        <div className="flex justify-between items-center mb-1">
                                          <div className="text-xs font-medium text-gray-800">
                                            To: {targetUserName}
                                          </div>
                                          <div className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                                            대기중
                                          </div>
                                        </div>
                                        <div className="text-xs text-gray-700 mb-2">
                                          {(dayMap[request.timeSlot?.day.toLowerCase()] || request.timeSlot?.day)} {request.timeSlot?.startTime}-{request.timeSlot?.endTime}
                                        </div>
                                        {request.message && (
                                          <p className="text-xs text-gray-600 italic mb-2 line-clamp-2">"{request.message}"</p>
                                        )}
                                        <div className="flex justify-end">
                                          <button
                                            onClick={() => handleCancelRequest(request._id)}
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
                                                onClick={() => handleCancelRequest(request._id)}
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
            </div>

            {/* 협의 관리 섹션 - 현재 시간표에 표시된 협의만 표시 */}
            {(() => {
              // Show only negotiations visible in current week's timetable
              const visibleNegotiations = currentWeekNegotiations || [];

              return visibleNegotiations.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h4 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
                    <MessageSquare size={16} className="mr-2 text-orange-600" />
                    협의 진행중 ({visibleNegotiations.length}건)
                  </h4>
                  <div className="space-y-3">
                    {visibleNegotiations.map((weekNegotiation, index) => {
                      const negotiation = weekNegotiation; // weekNegotiation is the negotiation itself, not nested under negotiationData
                      const isUserInvolved = negotiation.conflictingMembers?.some(cm =>
                        (cm.user._id || cm.user) === user?.id
                      );
                      const memberNames = negotiation.conflictingMembers?.map(cm => {
                        // Use name field first, then firstName/lastName combination
                        if (cm.user?.name) {
                          return cm.user.name;
                        } else if (cm.user?.firstName || cm.user?.lastName) {
                          return `${cm.user.firstName || ''} ${cm.user.lastName || ''}`.trim();
                        } else {
                          return '멤버';
                        }
                      }).join(', ') || '';

                      return (
                        <div key={index} className={`p-3 rounded-lg border ${
                          isUserInvolved
                            ? 'bg-orange-50 border-orange-200 ring-2 ring-orange-100'
                            : 'bg-gray-50 border-gray-200'
                        }`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center mb-1">
                                <Clock size={14} className="mr-1 text-orange-500" />
                                <span className="text-sm font-medium">
                                  {weekNegotiation.dayDisplay} {weekNegotiation.time}-{calculateEndTime(weekNegotiation.time)}
                                </span>
                                {isUserInvolved && (
                                  <span className="ml-2 px-2 py-0.5 text-xs bg-orange-100 text-orange-800 rounded-full">
                                    참여 필요
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-600 mb-2">
                                충돌 멤버: {memberNames}
                                {negotiation.priority && (
                                  <span className="ml-2 px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded-full">
                                    우선순위: {negotiation.priority}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                응답 현황: {negotiation.conflictingMembers?.filter(cm => cm.response !== 'pending').length || 0}
                                /{negotiation.conflictingMembers?.length || 0}
                                {negotiation.conflictingMembers?.some(cm => cm.response === 'accepted') &&
                                  <span className="ml-2 text-green-600">✓ 일부 동의</span>
                                }
                              </div>
                            </div>
                            <button
                              onClick={() => handleOpenNegotiation(negotiation)}
                              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                isUserInvolved
                                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                                  : 'bg-gray-300 text-gray-600 hover:bg-gray-400'
                              }`}
                            >
                              {isUserInvolved ? '참여하기' : '확인'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="lg:col-span-3">
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
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center">
                  <Calendar size={20} className="mr-2 text-green-600" />
                  시간표 ({scheduleStartHour}:00 - {scheduleEndHour}:00)
                </h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setViewMode('month')}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      viewMode === 'month'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <Calendar size={16} className="mr-1 inline" />
                    월간
                  </button>
                  <button
                    onClick={() => setViewMode('week')}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      viewMode === 'week'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <Grid size={16} className="mr-1 inline" />
                    주간
                  </button>
                  {!isOwner && (
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        viewMode === 'grid'
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      <Grid size={16} className="mr-1 inline" />
                      선택
                    </button>
                  )}
                </div>
              </div>

              {viewMode === 'grid' && !isOwner ? (
                <TimetableGrid
                  roomId={currentRoom._id}
                  roomSettings={{
                    startHour: scheduleStartHour,
                    endHour: scheduleEndHour,
                    ...currentRoom.settings // Include all room settings (roomExceptions, blockedTimes, etc.)
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
              handleRequestSlot({
                roomId: currentRoom._id,
                type: 'time_request',
                timeSlot: {
                  day: days[slotToRequest.dayIndex - 1],
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
            onRequestChange={(message) => {
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

              if (slotToChange.action === 'release') {
                requestData = {
                  roomId: currentRoom._id,
                  type: 'slot_release',
                  timeSlot: {
                    day: dayKey,
                    startTime: slotToChange.time,
                    endTime: calculateEndTime(slotToChange.time),
                  },
                  message: message || '시간을 취소합니다.',
                };
              } else if (slotToChange.action === 'swap') {
                requestData = {
                  roomId: currentRoom._id,
                  type: 'slot_swap',
                  timeSlot: {
                    day: dayKey,
                    startTime: slotToChange.time,
                    endTime: calculateEndTime(slotToChange.time),
                  },
                  targetUserId: slotToChange.targetUserId,
                  targetSlot: slotToChange.targetSlot,
                  message: message || '시간 교환을 요청합니다.',
                };
              } else {
                requestData = {
                  roomId: currentRoom._id,
                  type: 'time_change',
                  timeSlot: {
                    day: dayKey,
                    startTime: slotToChange.time,
                    endTime: calculateEndTime(slotToChange.time),
                  },
                  targetSlot: { // This is the slot being changed
                    day: dayKey,
                    startTime: slotToChange.time,
                    endTime: calculateEndTime(slotToChange.time),
                    user: user.id
                  },
                  message: message || '시간 변경 요청합니다.',
                };
              }
              handleRequestSlot(requestData);
              closeChangeRequestModal();
            }}
            slotToChange={slotToChange} // 전체 객체를 전달 (dayDisplay 포함)
          />
        )}
        <CustomAlertModal
            isOpen={customAlert.show}
            onClose={closeAlert}
            title="알림"
            message={customAlert.message}
            type="warning"
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

        {/* Member Stats Modal */}
        <MemberStatsModal
          isOpen={memberStatsModal.isOpen}
          onClose={() => setMemberStatsModal({ isOpen: false, member: null })}
          member={memberStatsModal.member}
          isOwner={currentRoom && user && (currentRoom.owner._id === user.id || currentRoom.owner === user.id)}
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
          />
        )}

        {/* Member Schedule Modal - 방 안에서도 보여야 하므로 여기에 위치 */}
        {showMemberScheduleModal && selectedMemberId && (
          <MemberScheduleModal
            memberId={selectedMemberId}
            onClose={() => {
              console.log('Closing MemberScheduleModal from room view');
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

      {(myRooms?.owned?.length > 0 || myRooms?.joined?.length > 0) ? (
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
      ) : (
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
          ownerProfileSchedule={user ? { defaultSchedule: user.defaultSchedule, scheduleExceptions: user.scheduleExceptions } : null}
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
      
      {showMemberScheduleModal && selectedMemberId && (
        <MemberScheduleModal
          memberId={selectedMemberId}
          onClose={() => {
            console.log('Closing MemberScheduleModal');
            setShowMemberScheduleModal(false);
            setSelectedMemberId(null);
          }}
        />
      )}
    </div>
  );
};


export default CoordinationTab;