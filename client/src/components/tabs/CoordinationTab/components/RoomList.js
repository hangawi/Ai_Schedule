/**
 * ===================================================================================================
 * [파일명] RoomList.js - 협업 방 목록 표시 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > [client/src/components/tabs/CoordinationTab/components/RoomList.js]
 *
 * 🎯 주요 기능:
 *    - 사용자가 속한 방 목록을 '내가 만든 방'과 '참여 중인 방' 탭으로 구분하여 표시.
 *    - 각 방의 주요 정보(이름, 설명, 멤버 수 등)를 카드 형태로 시각화.
 *    - 방에 새로운 교환 요청이 있을 경우, 해당 방 카드에 알림 배지(카운트)를 표시.
 *    - '새 조율방 생성' 및 '조율방 참여' 기능으로 연결되는 버튼 제공.
 *    - 사용자가 속한 방이 없을 경우, 'Empty State' UI를 표시하여 기능 사용을 유도.
 *
 * 🔗 연결된 파일:
 *    - ../index.js (CoordinationTab): 이 컴포넌트를 사용하며, 방 목록 데이터와 액션 핸들러를 props로 제공.
 *    - ../../../../utils/index.js: `translateEnglishDays` 유틸리티 함수 사용.
 *
 * 💡 UI 위치:
 *    - [협업] 탭 > 초기 화면 (아직 특정 방에 들어가지 않은 상태)
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 협업 탭의 방 목록 화면 전체의 레이아웃과 정보 표시 방식이 변경됩니다.
 *    - 방 카드에 표시되는 정보 변경: `RoomCard` 컴포넌트의 JSX 구조를 수정합니다.
 *    - 탭 로직 변경: `RoomList` 컴포넌트의 `selectedTab` 상태 및 관련 렌더링 로직을 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 컴포넌트는 `CoordinationTab`이 특정 방에 들어가기 전, '로비' 역할을 하는 중요한 진입점입니다.
 *    - `RoomCard`와 `EmptyRoomState`라는 두 개의 내부 컴포넌트로 구성되어 UI를 명확히 분리합니다.
 *    - `roomExchangeCounts` prop을 통해 각 방의 처리되지 않은 요청 수를 받아와 사용자에게 시각적 피드백을 제공합니다.
 *
 * ===================================================================================================
 */
import React from 'react';
import { Users, Calendar, PlusCircle, LogIn } from 'lucide-react';
import { translateEnglishDays } from '../../../../utils';

/**
 * [RoomList]
 * @description 사용자가 소유하거나 참여 중인 방 목록을 탭으로 나누어 보여주는 메인 컴포넌트.
 *              방 생성 및 참여 기능을 제공하며, 방이 없을 경우엔 안내 메시지를 표시합니다.
 * @param {object} myRooms - 'owned'와 'joined' 배열을 포함하는 방 목록 객체.
 * @param {string} selectedTab - 현재 선택된 탭 ('owned' 또는 'joined').
 * @param {function} setSelectedTab - 탭 선택을 변경하는 핸들러.
 * @param {object} roomExchangeCounts - 각 방의 교환 요청 수를 담은 객체.
 * @param {function} onRoomClick - 방 카드를 클릭했을 때 호출될 핸들러.
 * @param {function} onCreateRoom - '방 생성' 버튼 클릭 시 호출될 핸들러.
 * @param {function} onJoinRoom - '방 참여' 버튼 클릭 시 호출될 핸들러.
 * @returns {JSX.Element} 방 목록 컴포넌트의 JSX 엘리먼트.
 */
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

/**
 * [RoomCard]
 * @description 단일 방의 요약 정보를 보여주는 카드 UI 컴포넌트.
 *              방 이름, 설명, 멤버 수, 생성일, 초대 코드 등을 표시하며, 새로운 요청이 있을 경우 알림 배지를 보여줍니다.
 * @param {object} room - 표시할 방의 정보 객체.
 * @param {string} selectedTab - 현재 탭 정보 ('owned'/'joined')로 '방장'/'멤버' 배지 표시.
 * @param {number} exchangeCount - 해당 방의 처리되지 않은 교환 요청 수.
 * @param {function} onClick - 카드가 클릭되었을 때 호출될 함수.
 * @returns {JSX.Element} 방 카드 컴포넌트의 JSX 엘리먼트.
 */
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

/**
 * [EmptyRoomState]
 * @description 사용자가 속한 방이 하나도 없을 때 보여주는 UI 컴포넌트.
 *                사용자에게 기능에 대해 설명하고 방 생성/참여를 유도합니다.
 * @returns {JSX.Element} 빈 상태 안내 컴포넌트의 JSX 엘리먼트.
 */
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