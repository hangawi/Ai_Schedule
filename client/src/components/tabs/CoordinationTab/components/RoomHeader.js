/**
 * ===================================================================================================
 * [파일명] RoomHeader.js - 협업 방 상세 뷰의 헤더 컴포넌트
 * ===================================================================================================
 */
import React from 'react';
import { FileText, Settings, Users, Calendar, ChevronLeft, Sparkles, LogOut, Menu } from 'lucide-react';
import { translateEnglishDays } from '../../../../utils';
import { isRoomOwner } from '../../../../utils/coordinationUtils';

/**
 * [RoomHeader]
 * @description 현재 선택된 협업 방의 상세 정보와 관련 액션 버튼들을 담고 있는 헤더 컴포넌트.
 *              '표준 모드'와 '대화형 모드'에 따라 다른 디자인을 보여줍니다.
 */
const RoomHeader = ({
  currentRoom,
  user,
  isOwner,
  onManageRoom,
  onOpenLogs,
  onBackToRoomList,
  onLeaveRoom,
  isMobile,
  onToggleMembers, // 추가: 참여자 목록 토글 함수
  onToggleSuggestions, // 추가: 일정 관리 모달 토글 함수
  typoCorrection, // 추가: AI 오타 교정 ON/OFF 상태
  onToggleTypoCorrection, // 추가: AI 오타 교정 토글 함수
  onToggleDrawer // 🆕 추가: 오른쪽 Drawer 토글 함수
}) => {
  // 대화형 모드인지 확인
  const isConversational = currentRoom?.mode === 'conversational';

  // =================================================================================
  // [Case 1] 대화형 모드 (Compact & Slim Design)
  // 채팅창 공간 확보를 위해 높이를 줄인 디자인을 사용합니다.
  // =================================================================================
  if (isConversational) {
    if (isMobile) {
      // 모바일용 콤팩트 헤더
      return (
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-30">
          <div className="flex items-center mb-2">
            {/* 뒤로가기 버튼 (왼쪽) */}
            <button
              onClick={onBackToRoomList}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors mr-2"
              title="방 목록"
            >
              <ChevronLeft size={20} />
            </button>

            {/* 방 제목 (가운데) */}
            <div className="flex-1 min-w-0 text-center px-2">
              <h2 className="text-lg font-bold text-gray-800 truncate">{translateEnglishDays(currentRoom.name)}</h2>
              {currentRoom.description && (
                <p className="text-xs text-gray-500 truncate">{translateEnglishDays(currentRoom.description)}</p>
              )}
            </div>

            {/* 메뉴 버튼 (오른쪽) */}
            <button onClick={onToggleDrawer} className="p-2 text-gray-700 hover:bg-gray-100 rounded-full transition-colors" title="메뉴">
              <Menu size={20} />
            </button>
          </div>

          {/* CODE와 인원수 (왼쪽 정렬) */}
          <div className="flex items-center text-xs text-gray-500 space-x-2">
            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700">CODE: {currentRoom.inviteCode}</span>
            <span>👥 {currentRoom.memberCount || currentRoom.members?.length}명</span>
          </div>
        </div>
      );
    }    // PC용 슬림 헤더
    return (
      <div className="bg-white px-6 py-4 rounded-xl shadow-sm mb-4 border border-gray-200">
        <div className="flex items-center justify-between">
          {/* 뒤로가기 버튼 (왼쪽) */}
          <button
            onClick={onBackToRoomList}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="방 목록"
          >
            <ChevronLeft size={22} />
          </button>

          {/* 방 제목 (가운데) */}
          <div className="flex-1 text-center px-6">
            <h2 className="text-xl font-bold text-gray-800">{translateEnglishDays(currentRoom.name)}</h2>
            {currentRoom.description && (
              <p className="text-sm text-gray-500 mt-1">{translateEnglishDays(currentRoom.description)}</p>
            )}
          </div>

          {/* 메뉴 버튼 (오른쪽) */}
          <button
            onClick={onToggleDrawer}
            className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="메뉴"
          >
            <Menu size={22} />
          </button>
        </div>

        {/* CODE와 인원수 (왼쪽 정렬) */}
        <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
          <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
            CODE: {currentRoom.inviteCode}
          </span>
          <span className="text-sm">
            👥 {currentRoom.memberCount || currentRoom.members?.length} / {currentRoom.maxMembers}명
          </span>
        </div>
      </div>
    );
  }

  // =================================================================================
  // [Case 2] 표준 모드 (Original Large Design)
  // 기존의 풍성한 카드 형태 디자인을 유지합니다.
  // =================================================================================
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