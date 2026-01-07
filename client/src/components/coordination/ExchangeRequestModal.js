/**
 * ===================================================================================================
 * ExchangeRequestModal.js - 시간 교환 요청 모달 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/coordination
 *
 * 🎯 주요 기능:
 *    - 다른 사용자로부터 받은 시간 교환 요청의 상세 내용을 표시
 *    - 요청 수락/거절 버튼을 통해 사용자의 응답을 처리
 *    - API를 호출하여 서버에 사용자의 응답(수락/거절)을 전송
 *    - API 응답 후 처리 상태 및 메시지를 사용자에게 표시
 *
 * 🔗 연결된 파일:
 *    - ../../config/firebaseConfig - Firebase 인증 토큰을 가져오기 위해 사용
 *    - CoordinationTab/index.js - 이 모달을 호출하고 관리하는 상위 컴포넌트
 *
 * 💡 UI 위치:
 *    - 조율 탭 > '요청 관리' 섹션 > 받은 요청 목록에서 '시간 교환 요청'을 클릭했을 때 표시
 *
 * ✏️ 수정 가이드:
 *    - API 엔드포인트 변경: `axios.post`의 URL 주소 수정
 *    - 모달 UI/UX 디자인 변경: JSX 구조 및 Tailwind CSS 클래스 수정
 *    - 수락/거절 시 서버로 보내는 데이터 변경: `axios.post`의 body({ action }) 수정
 *
 * 📝 참고사항:
 *    - 이 모달은 'A <-> B' 형태의 1:1 시간 교환 요청을 처리합니다.
 *    - 사용자가 '수락'하면, 백엔드에서 두 사용자의 시간 슬롯을 맞바꾸고,
 *      요청을 받은 사용자는 자동으로 다른 빈 시간으로 재배치될 수 있습니다.
 *    - API 요청 시 Firebase 인증 토큰을 헤더에 포함하여 보냅니다.
 *
 * ===================================================================================================
 */

import React, { useState } from 'react';
import axios from 'axios';
import { auth } from '../../config/firebaseConfig';

/**
 * ExchangeRequestModal
 *
 * @description 다른 사용자로부터 받은 시간 교환 요청을 표시하고, 수락/거절 응답을 처리하는 모달 컴포넌트입니다.
 * @param {Object} props - 컴포넌트 프롭스
 * @param {boolean} props.isOpen - 모달의 열림/닫힘 상태
 * @param {Function} props.onClose - 모달을 닫는 함수
 * @param {Object | null} props.request - 표시할 시간 교환 요청 데이터 객체
 * @param {string} props.roomId - 현재 방의 ID
 * @param {Function} props.onRequestHandled - 요청 처리가 완료된 후 호출될 콜백 함수 (데이터 새로고침용)
 * @returns {JSX.Element | null} 시간 교환 요청 모달 또는 null
 *
 * @example
 * <ExchangeRequestModal
 *   isOpen={isModalOpen}
 *   onClose={() => setIsModalOpen(false)}
 *   request={selectedRequest}
 *   roomId={currentRoomId}
 *   onRequestHandled={fetchRequests}
 * />
 */
const ExchangeRequestModal = ({ isOpen, onClose, request, roomId, onRequestHandled }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [responseMessage, setResponseMessage] = useState('');

  if (!isOpen || !request) return null;

  const handleResponse = async (action) => {
    setIsProcessing(true);
    setResponseMessage('');

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setResponseMessage('인증이 필요합니다.');
        setIsProcessing(false);
        return;
      }

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/coordination/rooms/${roomId}/exchange-requests/${request._id}/respond`,
        { action },
        {
          headers: {
            'Authorization': `Bearer ${await currentUser.getIdToken()}`
          }
        }
      );

      const { success, message } = response.data;

      if (success) {
        setResponseMessage(message);

        // Wait a moment to show the message, then close and refresh
        setTimeout(() => {
          onRequestHandled();
          onClose();
        }, 2000);
      }
    } catch (error) {
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
