import React from 'react';
import { Users } from 'lucide-react';
import { getMemberDisplayName, isCurrentUser, isMemberOwner } from '../../utils/coordinationUtils';

const MemberItem = ({
  member,
  currentRoom,
  user,
  isOwner,
  onMemberClick,
  onMemberScheduleClick,
  index
}) => {
  const memberData = member.user || member;
  const memberName = getMemberDisplayName(memberData);
  const isCurrentUserMember = isCurrentUser(memberData, user);
  const memberIsOwner = isMemberOwner(memberData, currentRoom);

  return (
    <div
      key={memberData._id || index}
      className={`flex items-center p-3 rounded-lg border ${
        memberIsOwner
          ? 'bg-red-50 border-red-200 ring-2 ring-red-100'
          : isCurrentUserMember
            ? 'bg-blue-50 border-blue-200'
            : 'bg-gray-50 border-gray-200'
      }`}
    >
      <div
        className={`w-5 h-5 rounded-full mr-3 flex-shrink-0 ${
          memberIsOwner ? 'ring-2 ring-red-300' : ''
        }`}
        style={{ backgroundColor: member.color || '#6B7280' }}
      ></div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center">
          <span className={`text-sm font-medium truncate ${
            memberIsOwner
              ? 'text-red-900 font-bold'
              : isCurrentUserMember
                ? 'text-blue-900'
                : 'text-gray-900'
          }`}>
            {memberIsOwner && '👑 '}
            {memberName}
            {isCurrentUserMember && ' (나)'}
          </span>

          {memberIsOwner && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full flex-shrink-0 font-semibold">
              방장
            </span>
          )}

          {!memberIsOwner && (member.carryOver > 0 || (() => {
            if (!currentRoom?.negotiations) return false;
            const activeNegotiations = currentRoom.negotiations.filter(neg =>
              neg.status === 'active' &&
              neg.conflictingMembers &&
              Array.isArray(neg.conflictingMembers) &&
              neg.conflictingMembers.length > 1
            );
            return activeNegotiations.length > 0;
          })()) && (
            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full flex-shrink-0 font-semibold ${
              member.carryOver > 0
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-600'
            }`}>
              이월: {member.carryOver || 0}시간
            </span>
          )}

          {!memberIsOwner && member.totalProgressTime > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full flex-shrink-0 font-semibold">
              완료: {member.totalProgressTime}시간
            </span>
          )}
        </div>

        <div className={`text-xs mt-1 ${
          memberIsOwner ? 'text-red-600' : 'text-gray-500'
        }`}>
          {new Date(member.joinedAt || new Date()).toLocaleDateString('ko-KR')} 참여
        </div>
      </div>

      {/* 버튼들 */}
      {isOwner && (
        <div className="flex flex-col gap-1 ml-2">
          <button
            onClick={() => onMemberClick(memberData._id || memberData.id)}
            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            통계
          </button>
          <button
            onClick={() => onMemberScheduleClick(memberData._id || memberData.id)}
            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          >
            시간표
          </button>
        </div>
      )}
    </div>
  );
};

const MemberList = ({
  currentRoom,
  user,
  isOwner,
  onMemberClick,
  onMemberScheduleClick
}) => {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 sm:p-4">
      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
        <Users size={20} className="mr-2 text-blue-600" />
        조원 목록 ({(currentRoom.members || []).length}명)
      </h3>

      <div className="space-y-3">
        {(currentRoom.members || []).map((member, index) => (
          <MemberItem
            key={member.user?._id || member._id || index}
            member={member}
            currentRoom={currentRoom}
            user={user}
            isOwner={isOwner}
            onMemberClick={onMemberClick}
            onMemberScheduleClick={onMemberScheduleClick}
            index={index}
          />
        ))}
      </div>
    </div>
  );
};

export default MemberList;