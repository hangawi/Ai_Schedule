/**
 * ===================================================================================================
 * ChangeRequestModal.js - 조율 시간표의 '자리 요청' 또는 '시간 취소' 모달
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/ChangeRequestModal.js
 *
 * 🎯 주요 기능:
 *    - 사용자가 다른 조원의 시간 슬롯을 요청('request')하거나, 자신의 슬롯을 반납('release')하는 기능 제공.
 *    - `requestType` 상태에 따라 모달의 제목, 설명, 버튼 텍스트, 버튼 색상 등이 동적으로 변경됨.
 *    - 사용자가 요청/취소 사유를 메시지로 작성할 수 있는 텍스트 입력창 제공.
 *    - `slotToChange` prop에 담긴 다양한 형식의 날짜/시간 정보를 지능적으로 포맷하여 사용자에게 표시.
 *
 * 🔗 연결된 파일:
 *    - ./CoordinationTab.js (추정) - 이 모달을 열고 `onRequestChange` 콜백을 통해 실제 요청/취소 로직을 처리하는 부모 컴포넌트.
 *
 * 💡 UI 위치:
 *    - '일정 맞추기' 탭의 조율 시간표에서, 다른 사람이 차지한 슬롯 또는 자신의 슬롯을 클릭했을 때 나타나는 팝업 모달.
 *
 * ✏️ 수정 가이드:
 *    - 새로운 요청 유형을 추가하려면 `getTitle`, `getMessage` 등 `get...`으로 시작하는 헬퍼 함수들에 새로운 `case`를 추가해야 합니다.
 *    - 날짜/시간 표시 형식을 변경하려면 `getFormattedDateTime` 함수의 로직을 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 컴포넌트는 UI와 요청에 필요한 메시지/타입 상태만 관리합니다. 실제 API 호출 및 상태 변경 로직은 `onRequestChange` prop을 통해 상위 컴포넌트에 위임됩니다.
 *    - `getFormattedDateTime` 함수는 `dayDisplay`(e.g., "오늘"), `date`(e.g., "2023-12-25"), `dayIndex` 등 다양한 형태의 날짜 정보를 모두 처리할 수 있도록 구현되어 있습니다.
 *
 * ===================================================================================================
 */
import React, { useState } from 'react';
import { X } from 'lucide-react';

/**
 * ChangeRequestModal
 * @description 다른 조원에게 자리를 요청하거나 자신의 슬롯을 취소/반납하기 위한 모달 컴포넌트.
 * @param {object} props - 컴포넌트 props
 * @param {function} props.onClose - 모달을 닫는 함수.
 * @param {function} props.onRequestChange - '자리 요청' 또는 '취소 요청' 버튼 클릭 시 호출되는 콜백. (message, requestType)을 인자로 받음.
 * @param {object} props.slotToChange - 요청/취소 대상이 되는 슬롯에 대한 상세 정보.
 * @returns {JSX.Element}
 */
const ChangeRequestModal = ({ onClose, onRequestChange, slotToChange }) => {
  const [message, setMessage] = useState('');
  const [requestType, setRequestType] = useState(slotToChange.action || 'request');
  const days = ['월', '화', '수', '목', '금'];

  const handleSubmit = () => {
    onRequestChange(message, requestType);
  };

  const getTitle = () => {
    switch (requestType) {
      case 'release': return '시간 취소 요청';
      default: return '자리 요청';
    }
  };

  const getFormattedDateTime = () => {
    // 블록 요청인 경우 시간 범위 표시
    if (slotToChange.isBlockRequest && slotToChange.targetSlot) {
      const timeRange = `${slotToChange.targetSlot.startTime}-${slotToChange.targetSlot.endTime}`;

      // slotToChange에 실제 date 정보와 dayDisplay가 있다면 사용
      if (slotToChange.dayDisplay) {
        return `${slotToChange.dayDisplay} ${timeRange}`;
      }

      // 실제 날짜가 있다면 포맷팅
      if (slotToChange.date) {
        const date = new Date(slotToChange.date);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const dayOfMonth = String(date.getDate()).padStart(2, '0');
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const dayName = dayNames[date.getDay()];
        return `${dayName} (${month}.${dayOfMonth}) ${timeRange}`;
      }

      return `${days[slotToChange.dayIndex]}요일 ${timeRange}`;
    }

    // 일반 단일 슬롯 요청인 경우
    // slotToChange에 실제 date 정보와 dayDisplay가 있다면 사용
    if (slotToChange.dayDisplay) {
      return `${slotToChange.dayDisplay} ${slotToChange.time}`;
    }

    // 실제 날짜가 있다면 포맷팅
    if (slotToChange.date) {
      const date = new Date(slotToChange.date);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const dayOfMonth = String(date.getDate()).padStart(2, '0');
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const dayName = dayNames[date.getDay()];
      return `${dayName} (${month}.${dayOfMonth}) ${slotToChange.time}`;
    }

    // 기존 방식 (dayIndex 사용)
    return `${days[slotToChange.dayIndex]}요일 ${slotToChange.time}`;
  };

  const getMessage = () => {
    const dayTime = getFormattedDateTime();
    switch (requestType) {
      case 'release': return `${dayTime} 시간을 취소하시겠습니까?`;
      default: return `${slotToChange.currentOwner}님에게 ${dayTime} 자리를 요청하시겠습니까?`;
    }
  };

  const getPlaceholder = () => {
    switch (requestType) {
      case 'release': return '취소 사유를 입력하세요 (선택 사항)';
      default: return '자리 요청 사유를 입력하세요 (선택 사항)';
    }
  };

  const getButtonText = () => {
    switch (requestType) {
      case 'release': return '취소 요청';
      default: return '자리 요청';
    }
  };

  const getButtonColor = () => {
    switch (requestType) {
      case 'release': return 'bg-red-600 hover:bg-red-700';
      default: return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-11/12 max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">{getTitle()}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <p className="text-gray-700">
            {getMessage()}
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">메시지 (선택 사항)</label>
            <textarea
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={getPlaceholder()}
              rows={3}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">취소</button>
          <button onClick={handleSubmit} className={`px-4 py-2 text-white rounded-md ${getButtonColor()}`}>{getButtonText()}</button>
        </div>
      </div>
    </div>
  );
};

export default ChangeRequestModal;
