import React, { useState } from 'react';
import { X } from 'lucide-react';

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
