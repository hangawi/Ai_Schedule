// Room list component

import React from 'react';
import { Users, Calendar, PlusCircle, LogIn } from 'lucide-react';
import { translateEnglishDays } from '../../../../utils';

const RoomList = ({
  myRooms,
  selectedTab,
  setSelectedTab,
  roomExchangeCounts,
  onRoomClick,
  onCreateRoom,
  onJoinRoom
}) => {
  const hasRooms = myRooms?.owned?.length > 0 || myRooms?.joined?.length > 0;

  return (
    <div className="bg-slate-50 p-4 sm:p-6 rounded-lg min-h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2 sm:mb-0">일정 맞추기</h2>
        <div className="flex space-x-3">
          <button
            onClick={onCreateRoom}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center transition-all shadow-md hover:shadow-lg"
          >
            <PlusCircle size={18} className="mr-2" />
            새 조율방 생성
          </button>
          <button
            onClick={onJoinRoom}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center transition-all shadow-md hover:shadow-lg"
          >
            <LogIn size={18} className="mr-2" />
            조율방 참여
          </button>
        </div>
      </div>

      {hasRooms && (
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
              <RoomCard
                key={room._id}
                room={room}
                selectedTab={selectedTab}
                exchangeCount={roomExchangeCounts[room._id]}
                onClick={() => onRoomClick(room)}
              />
            ))}
          </div>
        </div>
      )}

      {!hasRooms && <EmptyRoomState />}
    </div>
  );
};

const RoomCard = ({ room, selectedTab, exchangeCount, onClick }) => (
  <div
    className="bg-white p-5 rounded-xl shadow-lg cursor-pointer hover:shadow-2xl transition-all duration-300 border border-gray-200 hover:border-blue-400 transform hover:-translate-y-1"
    onClick={onClick}
  >
    <div className="flex justify-between items-start mb-3">
      <div className="flex items-center">
        <h4 className="text-lg font-bold text-gray-900 truncate pr-2">{translateEnglishDays(room.name)}</h4>
        {exchangeCount > 0 && (
          <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] h-5 flex items-center justify-center">
            {exchangeCount}
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
);

const EmptyRoomState = () => (
  <div className="text-center py-16 bg-white rounded-lg shadow-md border">
    <div className="text-gray-400 text-8xl mb-6">📅</div>
    <h3 className="text-2xl font-bold text-gray-700 mb-4">시간표 조율을 시작해보세요!</h3>
    <p className="text-gray-500 mb-8 max-w-md mx-auto">
      팀 프로젝트나 스터디 그룹의 시간을 효율적으로 조율할 수 있습니다.
      방을 만들거나 기존 방에 참여해보세요.
    </p>
  </div>
);

export default RoomList;
