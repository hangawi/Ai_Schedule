import React, { useState } from 'react';
import { coordinationService } from '../../services/coordinationService';

/**
 * Chain Exchange Request Modal
 * 4.txt: A -> B -> C 연쇄 교환 요청 모달
 * C 사용자가 빈 시간으로 이동해줄 수 있는지 물어보는 모달
 */
const ChainExchangeRequestModal = ({ isOpen, onClose, request, roomId, onRequestHandled }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [responseMessage, setResponseMessage] = useState('');

  if (!isOpen || !request) return null;

  const handleResponse = async (action) => {
    setIsProcessing(true);
    setResponseMessage('');

    try {
      const response = await coordinationService.respondToChainExchangeRequest(
        roomId,
        request._id,
        action
      );

      const { success, message, result, nextCandidate } = response;

      if (success) {
        setResponseMessage(message);

        // 결과 정보 표시 (수락 시)
        if (result) {
          setResponseMessage(`${message}\n\n결과:\n- 당신: ${result.c.newDay} ${result.c.newTime}로 이동\n- ${request.requester?.firstName}: ${result.b.newDay} ${result.b.newTime}로 이동`);
        }

        // Wait a moment to show the message, then close and refresh
        setTimeout(() => {
          onRequestHandled();
          onClose();
        }, 3000);
      } else {
        setResponseMessage(message);
        setTimeout(() => {
          onRequestHandled();
          onClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Chain exchange request response error:', error);
      setResponseMessage(
        error.message || '요청 처리 중 오류가 발생했습니다.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-purple-50">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-purple-900">
              연쇄 일정 조정 요청
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
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <p className="text-sm text-gray-800">
                {request.message}
              </p>
            </div>
          </div>

          {/* Target Slot Details */}
          <div className="mb-4 bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">요청 대상 슬롯:</span>
              <span className="font-medium text-gray-900">
                {request.targetSlot?.day} {request.targetSlot?.startTime}-{request.targetSlot?.endTime}
              </span>
            </div>
          </div>

          {/* Chain Info Box */}
          <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-purple-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-medium text-purple-800 mb-1">
                  연쇄 조정이란?
                </p>
                <p className="text-xs text-purple-700">
                  다른 사용자의 일정 조정을 돕기 위해 당신이 빈 시간대로 이동해주시면,
                  연쇄적으로 모든 관련자의 일정이 원활하게 재배치됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* Warning */}
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
                  수락하면 당신은 다른 가능한 시간대로 자동 이동합니다.
                  거절하면 다음 후보에게 요청이 전달됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* Response Message */}
          {responseMessage && (
            <div className={`mb-4 p-3 rounded-lg whitespace-pre-line ${
              responseMessage.includes('완료') || responseMessage.includes('성공')
                ? 'bg-green-50 border border-green-200 text-green-800'
                : responseMessage.includes('거절') || responseMessage.includes('불가')
                  ? 'bg-orange-50 border border-orange-200 text-orange-800'
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
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {isProcessing ? '처리 중...' : '도와드릴게요'}
          </button>
          <button
            onClick={() => handleResponse('reject')}
            disabled={isProcessing}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {isProcessing ? '처리 중...' : '어려워요'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChainExchangeRequestModal;
