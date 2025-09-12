import React, { useState } from 'react';
import { X } from 'lucide-react';
import CustomAlertModal from '../modals/CustomAlertModal';

const EventFormModal = ({ onClose, onSubmitEvent, event }) => {
   const [title, setTitle] = useState(event ? event.title : '');
   const [date, setDate] = useState(event ? event.date : '');
   const [time, setTime] = useState(event ? event.time : '');
   const [color, setColor] = useState(event ? event.color : 'blue');

   // CustomAlert 상태
   const [customAlert, setCustomAlert] = useState({ show: false, message: '' });
   const showAlert = (message) => setCustomAlert({ show: true, message });
   const closeAlert = () => setCustomAlert({ show: false, message: '' });

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

         {/* CustomAlert Modal */}
         <CustomAlertModal
           show={customAlert.show}
           onClose={closeAlert}
           message={customAlert.message}
         />
      </div>
   );
};

export default EventFormModal;