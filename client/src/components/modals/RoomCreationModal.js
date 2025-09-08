import React, { useState } from 'react';
import { X } from 'lucide-react';

const RoomCreationModal = ({ onClose, onCreateRoom }) => {
  const [roomName, setRoomName] = useState('');
  const [maxMembers, setMaxMembers] = useState(10);

  const handleSubmit = () => {
    if (roomName.trim() === '') {
      alert('방 이름을 입력해주세요.');
      return;
    }
    onCreateRoom({ roomName, maxMembers });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-11/12 max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">새 조율방 생성</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">방 이름</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="예: 큐브 스터디 그룹"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">최대 멤버 수</label>
            <input
              type="number"
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={maxMembers}
              onChange={(e) => setMaxMembers(Number(e.target.value))}
              min="2"
              max="50"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">취소</button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">생성</button>
        </div>
      </div>
    </div>
  );
};

export default RoomCreationModal;
