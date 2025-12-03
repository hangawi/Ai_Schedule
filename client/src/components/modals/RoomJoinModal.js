import React, { useState } from 'react';
import { X } from 'lucide-react';
import CustomAlertModal from './CustomAlertModal';

const RoomJoinModal = ({ onClose, onJoinRoom }) => {
  const [inviteCode, setInviteCode] = useState('');

  // CustomAlert 상태
  const [customAlert, setCustomAlert] = useState({ show: false, message: '' });
  const showAlert = (message) => setCustomAlert({ show: true, message });
  const closeAlert = () => setCustomAlert({ show: false, message: '' });

  const handleSubmit = async () => {
    if (inviteCode.trim() === '') {
      showAlert('초대 코드를 입력해주세요.');
      return;
    }
    try {
      await onJoinRoom(inviteCode);
      onClose();
    } catch (error) {
      showAlert(error.message || '방 참여에 실패했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-11/12 max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">조율방 참여</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">초대 코드</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="초대 코드를 입력하세요"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">취소</button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">참여</button>
        </div>

        {/* CustomAlert Modal */}
        <CustomAlertModal
          show={customAlert.show}
          onClose={closeAlert}
          message={customAlert.message}
        />
      </div>
    </div>
  );
};

export default RoomJoinModal;
