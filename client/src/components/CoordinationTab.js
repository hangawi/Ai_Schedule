import React, { useState, useEffect } from 'react';
import TimetableGrid from './timetable/TimetableGrid';
import RoomCreationModal from './modals/RoomCreationModal';
import RoomJoinModal from './modals/RoomJoinModal';
import RoomManagementModal from './modals/RoomManagementModal';
import AssignSlotModal from './modals/AssignSlotModal';
import RequestSlotModal from './modals/RequestSlotModal';
import ChangeRequestModal from './modals/ChangeRequestModal';
import { useCoordination } from '../hooks/useCoordination';
import { useAuth } from '../hooks/useAuth';
import { Users, Calendar, PlusCircle, LogIn } from 'lucide-react';


const CoordinationTab = () => {
  const { user } = useAuth();
  const { currentRoom, createRoom, joinRoom, isLoading, error, submitTimeSlots, removeTimeSlot, myRooms, fetchMyRooms, fetchRoomDetails, setCurrentRoom, updateRoom, deleteRoom, assignTimeSlot, createRequest, handleRequest, autoAssignSlots } = useCoordination(user?.id);

  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [showJoinRoomModal, setShowJoinRoomModal] = useState(false);
  const [showManageRoomModal, setShowManageRoomModal] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [selectedTab, setSelectedTab] = useState('owned'); // 'owned' or 'joined'
  
  // Modal states for TimetableGrid
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [slotToAssign, setSlotToAssign] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [slotToRequest, setSlotToRequest] = useState(null);
  const [showChangeRequestModal, setShowChangeRequestModal] = useState(false);
  const [slotToChange, setSlotToChange] = useState(null);
  
  // Days array for modal calculations
  const days = ['월요일', '화요일', '수요일', '목요일', '금요일'];

  const handleCreateRoom = async (roomData) => {
    await createRoom(roomData);
    setShowCreateRoomModal(false);
    fetchMyRooms(); // Refresh the list of rooms after creation
  };

  const handleJoinRoom = async (inviteCode) => {
    await joinRoom(inviteCode);
    setShowJoinRoomModal(false);
    fetchMyRooms(); // Refresh the list of rooms after joining
  };

  const handleSubmitSlots = async () => {
    if (!currentRoom || selectedSlots.length === 0) return;
    try {
      await submitTimeSlots(currentRoom._id, selectedSlots);
      setSelectedSlots([]); // Clear selection after successful submission
      // Force refresh by refetching room details
      await fetchRoomDetails(currentRoom._id);
    } catch (error) {
      console.error('Error submitting slots:', error);
    }
  };

  const handleAssignSlot = async (assignmentData) => {
    if (!currentRoom) return; // Ensure currentRoom is available
    await assignTimeSlot(
      assignmentData.roomId,
      assignmentData.day,
      assignmentData.startTime,
      assignmentData.endTime,
      assignmentData.userId
    );
    // The assignTimeSlot in useCoordination already refreshes room details
  };

  const handleRequestSlot = async (requestData) => {
    if (!currentRoom) return;
    await createRequest(requestData);
    // createRequest already refreshes room details if successful
  };

  const handleAutoAssign = async () => {
    if (!currentRoom) return;
    await autoAssignSlots(currentRoom._id);
  };

  const handleRoomClick = async (room) => {
    if (room._id) {
      try {
        await fetchRoomDetails(room._id);
      } catch (error) {
        console.error('Failed to fetch room details:', error);
        alert(`방 접근 실패: ${error.message || error}`);
      }
    } else {
      setCurrentRoom(room);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchMyRooms();
    }
  }, [user?.id, fetchMyRooms]);

  useEffect(() => {
    if (!currentRoom && showManageRoomModal) {
      setShowManageRoomModal(false);
    }
  }, [currentRoom, showManageRoomModal]);

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
      const roomOwnerId = currentRoom.owner?._id || currentRoom.owner?.id || currentRoom.owner; // Handle various owner ID formats
      
      // Check if current user is the owner
      if (roomOwnerId && currentUserId.toString() === roomOwnerId.toString()) {
        isOwner = true;
      }
      // Also check for legacy roomMasterId if it exists
      if (currentRoom.roomMasterId && currentUserId.toString() === currentRoom.roomMasterId._id?.toString()) {
        isOwner = true;
      }
    }
    

  // Helper function to calculate end time based on start time (30-minute slot)
  const calculateEndTime = (startTime) => {
    const [hour, minute] = startTime.split(':').map(Number);
    const endHour = minute === 30 ? hour + 1 : hour;
    const endMinute = minute === 30 ? 0 : minute + 30;
    return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
  };

    // 시간표 설정 값 가져오기
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
    
    return (
      <div className="p-1">
        <div className="bg-white p-6 rounded-xl shadow-lg mb-6 border border-gray-200">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-800">{currentRoom.name}</h2>
              <p className="text-gray-500 mt-1">{currentRoom.description || '방 설명이 없습니다.'}</p>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                <div className="flex items-center"><strong className="mr-2">초대코드:</strong> <span className="font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded">{currentRoom.inviteCode}</span></div>
                <div className="flex items-center"><strong className="mr-2">방장:</strong> {isOwner ? (user.name || `${user.firstName} ${user.lastName}`) : (currentRoom.owner?.name || `${currentRoom.owner?.firstName || ''} ${currentRoom.owner?.lastName || ''}`.trim() || '알 수 없음')}</div>
                <div className="flex items-center"><strong className="mr-2">멤버:</strong> {currentRoom.memberCount || currentRoom.members?.length || 0} / {currentRoom.maxMembers}명</div>
              </div>
            </div>
            {isOwner && (
              <button
                onClick={() => setShowManageRoomModal(true)}
                className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                방 관리
              </button>
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
            {isOwner && (
              <button
                onClick={handleAutoAssign}
                className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
              >
                자동 배정
              </button>
            )}
            <button
              onClick={() => setCurrentRoom(null)}
              className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors shadow-sm"
            >
              방 목록으로 돌아가기
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 조원 리스트 사이드바 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <Users size={20} className="mr-2 text-blue-600" />
                조원 목록 ({(currentRoom.members || []).length}명)
              </h3>
              <div className="space-y-3">
                {(currentRoom.members || []).map((member, index) => {
                  const memberData = member.user || member;
                  const memberName = memberData.name || `${memberData.firstName || ''} ${memberData.lastName || ''}`.trim() || '알 수 없음';
                  const isCurrentUser = memberData._id === user?.id || memberData.id === user?.id;
                  
                  // 방장인지 확인 - owner와 비교
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
                        isCurrentUser ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-full mr-3 flex-shrink-0"
                        style={{ backgroundColor: member.color || '#6B7280' }}
                      ></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center">
                          <span className={`text-sm font-medium truncate ${
                            isCurrentUser ? 'text-blue-900' : 'text-gray-900'
                          }`}>
                            {memberName}
                            {isCurrentUser && ' (나)'}
                          </span>
                          {memberIsOwner && (
                            <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full flex-shrink-0">
                              방장
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(member.joinedAt || new Date()).toLocaleDateString('ko-KR')} 참여
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* 일반 요청 목록 (방장만 표시) */}
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
                            {request.timeSlot?.day} {request.timeSlot?.startTime}-{request.timeSlot?.endTime}
                          </div>
                          {request.message && (
                            <p className="text-xs text-gray-600 italic mb-2 line-clamp-2">"{request.message}"</p>
                          )}
                          <div className="flex justify-end space-x-2 mt-2">
                            <button
                              onClick={() => handleRequest(request._id, 'approved')}
                              className="px-3 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600"
                            >
                              승인
                            </button>
                            <button
                              onClick={() => handleRequest(request._id, 'rejected')}
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

              {/* 교환 요청 알림 (모든 멤버에게 표시) */}
              {(currentRoom.requests || []).filter(req => req.status === 'pending' && req.type === 'slot_swap' && (req.targetUserId === user?.id || req.targetUserId === user?.email || req.targetUserId?.toString() === user?.id?.toString())).length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h4 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
                    <Users size={16} className="mr-2 text-blue-600" />
                    교환 요청 ({(currentRoom.requests || []).filter(req => req.status === 'pending' && req.type === 'slot_swap' && (req.targetUserId === user?.id || req.targetUserId === user?.email || req.targetUserId?.toString() === user?.id?.toString())).length}건)
                  </h4>
                  <div className="space-y-2">
                    {(currentRoom.requests || []).filter(req => req.status === 'pending' && req.type === 'slot_swap' && (req.targetUserId === user?.id || req.targetUserId === user?.email || req.targetUserId?.toString() === user?.id?.toString())).slice(0, 3).map((request, index) => {
                      const requesterData = request.requester;
                      const requesterName = requesterData?.name || `${requesterData?.firstName || ''} ${requesterData?.lastName || ''}`.trim() || '알 수 없음';
                      
                      return (
                        <div key={request._id || index} className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex justify-between items-center mb-1">
                            <div className="text-xs font-medium text-blue-900">{requesterName}</div>
                            <div className="text-xs text-blue-600">교환 요청</div>
                          </div>
                          <div className="text-xs text-blue-700 mb-2">
                            {request.timeSlot?.day} {request.timeSlot?.startTime}-{request.timeSlot?.endTime} 교환
                          </div>
                          {request.message && (
                            <p className="text-xs text-gray-600 italic mb-2 line-clamp-2">"{request.message}"</p>
                          )}
                          <div className="flex justify-end space-x-2 mt-2">
                            <button
                              onClick={() => handleRequest(request._id, 'approved')}
                              className="px-3 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600"
                            >
                              교환 승인
                            </button>
                            <button
                              onClick={() => handleRequest(request._id, 'rejected')}
                              className="px-3 py-1 text-xs bg-red-500 text-white rounded-md hover:bg-red-600"
                            >
                              교환 거절
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {(currentRoom.requests || []).filter(req => req.status === 'pending' && req.type === 'slot_swap' && (req.targetUserId === user?.id || req.targetUserId === user?.email || req.targetUserId?.toString() === user?.id?.toString())).length > 3 && (
                      <div className="text-xs text-gray-500 text-center">
                        +{(currentRoom.requests || []).filter(req => req.status === 'pending' && req.type === 'slot_swap' && (req.targetUserId === user?.id || req.targetUserId === user?.email || req.targetUserId?.toString() === user?.id?.toString())).length - 3}개 더
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 시간표 그리드 */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <Calendar size={20} className="mr-2 text-green-600" />
                시간표 ({scheduleStartHour}:00 - {scheduleEndHour}:00)
              </h3>
              <TimetableGrid
                roomId={currentRoom._id}
                roomSettings={currentRoom.settings}
                timeSlots={currentRoom.timeSlots || []}
                members={currentRoom.members || []}
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
              />
            </div>
          </div>
        </div>
        {showManageRoomModal && currentRoom && (
          <RoomManagementModal
            room={currentRoom}
            onClose={() => setShowManageRoomModal(false)}
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
            onClose={() => setShowAssignModal(false)}
            onAssign={(memberId) => {
              handleAssignSlot({
                roomId: currentRoom._id,
                day: days[slotToAssign.dayIndex],
                startTime: slotToAssign.time,
                endTime: calculateEndTime(slotToAssign.time),
                userId: memberId
              });
              setShowAssignModal(false);
              setSlotToAssign(null);
            }}
            slotInfo={slotToAssign}
            members={currentRoom.members}
          />
        )}
        {showRequestModal && slotToRequest && (
          <RequestSlotModal
            onClose={() => setShowRequestModal(false)}
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
              setShowRequestModal(false);
              setSlotToRequest(null);
            }}
            slotInfo={slotToRequest}
          />
        )}
        {showChangeRequestModal && slotToChange && (
          <ChangeRequestModal
            onClose={() => setShowChangeRequestModal(false)}
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
                  message: message || '시간 교환을 요청합니다.',
                };
              } else {
                // Default change request (if action is not specified or new type)
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
                    user: user.id // Assuming currentUser has an id
                  },
                  message: message || '시간 변경 요청합니다.',
                };
              }
              handleRequestSlot(requestData);
              setShowChangeRequestModal(false);
              setSlotToChange(null);
            }}
            slotToChange={slotToChange}
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
            onClick={() => setShowCreateRoomModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center transition-all shadow-md hover:shadow-lg"
          >
            <PlusCircle size={18} className="mr-2" />
            새 조율방 생성
          </button>
          <button
            onClick={() => setShowJoinRoomModal(true)}
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
                  <h4 className="text-lg font-bold text-gray-900 truncate pr-2">{room.name}</h4>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${selectedTab === 'owned' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                    {selectedTab === 'owned' ? '방장' : '멤버'}
                  </span>
                </div>
                {room.description && (
                  <p className="text-gray-600 text-sm mb-4 h-10 line-clamp-2">{room.description}</p>
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
        <RoomCreationModal onClose={() => setShowCreateRoomModal(false)} onCreateRoom={handleCreateRoom} />
      )}
      {showJoinRoomModal && (
        <RoomJoinModal onClose={() => setShowJoinRoomModal(false)} onJoinRoom={handleJoinRoom} />
      )}
    </div>
  );
};


export default CoordinationTab;
