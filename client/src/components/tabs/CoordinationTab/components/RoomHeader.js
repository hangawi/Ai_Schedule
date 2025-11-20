// Room header component

import React from 'react';
import { FileText } from 'lucide-react';
import { translateEnglishDays } from '../../../../utils';
import { isRoomOwner } from '../../../../utils/coordinationUtils';

const RoomHeader = ({
  currentRoom,
  user,
  isOwner,
  onManageRoom,
  onOpenLogs,
  selectedSlots,
  onSubmitSlots,
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
        {!isOwner && (
          <button
            onClick={onSubmitSlots}
            className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
            disabled={selectedSlots.length === 0}
          >
            선택 시간표 제출 ({selectedSlots.length}개)
          </button>
        )}
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
