import React from 'react';
import { MessageSquare, Clock } from 'lucide-react';
import { calculateEndTime, isUserInvolvedInNegotiation, getNegotiationMemberNames } from '../../utils/coordinationUtils';

const NegotiationItem = ({
  negotiation,
  weekNegotiation,
  user,
  onOpenNegotiation,
  index,
  isOwner
}) => {
  const isUserInvolved = isUserInvolvedInNegotiation(negotiation, user?.id);
  const memberNames = getNegotiationMemberNames(negotiation);

  return (
    <div key={index} className={`p-3 rounded-lg border ${
      isUserInvolved
        ? 'bg-yellow-50 border-yellow-200 ring-2 ring-yellow-100'
        : 'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center mb-1">
            <Clock size={14} className="mr-1 text-yellow-600" />
            <span className="text-sm font-medium">
              {weekNegotiation.dayDisplay} {negotiation.slotInfo?.startTime || weekNegotiation.time}-{negotiation.slotInfo?.endTime || calculateEndTime(weekNegotiation.time)}
            </span>
            {isUserInvolved && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                참여 필요
              </span>
            )}
          </div>
          <div className="text-xs text-gray-600 mb-2">
            충돌 멤버: {memberNames}
            {negotiation.priority && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded-full">
                우선순위: {negotiation.priority}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">
            응답 현황: {negotiation.conflictingMembers?.filter(cm => cm.response !== 'pending').length || 0}
            /{negotiation.conflictingMembers?.length || 0}
            {negotiation.conflictingMembers?.some(cm => cm.response === 'accepted') &&
              <span className="ml-2 text-green-600">✓ 일부 동의</span>
            }
          </div>
        </div>
        <button
          onClick={() => {
            onOpenNegotiation(negotiation);
          }}
          className={`px-3 py-1 text-xs rounded-md transition-colors ${
            isUserInvolved
              ? 'bg-yellow-500 text-white hover:bg-yellow-600'
              : 'bg-gray-300 text-gray-600 hover:bg-gray-400'
          }`}
        >
          {isUserInvolved ? '참여하기' : isOwner ? '조회' : '확인'}
        </button>
      </div>
    </div>
  );
};

const NegotiationSection = ({
  currentWeekNegotiations,
  user,
  onOpenNegotiation,
  isOwner
}) => {
  // 방장이면 모든 협의를 볼 수 있음, 아니면 당사자만 볼 수 있음
  const visibleNegotiations = (currentWeekNegotiations || []).filter(negotiation => {
    // 방장이면 모든 협의를 볼 수 있음
    if (isOwner) return true;

    // 당사자인지 확인
    const isInvolved = negotiation.conflictingMembers?.some(cm => {
      let cmUserId;
      if (typeof cm.user === 'object' && cm.user !== null) {
        cmUserId = cm.user._id || cm.user.id;
      } else {
        cmUserId = cm.user;
      }
      return cmUserId === user?.id || cmUserId?.toString() === user?.id?.toString();
    });

    return isInvolved;
  });

  if (visibleNegotiations.length === 0) return null;

  return (
    <div className="mt-6 pt-4 border-t border-gray-200">
      <h4 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
        <MessageSquare size={16} className="mr-2 text-yellow-600" />
        협의 진행중 ({visibleNegotiations.length}건)
      </h4>
      <div className="space-y-3">
        {visibleNegotiations.map((weekNegotiation, index) => {
          const negotiation = weekNegotiation;

          return (
            <NegotiationItem
              key={index}
              negotiation={negotiation}
              weekNegotiation={weekNegotiation}
              user={user}
              onOpenNegotiation={onOpenNegotiation}
              index={index}
              isOwner={isOwner}
            />
          );
        })}
      </div>
    </div>
  );
};

export default NegotiationSection;