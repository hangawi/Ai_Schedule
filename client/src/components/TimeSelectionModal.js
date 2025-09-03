import React, { useState } from 'react';
import { X } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const TimeSelectionModal = ({ onClose, proposal, onFinalize }) => {
   const [selectedTimeIndex, setSelectedTimeIndex] = useState(null);

   const handleFinalize = async () => {
      if (selectedTimeIndex === null) {
         alert('시간을 선택해주세요.');
         return;
      }
      const token = localStorage.getItem('token');
      if (!token) {
         alert('로그인이 필요합니다.');
         return;
      }
      const finalTime = proposal.suggestedTimes[selectedTimeIndex].startTime;
      try {
         const response = await fetch(`${API_BASE_URL}/api/proposals/${proposal._id}/finalize`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
            body: JSON.stringify({ finalTime }),
         });
         if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Failed to finalize time');
         }
         const newEvent = await response.json();
         onFinalize(newEvent);
         onClose();
      } catch (error) {
         console.error('Error finalizing time:', error);
         alert(`시간 확정에 실패했습니다: ${error.message}`);
      }
   };

   return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
         <div className="bg-white w-11/12 max-w-md rounded-lg shadow-xl p-6">
            <div className="flex justify-between items-center mb-4">
               <h2 className="text-xl font-bold text-gray-800">일정 시간 확정</h2>
               <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
            </div>
            <p className="text-gray-600 mb-4">
               '<span className="font-semibold">{proposal.title}</span>' 일정에 대한 시간을 확정해주세요.
            </p>
            {proposal.suggestedTimes && proposal.suggestedTimes.length > 0 ? (
               <div className="space-y-3 mb-6">
                  {proposal.suggestedTimes.map((time, index) => (
                     <div key={index} className={`p-3 border rounded-md cursor-pointer ${selectedTimeIndex === index ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`} onClick={() => setSelectedTimeIndex(index)}>
                        <p className="font-medium text-gray-800">{new Date(time.startTime).toLocaleString('ko-KR', { dateStyle: 'full', timeStyle: 'short' })}{' '}-{new Date(time.endTime).toLocaleString('ko-KR', { timeStyle: 'short' })}</p>
                        {time.score !== undefined && (
                           <div className="flex items-center mt-1">
                              <span className="text-sm font-semibold mr-2" style={{ color: time.score >= 90 ? '#22C55E' : time.score >= 70 ? '#F59E0B' : '#EF4444' }}>{time.score}</span>
                              <span className="text-xs text-gray-500">{time.description}</span>
                           </div>
                        )}
                     </div>
                  ))}
               </div>
            ) : (
               <p className="text-gray-500 mb-6">제안된 시간이 없습니다.</p>
            )}
            <div className="flex justify-end space-x-3">
               <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">취소</button>
               <button onClick={handleFinalize} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600" disabled={proposal.suggestedTimes.length === 0 || selectedTimeIndex === null}>시간 확정</button>
            </div>
         </div>
      </div>
   );
};

export default TimeSelectionModal;