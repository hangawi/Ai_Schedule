import React from 'react';
import { AlertCircle, Clock, XCircle } from 'lucide-react';

const NegotiationConflictModal = ({
  isOpen,
  onClose,
  onNavigate,
  respondedNegotiation
}) => {
  if (!isOpen || !respondedNegotiation) return null;

  const dayMap = {
    monday: '월요일',
    tuesday: '화요일',
    wednesday: '수요일',
    thursday: '목요일',
    friday: '금요일',
    saturday: '토요일',
    sunday: '일요일'
  };
  const dayName = dayMap[respondedNegotiation?.slotInfo?.day] || respondedNegotiation?.slotInfo?.day;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                다른 협의에 이미 응답했습니다
              </h3>
            </div>
            <button
              onClick={onClose}
              className="ml-3 text-gray-400 hover:text-gray-500"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-3">
              이미 다른 협의에 응답하셨습니다. 새로운 협의에 참여하려면 먼저 기존 응답을 취소하거나 해결해야 합니다.
            </p>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <Clock className="h-4 w-4 text-yellow-600 mr-2" />
                <span className="text-sm font-medium text-yellow-800">
                  응답한 협의
                </span>
              </div>
              <p className="text-sm text-yellow-700">
                {dayName} {respondedNegotiation?.slotInfo?.startTime} - {respondedNegotiation?.slotInfo?.endTime}
              </p>
            </div>
          </div>

          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
            💡 <strong>팁:</strong> 기존 협의 모달에서 "응답 취소" 버튼을 눌러 응답을 취소할 수 있습니다.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            닫기
          </button>
          <button
            onClick={onNavigate}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-yellow-500 rounded-lg hover:bg-yellow-600"
          >
            기존 협의로 이동
          </button>
        </div>
      </div>
    </div>
  );
};

export default NegotiationConflictModal;
