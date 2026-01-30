import React, { useState } from 'react';
import GroupChat from '../chat/GroupChat';
import MemberList from './MemberList';
import SuggestionModal from '../chat/SuggestionModal';
import { RoomHeader } from '../tabs/CoordinationTab/components'; // 헤더 재사용
import { Users, LogOut, X, Calendar, Sparkles, Settings, FileText } from 'lucide-react';

/**
 * 대화형 조율방 전용 뷰 (Conversational Room View)
 * - 기존의 시간표 그리드 대신 채팅창이 메인
 * - 우측(PC) 또는 탭(모바일)에 멤버 목록 및 정보 표시
 */
const ConversationalRoomView = ({
  currentRoom,
  user,
  isOwner,
  isMobile,
  onManageRoom,
  onBackToRoomList,
  onLeaveRoom,
  onMemberClick,
  onMemberScheduleClick,
  onOpenLogs
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false); // 일정 관리 모달 토글
  const [showDrawer, setShowDrawer] = useState(false); // 🆕 오른쪽 Drawer 토글
  const [typoCorrection, setTypoCorrection] = useState(() => {
    // localStorage에서 상태 복원
    const saved = localStorage.getItem('typoCorrection');
    return saved === 'true';
  });

  // 오타 교정 토글 핸들러
  const handleToggleTypoCorrection = () => {
    setTypoCorrection(prev => {
      const newValue = !prev;
      localStorage.setItem('typoCorrection', String(newValue));
      return newValue;
    });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
      {/* 헤더 (기존 컴포넌트 재사용) */}
      <RoomHeader
        currentRoom={currentRoom}
        user={user}
        isOwner={isOwner}
        onBackToRoomList={onBackToRoomList}
        isMobile={isMobile}
        onToggleDrawer={() => setShowDrawer(!showDrawer)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* 메인 영역: 그룹 채팅 */}
        <div className="flex-1 flex flex-col relative">
          <GroupChat
            roomId={currentRoom._id}
            user={user}
            isMobile={isMobile}
            typoCorrection={typoCorrection}
          />
        </div>
      </div>

      {/* 일정 관리 모달 */}
      <SuggestionModal
        isOpen={showSuggestions}
        onClose={() => setShowSuggestions(false)}
        roomId={currentRoom._id}
        isMobile={isMobile}
      />

      {/* 🆕 오른쪽 Drawer (조원 목록 + 나가기) */}
      <>
        {/* Overlay */}
        {showDrawer && (
          <div
            className="fixed inset-0 bg-black bg-opacity-30 z-40 transition-opacity animate-fadeIn"
            onClick={() => setShowDrawer(false)}
          />
        )}

        {/* Drawer Panel */}
        <div className={`
          fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50
          transform transition-transform duration-300 ease-in-out
          ${showDrawer ? 'translate-x-0' : 'translate-x-full'}
          flex flex-col
        `}>
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">메뉴</h3>
              <button
                onClick={() => setShowDrawer(false)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Content: 조원 목록 */}
            <div className="flex-1 overflow-y-auto p-4">
              <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <Users size={16} />
                조원 목록
              </h4>
              <MemberList
                currentRoom={currentRoom}
                user={user}
                isOwner={isOwner}
                onMemberClick={onMemberClick}
                onMemberScheduleClick={onMemberScheduleClick}
                isMobile={isMobile}
              />
            </div>

            {/* Drawer Footer: 아이콘 버튼들 */}
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <div className="grid grid-cols-4 gap-2">
                {/* 방 나가기 */}
                <button
                  onClick={() => {
                    setShowDrawer(false);
                    onLeaveRoom();
                  }}
                  className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors flex flex-col items-center gap-1"
                  title="방 나가기"
                >
                  <LogOut size={18} />
                  <span className="text-[10px] font-medium whitespace-nowrap">나가기</span>
                </button>

                {/* 일정 관리 */}
                <button
                  onClick={() => {
                    setShowDrawer(false);
                    setShowSuggestions(true);
                  }}
                  className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors flex flex-col items-center gap-1"
                  title="일정 관리"
                >
                  <Calendar size={18} />
                  <span className="text-[10px] font-medium whitespace-nowrap">일정</span>
                </button>

                {/* 방 관리 (방장만) */}
                {isOwner ? (
                  <button
                    onClick={() => {
                      setShowDrawer(false);
                      onManageRoom();
                    }}
                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex flex-col items-center gap-1"
                    title="방 관리"
                  >
                    <Settings size={18} />
                    <span className="text-[10px] font-medium whitespace-nowrap">관리</span>
                  </button>
                ) : (
                  <div className="p-2"></div>
                )}

                {/* AI 오타 교정 */}
                <button
                  onClick={handleToggleTypoCorrection}
                  className={`p-2 rounded-lg transition-colors flex flex-col items-center gap-1 ${
                    typoCorrection
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                  title={typoCorrection ? 'AI 오타 교정 ON' : 'AI 오타 교정 OFF'}
                >
                  <Sparkles size={18} />
                  <span className="text-[10px] font-medium whitespace-nowrap">AI</span>
                </button>
              </div>
            </div>
          </div>
      </>
    </div>
  );
};

export default ConversationalRoomView;
