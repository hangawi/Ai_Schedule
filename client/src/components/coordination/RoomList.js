/**
 * ===================================================================================================
 * RoomList.js - 조율방 목록 및 관련 UI 컴포넌트 모음
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/coordination
 *
 * 🎯 주요 기능:
 *    - `RoomList`: 사용자가 속한 조율방 목록을 '내가 만든 방'과 '참여 중인 방'으로 나누어 표시하는 메인 컴포넌트
 *    - `RoomCard`: 개별 조율방의 정보를 보여주는 카드 UI
 *    - `EmptyRoomList`: 사용자가 속한 방이 없을 때 표시되는 UI
 *    - `RoomListHeader`: '새 조율방 생성', '조율방 참여' 버튼이 포함된 헤더
 *    - `RoomTabs`: '내가 만든 방'과 '참여 중인 방'을 전환하는 탭
 *    - `RoomGrid`: `RoomCard`들을 그리드 레이아웃으로 배열
 *
 * 🔗 연결된 파일:
 *    - ../../utils - `translateEnglishDays` 등 유틸리티 함수
 *    - CoordinationTab/index.js - 이 컴포넌트를 사용하는 상위 컴포넌트
 *
 * 💡 UI 위치:
 *    - 조율 탭 > 방 목록 뷰
 *
 * ✏️ 수정 가이드:
 *    - 방 카드 디자인 변경: `RoomCard` 컴포넌트의 JSX 및 스타일 수정
 *    - 방 목록 그리드 레이아웃 변경: `RoomGrid` 컴포넌트의 Tailwind CSS 그리드 클래스 수정
 *    - 탭 UI 변경: `RoomTabs` 컴포넌트 수정
 *
 * 📝 참고사항:
 *    - 이 파일은 `RoomList`를 중심으로 여러 개의 작은 UI 컴포넌트로 잘게 나누어져 있어 유지보수가 용이합니다.
 *    - `roomExchangeCounts` prop을 통해 각 방에 처리되지 않은 요청이 몇 개 있는지 뱃지로 표시합니다.
 *
 * ===================================================================================================
 */

import React from 'react';
import { Users, Calendar, PlusCircle, LogIn } from 'lucide-react';
import { translateEnglishDays } from '../../utils';

/**
 * RoomCard
 * @description 개별 조율방의 요약 정보를 표시하는 카드 컴포넌트입니다.
 */
const RoomCard = ({ room, selectedTab, roomExchangeCounts, onRoomClick }) => {
  return (
    <div
      key={room._id}
      className="bg-white p-5 rounded-xl shadow-lg cursor-pointer hover:shadow-2xl transition-all duration-300 border border-gray-200 hover:border-blue-400 transform hover:-translate-y-1"
      onClick={() => onRoomClick(room)}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center">
          <h4 className="text-lg font-bold text-gray-900 truncate pr-2">
            {translateEnglishDays(room.name)}
          </h4>
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
      {room.description && <p className="text-gray-600 text-sm mb-4 h-10 line-clamp-2">{translateEnglishDays(room.description)}</p>}
      <div className="space-y-2 text-sm text-gray-700 border-t pt-4 mt-4">
        <div className="flex items-center"><Users size={14} className="mr-2 text-gray-400"/><span>멤버: {room.memberCount || room.members?.length || 0} / {room.maxMembers}명</span></div>
        <div className="flex items-center"><Calendar size={14} className="mr-2 text-gray-400"/><span>생성일: {new Date(room.createdAt).toLocaleDateString()}</span></div>
        <div className="flex items-center"><strong className="text-gray-500 mr-2">Code:</strong><span className="font-mono bg-gray-100 text-gray-800 px-2 py-0.5 rounded">{room.inviteCode}</span></div>
      </div>
    </div>
  );
};

/**
 * EmptyRoomList
 * @description 사용자가 속한 방이 하나도 없을 때 표시되는 플레이스홀더 컴포넌트입니다.
 */
const EmptyRoomList = () => {
  return (
    <div className="text-center py-16 bg-white rounded-lg shadow-md border">
      <div className="text-gray-400 text-8xl mb-6">📅</div>
      <h3 className="text-2xl font-bold text-gray-700 mb-4">시간표 조율을 시작해보세요!</h3>
      <p className="text-gray-500 mb-8 max-w-md mx-auto">팀 프로젝트나 스터디 그룹의 시간을 효율적으로 조율할 수 있습니다. 방을 만들거나 기존 방에 참여해보세요.</p>
    </div>
  );
};

