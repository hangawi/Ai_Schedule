/**
 * ===================================================================================================
 * EditEventModal.js - 기존 Google 캘린더 일정을 수정하기 위한 모달
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/EditEventModal.js
 *
 * 🎯 주요 기능:
 *    - 기존 일정의 상세 정보(제목, 설명, 시간 등)를 미리 채워진 폼으로 제공.
 *    - 사용자가 일정 정보를 수정하고 '저장' 버튼을 통해 서버에 변경 사항을 업데이트.
 *    - `moment.js`를 사용하여 날짜 및 시간 데이터 파싱 및 포맷팅.
 *    - 종료 시간이 시작 시간보다 늦도록 하는 유효성 검사 수행.
 *    - Google Calendar API의 동시성 제어를 위해 `etag`를 함께 전송.
 *
 * 🔗 연결된 파일:
 *    - ../../SchedulingSystem.js (추정) - '나의 일정' 탭 등에서 '수정' 버튼 클릭 시 이 모달을 호출.
 *    - ../../config/firebaseConfig.js - API 요청 시 사용자 인증 토큰을 얻기 위해 사용.
 *    - ./CustomAlertModal.js - 유효성 검사 실패 또는 API 오류 시 알림 표시.
 *
 * 💡 UI 위치:
 *    - '나의 일정' 또는 'Google 캘린더' 탭에서 특정 일정을 수정하려고 할 때 나타나는 팝업 모달.
 *
 * ✏️ 수정 가이드:
 *    - 수정 가능한 필드를 변경하려면(예: 날짜도 수정 가능하게) JSX 내의 `readOnly` 속성을 제거하고 관련 상태 관리 로직을 추가해야 합니다.
 *    - API 요청 시 보내는 데이터를 변경하려면 `handleSubmit` 함수 내 `body` 부분을 수정합니다.
 *
 * 📝 참고사항:
 *    - 현재 구현에서는 날짜(date) 필드는 `readOnly`로 설정되어 있어 시간만 변경 가능합니다.
 *    - `PUT` 메소드를 사용하여 `/api/calendar/events/${event.id}` 엔드포인트로 요청을 보냅니다.
 *
 * ===================================================================================================
 */
import React, { useState } from 'react';
import moment from 'moment';
import CustomAlertModal from './CustomAlertModal';
import { auth } from '../../config/firebaseConfig';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

/**
 * EditEventModal
 * @description 기존에 생성된 일정을 수정하기 위한 폼을 담고 있는 모달 컴포넌트.
 * @param {object} props - 컴포넌트 props
 * @param {object} props.event - 수정할 이벤트의 원본 데이터 객체.
 * @param {function} props.onClose - 모달을 닫는 함수.
 * @param {function} props.onUpdateEvent - 이벤트가 성공적으로 업데이트되었을 때 호출되는 콜백.
 * @returns {JSX.Element}
 */
const EditEventModal = ({ event, onClose, onUpdateEvent }) => {
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description || '');
  const [startDate] = useState(moment(event.start).format('YYYY-MM-DD'));
  const [startTime, setStartTime] = useState(moment(event.start).format('HH:mm:ss'));
  const [endDate] = useState(moment(event.end).format('YYYY-MM-DD'));
  const [endTime, setEndTime] = useState(moment(event.end).format('HH:mm:ss'));

  // CustomAlert 상태
  const [customAlert, setCustomAlert] = useState({ show: false, message: '' });
  const showAlert = (message) => setCustomAlert({ show: true, message });
  const closeAlert = () => setCustomAlert({ show: false, message: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const startMoment = moment(`${startDate}T${startTime}`);
    const endMoment = moment(`${endDate}T${endTime}`);

    if (endMoment.isSameOrBefore(startMoment)) {
      showAlert('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        showAlert('인증이 필요합니다.');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/calendar/events/${event.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await currentUser.getIdToken()}`,
        },
        body: JSON.stringify({
          title,
          description,
          startDateTime: startMoment.toISOString(),
          endDateTime: endMoment.toISOString(),
          etag: event.etag,
        }),
      });

      if (!response.ok) {
        throw new Error('일정 업데이트에 실패했습니다.');
      }

      const updatedEvent = await response.json();
      onUpdateEvent(updatedEvent);
      onClose();
    } catch (error) {
      // Error updating event - silently handle error
      showAlert('일정 업데이트 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-11/12 max-w-md">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">일정 수정</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="title" className="block text-gray-700 text-sm font-bold mb-2">제목:</label>
            <input
              type="text"
              id="title"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="mb-4">
            <label htmlFor="description" className="block text-gray-700 text-sm font-bold mb-2">설명:</label>
            <textarea
              id="description"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            ></textarea>
          </div>
          <div className="mb-4">
            <label htmlFor="startDate" className="block text-gray-700 text-sm font-bold mb-2">시작 날짜:</label>
            <input
              type="date"
              id="startDate"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-100 cursor-not-allowed"
              value={startDate}
              readOnly
            />
          </div>
          <div className="mb-4">
            <label htmlFor="startTime" className="block text-gray-700 text-sm font-bold mb-2">시작 시간:</label>
            <input
              type="time"
              id="startTime"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          <div className="mb-4">
            <label htmlFor="endDate" className="block text-gray-700 text-sm font-bold mb-2">종료 날짜:</label>
            <input
              type="date"
              id="endDate"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-100 cursor-not-allowed"
              value={endDate}
              readOnly
            />
          </div>
          <div className="mb-4">
            <label htmlFor="endTime" className="block text-gray-700 text-sm font-bold mb-2">종료 시간:</label>
            <input
              type="time"
              id="endTime"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            >
              저장
            </button>
          </div>
        </form>

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

export default EditEventModal;