/**
 * ===================================================================================================
 * [파일명] RequestSection.js - 자리 요청 관리 섹션 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > [client/src/components/tabs/CoordinationTab/components/RequestSection.js]
 *
 * 🎯 주요 기능:
 *    - 방에 소속된 일반 멤버에게 '자리 요청관리' UI를 제공.
 *    - '받은 요청'과 '보낸 요청'을 탭으로 구분하여 보여줌.
 *    - 각 요청의 상태(대기중, 승인됨, 거절됨, 연쇄 조정중 등)에 따라 시각적으로 다르게 표시.
 *    - 요청에 대한 상호작용(승인, 거절, 요청 취소) 버튼 제공.
 *    - 요청 데이터를 기반으로 사용자 친화적인 설명 메시지를 동적으로 생성.
 *
 * 🔗 연결된 파일:
 *    - ../index.js (CoordinationTab): 이 컴포넌트에 필요한 모든 데이터(requests)와 핸들러 함수(handleRequestWithUpdate 등)를 props로 전달.
 *
 * 💡 UI 위치:
 *    - [협업] 탭 > (방 선택 후) > 좌측 사이드바 (방장이 아닌 멤버에게 표시됨)
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 멤버의 요청 관리 UI 및 표시 방식이 변경됩니다.
 *    - 요청 메시지 생성 로직 변경: `generateRequestMessage` 함수의 내용을 수정하여 사용자에게 보여지는 메시지를 변경할 수 있습니다.
 *    - 새로운 요청 상태 UI 추가: `ReceivedRequestsView` 또는 `SentRequestsView` 내부에서 새로운 status에 대한 분기 처리 및 CSS 클래스를 추가합니다.
 *
 * 📝 참고사항:
 *    - 이 컴포넌트는 UI 렌더링에만 집중하는 Presentational Component입니다. 실제 로직은 모두 props를 통해 상위 컴포넌트(`CoordinationTab`)에서 전달받습니다.
 *    - `generateRequestMessage` 헬퍼 함수는 단순 요청 외에도, 사용자의 이동 가능성, 연쇄 교환 필요성 등을 고려하여 상당히 지능적인 메시지를 생성하는 핵심 로직을 포함합니다.
 *    - 'waiting_for_chain'(연쇄 조정 진행중), 'needs_chain_confirmation'(연쇄 조정 확인 필요) 등 복잡한 연쇄 교환 상태를 시각적으로 처리하는 로직이 포함되어 있습니다.
 *
 * ===================================================================================================
 */
import React from 'react';
import { Users, AlertTriangle } from 'lucide-react';
import { auth } from '../../../../config/firebaseConfig';
import { useToast } from '../../../../contexts/ToastContext';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const dayMap = {
  'monday': '월요일',
  'tuesday': '화요일',
  'wednesday': '수요일',
  'thursday': '목요일',
  'friday': '금요일'
};

/**
 * [checkIfSlotsInPreferredTimes]
 * @description 주어진 시간(slots)이 사용자의 선호 시간대(priority >= 2) 내에 포함되는지 확인하는 헬퍼 함수.
 * @param {Array<object>} slots - 확인할 시간 슬롯 배열.
 * @param {Array<object>} userPreferredTimes - 사용자의 전체 선호 시간(defaultSchedule) 배열.
 * @returns {boolean} 모든 슬롯이 선호 시간대에 포함되면 true, 아니면 false.
 */
const checkIfSlotsInPreferredTimes = (slots, userPreferredTimes) => {
  if (!slots || slots.length === 0 || !userPreferredTimes || userPreferredTimes.length === 0) {
    return false;
  }

  // Day mapping for comparison
  const DAY_NAMES = {
    'monday': 'monday',
    'tuesday': 'tuesday',
    'wednesday': 'wednesday',
    'thursday': 'thursday',
    'friday': 'friday',
    'saturday': 'saturday',
    'sunday': 'sunday'
  };

  return slots.every(slot => {
    return userPreferredTimes.some(pref => {
      // Only consider preferred times (priority >= 2)
      if (pref.priority < 2) return false;

      // Check day match
      if (pref.dayOfWeek !== slot.day && DAY_NAMES[pref.dayOfWeek] !== slot.day) {
        return false;
      }

      // Check if slot time is within preferred time range
      return pref.startTime <= slot.startTime && pref.endTime >= slot.endTime;
    });
  });
};