/**
 * RoomListHeader
 * @description 방 목록 상단의 헤더. 페이지 제목과 '새 조율방 생성', '조율방 참여' 버튼을 포함합니다.
 */
const RoomListHeader = ({ onCreateRoom, onJoinRoom }) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-2 sm:mb-0">일정 맞추기</h2>
      <div className="flex space-x-3">
        <button onClick={onCreateRoom} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center transition-all shadow-md hover:shadow-lg"><PlusCircle size={18} className="mr-2" />새 조율방 생성</button>
        <button onClick={onJoinRoom} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center transition-all shadow-md hover:shadow-lg"><LogIn size={18} className="mr-2" />조율방 참여</button>
      </div>
    </div>
  );
};

/**
 * RoomTabs
 * @description '내가 만든 방'과 '참여 중인 방'을 전환하는 탭 UI 컴포넌트입니다.
 */
const RoomTabs = ({ selectedTab, setSelectedTab, myRooms }) => {
  return (
    <div className="flex space-x-2 border-b border-gray-200 mb-4">
      <button onClick={() => setSelectedTab('owned')} className={`px-4 py-2 font-semibold transition-colors ${selectedTab === 'owned' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
        내가 만든 방 ({myRooms?.owned?.length || 0})
      </button>
      <button onClick={() => setSelectedTab('joined')} className={`px-4 py-2 font-semibold transition-colors ${selectedTab === 'joined' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
        참여 중인 방 ({myRooms?.joined?.length || 0})
      </button>
    </div>
  );
};

/**
 * RoomGrid
 * @description 선택된 탭에 해당하는 방 목록을 그리드 레이아웃으로 렌더링하는 컴포넌트입니다.
 */
const RoomGrid = ({ myRooms, selectedTab, roomExchangeCounts, onRoomClick }) => {
  const rooms = selectedTab === 'owned' ? myRooms.owned : myRooms.joined;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {rooms.map(room => (
        <RoomCard key={room._id} room={room} selectedTab={selectedTab} roomExchangeCounts={roomExchangeCounts} onRoomClick={onRoomClick} />
      ))}
    </div>
  );
};

/**
 * RoomList
 *
 * @description 사용자가 속한 조율방 목록을 전체적으로 관리하고 렌더링하는 메인 컴포넌트입니다.
 * @param {Object} props - 컴포넌트 프롭스
 * @param {Object} props.myRooms - 'owned'와 'joined'로 구분된 방 목록 데이터
 * @param {string} props.selectedTab - 현재 선택된 탭 ('owned' 또는 'joined')
 * @param {Function} props.setSelectedTab - 탭 선택 상태를 변경하는 함수
 * @param {Object} props.roomExchangeCounts - 각 방의 처리되지 않은 요청 수를 담은 객체
 * @param {Function} props.onCreateRoom - '새 조율방 생성' 버튼 클릭 시 호출될 함수
 * @param {Function} props.onJoinRoom - '조율방 참여' 버튼 클릭 시 호출될 함수
 * @param {Function} props.onRoomClick - 개별 방 카드를 클릭했을 때 호출될 함수
 * @returns {JSX.Element} 조율방 목록 전체 UI
 */
const RoomList = ({
  myRooms,
  selectedTab,
  setSelectedTab,
  roomExchangeCounts,
  onCreateRoom,
  onJoinRoom,
  onRoomClick
}) => {
  const hasRooms = (myRooms?.owned?.length > 0 || myRooms?.joined?.length > 0);

  return (
    <div className="bg-slate-50 p-4 sm:p-6 rounded-lg min-h-full">
      <RoomListHeader onCreateRoom={onCreateRoom} onJoinRoom={onJoinRoom} />
      {hasRooms ? (
        <div className="mb-6">
          <RoomTabs selectedTab={selectedTab} setSelectedTab={setSelectedTab} myRooms={myRooms} />
          <RoomGrid myRooms={myRooms} selectedTab={selectedTab} roomExchangeCounts={roomExchangeCounts} onRoomClick={onRoomClick} />
        </div>
      ) : (
        <EmptyRoomList />
      )}
    </div>
  );
};

export default RoomList;
