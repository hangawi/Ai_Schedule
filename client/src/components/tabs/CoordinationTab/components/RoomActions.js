// Room action buttons component

import React from 'react';

const RoomActions = ({
  isOwner,
  selectedSlots,
  onSubmitSlots,
  onBackToRoomList,
  onLeaveRoom
}) => {
  return (
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
  );
};

export default RoomActions;
