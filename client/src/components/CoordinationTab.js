import React, { useState, useEffect } from 'react';
import TimetableGrid from './timetable/TimetableGrid';
import RoomCreationModal from './modals/RoomCreationModal';
import RoomJoinModal from './modals/RoomJoinModal';
import RoomManagementModal from './modals/RoomManagementModal';
import { useCoordination } from '../hooks/useCoordination';
import { useAuth } from '../hooks/useAuth';
import { Users, Calendar, PlusCircle, LogIn } from 'lucide-react';


const CoordinationTab = () => {
  const { user } = useAuth();
  const { currentRoom, createRoom, joinRoom, isLoading, error, submitTimeSlots, myRooms, fetchMyRooms, fetchRoomDetails, setCurrentRoom, updateRoom, deleteRoom } = useCoordination(user?.id);

  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [showJoinRoomModal, setShowJoinRoomModal] = useState(false);
  const [showManageRoomModal, setShowManageRoomModal] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [selectedTab, setSelectedTab] = useState('owned'); // 'owned' or 'joined'

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
    if (!currentRoom) return;
    await submitTimeSlots(currentRoom._id, selectedSlots);
    setSelectedSlots([]);
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
    if (user?.id) {
      if (currentRoom.owner?._id === user.id || 
          currentRoom.owner?.id === user.id || 
          (typeof currentRoom.owner === 'string' && currentRoom.owner === user.id) ||
          currentRoom.roomMasterId?._id === user.id) {
        isOwner = true;
      }
    }
    
    return (
      <div className="p-1">
        <div className="bg-white p-6 rounded-xl shadow-lg mb-6 border border-gray-200">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-800">{currentRoom.name}</h2>
              <p className="text-gray-500 mt-1">{currentRoom.description || '방 설명이 없습니다.'}</p>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                <div className="flex items-center"><strong className="mr-2">초대코드:</strong> <span className="font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded">{currentRoom.inviteCode}</span></div>
                <div className="flex items-center"><strong className="mr-2">방장:</strong> {isOwner ? (user.name || `${user.firstName} ${user.lastName}`) : (currentRoom.owner?.name || '알 수 없음')}</div>
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
            <button
              onClick={handleSubmitSlots}
              className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
              disabled={selectedSlots.length === 0}
            >
              선택 시간표 제출 ({selectedSlots.length}개)
            </button>
            <button
              onClick={() => setCurrentRoom(null)}
              className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors shadow-sm"
            >
              방 목록으로 돌아가기
            </button>
          </div>
        </div>
        <TimetableGrid
          roomSettings={currentRoom.settings}
          timeSlots={currentRoom.timeSlots || []}
          members={currentRoom.members || []}
          onSlotSelect={setSelectedSlots}
          currentUser={user}
          isRoomOwner={isOwner}
        />
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
