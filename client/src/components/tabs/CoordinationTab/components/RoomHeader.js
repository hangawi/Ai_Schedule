/**
 * ===================================================================================================
 * [파일명] RoomHeader.js - 협업 방 상세 뷰의 헤더 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > [client/src/components/tabs/CoordinationTab/components/RoomHeader.js]
 *
 * 🎯 주요 기능:
 *    - 현재 선택된 협업 방의 주요 정보(이름, 설명, 초대코드, 멤버 수 등)를 표시.
 *    - 사용자의 역할(방장/멤버)에 따라 다른 액션 버튼을 조건부로 렌더링.
 *    - 방장에게는 '방 관리', '로그 보기' 버튼을 제공.
 *    - 일반 멤버에게는 '방 나가기' 버튼을 제공.
 *    - 모든 사용자에게 '방 목록으로 돌아가기' 기능을 제공.
 *
 * 🔗 연결된 파일:
 *    - ../index.js (CoordinationTab): 이 컴포넌트를 사용하며 모든 데이터와 핸들러를 props로 제공.
 *    - ../../../../utils/coordinationUtils.js: 사용자가 방장인지 판별하는 `isRoomOwner` 유틸리티 함수.
 *
 * 💡 UI 위치:
 *    - [협업] 탭 > (방 선택 후) > 페이지 최상단
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 방 상세 뷰의 헤더 정보 및 버튼 레이아웃이 변경됩니다.
 *    - 새로운 방 정보 추가: JSX 내에 새로운 정보를 표시하는 엘리먼트를 추가합니다.
 *    - 새로운 액션 버튼 추가: 부모 컴포넌트(`CoordinationTab`)로부터 새로운 핸들러를 props로 받아와 버튼과 연결합니다.
 *
 * 📝 참고사항:
 *    - 이 컴포넌트는 데이터를 받아 표시하고, 이벤트 발생 시 상위로 콜백을 전달하는 Presentational Component입니다.
 *    - `isOwner` prop을 통해 사용자의 역할에 따라 UI가 동적으로 변경되는 것이 핵심입니다.
 *    - `translateEnglishDays` 유틸리티를 사용하여 방 이름이나 설명에 포함된 영어 요일을 한국어로 번역하여 표시합니다.
 *
 * ===================================================================================================
 */
import React from 'react';
import { FileText } from 'lucide-react';
import { translateEnglishDays } from '../../../../utils';
import { isRoomOwner } from '../../../../utils/coordinationUtils';

/**
 * [RoomHeader]
 * @description 현재 선택된 협업 방의 상세 정보와 관련 액션 버튼들을 담고 있는 헤더 컴포넌트.
 *              사용자의 권한(방장 여부)에 따라 다른 버튼을 보여줍니다.
 * @param {object} currentRoom - 현재 방의 정보 객체.
 * @param {object} user - 현재 로그인한 사용자 정보 객체.
 * @param {boolean} isOwner - 현재 사용자가 방장인지 여부.
 * @param {function} onManageRoom - '방 관리' 버튼 클릭 시 호출될 핸들러.
 * @param {function} onOpenLogs - '로그 보기' 버튼 클릭 시 호출될 핸들러.
 * @param {function} onBackToRoomList - '방 목록으로 돌아가기' 버튼 클릭 시 호출될 핸들러.
 * @param {function} onLeaveRoom - '방 나가기' 버튼 클릭 시 호출될 핸들러.
 * @returns {JSX.Element} 방 헤더 컴포넌트의 JSX 엘리먼트.
 */
const RoomHeader = ({
  currentRoom,
  user,
  isOwner,
  onManageRoom,
  onOpenLogs,
  onBackToRoomList,
  onLeaveRoom
}) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-lg mb-6 border border-gray-200">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-800">{translateEnglishDays(currentRoom.name)}</h2>
          <p className="text-gray-500 mt-1">{translateEnglishDays(currentRoom.description || '방 설명이 없습니다.')}</p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
            <div className="flex items-center">
              <strong className="mr-2">초대코드:</strong>
              <span className="font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded">{currentRoom.inviteCode}</span>
            </div>
            <div className="flex items-center">
              <strong className="mr-2">방장:</strong>
              {isOwner
                ? `${user.firstName} ${user.lastName}`
                : `${currentRoom.owner?.firstName || ''} ${currentRoom.owner?.lastName || ''}`.trim() || '알 수 없음'}
            </div>
            <div className="flex items-center">
              <strong className="mr-2">멤버:</strong>
              {currentRoom.memberCount || currentRoom.members?.length || 0} / {currentRoom.maxMembers}명
            </div>
          </div>
        </div>
        {isOwner && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 flex gap-2">
            <button
              onClick={onManageRoom}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-medium shadow-sm"
            >
              방 관리
            </button>
            <button
              onClick={onOpenLogs}
              className="px-3 py-2 text-sm bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors font-medium shadow-sm flex items-center"
              title="방 활동 로그를 확인합니다"
            >
              <FileText size={14} className="mr-1" />
              로그 보기
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={onBackToRoomList}
          className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors shadow-sm"
        >
          방 목록으로 돌아가기
        </button>
        {!isOwner && (
          <button
            onClick={onLeaveRoom}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: '#f97316',
              color: 'white',
              borderRadius: '0.5rem',
              fontWeight: '500',
              boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
              border: 'none',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#ea580c'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#f97316'}
          >
            방 나가기
          </button>
        )}
      </div>
    </div>
  );
};

export default RoomHeader;