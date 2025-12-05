/**
 * ===================================================================================================
 * EventFormModal.js - 간단한 일정 추가/수정 모달 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/forms
 *
 * 🎯 주요 기능:
 *    - 간단한 일정(제목, 날짜, 시간, 색상)을 추가하거나 수정하는 폼을 제공
 *    - '수정 모드'와 '추가 모드'를 구분하여 UI 텍스트(제목, 버튼)를 동적으로 변경
 *    - 폼 제출 시 입력 데이터 유효성 검사
 *    - 유효한 데이터를 부모 컴포넌트의 `onSubmitEvent` 콜백 함수로 전달
 *
 * 🔗 연결된 파일:
 *    - ../modals/CustomAlertModal - 유효성 검사 실패 시 경고 메시지를 표시하기 위해 사용
 *
 * 💡 UI 위치:
 *    - 'Events' 탭에서 '새 이벤트 추가' 버튼을 클릭하거나 기존 이벤트를 클릭했을 때 표시됨
 *
 * ✏️ 수정 가이드:
 *    - 새로운 폼 필드 추가: `useState`로 새 상태를 관리하고 JSX에 해당 필드를 렌더링
 *    - 색상 옵션 변경: `select` 태그 내의 `<option>` 목록 수정
 *    - 유효성 검사 로직 변경: `handleSubmit` 함수 내의 조건문 수정
 *
 * 📝 참고사항:
 *    - `event` prop의 유무에 따라 '수정 모드'와 '추가 모드'가 결정됩니다.
 *    - `onSubmitEvent` 콜백은 비동기 함수일 수 있으며, 컴포넌트는 해당 함수의 완료를 기다립니다.
 *
 * ===================================================================================================
 */

import React, { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import CustomAlertModal from '../modals/CustomAlertModal';

/**
 * EventFormModal
 *
 * @description 간단한 이벤트를 추가하거나 수정하는 폼을 담은 모달 컴포넌트입니다.
 * @param {Object} props - 컴포넌트 프롭스
 * @param {Function} props.onClose - 모달을 닫는 함수
 * @param {Function} props.onSubmitEvent - 폼 제출 시 호출될 콜백 함수. 이벤트 데이터와 (수정 시)이벤트 ID를 인자로 받습니다.
 * @param {Object} [props.event] - 수정할 이벤트 데이터. 이 prop이 있으면 '수정 모드'로 작동합니다.
 * @returns {JSX.Element} 이벤트 폼 모달 UI
 *
 * @example
 * // 새 이벤트 추가
 * <EventFormModal onClose={handleClose} onSubmitEvent={handleCreate} />
 *
 * // 기존 이벤트 수정
 * <EventFormModal onClose={handleClose} onSubmitEvent={handleUpdate} event={existingEvent} />
 */
const EventFormModal = ({ onClose, onSubmitEvent, event }) => {
   const [title, setTitle] = useState(event ? event.title : '');
   const [date, setDate] = useState(event ? event.date : '');
   const [time, setTime] = useState(event ? event.time : '');
   const [color, setColor] = useState(event ? event.color : 'blue');

   const [alertModal, setAlertModal] = useState({ isOpen: false, message: '' });

   const showAlert = useCallback((message) => {
     setAlertModal({ isOpen: true, message });
   }, []);

   const closeAlert = useCallback(() => {
     setAlertModal({ isOpen: false, message: '' });
   }, []);

   const isEditMode = !!event;

   const handleSubmit = async () => {
      if (title && date && time) {
         await onSubmitEvent({ title, date, time, color }, event ? event.id : null);
      } else {
         showAlert('모든 필드를 채워주세요.');
      }
   };

   return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
         <div className="bg-white w-11/12 max-w-md rounded-lg shadow-xl p-6">
            <div className="flex justify-between items-center mb-4">
               <h2 className="text-xl font-bold text-gray-800">{isEditMode ? '일정 수정' : '새 일정 추가'}</h2>
               <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                  <input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" value={title} onChange={e => setTitle(e.target.value)} />
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                  <input type="date" className="w-full border border-gray-300 rounded-md px-3 py-2" value={date} onChange={e => setDate(e.target.value)} />
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">시간</label>
                  <input type="time" className="w-full border border-gray-300 rounded-md px-3 py-2" value={time} onChange={e => setTime(e.target.value)} />
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">색상</label>
                  <select className="w-full border border-gray-300 rounded-md px-3 py-2" value={color} onChange={e => setColor(e.target.value)}>
                     <option value="blue">파랑</option>
                     <option value="purple">보라</option>
                     <option value="green">초록</option>
                     <option value="red">빨강</option>
                  </select>
               </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
               <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">취소</button>
               <button onClick={handleSubmit} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">{isEditMode ? '수정' : '추가'}</button>
            </div>
         </div>

         <CustomAlertModal
           isOpen={alertModal.isOpen}
           onClose={closeAlert}
           message={alertModal.message}
           type="warning"
         />
      </div>
   );
};

export default EventFormModal;
