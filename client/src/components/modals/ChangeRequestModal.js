import React, { useState } from 'react';
import { X } from 'lucide-react';

const ChangeRequestModal = ({ onClose, onRequestChange, slotToChange }) => {
  const [message, setMessage] = useState('');
  const days = ['월', '화', '수', '목', '금'];

  const handleSubmit = () => {
    onRequestChange(message);
  };

  const getTitle = () => {
    switch (slotToChange.action) {
      case 'release': return '시간 취소 요청';
      case 'swap': return '시간 교환 요청';
      default: return '시간 변경 요청';
    }
  };

  const getFormattedDateTime = () => {
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
    switch (slotToChange.action) {
      case 'release': return `${dayTime} 시간을 취소하시겠습니까?`;
      case 'swap': return `${slotToChange.currentOwner}님의 ${dayTime} 시간과 교환을 요청하시겠습니까?`;
      default: return `${dayTime} 시간을 변경 요청하시겠습니까?`;
    }
  };

  const getPlaceholder = () => {
    switch (slotToChange.action) {
      case 'release': return '취소 사유를 입력하세요 (선택 사항)';
      case 'swap': return '교환 요청 메시지를 입력하세요 (선택 사항)';
      default: return '변경 요청 메시지를 입력하세요 (선택 사항)';
    }
  };

  const getButtonText = () => {
    switch (slotToChange.action) {
      case 'release': return '취소 요청';
      case 'swap': return '교환 요청';
      default: return '변경 요청하기';
    }
  };

  const getButtonColor = () => {
    switch (slotToChange.action) {
      case 'release': return 'bg-red-600 hover:bg-red-700';
      case 'swap': return 'bg-blue-600 hover:bg-blue-700';
      default: return 'bg-purple-600 hover:bg-purple-700';
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
