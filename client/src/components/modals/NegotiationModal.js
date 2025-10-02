import React, { useState, useEffect } from 'react';
import { coordinationService } from '../../services/coordinationService';
import { Check, MessageSquare, Clock, Users } from 'lucide-react';

const NegotiationModal = ({ isOpen, onClose, negotiation, currentUser, roomId, onRefresh }) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedYieldOption, setSelectedYieldOption] = useState('carry_over');
  const [alternativeSlots, setAlternativeSlots] = useState([]);
  const [chosenSlot, setChosenSlot] = useState(null);

  useEffect(() => {
    if (negotiation) {
      setMessages(negotiation.messages || []);
    }
  }, [negotiation, currentUser, roomId]);

  if (!isOpen || !negotiation) {
    return null;
  }

  // 접근 권한 확인: 당사자인지, 방장인지 구분
  const isConflictingMember = negotiation.conflictingMembers?.some(cm => {
    let cmUserId;
    if (typeof cm.user === 'object' && cm.user !== null) {
      cmUserId = cm.user._id || cm.user.id;
    } else {
      cmUserId = cm.user;
    }

    const userId = currentUser?.id;
    return cmUserId === userId || cmUserId?.toString() === userId?.toString();
  });

  // 방장인지 확인 (participants에는 있지만 conflictingMembers에는 없음)
  const isOwnerViewing = !isConflictingMember && negotiation.participants?.some(p => {
    const pUserId = typeof p === 'object' ? (p._id || p.id) : p;
    return pUserId?.toString() === currentUser?.id;
  });

  const handleResponse = async (response) => {
    setIsLoading(true);
    setError(null);

    try {
      const payload = { response };

      if (response === 'yield') {
        payload.yieldOption = selectedYieldOption;
        if (selectedYieldOption === 'alternative_time' && alternativeSlots.length === 0) {
          setError('대체 시간을 선택해주세요.');
          setIsLoading(false);
          return;
        }
        payload.alternativeSlots = alternativeSlots;
      } else if (response === 'choose_slot') {
        if (!chosenSlot) {
          setError('시간대를 선택해주세요.');
          setIsLoading(false);
          return;
        }
        payload.chosenSlot = chosenSlot;
      }

      const result = await coordinationService.respondToNegotiation(roomId, negotiation._id, payload);
      setMessages(result.negotiation.messages);

      // Refresh parent component to update room data
      if (onRefresh) {
        await onRefresh();
      }

      // Close modal if negotiation is resolved
      if (result.negotiation.status === 'resolved') {
        onClose();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentUserResponse = () => {
    const currentUserMember = negotiation.conflictingMembers?.find(
      cm => cm.user._id === currentUser?.id || cm.user.toString() === currentUser?.id
    );
    return currentUserMember?.response || 'pending';
  };

  const getConflictingMemberNames = () => {
    return negotiation.conflictingMembers?.map(cm => {
      if (cm.user?.name) {
        return cm.user.name;
      } else if (cm.user?.firstName || cm.user?.lastName) {
        return `${cm.user.firstName || ''} ${cm.user.lastName || ''}`.trim();
      } else {
        return '멤버';
      }
    }).join(', ') || '';
  };

  const userResponse = getCurrentUserResponse();
  const conflictingMembers = negotiation.conflictingMembers || [];
  const memberNames = getConflictingMemberNames();

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-auto max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <Users size={20} className="mr-2 text-orange-500" />
              시간 충돌 협의
            </h3>
            <div className="mt-2 text-sm text-gray-600">
              <div className="flex items-center mb-1">
                <Clock size={16} className="mr-1" />
                {new Date(negotiation.slotInfo.date).toLocaleDateString('ko-KR')} {negotiation.slotInfo.startTime}-{negotiation.slotInfo.endTime}
              </div>
              <div className="flex items-center">
                <Users size={16} className="mr-1" />
                충돌 멤버: {memberNames}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Messages */}
            <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <MessageSquare size={16} className="mr-1" />
                협의 메시지
              </h4>
              <div className="space-y-3">
                {messages.map((message, index) => (
                  <div key={index} className={`p-3 rounded-lg ${
                    message.isSystemMessage
                      ? 'bg-blue-50 border border-blue-200'
                      : 'bg-white border border-gray-200'
                  }`}>
                    <div className="text-sm text-gray-800">{message.message}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(message.timestamp).toLocaleString('ko-KR')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Member responses */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">멤버 응답 현황</h4>
              <div className="space-y-2">
                {conflictingMembers.map((member, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-white rounded border">
                    <div className="flex-1">
                      <span className="text-sm font-medium">
                        {member.user?.name ||
                         (member.user?.firstName || member.user?.lastName ?
                          `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim() :
                          '멤버')}
                      </span>
                      {member.requiredSlots && (
                        <span className="ml-2 text-xs text-gray-500">
                          (필요: {member.requiredSlots}슬롯)
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        member.response === 'yield'
                          ? 'bg-green-100 text-green-800'
                          : member.response === 'claim'
                          ? 'bg-red-100 text-red-800'
                          : member.response === 'split_first'
                          ? 'bg-blue-100 text-blue-800'
                          : member.response === 'split_second'
                          ? 'bg-purple-100 text-purple-800'
                          : member.response === 'choose_slot'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {member.response === 'yield' ? '양보' :
                         member.response === 'claim' ? '주장' :
                         member.response === 'split_first' ? '앞시간' :
                         member.response === 'split_second' ? '뒷시간' :
                         member.response === 'choose_slot' ? '시간선택' : '대기중'}
                      </span>
                      {member.yieldOption && (
                        <span className="text-xs text-gray-600 mt-1">
                          {member.yieldOption === 'carry_over' ? '이월' : '대체시간'}
                        </span>
                      )}
                      {member.chosenSlot && (
                        <span className="text-xs text-gray-600 mt-1">
                          {member.chosenSlot.startTime}-{member.chosenSlot.endTime}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Response section */}
            {negotiation.status === 'active' && userResponse === 'pending' && isConflictingMember && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-orange-800 mb-3">
                  협의 참여
                </h4>

                {negotiation.type === 'time_slot_choice' ? (
                  <>
                    <p className="text-sm text-orange-700 mb-4">
                      선호 가능한 시간대 중 하나를 선택하세요. 서로 다른 시간대를 선택하면 각자 배정됩니다.
                    </p>

                    {/* 시간대 선택 */}
                    <div className="mb-4 bg-white p-3 rounded-lg border border-orange-200">
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        시간대 선택:
                      </label>
                      <div className="space-y-2">
                        {negotiation.availableTimeSlots?.map((slot, index) => (
                          <label key={index} className="flex items-center p-2 border rounded hover:bg-gray-50 cursor-pointer">
                            <input
                              type="radio"
                              name="timeSlot"
                              value={index}
                              checked={chosenSlot?.startTime === slot.startTime}
                              onChange={() => setChosenSlot(slot)}
                              className="mr-2"
                            />
                            <span className="text-sm font-medium">{slot.startTime} - {slot.endTime}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleResponse('choose_slot')}
                      disabled={isLoading || !chosenSlot}
                      className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:bg-blue-300"
                    >
                      시간대 선택 완료
                    </button>

                    <div className="mt-2 text-xs text-gray-600 text-center">
                      시간대가 겹치면 양보/주장으로 다시 선택하게 됩니다
                    </div>
                  </>
                ) : negotiation.type === 'full_conflict' ? (
                  <>
                    <p className="text-sm text-orange-700 mb-4">
                      전체 시간이 필요한 충돌입니다. 양보하거나 주장하세요.
                    </p>

                    {/* Yield option selection */}
                    <div className="mb-4 bg-white p-3 rounded-lg border border-orange-200">
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        양보 시 옵션 선택:
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="yieldOption"
                            value="carry_over"
                            checked={selectedYieldOption === 'carry_over'}
                            onChange={(e) => setSelectedYieldOption(e.target.value)}
                            className="mr-2"
                          />
                          <span className="text-sm">이월하기 (다음 주로 넘김)</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="yieldOption"
                            value="alternative_time"
                            checked={selectedYieldOption === 'alternative_time'}
                            onChange={(e) => setSelectedYieldOption(e.target.value)}
                            className="mr-2"
                          />
                          <span className="text-sm">다른 선호 시간 선택</span>
                        </label>
                      </div>

                      {selectedYieldOption === 'alternative_time' && (
                        <div className="mt-2 text-xs text-gray-600 bg-blue-50 p-2 rounded">
                          대체 시간 선택 기능은 추후 구현 예정입니다. 현재는 이월 옵션을 사용해주세요.
                        </div>
                      )}
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleResponse('yield')}
                        disabled={isLoading}
                        className="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 disabled:bg-green-300 flex items-center justify-center"
                      >
                        <Check size={16} className="mr-2" />
                        양보하기
                      </button>
                      <button
                        onClick={() => handleResponse('claim')}
                        disabled={isLoading}
                        className="flex-1 bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 disabled:bg-red-300 flex items-center justify-center"
                      >
                        주장하기
                      </button>
                    </div>
                  </>
) : (
                  <>
                    <p className="text-sm text-orange-700 mb-4">
                      시간을 분할하여 배정할 수 있습니다. 원하는 시간대를 선택하세요.
                    </p>
                    {(() => {
                      // 시간을 분할 계산
                      const startTime = negotiation.slotInfo?.startTime || '';
                      const endTime = negotiation.slotInfo?.endTime || '';
                      
                      if (!startTime || !endTime) {
                        return <p className="text-sm text-red-600">시간 정보를 불러올 수 없습니다.</p>;
                      }

                      // 시작과 종료 시간을 분 단위로 변환
                      const [startHour, startMin] = startTime.split(':').map(Number);
                      const [endHour, endMin] = endTime.split(':').map(Number);
                      const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
                      
                      // 각 멤버의 필요 슬롯 수 확인
                      const currentUserMember = negotiation.conflictingMembers?.find(
                        cm => (cm.user?._id || cm.user) === currentUser?.id
                      );
                      const requiredSlots = currentUserMember?.requiredSlots || 1;
                      const requiredMinutes = requiredSlots * 30; // 1슬롯 = 30분

                      // 중간 시간 계산
                      const midMinutes = startHour * 60 + startMin + requiredMinutes;
                      const midHour = Math.floor(midMinutes / 60);
                      const midMin = midMinutes % 60;
                      const midTime = `${String(midHour).padStart(2, '0')}:${String(midMin).padStart(2, '0')}`;

                      const firstHalfTime = `${startTime}-${midTime}`;
                      const secondHalfTime = `${midTime}-${endTime}`;

                      return (
                        <div className="space-y-2">
                          <button
                            onClick={() => handleResponse('split_first')}
                            disabled={isLoading}
                            className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 disabled:bg-blue-300 text-sm font-medium"
                          >
                            앞 시간: {firstHalfTime}
                          </button>
                          <button
                            onClick={() => handleResponse('split_second')}
                            disabled={isLoading}
                            className="w-full bg-purple-500 text-white py-3 px-4 rounded-lg hover:bg-purple-600 disabled:bg-purple-300 text-sm font-medium"
                          >
                            뒷 시간: {secondHalfTime}
                          </button>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

            {userResponse !== 'pending' && (
              <div className={`border rounded-lg p-4 ${
                userResponse === 'yield'
                  ? 'bg-green-50 border-green-200'
                  : userResponse === 'claim'
                  ? 'bg-red-50 border-red-200'
                  : userResponse === 'choose_slot'
                  ? 'bg-indigo-50 border-indigo-200'
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <p className="text-sm font-medium">
                  이미 {
                    userResponse === 'yield' ? '양보' :
                    userResponse === 'claim' ? '주장' :
                    userResponse === 'split_first' ? '앞 시간 선택' :
                    userResponse === 'split_second' ? '뒤 시간 선택' :
                    userResponse === 'choose_slot' ? '시간대 선택' : '응답'
                  }하셨습니다.
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  다른 멤버들의 응답을 기다리고 있습니다.
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default NegotiationModal;