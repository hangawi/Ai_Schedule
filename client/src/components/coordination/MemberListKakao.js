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
      className="flex items-center px-5 py-3"
      onClick={() => onMemberClick && onMemberClick(memberData._id || memberData.id)}
    >
      {/* 프로필 아바타 */}
      <div className="relative flex-shrink-0">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl"
          style={{ backgroundColor: memberColor }}
        >
          {initial}
        </div>
        {/* 방장 표시 - 프로필 위에 작은 아이콘 */}
        {memberIsOwner && (
          <div className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
            <Crown size={12} className="text-white fill-white" />
          </div>
        )}
      </div>

      {/* 조원 정보 */}
      <div className="flex-1 ml-4 min-w-0">
        <div className="flex items-center gap-2">
          {/* 본인 표시 */}
          {isCurrentUserMember && (
            <span className="text-sm px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded flex-shrink-0 font-medium">
              나
            </span>
          )}

          {/* 이름 */}
          <span className="text-base font-normal text-gray-900 truncate">
            {memberName}
          </span>
        </div>
      </div>
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
      <div className="px-5 py-4 flex-shrink-0">
        <h3 className="text-sm font-medium text-gray-600">
          대화상대 {memberCount}
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
