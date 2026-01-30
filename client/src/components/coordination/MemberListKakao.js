/**
 * ===================================================================================================
 * MemberListKakao.js - 카카오톡 스타일 조원 목록 컴포넌트 (모바일 최적화)
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/coordination
 *
 * 🎯 주요 기능:
 *    - 카카오톡 대화방 스타일의 조원 목록 UI
 *    - 프로필 아바타 (이름 첫 글자 또는 색상 원형)
 *    - 모바일에 최적화된 터치 인터페이스
 *    - 간결하고 깔끔한 디자인
 *
 * 🔗 연결된 파일:
 *    - ../../utils/coordinationUtils - 조원 이름 표시 유틸리티
 *    - ConversationalRoomView.js - 이 컴포넌트를 사용하는 상위 컴포넌트
 *
 * ===================================================================================================
 */

import React from 'react';
import { Crown } from 'lucide-react';
import { getMemberDisplayName, isCurrentUser, isMemberOwner } from '../../utils/coordinationUtils';

/**
 * 이름에서 첫 글자 추출 (한글/영문)
 */
const getInitial = (name) => {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
};

/**
 * MemberItemKakao - 카카오톡 스타일 조원 아이템
 */
const MemberItemKakao = ({
  member,
  currentRoom,
  user,
  isOwner,
  onMemberClick,
  index
}) => {
  const memberData = member.user || member;
  const memberName = getMemberDisplayName(memberData);
  const isCurrentUserMember = isCurrentUser(memberData, user);
  const memberIsOwner = isMemberOwner(memberData, currentRoom);
  const initial = getInitial(memberName);
  const memberColor = member.color || '#6B7280';

  return (
    <div
      className="flex items-center p-3 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer rounded-lg"
      onClick={() => onMemberClick && onMemberClick(memberData._id || memberData.id)}
    >
      {/* 프로필 아바타 */}
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-sm"
        style={{ backgroundColor: memberColor }}
      >
        {initial}
      </div>

      {/* 조원 정보 */}
      <div className="flex-1 ml-3 min-w-0">
        <div className="flex items-center gap-2">
          {/* 이름 */}
          <span className={`text-base font-medium truncate ${
            memberIsOwner ? 'text-amber-700' : isCurrentUserMember ? 'text-blue-700' : 'text-gray-900'
          }`}>
            {memberName}
          </span>

          {/* 방장 아이콘 */}
          {memberIsOwner && (
            <Crown size={16} className="text-amber-500 fill-amber-500 flex-shrink-0" />
          )}

          {/* 본인 표시 */}
          {isCurrentUserMember && !memberIsOwner && (
            <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded flex-shrink-0">
              나
            </span>
          )}
        </div>

        {/* 참여일 또는 추가 정보 */}
        <div className="text-xs text-gray-500 mt-0.5">
          {new Date(member.joinedAt || new Date()).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })} 참여
        </div>
      </div>

      {/* 온라인 상태 표시 (옵션) */}
      <div className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0 ml-2"></div>
    </div>
  );
};

/**
 * MemberListKakao - 카카오톡 스타일 조원 목록 컨테이너
 */
const MemberListKakao = ({
  currentRoom,
  user,
  isOwner,
  onMemberClick,
  onMemberScheduleClick
}) => {
  const memberCount = (currentRoom.members || []).length;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <h3 className="text-sm font-bold text-gray-700">
          대화 상대 {memberCount}
        </h3>
      </div>

      {/* 조원 목록 */}
      <div className="flex-1 overflow-y-auto">
        {(currentRoom.members || []).map((member, index) => (
          <MemberItemKakao
            key={member.user?._id || member._id || index}
            member={member}
            currentRoom={currentRoom}
            user={user}
            isOwner={isOwner}
            onMemberClick={onMemberClick}
            index={index}
          />
        ))}
      </div>
    </div>
  );
};

export default MemberListKakao;
