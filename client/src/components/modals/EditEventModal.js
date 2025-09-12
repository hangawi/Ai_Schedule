import React, { useState } from 'react';
import moment from 'moment';
import CustomAlertModal from './CustomAlertModal';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

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
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/calendar/events/${event.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
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
      console.error('Error updating event:', error);
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