import React, { useState, useEffect, useCallback } from 'react';
import TimetableGrid from '../timetable/TimetableGrid';
import RoomCreationModal from '../modals/RoomCreationModal';
import RoomJoinModal from '../modals/RoomJoinModal';
import RoomManagementModal from '../modals/RoomManagementModal';
import AssignSlotModal from '../modals/AssignSlotModal';
import RequestSlotModal from '../modals/RequestSlotModal';
import ChangeRequestModal from '../modals/ChangeRequestModal';
import { useCoordination } from '../../hooks/useCoordination';
import { useCoordinationModals } from '../../hooks/useCoordinationModals';
import { useAuth } from '../../hooks/useAuth';
import { coordinationService } from '../../services/coordinationService';
import { Users, Calendar, PlusCircle, LogIn, WandSparkles, Zap, X } from 'lucide-react';
import { translateEnglishDays } from '../../utils';
import CustomAlertModal from '../modals/CustomAlertModal';
import MemberScheduleModal from '../modals/MemberScheduleModal';
import NotificationModal from '../modals/NotificationModal';

const dayMap = {
  'monday': '월요일', 'tuesday': '화요일', 'wednesday': '수요일',
  'thursday': '목요일', 'friday': '금요일', 'saturday': '토요일', 'sunday': '일요일'
};

