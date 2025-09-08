import React, { useState, useEffect } from 'react';
import TimetableGrid from './timetable/TimetableGrid';
import RoomCreationModal from './modals/RoomCreationModal';
import RoomJoinModal from './modals/RoomJoinModal';
import { useCoordination } from '../hooks/useCoordination';
import { useAuth } from '../hooks/useAuth';

const CoordinationTab = () => {
  const { user } = useAuth();
  const { currentRoom, createRoom, joinRoom, isLoading, error, submitTimeSlots, myRooms, fetchMyRooms, fetchRoomDetails, setCurrentRoom } = useCoordination(user?.id);

  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [showJoinRoomModal, setShowJoinRoomModal] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState([]);

  const handleCreateRoom = async (roomData) => {
    await createRoom({ ...roomData, roomMasterId: user.id });
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

  useEffect(() => {
    if (user?.id) {
      fetchMyRooms();
    }
  }, [user?.id, fetchMyRooms]);

  if (isLoading) {
    return <div className="text-center text-gray-500">로딩 중...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500">오류 발생: {error}</div>;
  }

  if (currentRoom) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">시간표 조율</h2>
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <h3 className="text-xl font-semibold text-gray-800">{currentRoom.name}</h3>
          <p className="text-gray-600">초대 코드: <span className="font-mono font-bold text-blue-600">{currentRoom.inviteCode}</span></p>
          <p className="text-gray-600">멤버: {currentRoom.members.length} / {currentRoom.settings.maxMembers}명</p>
          <button
            onClick={handleSubmitSlots}
            className="mt-4 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
            disabled={selectedSlots.length === 0}
          >
            선택 시간표 제출 ({selectedSlots.length}개)
          </button>
          <button
            onClick={() => setCurrentRoom(null)} // Go back to room list
            className="ml-4 mt-4 px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
          >
            방 목록으로 돌아가기
          </button>
        </div>
        <TimetableGrid
          roomSettings={currentRoom.settings}
          timeSlots={currentRoom.timeSlots}
          members={currentRoom.members}
          onSlotSelect={setSelectedSlots}
        />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">시간표 조율</h2>
      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setShowCreateRoomModal(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          새 조율방 생성
        </button>
        <button
          onClick={() => setShowJoinRoomModal(true)}
          className="px-4 py-2 border border-blue-500 text-blue-500 rounded-md hover:bg-blue-50"
        >
          조율방 참여
        </button>
      </div>

      {myRooms.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">내 조율방</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myRooms.map(room => (
              <div
                key={room.id}
                className="bg-white p-4 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setCurrentRoom(room)}
              >
                <h4 className="text-lg font-bold text-gray-800">{room.name}</h4>
                <p className="text-gray-600 text-sm">방장: {room.roomMasterId.firstName} {room.roomMasterId.lastName}</p>
                <p className="text-gray-600 text-sm">멤버: {room.members.length} / {room.settings.maxMembers}명</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreateRoomModal && (
        <RoomCreationModal
          onClose={() => setShowCreateRoomModal(false)}
          onCreateRoom={handleCreateRoom}
        />
      )}
      {showJoinRoomModal && (
        <RoomJoinModal
          onClose={() => setShowJoinRoomModal(false)}
          onJoinRoom={handleJoinRoom}
        />
      )}
    </div>
  );
};

export default CoordinationTab;
