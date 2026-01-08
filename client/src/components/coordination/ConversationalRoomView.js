import React, { useState } from 'react';
import GroupChat from '../chat/GroupChat';
import MemberList from './MemberList';
import { RoomHeader } from '../tabs/CoordinationTab/components'; // 헤더 재사용
import { Users, Info } from 'lucide-react';

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
  onMemberScheduleClick
}) => {
  const [showMembers, setShowMembers] = useState(false); // 모바일에서 멤버 목록 토글

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
      {/* 헤더 (기존 컴포넌트 재사용) */}
      <RoomHeader 
        currentRoom={currentRoom} 
        user={user} 
        isOwner={isOwner} 
        onManageRoom={onManageRoom} 
        onBackToRoomList={onBackToRoomList} 
        onLeaveRoom={onLeaveRoom} 
        isMobile={isMobile}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* 메인 영역: 그룹 채팅 */}
        <div className="flex-1 flex flex-col relative">
          <GroupChat 
            roomId={currentRoom._id} 
            user={user} 
            isMobile={isMobile} 
          />
          
          {/* 모바일: 멤버 목록 토글 버튼 */}
          {isMobile && (
            <button 
              onClick={() => setShowMembers(!showMembers)}
              className="absolute top-4 right-4 bg-white/90 p-2 rounded-full shadow-md border border-gray-200 z-10 text-gray-600"
            >
              {showMembers ? <Info size={20} /> : <Users size={20} />}
            </button>
          )}
        </div>

        {/* 사이드 패널: 멤버 목록 및 정보 (PC: 우측 고정, 모바일: 오버레이) */}
        {(showMembers || !isMobile) && (
          <div className={`
            ${isMobile 
              ? 'absolute inset-0 z-20 bg-white transform transition-transform duration-300' 
              : 'w-80 border-l border-gray-200 bg-white flex-shrink-0'
            }
            ${isMobile && !showMembers ? 'translate-x-full' : 'translate-x-0'}
          `}>
            {isMobile && (
              <div className="flex justify-between items-center p-4 border-b border-gray-100">
                <h3 className="font-bold text-lg">참여자 목록</h3>
                <button onClick={() => setShowMembers(false)} className="text-gray-500">닫기</button>
              </div>
            )}
            <div className="h-full overflow-y-auto p-4">
              <MemberList 
                currentRoom={currentRoom} 
                user={user} 
                isOwner={isOwner} 
                onMemberClick={onMemberClick} 
                onMemberScheduleClick={onMemberScheduleClick} 
                isMobile={isMobile}
              />
              <div className="mt-6 p-4 bg-blue-50 rounded-xl text-xs text-blue-800 leading-relaxed">
                <h4 className="font-bold mb-2 text-blue-900">💡 대화형 조율 가이드</h4>
                <p>채팅방에서 자유롭게 일정을 의논하세요. AI가 대화를 분석하여 일정이 합의되면 자동으로 캘린더 등록을 제안합니다.</p>
                <ul className="list-disc pl-4 mt-2 space-y-1">
                  <li>"내일 오후 2시 어때?"</li>
                  <li>"좋아, 그때 보자!"</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationalRoomView;
