/**
 * ===================================================================================================
 * RequestSlotModal.js - 조율방의 빈 시간대에 대한 배정을 요청하는 모달
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/RequestSlotModal.js
 *
 * 🎯 주요 기능:
 *    - 사용자가 조율 시간표에서 비어있는 특정 시간대를 선택하여 배정 요청을 보낼 수 있는 UI 제공.
 *    - 요청 시 간단한 메시지를 함께 첨부할 수 있음.
 *    - '요청하기' 버튼 클릭 시, 입력된 메시지와 함께 부모 컴포넌트에 요청 액션을 전달.
 *
 * 🔗 연결된 파일:
 *    - ./CoordinationTab.js (추정) - 이 모달을 열고 `onRequest` 콜백을 통해 실제 요청 로직을 처리하는 부모 컴포넌트.
 *
 * 💡 UI 위치:
 *    - '일정 맞추기' 탭의 조율 시간표에서, 비어있는 회색 슬롯을 클릭했을 때 나타나는 팝업 모달.
 *
 * ✏️ 수정 가이드:
 *    - 요청 메시지 입력란의 플레이스홀더나 UI를 변경하려면 JSX 부분을 수정합니다.
 *    - '요청하기' 버튼 클릭 시 추가적인 데이터를 부모로 전달해야 한다면 `handleSubmit` 함수와 `onRequest` 콜백의 인자를 수정해야 합니다.
 *
 * 📝 참고사항:
 *    - 이 모달은 `ChangeRequestModal`과 유사하지만, 소유자가 없는 빈 슬롯을 대상으로 한다는 점에서 더 단순합니다.
 *    - 실제 요청 로직은 `onRequest` prop을 통해 상위 컴포넌트에 위임됩니다.
 *
 * ===================================================================================================
 */
import React, { useState } from 'react';
import { X } from 'lucide-react';

/**
 * RequestSlotModal
 * @description 비어있는 시간 슬롯에 대해 배정을 요청하는 폼을 제공하는 모달 컴포넌트.
 * @param {object} props - 컴포넌트 props
 * @param {function} props.onClose - 모달을 닫는 함수.
 * @param {function} props.onRequest - '요청하기' 버튼 클릭 시 호출되는 콜백 함수 (메시지를 인자로 받음).
 * @param {object} props.slotInfo - 요청할 슬롯의 정보 (요일 인덱스, 시간 등).
 * @returns {JSX.Element}
 */
const RequestSlotModal = ({ onClose, onRequest, slotInfo }) => {
  const [message, setMessage] = useState('');
  const days = ['월', '화', '수', '목', '금'];

  const handleSubmit = () => {
    onRequest(message);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-11/12 max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">시간 요청</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <p className="text-gray-700">
            <span className="font-semibold">{days[slotInfo.dayIndex]}요일 {slotInfo.time}</span> 시간을 요청하시겠습니까?
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">요청 메시지 (선택 사항)</label>
            <textarea
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="예: 이 시간에 스터디를 하고 싶습니다."
              rows={3}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">취소</button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">요청하기</button>
        </div>
      </div>
    </div>
  );
};

export default RequestSlotModal;