/**
 * [generateRequestMessage]
 * @description 요청(request) 객체를 기반으로 사용자에게 보여줄 자연스러운 한글 메시지를 생성하는 헬퍼 함수.
 *              요청 유형(자리 요청, 교환, 연쇄 요청 등)과 관련 데이터를 분석하여 상황에 맞는 상세한 설명을 제공합니다.
 * @param {object} request - 메시지를 생성할 요청 객체.
 * @param {object} currentRoom - 현재 방 정보.
 * @param {object} currentUser - 현재 로그인한 사용자 정보.
 * @returns {string} 생성된 설명 메시지.
 */
const generateRequestMessage = (request, currentRoom, currentUser) => {
  // If message already contains useful info, use it
  if (request.message && (
    request.message.includes('이동하고 싶어합니다') ||
    request.message.includes('연쇄 요청') ||
    request.message.includes('교환하고 싶어합니다')
  )) {
    return request.message;
  }

  // Otherwise, generate a better message
  const requester = request.requester;
  const requesterName = requester?.firstName && requester?.lastName
    ? `${requester.firstName} ${requester.lastName}`
    : requester?.firstName || '요청자';

  const dayKorean = dayMap[request.timeSlot?.day?.toLowerCase()] || request.timeSlot?.day || '';
  const timeRange = `${request.timeSlot?.startTime || ''}-${request.timeSlot?.endTime || ''}`;

  switch(request.type) {
    case 'time_request':
    case 'time_change':
      // Find where the target will move to (requester's current slots)
      let targetDestinationInfo = '';
      let requesterSlots = [];

      // First, check if requesterSlots is available in the request
      if (request.requesterSlots && request.requesterSlots.length > 0) {
        requesterSlots = request.requesterSlots;
      } else if (currentRoom && currentRoom.timeSlots && request.requester) {
        // Otherwise, try to find requester's current slots from currentRoom
        const requesterId = request.requester._id || request.requester;
        const requesterCurrentSlots = currentRoom.timeSlots.filter(slot => {
          const slotUserId = (slot.user?._id || slot.user)?.toString();
          const isRequesterSlot = slotUserId === requesterId.toString();
          const isValidSubject = slot.subject === '자동 배정' ||
                                 slot.subject === '교환 결과' ||
                                 slot.subject === '자동 재배치' ||
                                 slot.subject === '연쇄 교환 결과' ||
                                 slot.subject === '연쇄 조정 결과' ||
                                 slot.subject === '직접 교환';
          return isRequesterSlot && isValidSubject;
        });

        if (requesterCurrentSlots.length > 0) {
          requesterSlots = requesterCurrentSlots;
        }
      }

      // Now check if requester's slots are in target's preferred times
      if (requesterSlots.length > 0) {
        // Group by date
        const slotsByDate = {};
        requesterSlots.forEach(slot => {
          const dateKey = new Date(slot.date).toISOString().split('T')[0];
          if (!slotsByDate[dateKey]) slotsByDate[dateKey] = [];
          slotsByDate[dateKey].push(slot);
        });

        // Get first date group
        const firstDateSlots = Object.values(slotsByDate)[0];
        if (firstDateSlots && firstDateSlots.length > 0) {
          firstDateSlots.sort((a, b) => {
            const [aH, aM] = a.startTime.split(':').map(Number);
            const [bH, bM] = b.startTime.split(':').map(Number);
            return (aH * 60 + aM) - (bH * 60 + bM);
          });
          const firstSlot = firstDateSlots[0];
          const lastSlot = firstDateSlots[firstDateSlots.length - 1];
          const slotDayKorean = dayMap[firstSlot.day?.toLowerCase()] || firstSlot.day;

          // Check if these slots are in target's preferred times
          let targetCanDirectlyMove = false;
          if (currentUser && currentUser.id && currentRoom && currentRoom.members) {
            const targetMember = currentRoom.members.find(m => {
              const userId = m.user._id || m.user.id || m.user;
              return userId && userId.toString() === currentUser.id.toString();
            });

            if (targetMember && targetMember.user && targetMember.user.defaultSchedule) {
              targetCanDirectlyMove = checkIfSlotsInPreferredTimes(
                firstDateSlots,
                targetMember.user.defaultSchedule
              );
            }
          }

          if (targetCanDirectlyMove) {
            targetDestinationInfo = ` 회원님은 ${slotDayKorean} ${firstSlot.startTime}-${lastSlot.endTime}로 이동하게 됩니다.`;
          } else {
            targetDestinationInfo = ` (승인 시 연쇄 교환이 필요할 수 있습니다)`;
          }
        }
      }

      return `${requesterName}님이 회원님의 ${dayKorean} ${timeRange} 자리로 이동하고 싶어합니다.${targetDestinationInfo}`;

    case 'chain_request':
    case 'chain_exchange_request':
      return `[연쇄 요청] ${requesterName}님이 다른 멤버에게 자리를 양보하기 위해 회원님의 ${dayKorean} ${timeRange} 자리가 필요합니다. 회원님은 빈 시간으로 이동하게 됩니다.`;

    case 'slot_swap':
      if (request.targetSlot) {
        const targetDayKorean = dayMap[request.targetSlot.day?.toLowerCase()] || request.targetSlot.day;
        const targetTimeRange = `${request.targetSlot.startTime}-${request.targetSlot.endTime}`;
        return `${requesterName}님이 회원님과 자리를 교환하고 싶어합니다. (${targetDayKorean} ${targetTimeRange} ↔ ${dayKorean} ${timeRange})`;
      }
      return `${requesterName}님이 회원님과 ${dayKorean} ${timeRange} 자리를 교환하고 싶어합니다.`;

    case 'slot_release':
      return `${requesterName}님이 ${dayKorean} ${timeRange} 시간을 양보하려고 합니다.`;

    default:
      return request.message || `${requesterName}님이 ${dayKorean} ${timeRange} 일정을 요청합니다.`;
  }
};

