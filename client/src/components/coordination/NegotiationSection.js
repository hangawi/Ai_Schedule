import React, { useState } from 'react';
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

  // 날짜 표시
  const displayDate = weekNegotiation.dayDisplay || (() => {
    if (negotiation.slotInfo?.date) {
      const date = new Date(negotiation.slotInfo.date);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const dayName = dayNames[date.getDay()];
      return `${month}/${day} (${dayName})`;
    }
    return '';
  })();

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
              {displayDate} {negotiation.slotInfo?.startTime || weekNegotiation.time}-{negotiation.slotInfo?.endTime || calculateEndTime(weekNegotiation.time)}
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
  allNegotiations,
  user,
  onOpenNegotiation,
  isOwner,
  currentWeekStartDate
}) => {
  const [negotiationViewMode, setNegotiationViewMode] = useState('week'); // 'week' or 'month'

  // 필터링 함수
  const filterVisibleNegotiations = (negotiations) => {
    return (negotiations || []).filter(negotiation => {
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
  };

  // 💡 주간 협의: weekStartDate가 있는 협의만 사용 (주별로 분리된 협의)
  // currentWeekStartDate와 정확히 일치하는 주의 협의만 표시
  const currentDate = currentWeekStartDate ? new Date(currentWeekStartDate) : new Date();
  const currentWeekDateString = currentDate.toISOString().split('T')[0];

  const weekNegotiations = (allNegotiations || []).filter(neg => {
    // weekStartDate가 있으면 주별로 분리된 협의임
    if (neg.weekStartDate) {
      return neg.weekStartDate === currentWeekDateString;
    }

    // weekStartDate가 없으면 기존 방식: 날짜로 주 판단
    if (!neg.slotInfo?.date) return false;
    const negDate = new Date(neg.slotInfo.date);
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(currentDate.getDate() + 7);
    return negDate >= currentDate && negDate < weekEnd;
  });

  const visibleWeekNegotiations = filterVisibleNegotiations(weekNegotiations);

  // 월간 협의: 현재 월의 모든 협의 (주별로 그룹화)
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // 월의 첫째 주 월요일 찾기
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const firstDayOfWeek = firstDayOfMonth.getDay();
  const daysToMonday = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const firstMonday = new Date(firstDayOfMonth);
  firstMonday.setDate(firstDayOfMonth.getDate() - daysToMonday);

  // 월의 마지막 주 일요일 찾기
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  const lastDayOfWeek = lastDayOfMonth.getDay();
  const daysToSunday = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
  const lastSunday = new Date(lastDayOfMonth);
  lastSunday.setDate(lastDayOfMonth.getDate() + daysToSunday);

  const monthNegotiations = (allNegotiations || []).filter(neg => {
    // weekStartDate가 있으면 해당 주차가 이번 달 범위에 포함되는지 확인
    if (neg.weekStartDate) {
      const negWeekStart = new Date(neg.weekStartDate);
      return negWeekStart >= firstMonday && negWeekStart <= lastSunday;
    }

    // weekStartDate가 없으면 기존 방식: 날짜로 월 판단
    if (!neg.slotInfo?.date) return false;
    const negDate = new Date(neg.slotInfo.date);
    return negDate >= firstMonday && negDate <= lastSunday;
  });

  const visibleMonthNegotiations = filterVisibleNegotiations(monthNegotiations);

  // 현재 선택된 모드에 따라 표시할 협의 결정
  const displayNegotiations = negotiationViewMode === 'week' ? visibleWeekNegotiations : visibleMonthNegotiations;

  if (visibleWeekNegotiations.length === 0 && visibleMonthNegotiations.length === 0) return null;

  return (
    <div className="mt-6 pt-4 border-t border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-md font-semibold text-gray-800 flex items-center">
          <MessageSquare size={16} className="mr-2 text-yellow-600" />
          협의 진행중 (주간 {visibleWeekNegotiations.length}건 / 월간 {visibleMonthNegotiations.length}건)
        </h4>

        {/* 주간/월간 토글 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={() => setNegotiationViewMode('week')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              negotiationViewMode === 'week'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            주간
          </button>
          <button
            onClick={() => setNegotiationViewMode('month')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              negotiationViewMode === 'month'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            월간
          </button>
        </div>
      </div>

      {displayNegotiations.length === 0 ? (
        <div className="text-sm text-gray-500 text-center py-4">
          {negotiationViewMode === 'week' ? '이번 주' : '이번 달'} 협의가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {displayNegotiations.map((weekNegotiation, index) => {
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
      )}
    </div>
  );
};

export default NegotiationSection;