const CoordinationTab = ({ onExchangeRequestCountChange, onRefreshExchangeCount }) => {
  const { user } = useAuth();
  const [roomExchangeCounts, setRoomExchangeCounts] = useState({});
  const [sentRequests, setSentRequests] = useState([]);

  const [customAlert, setCustomAlert] = useState({ show: false, message: '' });
  const showAlert = (message) => setCustomAlert({ show: true, message });
  const closeAlert = () => setCustomAlert({ show: false, message: '' });

  // State for the currently displayed week in TimetableGrid
  const [currentWeekStartDate, setCurrentWeekStartDate] = useState(null);
  const handleWeekChange = useCallback((date) => {
    setCurrentWeekStartDate(date);
  }, []);

  // Auto-scheduler State
  const [scheduleOptions, setScheduleOptions] = useState({ minHoursPerWeek: 3 });
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState(null);
  const [unassignedMembersInfo, setUnassignedMembersInfo] = useState(null);
  const [conflictSuggestions, setConflictSuggestions] = useState([]); // New state for unassigned members

  // Negotiation notification states
  const [showNegotiationAlert, setShowNegotiationAlert] = useState(false);
  const [negotiationAlertData, setNegotiationAlertData] = useState(null);

  // Handle auto-resolution of timeout negotiations
  const handleAutoResolveNegotiations = useCallback(async () => {
    if (!currentRoom?._id) return;

    try {
      const result = await coordinationService.autoResolveTimeoutNegotiations(currentRoom._id, 24);

      if (result.resolvedCount > 0) {
        // Show notification about auto-resolved negotiations
        showAlert(`${result.resolvedCount}개의 협의가 자동으로 해결되었습니다.`);

        // Refresh room data
        await fetchRoomDetails(currentRoom._id);
      }
    } catch (error) {
      console.error('Error auto-resolving negotiations:', error);
    }
  }, [currentRoom?._id, fetchRoomDetails, showAlert]);

  // Force resolve negotiation function
  const handleForceResolveNegotiation = useCallback(async (negotiationId, method = 'random') => {
    if (!currentRoom?._id) return;

    try {
      const result = await coordinationService.forceResolveNegotiation(currentRoom._id, negotiationId, method);

      showAlert(`협의가 ${result.assignmentMethod}으로 해결되었습니다.`);

      // Refresh room data
      await fetchRoomDetails(currentRoom._id);
    } catch (error) {
      console.error('Error force resolving negotiation:', error);
      showAlert(`협의 해결 실패: ${error.message}`);
    }
  }, [currentRoom?._id, fetchRoomDetails, showAlert]);

  const handleRunAutoSchedule = async () => {
    if (!currentRoom || !currentWeekStartDate) return;
    setIsScheduling(true);
    setScheduleError(null);
    setUnassignedMembersInfo(null);
    setConflictSuggestions([]); // Reset unassigned members info
    try {
      console.log('자동 배정 시작 - 옵션:', { ...scheduleOptions, currentWeek: currentWeekStartDate });
      const { room: updatedRoom, unassignedMembersInfo: newUnassignedMembersInfo, conflictSuggestions: newConflictSuggestions } = await coordinationService.runAutoSchedule(currentRoom._id, { ...scheduleOptions, currentWeek: currentWeekStartDate });
            
      if (newUnassignedMembersInfo) {
          setUnassignedMembersInfo(newUnassignedMembersInfo);
          console.log('이월 정보:', newUnassignedMembersInfo);
      }
      if (newConflictSuggestions && newConflictSuggestions.length > 0) {
          setConflictSuggestions(newConflictSuggestions);
          console.log('충돌 해결 제안:', newConflictSuggestions);
      }
      // Directly update the current room state with the fresh room returned by the API
      // This bypasses a potential race condition with fetchRoomDetails
      console.log('업데이트된 방 정보:', updatedRoom);
      console.log('업데이트된 멤버 정보:', updatedRoom.members.map(m => ({ name: m.user?.name, carryOver: m.carryOver })));
      setCurrentRoom(updatedRoom);

      // Check for active negotiations and show notification
      const activeNegotiations = updatedRoom.negotiations?.filter(neg => neg.status === 'active') || [];
      if (activeNegotiations.length > 0) {
        setNegotiationAlertData({
          count: activeNegotiations.length,
          negotiations: activeNegotiations
        });
        setShowNegotiationAlert(true);
      } else {
        showAlert('자동 시간 배정이 완료되었습니다.');
      }
    } catch (error) {
      setScheduleError(error.message);
      showAlert(`자동 배정 실패: ${error.message}`);
    } finally {
      setIsScheduling(false);
    }
  };

  const loadRoomExchangeCounts = useCallback(async () => {
    if (!user?.id) return;
    try {
      const result = await coordinationService.getRoomExchangeCounts();
      if (result.success) {
        setRoomExchangeCounts(result.roomCounts);
      }
    } catch (error) {
      console.error('Failed to load room exchange counts:', error);
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
      console.error('Failed to load sent requests:', error);
    }
  }, [user?.id]);

  const { currentRoom, createRoom, joinRoom, isLoading, error, submitTimeSlots, removeTimeSlot, myRooms, fetchMyRooms, fetchRoomDetails, setCurrentRoom, updateRoom, deleteRoom, assignTimeSlot, createRequest, handleRequest } = useCoordination(user?.id, onRefreshExchangeCount, loadSentRequests, showAlert);
  
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

  const [selectedSlots, setSelectedSlots] = useState([]);
  const [selectedTab, setSelectedTab] = useState('owned');
  const [showMemberScheduleModal, setShowMemberScheduleModal] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(null);

  const handleMemberClick = (memberId) => {
    setSelectedMemberId(memberId);
    setShowMemberScheduleModal(true);
  };
  
  const [requestViewMode, setRequestViewMode] = useState('received');
  const [showAllRequests, setShowAllRequests] = useState({});
  const [expandedSections, setExpandedSections] = useState({});
  
  const days = ['월요일', '화요일', '수요일', '목요일', '금요일'];

  const handleCancelRequest = async (requestId) => {
    try {
      await coordinationService.cancelRequest(requestId);
    } catch (error) {
    }
    
    try {
      if (currentRoom) {
        await fetchRoomDetails(currentRoom._id);
      }
      await loadSentRequests();
    } catch (updateError) {
    }
  };

  const handleRequestWithUpdate = async (requestId, action) => {
    try {
      await handleRequest(requestId, action);
    } catch (error) {
      console.error('Failed to handle request:', error);
    }
  };
  
  useEffect(() => {
    if (!currentRoom || !onExchangeRequestCountChange) return;
    
    const exchangeRequestCount = (currentRoom.requests || []).filter(req => 
      req.status === 'pending' && 
      req.type === 'slot_swap' && 
      (req.targetUserId === user?.id || req.targetUserId === user?.email || req.targetUserId?.toString() === user?.id?.toString())
    ).length;
    
    onExchangeRequestCountChange(exchangeRequestCount);
  }, [currentRoom, user?.id, user?.email, onExchangeRequestCountChange]);

  const handleCreateRoom = async (roomData) => {
    console.log('handleCreateRoom called');
    console.log('Creating room with data:', roomData);
    await createRoom(roomData);
    closeCreateRoomModal();
    fetchMyRooms();
    console.log('Room created, currentRoom after creation:', currentRoom); // Note: currentRoom might not be immediately updated here due to async state updates
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
      console.error('Error submitting slots:', error);
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
      } catch (error) {
        console.error('Failed to fetch room details:', error);
        showAlert(`방 접근 실패: ${error.message || error}`);
      }
    } else {
      setCurrentRoom(room);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchMyRooms();
      setTimeout(() => {
        loadRoomExchangeCounts();
        loadSentRequests();
      }, 100);
    }
  }, [user?.id, fetchMyRooms, loadRoomExchangeCounts, loadSentRequests]);

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
    let isOwner = false;
    if (user?.id && currentRoom) {
      const currentUserId = user.id;
      const roomOwnerId = currentRoom.owner?._id || currentRoom.owner?.id || currentRoom.owner;
      
      if (roomOwnerId && currentUserId.toString() === roomOwnerId.toString()) {
        isOwner = true;
      }
      if (currentRoom.roomMasterId && currentUserId.toString() === currentRoom.roomMasterId._id?.toString()) {
        isOwner = true;
      }
    }
    
  const calculateEndTime = (startTime) => {
    const [hour, minute] = startTime.split(':').map(Number);
    const endHour = minute === 30 ? hour + 1 : hour;
    const endMinute = minute === 30 ? 0 : minute + 30;
    return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
  };

    const getHourFromSettings = (setting, defaultValue) => {
      if (!setting) return parseInt(defaultValue);
      if (typeof setting === 'string') return parseInt(setting.split(':')[0]);
      if (typeof setting === 'number') return setting;
      return parseInt(defaultValue);
    };

    const scheduleStartHour = getHourFromSettings(
      currentRoom.settings?.scheduleStart || currentRoom.settings?.startHour, 
      '9'
    );
    const scheduleEndHour = getHourFromSettings(
      currentRoom.settings?.scheduleEnd || currentRoom.settings?.endHour, 
      '18'
    );
    
    console.log("CoordinationTab: currentWeekStartDate before rendering TimetableGrid:", currentWeekStartDate);

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
              }}
              className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors shadow-sm"
            >
              방 목록으로 돌아가기
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 px-2 sm:px-4 lg:px-6">
          <div className="lg:col-span-1">
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
                  
                  console.log(`렌더링 - Member ${memberName}: carryOver = ${member.carryOver}`);
                  
                  let memberIsOwner = false;
                  if (currentRoom.owner) {
                    const ownerId = currentRoom.owner._id || currentRoom.owner.id || currentRoom.owner;
                    const memberId = memberData._id || memberData.id;
                    memberIsOwner = (ownerId === memberId);
                  }
                  
                  return (
                    <div
                      key={memberData._id || index}
                      className={`flex items-center p-3 rounded-lg border ${isOwner ? 'cursor-pointer' : 'cursor-default'} ${
                        memberIsOwner 
                          ? 'bg-red-50 border-red-200 ring-2 ring-red-100' 
                          : isCurrentUser 
                            ? 'bg-blue-50 border-blue-200' 
                            : 'bg-gray-50 border-gray-200'
                      }`}
                      onClick={() => {
                        if (isOwner) {
                          handleMemberClick(memberData._id || memberData.id);
                        }
                      }}
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
                          {(member.carryOver !== undefined && member.carryOver !== null) && (
                            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full flex-shrink-0 font-semibold ${
                              member.carryOver > 0
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              이월: {member.carryOver || 0}시간
                            </span>
                          )}
                        </div>
                        <div className={`text-xs mt-1 ${
                          memberIsOwner ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          {new Date(member.joinedAt || new Date()).toLocaleDateString('ko-KR')} 참여
                        </div>
                      </div>
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
                    {(currentRoom.requests || []).filter(req => req.status === 'pending' && (req.targetUserId === user?.id || req.targetUserId === user?.email || req.targetUserId?.toString() === user?.id?.toString())).length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">대기 중인 요청</h5>
                        <div className="space-y-2">
                          {(currentRoom.requests || [])
                            .filter(req => req.status === 'pending' && (req.targetUserId === user?.id || req.targetUserId === user?.email || req.targetUserId?.toString() === user?.id?.toString()))
                            .slice(0, showAllRequests['receivedPending'] ? undefined : 3)
                            .map((request, index) => {
                              const requesterData = request.requester;
                              const requesterName = requesterData?.name || `${requesterData?.firstName || ''} ${requesterData?.lastName || ''}`.trim() || '알 수 없음';
                              
                              return (
                                <div key={request._id || index} className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                                  <div className="flex justify-between items-center mb-1">
                                    <div className="text-xs font-medium text-blue-900">{requesterName}</div>
                                    <div className="text-xs text-blue-600">
                                      {request.type === 'slot_swap' ? '교환 요청' : request.type === 'time_request' ? '시간 요청' : '시간 변경'}
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
                          {(currentRoom.requests || []).filter(req => req.status === 'pending' && (req.targetUserId === user?.id || req.targetUserId === user?.email || req.targetUserId?.toString() === user?.id?.toString())).length > 3 && !showAllRequests['receivedPending'] && (
                            <button
                              onClick={() => setShowAllRequests(prev => ({...prev, receivedPending: true}))}
                              className="text-xs text-blue-500 hover:text-blue-600 text-center w-full"
                            >
                              +{(currentRoom.requests || []).filter(req => req.status === 'pending' && (req.targetUserId === user?.id || req.targetUserId === user?.email || req.targetUserId?.toString() === user?.id?.toString())).length - 3}개 더 보기
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {(currentRoom.requests || []).filter(req => req.status !== 'pending' && (req.targetUserId === user?.id || req.targetUserId === user?.email || req.targetUserId?.toString() === user?.id?.toString())).length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-sm font-medium text-gray-700">처리된 요청</h5>
                          <button
                            onClick={() => setExpandedSections(prev => ({...prev, receivedProcessed: !prev.receivedProcessed}))}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            {expandedSections['receivedProcessed'] ? '접기' : '펼치기'}
                          </button>
                        </div>
                        {expandedSections['receivedProcessed'] && (
                          <div className="space-y-2">
                            {(currentRoom.requests || [])
                              .filter(req => req.status !== 'pending' && (req.targetUserId === user?.id || req.targetUserId === user?.email || req.targetUserId?.toString() === user?.id?.toString()))
                              .slice(0, showAllRequests['receivedProcessed'] ? undefined : 3)
                              .map((request, index) => {
                                const requesterData = request.requester;
                                const requesterName = requesterData?.name || `${requesterData?.firstName || ''} ${requesterData?.lastName || ''}`.trim() || '알 수 없음';
                                
                                return (
                                  <div key={request._id || index} className={`p-2 border rounded-lg ${
                                    request.status === 'approved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                                  }`}>
                                    <div className="flex justify-between items-center mb-1">
                                      <div className={`text-xs font-medium ${
                                        request.status === 'approved' ? 'text-green-900' : 'text-red-900'
                                      }`}>{requesterName}</div>
                                      <div className="flex items-center space-x-2">
                                        <div className={`text-xs px-2 py-1 rounded-full ${
                                          request.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                          {request.status === 'approved' ? '승인됨' : '거절됨'}
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
                                      request.status === 'approved' ? 'text-green-700' : 'text-red-700'
                                    }`}>
                                      {(dayMap[request.timeSlot?.day.toLowerCase()] || request.timeSlot?.day)} {request.timeSlot?.startTime}-{request.timeSlot?.endTime}
                                    </div>
                                  </div>
                                );
                              })}
                            {(currentRoom.requests || []).filter(req => req.status !== 'pending' && (req.targetUserId === user?.id || req.targetUserId === user?.email || req.targetUserId?.toString() === user?.id?.toString())).length > 3 && !showAllRequests['receivedProcessed'] && (
                              <button
                                onClick={() => setShowAllRequests(prev => ({...prev, receivedProcessed: true}))}
                                className="text-xs text-gray-500 hover:text-gray-600 text-center w-full"
                              >
                                +{(currentRoom.requests || []).filter(req => req.status !== 'pending' && (req.targetUserId === user?.id || req.targetUserId === user?.email || req.targetUserId?.toString() === user?.id?.toString())).length - 3}개 더 보기
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
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
                                  .map((request, index) => (
                                    <div key={request._id || index} className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                                      <div className="flex justify-between items-center mb-1">
                                        <div className="text-xs font-medium text-yellow-900">
                                          {request.type === 'slot_swap' ? '교환 요청' : request.type === 'time_request' ? '시간 요청' : '시간 변경'}
                                        </div>
                                        <div className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                                          대기중
                                        </div>
                                      </div>
                                      <div className="text-xs text-yellow-700 mb-2">
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
                                          취소
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                {pendingRequests.length > 3 && !showAllRequests['sentPending'] && (
                                  <button
                                    onClick={() => setShowAllRequests(prev => ({...prev, sentPending: true}))}
                                    className="text-xs text-yellow-600 hover:text-yellow-700 text-center w-full"
                                  >
                                    +{pendingRequests.length - 3}개 더 보기
                                  </button>
                                )}
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
                                    .map((request, index) => (
                                      <div key={request._id || index} className={`p-2 border rounded-lg ${
                                        request.status === 'approved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                                      }`}>
                                        <div className="flex justify-between items-center mb-1">
                                          <div className={`text-xs font-medium ${
                                            request.status === 'approved' ? 'text-green-900' : 'text-red-900'
                                          }`}>
                                            {request.type === 'slot_swap' ? '교환 요청' : request.type === 'time_request' ? '시간 요청' : '시간 변경'}
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <div className={`text-xs px-2 py-1 rounded-full ${
                                              request.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                              {request.status === 'approved' ? '승인됨' : '거절됨'}
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
                                          request.status === 'approved' ? 'text-green-700' : 'text-red-700'
                                        }`}>
                                          {(dayMap[request.timeSlot?.day.toLowerCase()] || request.timeSlot?.day)} {request.timeSlot?.startTime}-{request.timeSlot?.endTime}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {new Date(request.createdAt).toLocaleDateString('ko-KR')} {new Date(request.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                      </div>
                                    ))}
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
          </div>

          <div className="lg:col-span-3">
            {isOwner &&
              <AutoSchedulerPanel
                options={scheduleOptions}
                setOptions={setScheduleOptions}
                onRun={handleRunAutoSchedule}
                isLoading={isScheduling}
                currentRoom={currentRoom}
                onAutoResolveNegotiations={handleAutoResolveNegotiations}
              />
            }
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
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <Calendar size={20} className="mr-2 text-green-600" />
                시간표 ({scheduleStartHour}:00 - {scheduleEndHour}:00)
              </h3>
              <TimetableGrid
                roomId={currentRoom._id}
                roomSettings={currentRoom.settings}
                timeSlots={currentRoom.timeSlots || []}
                members={currentRoom.members || []}
                roomData={currentRoom}
                onSlotSelect={setSelectedSlots}
                currentUser={user}
                isRoomOwner={isOwner}
                onAssignSlot={handleAssignSlot}
                onRequestSlot={handleRequestSlot}
                onRemoveSlot={async (slotData) => {
                  await removeTimeSlot(currentRoom._id, slotData.day, slotData.startTime, slotData.endTime);
                  await fetchRoomDetails(currentRoom._id);
                }}
                onDirectSubmit={async (slots) => {
                  await submitTimeSlots(currentRoom._id, slots);
                  await fetchRoomDetails(currentRoom._id);
                }}
                selectedSlots={selectedSlots}
                calculateEndTime={calculateEndTime}
                onWeekChange={handleWeekChange}
                initialStartDate={currentWeekStartDate}
              />
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
                day: days[slotToAssign.dayIndex],
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
            onRequest={(message) => {
              handleRequestSlot({
                roomId: currentRoom._id,
                type: 'time_request',
                timeSlot: {
                  day: days[slotToRequest.dayIndex],
                  startTime: slotToRequest.time,
                  endTime: calculateEndTime(slotToRequest.time),
                },
                message: message
              });
              closeRequestModal();
            }}
            slotInfo={slotToRequest}
          />
        )}
        {showChangeRequestModal && slotToChange && (
          <ChangeRequestModal
            onClose={closeChangeRequestModal}
            onRequestChange={(message) => {
              let requestData;

              if (slotToChange.action === 'release') {
                requestData = {
                  roomId: currentRoom._id,
                  type: 'slot_release',
                  timeSlot: {
                    day: days[slotToChange.dayIndex],
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
                    day: days[slotToChange.dayIndex],
                    startTime: slotToChange.time,
                    endTime: calculateEndTime(slotToChange.time),
                  },
                  targetUserId: slotToChange.targetUserId,
                  targetSlot: slotToChange.targetSlot, // <--- ADD THIS LINE
                  message: message || '시간 교환을 요청합니다.',
                };
              } else {
                requestData = {
                  roomId: currentRoom._id,
                  type: 'time_change',
                  timeSlot: {
                    day: days[slotToChange.dayIndex],
                    startTime: slotToChange.time,
                    endTime: calculateEndTime(slotToChange.time),
                  },
                  targetSlot: { // This is the slot being changed
                    day: days[slotToChange.dayIndex],
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
            slotToChange={slotToChange}
          />
        )}
        {showMemberScheduleModal && selectedMemberId && (
          <MemberScheduleModal
            memberId={selectedMemberId}
            onClose={() => setShowMemberScheduleModal(false)}
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
            `자동 배정 중 ${negotiationAlertData.count}개의 시간대에서 충돌이 발생했습니다. 해당 시간대는 '협의중' 상태로 표시되며, 멤버들 간의 협의가 필요합니다. 24시간 후 자동으로 해결됩니다.` :
            ''
          }
        />
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
          onClose={() => setShowMemberScheduleModal(false)}
        />
      )}
    </div>
  );
};


export default CoordinationTab;

const AutoSchedulerPanel = ({ options, setOptions, onRun, isLoading, currentRoom, onAutoResolveNegotiations }) => {
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setOptions(prev => ({ ...prev, [name]: Number(value) }));
  };

  // Get active negotiations count
  const activeNegotiationsCount = currentRoom?.negotiations?.filter(neg => neg.status === 'active')?.length || 0;

  return (
    <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 mb-4">
      <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
        <Zap size={20} className="mr-2 text-purple-600" />
        자동 시간 배정
      </h3>
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">주당 최소 할당 시간 (시간)</label>
          <input
            type="number"
            name="minHoursPerWeek"
            value={options.minHoursPerWeek}
            onChange={handleInputChange}
            className="mt-1 block w-full p-2 border rounded-md"
            min="1"
            max="10"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-4">
        <button
          onClick={onRun}
          disabled={isLoading}
          className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 disabled:bg-purple-300 flex items-center justify-center"
        >
          {isLoading ? '배정 중...' : '자동 배정 실행'}
        </button>

        {activeNegotiationsCount > 0 && (
          <button
            onClick={onAutoResolveNegotiations}
            className="w-full bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 flex items-center justify-center text-sm"
          >
            협의 자동 해결 ({activeNegotiationsCount}개)
          </button>
        )}
      </div>

      {activeNegotiationsCount > 0 && (
        <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-sm text-orange-700">
            현재 {activeNegotiationsCount}개의 협의가 진행 중입니다.
            24시간 후 자동으로 해결되거나 위 버튼으로 즉시 해결할 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
};