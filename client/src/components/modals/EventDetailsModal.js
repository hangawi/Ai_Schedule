/**
 * ===================================================================================================
 * EventDetailsModal.js - 캘린더 이벤트의 상세 정보를 보여주는 모달
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/EventDetailsModal.js
 *
 * 🎯 주요 기능:
 *    - 사용자가 캘린더에서 선택한 이벤트의 상세 정보(제목, 시작/종료 시간, 설명)를 표시.
 *    - '확인', '수정', '삭제' 버튼을 제공하여 사용자가 다음 행동을 선택할 수 있도록 함.
 *    - `moment.js`를 사용하여 날짜와 시간을 사용자 친화적인 형식으로 포맷.
 *
 * 🔗 연결된 파일:
 *    - ../calendar/Calendar.js (추정) - 캘린더에서 이벤트를 클릭했을 때 이 모달을 호출.
 *    - ../../SchedulingSystem.js (추정) - '수정', '삭제' 로직을 처리하는 콜백 함수를 전달.
 *
 * 💡 UI 위치:
 *    - 'Google 캘린더' 또는 '나의 일정' 탭에서 특정 이벤트를 클릭했을 때 나타나는 팝업 모달.
 *
 * ✏️ 수정 가이드:
 *    - 이벤트 상세 정보에 새로운 필드를 추가하려면 JSX 내에 해당 정보를 표시하는 부분을 추가합니다.
 *    - 날짜/시간 표시 형식을 변경하려면 `formatDateTime` 함수의 `moment().format(...)` 부분을 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 컴포넌트는 정보를 보여주고 사용자 액션을 부모에게 전달하는 단순한 프레젠테이셔널 컴포넌트입니다.
 *    - 실제 수정, 삭제 로직은 `onEdit`, `onDelete` prop을 통해 상위 컴포넌트에서 처리됩니다.
 *
 * ===================================================================================================
 */
import React from 'react';
import moment from 'moment';

/**
 * EventDetailsModal
 * @description 선택된 이벤트의 상세 정보를 보여주고, 수정/삭제/닫기 액션을 위한 버튼을 제공하는 모달.
 * @param {object} props - 컴포넌트 props
 * @param {object} props.event - 표시할 이벤트 데이터 객체.
 * @param {function} props.onClose - 모달을 닫는 함수.
 * @param {function} props.onDelete - '삭제' 버튼 클릭 시 호출되는 콜백 (이벤트 객체를 인자로 받음).
 * @param {function} props.onEdit - '수정' 버튼 클릭 시 호출되는 콜백 (이벤트 객체를 인자로 받음).
 * @returns {JSX.Element|null} `event` prop이 없으면 null을 반환.
 */
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
        {event.description && <p className="text-gray-700 mb-2"><strong>설명:</strong> {event.description}</p>}
        {event.location && <p className="text-gray-700 mb-2"><strong>장소:</strong> {event.location}</p>}
        {(event.participants || event.participantNames) && (
          <div className="mb-4">
            <p className="text-gray-700 mb-1">
              <strong>참가자:</strong> 👥 {event.participants || 0}명{event.totalMembers > 0 && ` / ${event.totalMembers}명`}
            </p>
            {event.participantNames && event.participantNames.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {event.participantNames.map((name, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

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