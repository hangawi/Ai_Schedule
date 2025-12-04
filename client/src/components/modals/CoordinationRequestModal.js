/**
 * ===================================================================================================
 * CoordinationRequestModal.js - 조율방 내의 시간 요청을 검토하고 승인/거절하는 모달
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/CoordinationRequestModal.js
 *
 * 🎯 주요 기능:
 *    - 조율방 멤버가 보낸 시간 요청의 상세 내용을 표시.
 *    - 요청 유형(`requestType`)에 따라 '배정 요청' 또는 '조율 요청'(충돌 발생 시)으로 동적 UI를 제공.
 *    - 요청자, 요청 시간, 첨부 메시지 등의 정보를 명확하게 보여줌.
 *    - 충돌이 발생한 경우, 누구의 시간과 충돌하는지 알려줌.
 *    - 방장이 요청을 '승인'하거나 '거절'할 수 있는 버튼을 제공.
 *
 * 🔗 연결된 파일:
 *    - ./CoordinationTab.js (추정) - 이 모달을 열고 `onApprove`, `onReject` 콜백을 통해 실제 로직을 처리하는 부모 컴포넌트.
 *
 * 💡 UI 위치:
 *    - '일정 맞추기' 탭의 '요청 관리' 섹션에서 특정 요청을 클릭했을 때 나타나는 팝업 모달.
 *
 * ✏️ 수정 가이드:
 *    - 요청 상세 정보의 표시 방식을 변경하려면 JSX 내부의 각 정보 섹션(요청 시간, 충돌 발생 등)을 수정합니다.
 *    - 날짜/시간 포맷을 변경하려면 `formatTime` 함수를 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 컴포넌트는 요청 내용을 보여주고 승인/거절 액션을 부모에게 전달하는 역할만 수행합니다.
 *    - 실제 승인/거절 로직은 `onApprove`, `onReject` prop을 통해 상위 컴포넌트에서 처리됩니다.
 *
 * ===================================================================================================
 */
import React from 'react';
import { X, CheckCircle, XCircle, Info } from 'lucide-react';

/**
 * CoordinationRequestModal
 * @description 조율방 내에서 발생한 시간 요청의 세부 정보를 보여주고, 방장이 이를 승인하거나 거절할 수 있도록 하는 모달.
 * @param {object} props - 컴포넌트 props
 * @param {object} props.request - 표시할 요청의 상세 데이터 객체.
 * @param {function} props.onClose - 모달을 닫는 함수.
 * @param {function} props.onApprove - '승인' 버튼 클릭 시 호출되는 콜백 함수 (요청 ID를 인자로 받음).
 * @param {function} props.onReject - '거절' 버튼 클릭 시 호출되는 콜백 함수 (요청 ID를 인자로 받음).
 * @returns {JSX.Element|null} request 객체가 없으면 null을 반환.
 */
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
