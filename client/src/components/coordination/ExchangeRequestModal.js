import React, { useState } from 'react';
import axios from 'axios';

const ExchangeRequestModal = ({ isOpen, onClose, request, roomId, onRequestHandled }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [responseMessage, setResponseMessage] = useState('');

  if (!isOpen || !request) return null;

  const handleResponse = async (action) => {
    setIsProcessing(true);
    setResponseMessage('');

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/coordination/rooms/${roomId}/exchange-requests/${request._id}/respond`,
        { action },
        {
          headers: {
            'x-auth-token': localStorage.getItem('token')
          }
        }
      );

      const { success, message, alternativeSlot } = response.data;

      if (success) {
        setResponseMessage(message);

        // Wait a moment to show the message, then close and refresh
        setTimeout(() => {
          onRequestHandled();
          onClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Exchange request response error:', error);
      setResponseMessage(
        error.response?.data?.message || '요청 처리 중 오류가 발생했습니다.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              시간 교환 요청
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={isProcessing}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {/* Requester Info */}
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">요청자</p>
            <p className="text-base font-medium text-gray-900">
              {request.requester?.firstName} {request.requester?.lastName}
            </p>
          </div>

          {/* Request Message */}
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">요청 내용</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-gray-800">
                {request.message}
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="mb-4 bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">원하는 요일:</span>
              <span className="font-medium text-gray-900">{request.desiredDay}</span>
            </div>
            {request.desiredTime && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">원하는 시간:</span>
                <span className="font-medium text-gray-900">{request.desiredTime}</span>
              </div>
            )}
            {request.requesterSlots && request.requesterSlots.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">요청자 현재 시간:</span>
                <span className="font-medium text-gray-900">
                  {request.requesterSlots[0].day} {request.requesterSlots[0].startTime}
                </span>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-medium text-yellow-800 mb-1">
                  수락 시 자동 재배치
                </p>
                <p className="text-xs text-yellow-700">
                  수락하면 당신은 다른 가능한 시간대로 자동 이동하고, 요청자가 당신의 자리로 이동합니다.
                </p>
              </div>
            </div>
          </div>

          {/* Response Message */}
          {responseMessage && (
            <div className={`mb-4 p-3 rounded-lg ${
              responseMessage.includes('수락') || responseMessage.includes('성공')
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              <p className="text-sm">{responseMessage}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex space-x-3">
          <button
            onClick={() => handleResponse('accept')}
            disabled={isProcessing}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {isProcessing ? '처리 중...' : '✅ 수락'}
          </button>
          <button
            onClick={() => handleResponse('reject')}
            disabled={isProcessing}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {isProcessing ? '처리 중...' : '❌ 거절'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExchangeRequestModal;
