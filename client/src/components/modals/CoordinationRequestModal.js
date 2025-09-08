import React from 'react';
import { X, CheckCircle, XCircle, Info } from 'lucide-react';

const CoordinationRequestModal = ({ request, onClose, onApprove, onReject }) => {
  if (!request) return null;

  const isConflict = request.requestType === 'conflict';
  const isBooking = request.requestType === 'booking';

  const formatTime = (date) => {
    return new Date(date).toLocaleString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">
            {isConflict ? '시간표 조율 요청' : '시간표 배정 요청'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center space-x-2 text-gray-700">
            <Info size={20} />
            <p>
              <strong>{request.requesterId?.firstName || '알 수 없음'}</strong>님이
              새로운 요청을 보냈습니다.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm">
            <p className="font-semibold text-blue-800 mb-1">요청 시간:</p>
            <p className="text-blue-700">
              {formatTime(request.requestedSlot.startTime)} ~ {formatTime(request.requestedSlot.endTime)}
            </p>
          </div>

          {isConflict && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm">
              <p className="font-semibold text-red-800 mb-1">충돌 발생:</p>
              <p className="text-red-700">
                해당 시간은 이미 <strong>{request.conflictingUserId?.firstName || '알 수 없음'}</strong>님에게 배정되어 있습니다.
              </p>
            </div>
          )}

          {request.message && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-sm">
              <p className="font-semibold text-gray-800 mb-1">메시지:</p>
              <p className="text-gray-700">{request.message}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end p-4 border-t space-x-3">
          <button
            onClick={() => onReject(request._id)}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center"
          >
            <XCircle size={18} className="mr-1" /> 거절
          </button>
          <button
            onClick={() => onApprove(request._id)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center"
          >
            <CheckCircle size={18} className="mr-1" /> 승인
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoordinationRequestModal;
