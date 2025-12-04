/**
 * ===================================================================================================
 * AssignSlotModal.js - 조율 시간표의 빈 슬롯에 조원을 배정하기 위한 모달
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/AssignSlotModal.js
 *
 * 🎯 주요 기능:
 *    - 특정 시간대(예: 월요일 10:00)에 배정할 조원을 선택하는 UI 제공.
 *    - 드롭다운 메뉴를 통해 해당 조율방에 속한 조원 목록을 표시.
 *    - '배정' 버튼 클릭 시, 선택된 조원의 ID를 부모 컴포넌트로 전달.
 *
 * 🔗 연결된 파일:
 *    - ./CoordinationTab.js (추정) - 이 모달을 열고 `onAssign` 콜백을 통해 배정 로직을 처리하는 부모 컴포넌트.
 *    - ./CustomAlertModal.js - 조원을 선택하지 않고 배정을 시도할 경우 경고 메시지를 표시.
 *
 * 💡 UI 위치:
 *    - '일정 맞추기' 탭의 조율 시간표에서, 배정되지 않은 빈 슬롯을 클릭했을 때 나타나는 팝업 모달.
 *
 * ✏️ 수정 가이드:
 *    - 조원 목록을 표시하는 방식을 드롭다운이 아닌 다른 형태로 변경하려면 `select` 태그 부분을 수정합니다.
 *    - 배정 버튼 클릭 시 수행되는 유효성 검사를 변경하려면 `handleSubmit` 함수를 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 컴포넌트는 UI와 최소한의 상태(선택된 조원 ID)만 관리하며, 실제 배정 로직은 `onAssign` prop을 통해 부모 컴포넌트에 위임합니다.
 *
 * ===================================================================================================
 */
import React, { useState } from 'react';
import { X } from 'lucide-react';
import CustomAlertModal from './CustomAlertModal';

/**
 * AssignSlotModal
 * @description 특정 시간 슬롯에 조원을 배정하기 위한 인터페이스를 제공하는 모달 컴포넌트.
 * @param {object} props - 컴포넌트 props
 * @param {function} props.onClose - 모달을 닫는 함수.
 * @param {function} props.onAssign - '배정' 버튼 클릭 시 선택된 조원 ID와 함께 호출되는 콜백 함수.
 * @param {object} props.slotInfo - 배정할 슬롯의 정보 (요일 인덱스, 시간 등).
 * @param {Array} props.members - 드롭다운에 표시될 조원 목록.
 * @returns {JSX.Element}
 */
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