/**
 * [RequestSection]
 * @description 멤버의 '받은 요청'과 '보낸 요청'을 관리하는 전체 UI 섹션을 렌더링하는 메인 컴포넌트.
 * @param {object} props - 컴포넌트에 전달되는 모든 props.
 * @returns {JSX.Element} 자리 요청 관리 섹션 JSX 엘리먼트.
 */
const RequestSection = ({
  currentRoom,
  currentUser,
  requestViewMode,
  setRequestViewMode,
  receivedRequests,
  sentRequests,
  showAllRequests,
  setShowAllRequests,
  expandedSections,
  setExpandedSections,
  handleRequestWithUpdate,
  handleCancelRequest
}) => {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 sm:p-4 mt-4">
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-md font-semibold text-gray-800 flex items-center">
            <Users size={16} className="mr-2 text-blue-600" />
            자리 요청관리
          </h4>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setRequestViewMode('received')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                requestViewMode === 'received'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              받은 요청
            </button>
            <button
              onClick={() => setRequestViewMode('sent')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                requestViewMode === 'sent'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              보낸 요청
            </button>
          </div>
        </div>

        {requestViewMode === 'received' && (
          <ReceivedRequestsView
            currentRoom={currentRoom}
            currentUser={currentUser}
            receivedRequests={receivedRequests}
            showAllRequests={showAllRequests}
            setShowAllRequests={setShowAllRequests}
            expandedSections={expandedSections}
            setExpandedSections={setExpandedSections}
            handleRequestWithUpdate={handleRequestWithUpdate}
            handleCancelRequest={handleCancelRequest}
          />
        )}

        {requestViewMode === 'sent' && (
          <SentRequestsView
            currentRoom={currentRoom}
            currentUser={currentUser}
            sentRequests={sentRequests}
            showAllRequests={showAllRequests}
            setShowAllRequests={setShowAllRequests}
            expandedSections={expandedSections}
            setExpandedSections={setExpandedSections}
            handleCancelRequest={handleCancelRequest}
          />
        )}
      </div>
    </div>
  );
};

