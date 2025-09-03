import React from 'react';
import moment from 'moment';

const EventDetailsModal = ({ event, onClose, onDelete, onEdit }) => {
  if (!event) return null;

  const formatDateTime = (date) => {
    return moment(date).format('YYYY년 MM월 DD일 HH:mm');
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-11/12 max-w-md">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">{event.title}</h2>
        <p className="text-gray-700 mb-2"><strong>시작:</strong> {formatDateTime(event.start)}</p>
        <p className="text-gray-700 mb-4"><strong>종료:</strong> {formatDateTime(event.end)}</p>
        {event.description && <p className="text-gray-700 mb-4"><strong>설명:</strong> {event.description}</p>}
        
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
          >
            확인
          </button>
          <button
            onClick={() => onEdit(event)}
            className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-50"
          >
            수정
          </button>
          <button
            onClick={() => onDelete(event)}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventDetailsModal;