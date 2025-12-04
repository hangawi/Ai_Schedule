/**
 * ===================================================================================================
 * AddEventModal.js - Google 캘린더에 새 일정을 추가하기 위한 모달 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/AddEventModal.js
 *
 * 🎯 주요 기능:
 *    - '새 일정 추가' 폼을 제공하여 사용자가 제목, 설명, 날짜, 시간 등을 입력.
 *    - 입력값에 대한 유효성 검사 (필수 필드, 시간 순서 등).
 *    - '추가' 버튼 클릭 시, 입력된 정보를 기반으로 Google 캘린더에 일정을 추가하는 API를 호출.
 *    - API 요청 성공 시, 부모 컴포넌트에 새로운 이벤트가 추가되었음을 알림 (`onAddEvent` 콜백).
 *
 * 🔗 연결된 파일:
 *    - ../../config/firebaseConfig.js - API 요청 시 사용자 인증 토큰을 얻기 위해 사용.
 *    - ./CustomAlertModal.js - 유효성 검사 실패 또는 API 오류 시 사용자에게 알림을 표시.
 *
 * 💡 UI 위치:
 *    - 'Google 캘린더' 탭에서 '새 일정 추가' 버튼을 클릭했을 때 나타나는 팝업 모달.
 *
 * ✏️ 수정 가이드:
 *    - Google 캘린더에 전송하는 데이터 형식을 변경하려면 `handleAdd` 함수 내의 `body` 부분을 수정합니다.
 *    - API 엔드포인트가 변경될 경우 `fetch` 요청의 URL을 수정해야 합니다.
 *    - 폼에 새로운 입력 필드를 추가하려면 `useState`를 추가하고 JSX에 해당 input 요소를 추가합니다.
 *
 * 📝 참고사항:
 *    - 이 모달은 `/api/calendar/events/google` 엔드포인트를 호출하며, Google 캘린더 연동 기능에 특화되어 있습니다.
 *    - `moment.js` 라이브러리를 사용하여 날짜 및 시간 데이터를 ISO 형식으로 변환합니다.
 *
 * ===================================================================================================
 */
import React, { useState } from 'react';
import { X } from 'lucide-react';
import moment from 'moment';
import CustomAlertModal from './CustomAlertModal';
import { auth } from '../../config/firebaseConfig';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

/**
 * AddEventModal
 * @description Google 캘린더에 새 일정을 추가하기 위한 폼을 담고 있는 모달 컴포넌트.
 * @param {object} props - 컴포넌트 props
 * @param {function} props.onClose - 모달을 닫는 함수.
 * @param {function} props.onAddEvent - 이벤트가 성공적으로 추가되었을 때 호출되는 콜백 함수.
 * @returns {JSX.Element}
 */
const AddEventModal = ({ onClose, onAddEvent }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // CustomAlert 상태
  const [customAlert, setCustomAlert] = useState({ show: false, message: '' });
  const showAlert = (message) => setCustomAlert({ show: true, message });
  const closeAlert = () => setCustomAlert({ show: false, message: '' });

  const handleAdd = async () => {
    if (title && date && startTime && endTime) {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          showAlert('인증이 필요합니다.');
          return;
        }

        const startMoment = moment(`${date}T${startTime}`);
        const endMoment = moment(`${date}T${endTime}`);

        if (endMoment.isSameOrBefore(startMoment)) {
          showAlert('종료 시간은 시작 시간보다 늦어야 합니다.');
          return;
        }

        const startDateTime = startMoment.toISOString();
        const endDateTime = endMoment.toISOString();

        const response = await fetch(`${API_BASE_URL}/api/calendar/events/google`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await currentUser.getIdToken()}`,
          },
          body: JSON.stringify({ title, description, startDateTime, endDateTime }),
        });

        if (!response.ok) {
          throw new Error('Failed to add event to Google Calendar');
        }

        const data = await response.json();
        onAddEvent(data);
      } catch (error) {
        // Error adding event - silently handle error
        showAlert(`일정 추가 실패: ${error.message}`);
      }
    } else {
      showAlert('제목, 날짜, 시작 시간, 종료 시간을 모두 입력해주세요.');
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <div className="bg-white w-full max-w-md rounded-lg shadow-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">새 일정 추가</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
            <textarea
              className="w-full border border-gray-300 rounded-md px-3 py-2 h-24 resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            ></textarea>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시작 시간</label>
            <input
              type="time"
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">종료 시간</label>
            <input
              type="time"
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            추가
          </button>
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

export default AddEventModal;