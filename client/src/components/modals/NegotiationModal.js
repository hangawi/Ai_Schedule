import React, { useState, useEffect } from 'react';
import { coordinationService } from '../../services/coordinationService';
import { Check, MessageSquare, Clock, Users } from 'lucide-react';

const NegotiationModal = ({ isOpen, onClose, negotiation, currentUser, roomId, onRefresh }) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (negotiation) {
      setMessages(negotiation.messages || []);
    }
  }, [negotiation]);

  if (!isOpen || !negotiation) return null;

  const handleResponse = async (response) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await coordinationService.respondToNegotiation(roomId, negotiation._id, response);
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
                    <span className="text-sm font-medium">
                      {member.user?.name ||
                       (member.user?.firstName || member.user?.lastName ?
                        `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim() :
                        '멤버')}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      member.response === 'accept'
                        ? 'bg-green-100 text-green-800'
                        : member.response === 'reject'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {member.response === 'accept' ? '양보' :
                       member.response === 'reject' ? '거절' : '대기중'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Response section */}
            {negotiation.status === 'active' && userResponse === 'pending' && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-orange-800 mb-3">
                  협의 참여
                </h4>
                <p className="text-sm text-orange-700 mb-4">
                  이 시간대를 양보하시겠습니까? 한 명이 양보하면 나머지 분이 시간을 배정받습니다.
                  모두가 거절하면 해당 시간이 이월됩니다.
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={() => handleResponse('accept')}
                    disabled={isLoading}
                    className="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 disabled:bg-green-300 flex items-center justify-center"
                  >
                    <Check size={16} className="mr-2" />
                    양보하기
                  </button>
                  <button
                    onClick={() => handleResponse('reject')}
                    disabled={isLoading}
                    className="flex-1 bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 disabled:bg-red-300 flex items-center justify-center"
                  >
                    거절하기
                  </button>
                </div>
              </div>
            )}

            {userResponse !== 'pending' && (
              <div className={`border rounded-lg p-4 ${
                userResponse === 'accept'
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <p className="text-sm font-medium">
                  이미 {userResponse === 'accept' ? '양보' : '거절'}하셨습니다.
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