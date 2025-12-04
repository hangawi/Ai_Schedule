/**
 * ===================================================================================================
 * RoomJoinModal.js - 초대 코드를 사용하여 조율방에 참여하기 위한 모달
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/RoomJoinModal.js
 *
 * 🎯 주요 기능:
 *    - 사용자가 조율방 참여를 위한 초대 코드를 입력할 수 있는 UI를 제공.
 *    - '참여' 버튼 클릭 시 입력된 초대 코드의 유효성을 검사.
 *    - 유효한 코드가 입력되면, `onJoinRoom` 콜백 함수를 호출하여 실제 방 참여 로직을 실행.
 *    - 방 참여 실패 시(예: 잘못된 코드, 방 인원 초과) 에러 메시지를 알림창으로 표시.
 *
 * 🔗 연결된 파일:
 *    - ./CoordinationTab.js (추정) - '방 참여' 버튼 클릭 시 이 모달을 호출하고, `onJoinRoom` 로직을 제공.
 *    - ./CustomAlertModal.js - 입력값 오류 또는 참여 실패 시 알림을 표시하는 데 사용.
 *
 * 💡 UI 위치:
 *    - '일정 맞추기' 탭에서 '방 참여' 버튼을 클릭했을 때 나타나는 팝업 모달.
 *
 * ✏️ 수정 가이드:
 *    - 초대 코드 입력 필드의 유효성 검사 로직을 변경하려면 `handleSubmit` 함수를 수정합니다.
 *    - 모달의 디자인을 변경하려면 이 파일의 JSX 구조를 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 모달은 `onJoinRoom` prop으로 받은 함수가 Promise를 반환하고, 실패 시 에러를 throw할 것을 기대하고 `try...catch` 구문을 사용합니다.
 *
 * ===================================================================================================
 */
import React, { useState } from 'react';
import { X } from 'lucide-react';
import CustomAlertModal from './CustomAlertModal';

/**
 * RoomJoinModal
 * @description 초대 코드를 입력하여 기존 조율방에 참여하기 위한 UI를 제공하는 모달 컴포넌트.
 * @param {object} props - 컴포넌트 props
 * @param {function} props.onClose - 모달을 닫는 함수.
 * @param {function} props.onJoinRoom - '참여' 버튼 클릭 시 호출되는 콜백 함수. 입력된 초대 코드를 인자로 받음.
 * @returns {JSX.Element}
 */
const RoomJoinModal = ({ onClose, onJoinRoom }) => {
  const [inviteCode, setInviteCode] = useState('');

  // CustomAlert 상태
  const [customAlert, setCustomAlert] = useState({ show: false, message: '', title: '' });
  const showAlert = (message, title = '알림') => setCustomAlert({ show: true, message, title });
  const closeAlert = () => setCustomAlert({ show: false, message: '', title: '' });

  const handleSubmit = async () => {
    if (inviteCode.trim() === '') {
      showAlert('초대 코드를 입력해주세요.', '입력 필요');
      return;
    }
    try {
      await onJoinRoom(inviteCode);
      onClose();
    } catch (error) {
      showAlert(error.message || '방 참여에 실패했습니다.', '참여 실패');
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
          isOpen={customAlert.show}
          onClose={closeAlert}
          title={customAlert.title}
          message={customAlert.message}
          type="error"
        />
      </div>
    </div>
  );
};

export default RoomJoinModal;
