// Request management section component for non-owners

import React from 'react';
import { Users, AlertTriangle } from 'lucide-react';
import { auth } from '../../../../config/firebaseConfig';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const dayMap = {
  'monday': '월요일',
  'tuesday': '화요일',
  'wednesday': '수요일',
  'thursday': '목요일',
  'friday': '금요일'
};

const RequestSection = ({
  currentRoom,
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

const ReceivedRequestsView = ({
  currentRoom,
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
                        {request.type === 'time_request' ? '자리 요청' : request.type === 'slot_swap' ? '교환 요청' : '알 수 없는 요청'}
                      </div>
                    </div>
                    <div className="text-xs font-medium text-blue-100 mb-2">
                      {(dayMap[request.timeSlot?.day.toLowerCase()] || request.timeSlot?.day)} {request.timeSlot?.startTime}-{request.timeSlot?.endTime}
                    </div>
                    {request.message && (
                      <p className="text-xs text-white italic mb-2 line-clamp-2">"{request.message}"</p>
                    )}
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

const SentRequestsView = ({
  currentRoom,
  sentRequests,
  showAllRequests,
  setShowAllRequests,
  expandedSections,
  setExpandedSections,
  handleCancelRequest
}) => {
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
                        alert('로그인이 필요합니다.');
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
                        alert(data.msg);
                        window.location.reload(); // 간단하게 페이지 새로고침
                      } else {
                        alert(data.msg || '처리 중 오류가 발생했습니다.');
                      }
                    } catch (error) {
                      console.error('Chain action error:', error);
                      alert('연쇄 조정 처리 중 오류가 발생했습니다.');
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
                    {request.message && (
                      <p className="text-xs text-white italic mb-2 line-clamp-2">"{request.message}"</p>
                    )}
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