/**
 * [ReceivedRequestsView]
 * @description '받은 요청' 목록을 '대기 중인 요청'과 '처리된 요청'으로 나누어 렌더링하는 컴포넌트.
 * @param {object} props - 컴포넌트에 전달되는 모든 props.
 * @returns {JSX.Element} 받은 요청 목록 뷰 JSX 엘리먼트.
 */
const ReceivedRequestsView = ({
  currentRoom,
  currentUser,
  receivedRequests,
  showAllRequests,
  setShowAllRequests,
  expandedSections,
  setExpandedSections,
  handleRequestWithUpdate,
  handleCancelRequest
}) => {
  // 🆕 needs_chain_confirmation, waiting_for_chain도 대기 중으로 분류
  const pendingReceived = receivedRequests.filter(req =>
    (req.status === 'pending' || req.status === 'needs_chain_confirmation' || req.status === 'waiting_for_chain') &&
    req.roomId === currentRoom?._id
  );
  const processedReceived = receivedRequests.filter(req =>
    req.status !== 'pending' &&
    req.status !== 'needs_chain_confirmation' &&
    req.status !== 'waiting_for_chain' &&
    req.roomId === currentRoom?._id
  );

  return (
    <div>
      {pendingReceived.length > 0 && (
        <div className="mb-4">
          <h5 className="text-sm font-medium text-gray-700 mb-2">대기 중인 요청</h5>
          <div className="space-y-2">
            {pendingReceived
              .slice(0, showAllRequests['receivedPending'] ? undefined : 3)
              .map((request, index) => {
                const requesterData = request.requester;
                const requesterName = `${requesterData?.firstName || ''} ${requesterData?.lastName || ''}`.trim() || '알 수 없음';

                // 🆕 waiting_for_chain 상태 처리
                if (request.status === 'waiting_for_chain') {
                  return (
                    <div key={request._id || index} className="p-3 bg-blue-50 border border-blue-300 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <div className="text-xs font-semibold text-blue-900">{requesterName}</div>
                        <div className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                          연쇄 조정 진행중
                        </div>
                      </div>
                      <div className="text-xs font-medium text-blue-800 mb-2">
                        {(dayMap[request.timeSlot?.day.toLowerCase()] || request.timeSlot?.day)} {request.timeSlot?.startTime}-{request.timeSlot?.endTime}
                      </div>
                      <div className="text-xs text-gray-600 p-2 bg-white rounded border border-blue-200">
                        빈 시간이 없어 다른 사람에게 연쇄 요청을 보냈습니다. 응답을 기다리는 중입니다.
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={request._id || index} className="p-2 bg-blue-500 border border-blue-600 rounded-lg relative">
                    <div className="flex justify-between items-center mb-1">
                      <div className="text-xs font-semibold text-white">{requesterName}</div>
                      <div className="text-xs font-medium text-blue-100">
                        {(() => {
                          switch(request.type) {
                            case 'slot_swap': return '자리 교환';
                            case 'time_request':
                            case 'time_change': return '자리 요청';
                            case 'chain_request':
                            case 'chain_exchange_request': return '연쇄 요청';
                            case 'slot_release': return '자리 양보';
                            default: return '일정 요청';
                          }
                        })()}
                      </div>
                    </div>
                    <div className="text-xs font-medium text-blue-100 mb-2">
                      {(dayMap[request.timeSlot?.day.toLowerCase()] || request.timeSlot?.day)} {request.timeSlot?.startTime}-{request.timeSlot?.endTime}
                    </div>
                    <p className="text-xs text-white italic mb-2 line-clamp-2">"{generateRequestMessage(request, currentRoom, currentUser)}"</p>
                    <div className="flex justify-end space-x-2 mt-2">
                      <button
                        onClick={() => handleRequestWithUpdate(request._id, 'approved', request)}
                        className="px-3 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600"
                      >
                        승인
                      </button>
                      <button
                        onClick={() => handleRequestWithUpdate(request._id, 'rejected', request)}
                        className="px-3 py-1 text-xs bg-red-500 text-white rounded-md hover:bg-red-600"
                      >
                        거절
                      </button>
                    </div>
                  </div>
                );
              })}
            {pendingReceived.length > 3 && !showAllRequests['receivedPending'] && (
              <button
                onClick={() => setShowAllRequests(prev => ({ ...prev, receivedPending: true }))}
                className="text-xs text-blue-500 hover:text-blue-600 text-center w-full"
              >
                +{pendingReceived.length - 3}개 더 보기
              </button>
            )}
          </div>
        </div>
      )}

      {pendingReceived.length === 0 && (
        <div className="mb-4">
          <h5 className="text-sm font-medium text-gray-700 mb-2">대기 중인 요청</h5>
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
            <p className="text-xs text-gray-500">받은 요청이 없습니다</p>
          </div>
        </div>
      )}

      {processedReceived.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-sm font-medium text-gray-700">처리된 요청</h5>
            <button
              onClick={() => setExpandedSections(prev => ({ ...prev, receivedProcessed: !prev.receivedProcessed }))}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              {expandedSections['receivedProcessed'] ? '접기' : '펼치기'}
            </button>
          </div>
          {expandedSections['receivedProcessed'] && (
            <div className="space-y-2">
              {processedReceived
                .slice(0, showAllRequests['receivedProcessed'] ? undefined : 3)
                .map((request, index) => {
                  const requesterData = request.requester;
                  const requesterName = `${requesterData?.firstName || ''} ${requesterData?.lastName || ''}`.trim() || '알 수 없음';
                  return (
                    <div key={request._id || index} className={`p-2 border rounded-lg ${
                      request.status === 'approved' ? 'bg-green-50 border-green-200' :
                      request.status === 'cancelled' ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex justify-between items-center mb-1">
                        <div className={`text-xs font-medium ${
                          request.status === 'approved' ? 'text-green-900' :
                          request.status === 'cancelled' ? 'text-gray-900' : 'text-red-900'
                        }`}>{requesterName}</div>
                        <div className="flex items-center space-x-2">
                          <div className={`text-xs px-2 py-1 rounded-full ${
                            request.status === 'approved' ? 'bg-green-100 text-green-800' :
                            request.status === 'cancelled' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {request.status === 'approved' ? '승인됨' :
                             request.status === 'cancelled' ? '취소됨' : '거절됨'}
                          </div>
                          <button
                            onClick={() => handleCancelRequest(request._id)}
                            className="text-xs text-gray-400 hover:text-red-500"
                            title="내역 삭제"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <div className={`text-xs mb-2 ${
                        request.status === 'approved' ? 'text-green-700' :
                        request.status === 'cancelled' ? 'text-gray-700' : 'text-red-700'
                      }`}>
                        {(dayMap[request.timeSlot?.day.toLowerCase()] || request.timeSlot?.day)} {request.timeSlot?.startTime}-{request.timeSlot?.endTime}
                      </div>
                    </div>
                  );
                })}
              {processedReceived.length > 3 && !showAllRequests['receivedProcessed'] && (
                <button
                  onClick={() => setShowAllRequests(prev => ({ ...prev, receivedProcessed: true }))}
                  className="text-xs text-gray-500 hover:text-gray-600 text-center w-full"
                >
                  +{processedReceived.length - 3}개 더 보기
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * [SentRequestsView]
 * @description '보낸 요청' 목록을 '대기 중인 요청'과 '처리된 요청'으로 나누어 렌더링하는 컴포넌트.
 * @param {object} props - 컴포넌트에 전달되는 모든 props.
 * @returns {JSX.Element} 보낸 요청 목록 뷰 JSX 엘리먼트.
 */
const SentRequestsView = ({
  currentRoom,
  currentUser,
  sentRequests,
  showAllRequests,
  setShowAllRequests,
  expandedSections,
  setExpandedSections,
  handleCancelRequest
}) => {
  const { showToast } = useToast();
  const currentRoomSentRequests = sentRequests.filter(req => req.roomId === currentRoom?._id);
  // 🆕 needs_chain_confirmation, waiting_for_chain도 대기 중으로 분류
  const pendingRequests = currentRoomSentRequests.filter(req =>
    req.status === 'pending' || req.status === 'needs_chain_confirmation' || req.status === 'waiting_for_chain'
  );
  const processedRequests = currentRoomSentRequests.filter(req =>
    req.status !== 'pending' && req.status !== 'needs_chain_confirmation' && req.status !== 'waiting_for_chain'
  );

  return (
    <div>
      {pendingRequests.length > 0 && (
        <div className="mb-4">
          <h5 className="text-sm font-medium text-gray-700 mb-2">대기 중인 요청</h5>
          <div className="space-y-2">
            {pendingRequests
              .slice(0, showAllRequests['sentPending'] ? undefined : 3)
              .map((request, index) => {
                const targetUserData = request.targetUser;
                const targetUserName = `${targetUserData?.firstName || ''} ${targetUserData?.lastName || ''}`.trim() || '방장';

                // 🆕 waiting_for_chain 상태 처리
                if (request.status === 'waiting_for_chain') {
                  return (
                    <div key={request._id || index} className="p-3 bg-blue-50 border border-blue-300 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <div className="text-xs font-semibold text-blue-900">
                          To: {targetUserName}
                        </div>
                        <div className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                          연쇄 조정 진행중
                        </div>
                      </div>
                      <div className="text-xs font-medium text-blue-800 mb-2">
                        {(dayMap[request.timeSlot?.day.toLowerCase()] || request.timeSlot?.day)} {request.timeSlot?.startTime}-{request.timeSlot?.endTime}
                      </div>
                      <div className="text-xs text-gray-600 p-2 bg-white rounded border border-blue-200">
                        {targetUserName}님에게 빈 시간이 없어 다른 사람에게 연쇄 요청을 보냈습니다. 응답을 기다리는 중입니다.
                      </div>
                    </div>
                  );
                }

                // 🆕 needs_chain_confirmation 상태 처리 (혹시 남아있는 경우)
                if (request.status === 'needs_chain_confirmation') {
                  const chainCandidate = request.chainData?.firstCandidate;

                  const handleChainAction = async (action) => {
                    try {
                      const currentUser = auth.currentUser;
                      if (!currentUser) {
                        showToast('로그인이 필요합니다.');
                        return;
                      }
                      const token = await currentUser.getIdToken();

                      const response = await fetch(`${API_BASE_URL}/api/coordination/requests/${request._id}/chain-confirm`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ action })
                      });

                      const data = await response.json();

                      if (data.success) {
                        showToast(data.msg);
                        window.location.reload(); // 간단하게 페이지 새로고침
                      } else {
                        showToast(data.msg || '처리 중 오류가 발생했습니다.');
                      }
                    } catch (error) {
                      console.error('Chain action error:', error);
                      showToast('연쇄 조정 처리 중 오류가 발생했습니다.');
                    }
                  };

                  return (
                    <div key={request._id || index} className="p-3 bg-amber-50 border border-amber-300 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <div className="text-xs font-semibold text-amber-900 flex items-center">
                          <AlertTriangle size={14} className="mr-1 text-amber-600" />
                          To: {targetUserName}
                        </div>
                        <div className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 font-medium">
                          연쇄 조정 확인 필요
                        </div>
                      </div>
                      <div className="text-xs font-medium text-amber-800 mb-2">
                        {(dayMap[request.timeSlot?.day.toLowerCase()] || request.timeSlot?.day)} {request.timeSlot?.startTime}-{request.timeSlot?.endTime}
                      </div>
                      <div className="text-xs text-gray-700 mb-3 p-2 bg-white rounded border border-amber-200">
                        <div className="font-medium mb-1">{targetUserName}님에게 이동할 빈 시간이 없습니다.</div>
                        {chainCandidate && (
                          <div className="text-gray-600">
                            <strong>{chainCandidate.userName}</strong>님에게 연쇄 요청을 보내면 조정이 가능합니다.
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleChainAction('proceed')}
                          className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded-md hover:bg-amber-600 font-medium"
                        >
                          연쇄 조정 진행
                        </button>
                        <button
                          onClick={() => handleChainAction('cancel')}
                          className="px-3 py-1.5 text-xs bg-gray-400 text-white rounded-md hover:bg-gray-500"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={request._id || index} className="p-2 bg-gray-50 border border-gray-200 rounded-lg relative">
                    <div className="flex justify-between items-center mb-1">
                      <div className="text-xs font-semibold text-gray-800 !text-gray-800">
                        To: {targetUserName}
                      </div>
                      <div className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 !text-yellow-800 font-medium">
                        대기중
                      </div>
                    </div>
                    <div className="text-xs font-medium text-gray-700 !text-gray-700 mb-2">
                      {(dayMap[request.timeSlot?.day.toLowerCase()] || request.timeSlot?.day)} {request.timeSlot?.startTime}-{request.timeSlot?.endTime}
                    </div>
                    <p className="text-xs text-white italic mb-2 line-clamp-2">"{generateRequestMessage(request, currentRoom, currentUser)}"</p>
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleCancelRequest(request._id)}
                        className="px-3 py-1 text-xs bg-gray-500 text-white rounded-md hover:bg-gray-600"
                      >
                        요청 취소
                      </button>
                    </div>
                  </div>
                );
              })}
            {pendingRequests.length > 3 && !showAllRequests['sentPending'] && (
              <button
                onClick={() => setShowAllRequests(prev => ({...prev, sentPending: true}))}
                className="text-xs text-blue-500 hover:text-blue-600 text-center w-full"
              >
                +{pendingRequests.length - 3}개 더 보기
              </button>
            )}
          </div>
        </div>
      )}

      {pendingRequests.length === 0 && (
        <div className="mb-4">
          <h5 className="text-sm font-medium text-gray-700 mb-2">대기 중인 요청</h5>
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
            <p className="text-xs text-gray-500">보낸 요청이 없습니다</p>
          </div>
        </div>
      )}

      {processedRequests.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-sm font-medium text-gray-700">처리된 요청</h5>
            <button
              onClick={() => setExpandedSections(prev => ({...prev, sentProcessed: !prev.sentProcessed}))}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              {expandedSections['sentProcessed'] ? '접기' : '펼치기'}
            </button>
          </div>
          {expandedSections['sentProcessed'] && (
            <div className="space-y-2">
              {processedRequests
                .slice(0, showAllRequests['sentProcessed'] ? undefined : 3)
                .map((request, index) => {
                  const targetUserData = request.targetUser;
                  const targetUserName = `${targetUserData?.firstName || ''} ${targetUserData?.lastName || ''}`.trim() || '방장';
                  return (
                    <div key={request._id || index} className={`p-2 border rounded-lg ${
                      request.status === 'approved' ? 'bg-green-50 border-green-200' :
                      request.status === 'cancelled' ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex justify-between items-center mb-1">
                        <div className={`text-xs font-medium ${
                          request.status === 'approved' ? 'text-green-900' :
                          request.status === 'cancelled' ? 'text-gray-900' : 'text-red-900'
                        }`}>
                          To: {targetUserName}
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className={`text-xs px-2 py-1 rounded-full ${
                            request.status === 'approved' ? 'bg-green-100 text-green-800' :
                            request.status === 'cancelled' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {request.status === 'approved' ? '승인됨' :
                             request.status === 'cancelled' ? '취소됨' : '거절됨'}
                          </div>
                          <button
                            onClick={() => handleCancelRequest(request._id)}
                            className="text-xs text-gray-400 hover:text-red-500"
                            title="내역 삭제"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <div className={`text-xs mb-2 ${
                        request.status === 'approved' ? 'text-green-700' :
                        request.status === 'cancelled' ? 'text-gray-700' : 'text-red-700'
                      }`}>
                        {(dayMap[request.timeSlot?.day.toLowerCase()] || request.timeSlot?.day)} {request.timeSlot?.startTime}-{request.timeSlot?.endTime}
                      </div>
                    </div>
                  );
                })}
              {processedRequests.length > 3 && !showAllRequests['sentProcessed'] && (
                <button
                  onClick={() => setShowAllRequests(prev => ({...prev, sentProcessed: true}))}
                  className="text-xs text-gray-500 hover:text-gray-600 text-center w-full"
                >
                  +{processedRequests.length - 3}개 더 보기
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RequestSection;