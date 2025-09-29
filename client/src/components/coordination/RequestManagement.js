import React from 'react';
import { Calendar, Users } from 'lucide-react';
import { dayMap, getMemberDisplayName, filterRequestsByRoomAndStatus } from '../../utils/coordinationUtils';

const PendingRequestItem = ({ request, onApprove, onReject, index }) => {
  const requesterData = request.requester;
  const requesterName = getMemberDisplayName(requesterData);

  return (
    <div key={request._id || index} className="p-2 bg-orange-50 border border-orange-200 rounded-lg">
      <div className="flex justify-between items-center mb-1">
        <div className="text-xs font-medium text-orange-900">{requesterName}</div>
        <div className="text-xs text-orange-600">
          {request.type === 'time_request' ? '자리 요청' : request.type === 'slot_swap' ? '자리 교환' : '시간 변경'}
        </div>
      </div>
      <div className="text-xs text-orange-700 mb-2">
        {(dayMap[request.timeSlot?.day.toLowerCase()] || request.timeSlot?.day)} {request.timeSlot?.startTime}-{request.timeSlot?.endTime}
      </div>
      {request.message && (
        <p className="text-xs text-gray-600 italic mb-2 line-clamp-2">"{request.message}"</p>
      )}
      <div className="flex justify-end space-x-2 mt-2">
        <button
          onClick={() => onApprove(request._id)}
          className="px-3 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600"
        >
          승인
        </button>
        <button
          onClick={() => onReject(request._id)}
          className="px-3 py-1 text-xs bg-red-500 text-white rounded-md hover:bg-red-600"
        >
          거절
        </button>
      </div>
    </div>
  );
};

const OwnerRequestsSection = ({
  currentRoom,
  onRequestWithUpdate
}) => {
  const pendingRequests = (currentRoom.requests || [])
    .filter(req => req.status === 'pending' && ['time_request', 'time_change'].includes(req.type));

  if (pendingRequests.length === 0) return null;

  return (
    <div className="mt-6 pt-4 border-t border-gray-200">
      <h4 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
        <Calendar size={16} className="mr-2 text-orange-600" />
        대기 중인 요청 ({pendingRequests.length}건)
      </h4>
      <div className="space-y-2">
        {pendingRequests.slice(0, 3).map((request, index) => (
          <PendingRequestItem
            key={request._id || index}
            request={request}
            onApprove={(id) => onRequestWithUpdate(id, 'approved')}
            onReject={(id) => onRequestWithUpdate(id, 'rejected')}
            index={index}
          />
        ))}
        {pendingRequests.length > 3 && (
          <div className="text-xs text-gray-500 text-center">
            +{pendingRequests.length - 3}개 더
          </div>
        )}
      </div>
    </div>
  );
};

