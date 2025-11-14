import React, { useState } from 'react';
import { X } from 'lucide-react';
import CustomAlertModal from './CustomAlertModal';

const AssignSlotModal = ({ onClose, onAssign, slotInfo, members }) => {
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const days = ['월', '화', '수', '목', '금'];

  // CustomAlert 상태
  const [customAlert, setCustomAlert] = useState({ show: false, message: '' });
  const showAlert = (message) => setCustomAlert({ show: true, message });
  const closeAlert = () => setCustomAlert({ show: false, message: '' });

  const handleSubmit = () => {
    if (!selectedMemberId) {
      showAlert('조원을 선택해주세요.');
      return;
    }
    onAssign(selectedMemberId);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-11/12 max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">시간 배정</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <p className="text-gray-700">
            <span className="font-semibold">{days[slotInfo.dayIndex]}요일 {slotInfo.time}</span> 시간을 누구에게 배정하시겠습니까?
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">조원 선택</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
            >
              <option value="">-- 조원을 선택하세요 --</option>
              {members.map(member => (
                <option key={member.user._id || member._id} value={member.user._id || member._id}>
                  {`${member.user.firstName || ''} ${member.user.lastName || ''}`.trim()}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">취소</button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">배정</button>
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

export default AssignSlotModal;