const ExchangeRequestItem = ({ request, type, onCancel, onApprove, onReject, index }) => {
  const userData = type === 'sent' ? request.targetUser : request.requester;
  const userName = getMemberDisplayName(userData) || (type === 'sent' ? '방장' : '알 수 없음');

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-50 border-green-200';
      case 'cancelled': return 'bg-gray-50 border-gray-200';
      default: return 'bg-red-50 border-red-200';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'approved': return '승인됨';
      case 'cancelled': return '취소됨';
      default: return '거절됨';
    }
  };

  const getStatusTextColor = (status) => {
    switch (status) {
      case 'approved': return 'text-green-700';
      case 'cancelled': return 'text-gray-700';
      default: return 'text-red-700';
    }
  };

  if (request.status === 'pending') {
    return (
      <div key={request._id || index} className={type === 'sent' ? 'p-2 bg-gray-50 border border-gray-200 rounded-lg' : 'p-2 bg-blue-50 border border-blue-200 rounded-lg'}>
        <div className="flex justify-between items-center mb-1">
          <div className={`text-xs font-medium ${type === 'sent' ? 'text-gray-800' : 'text-blue-900'}`}>
            {type === 'sent' ? `To: ${userName}` : userName}
          </div>
          <div className={`text-xs px-2 py-1 rounded-full ${type === 'sent' ? 'bg-yellow-100 text-yellow-800' : 'text-blue-600'}`}>
            {type === 'sent' ? '대기중' : (request.type === 'slot_swap' ? '자리 교환' : '알 수 없는 요청')}
          </div>
        </div>
        <div className={`text-xs mb-2 ${type === 'sent' ? 'text-gray-700' : 'text-blue-700'}`}>
          {(dayMap[request.timeSlot?.day.toLowerCase()] || request.timeSlot?.day)} {request.timeSlot?.startTime}-{request.timeSlot?.endTime}
        </div>
        {request.message && (
          <p className="text-xs text-gray-600 italic mb-2 line-clamp-2">"{request.message}"</p>
        )}
        <div className="flex justify-end space-x-2 mt-2">
          {type === 'sent' ? (
            <button
              onClick={() => onCancel(request._id)}
              className="px-3 py-1 text-xs bg-gray-500 text-white rounded-md hover:bg-gray-600"
            >
              요청 취소
            </button>
          ) : (
            <>
              <button
                onClick={() => onApprove(request._id)}
                className="px-3 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                승인
              </button>
              <button
                onClick={() => onReject(request._id)}
                className="px-3 py-1 text-xs bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                거절
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div key={request._id || index} className={`p-2 border rounded-lg ${getStatusColor(request.status)}`}>
      <div className="flex justify-between items-center mb-1">
        <div className={`text-xs font-medium ${
          request.status === 'approved' ? 'text-green-900' :
          request.status === 'cancelled' ? 'text-gray-900' : 'text-red-900'
        }`}>
          {type === 'sent' ? `To: ${userName}` : userName}
        </div>
        <div className="flex items-center space-x-2">
          <div className={`text-xs px-2 py-1 rounded-full ${
            request.status === 'approved' ? 'bg-green-100 text-green-800' :
            request.status === 'cancelled' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'
          }`}>
            {getStatusText(request.status)}
          </div>
          <button
            onClick={() => onCancel(request._id)}
            className="text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full w-5 h-5 flex items-center justify-center transition-colors"
            title="내역 삭제"
          >
            ✕
          </button>
        </div>
      </div>
      <div className={`text-xs mb-2 ${getStatusTextColor(request.status)}`}>
        {(dayMap[request.timeSlot?.day.toLowerCase()] || request.timeSlot?.day)} {request.timeSlot?.startTime}-{request.timeSlot?.endTime}
      </div>
    </div>
  );
};

const RequestSection = ({
  title,
  requests,
  type,
  showAllKey,
  expandedKey,
  showAllRequests,
  expandedSections,
  onShowAll,
  onToggleExpanded,
  onCancel,
  onApprove,
  onReject
}) => {
  const pendingRequests = requests.filter(req => req.status === 'pending');
  const processedRequests = requests.filter(req => req.status !== 'pending');

  return (
    <>
      {/* Pending Requests */}
      <div className="mb-4">
        <h5 className="text-sm font-medium text-gray-700 mb-2">{title}</h5>
        {pendingRequests.length > 0 ? (
          <div className="space-y-2">
            {pendingRequests
              .slice(0, showAllRequests[showAllKey] ? undefined : 3)
              .map((request, index) => (
                <ExchangeRequestItem
                  key={request._id || index}
                  request={request}
                  type={type}
                  onCancel={onCancel}
                  onApprove={onApprove}
                  onReject={onReject}
                  index={index}
                />
              ))}
            {pendingRequests.length > 3 && !showAllRequests[showAllKey] && (
              <button
                onClick={() => onShowAll(showAllKey)}
                className="text-xs text-blue-500 hover:text-blue-600 text-center w-full"
              >
                +{pendingRequests.length - 3}개 더 보기
              </button>
            )}
          </div>
        ) : (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
            <p className="text-xs text-gray-500">{type === 'sent' ? '보낸 요청이 없습니다' : '받은 요청이 없습니다'}</p>
          </div>
        )}
      </div>

      {/* Processed Requests */}
      {processedRequests.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-sm font-medium text-gray-700">처리된 요청</h5>
            <button
              onClick={() => onToggleExpanded(expandedKey)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              {expandedSections[expandedKey] ? '접기' : '펼치기'}
            </button>
          </div>
          {expandedSections[expandedKey] && (
            <div className="space-y-2">
              {processedRequests
                .slice(0, showAllRequests[expandedKey] ? undefined : 3)
                .map((request, index) => (
                  <ExchangeRequestItem
                    key={request._id || index}
                    request={request}
                    type={type}
                    onCancel={onCancel}
                    onApprove={onApprove}
                    onReject={onReject}
                    index={index}
                  />
                ))}
              {processedRequests.length > 3 && !showAllRequests[expandedKey] && (
                <button
                  onClick={() => onShowAll(expandedKey)}
                  className="text-xs text-gray-500 hover:text-gray-600 text-center w-full"
                >
                  +{processedRequests.length - 3}개 더 보기
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};

const RequestManagement = ({
  currentRoom,
  receivedRequests,
  sentRequests,
  requestViewMode,
  setRequestViewMode,
  showAllRequests,
  setShowAllRequests,
  expandedSections,
  setExpandedSections,
  onRequestWithUpdate,
  onCancelRequest
}) => {
  const handleShowAll = (key) => {
    setShowAllRequests(prev => ({ ...prev, [key]: true }));
  };

  const handleToggleExpanded = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="mt-6 pt-4 border-t border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-md font-semibold text-gray-800 flex items-center">
          <Users size={16} className="mr-2 text-blue-600" />
          자리요청 관리
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
        <RequestSection
          title="대기 중인 요청"
          requests={filterRequestsByRoomAndStatus(receivedRequests, currentRoom._id, 'pending')}
          type="received"
          showAllKey="receivedPending"
          expandedKey="receivedProcessed"
          showAllRequests={showAllRequests}
          expandedSections={expandedSections}
          onShowAll={handleShowAll}
          onToggleExpanded={handleToggleExpanded}
          onCancel={onCancelRequest}
          onApprove={(id) => onRequestWithUpdate(id, 'approved')}
          onReject={(id) => onRequestWithUpdate(id, 'rejected')}
        />
      )}

      {requestViewMode === 'sent' && (
        <RequestSection
          title="대기 중인 요청"
          requests={filterRequestsByRoomAndStatus(sentRequests, currentRoom._id, 'pending')}
          type="sent"
          showAllKey="sentPending"
          expandedKey="sentProcessed"
          showAllRequests={showAllRequests}
          expandedSections={expandedSections}
          onShowAll={handleShowAll}
          onToggleExpanded={handleToggleExpanded}
          onCancel={onCancelRequest}
          onApprove={(id) => onRequestWithUpdate(id, 'approved')}
          onReject={(id) => onRequestWithUpdate(id, 'rejected')}
        />
      )}
    </div>
  );
};

export { RequestManagement, OwnerRequestsSection };