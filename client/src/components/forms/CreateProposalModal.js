import React, { useState, useCallback } from 'react';
import { X, UserPlus } from 'lucide-react';
import CustomAlertModal from '../modals/CustomAlertModal';

const ParticipantChip = ({ name, onRemove }) => (
   <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center">
      {name}
      <button onClick={onRemove} className="ml-1 text-blue-500 hover:text-blue-700"><X size={14} /></button>
   </div>
);

const CreateProposalModal = ({ onClose, onProposalCreated }) => {
   const [title, setTitle] = useState('');
   const [description, setDescription] = useState('');
   const [duration, setDuration] = useState('60');
   const [preferredTimeRangesInput, setPreferredTimeRangesInput] = useState([{ startDate: '', endDate: '', startTime: '', endTime: '' }]);
   const [priority, setPriority] = useState('3');
   const [participants, setParticipants] = useState([]);
   const [externalParticipants, setExternalParticipants] = useState('');
   const [searchQuery, setSearchQuery] = useState('');
   const [searchResults, setSearchResults] = useState([]);

   // CustomAlert 상태
   const [alertModal, setAlertModal] = useState({
     isOpen: false,
     title: '',
     message: '',
     type: 'info',
     showCancel: false,
     onConfirm: null
   });

   // Alert 표시 유틸리티 함수
   const showAlert = useCallback((message, type = 'info', title = '', showCancel = false, onConfirm = null) => {
     setAlertModal({
       isOpen: true,
       title,
       message,
       type,
       showCancel,
       onConfirm
     });
   }, []);

   // Alert 닫기 함수
   const closeAlert = useCallback(() => {
     setAlertModal(prev => ({ ...prev, isOpen: false }));
   }, []);

   const dummyUsers = [
      { id: '60d5ec49a4d2a13e4c8b4567', name: '김철수', email: 'kim@example.com' },
      { id: '60d5ec49a4d2a13e4c8b4568', name: '이영희', email: 'lee@example.com' },
      { id: '60d5ec49a4d2a13e4c8b4569', name: '박민수', email: 'park@example.com' },
   ];

   const handleSearchChange = e => {
      const query = e.target.value;
      setSearchQuery(query);
      if (query.length > 0) {
         const filteredUsers = dummyUsers.filter(user => user.name.includes(query) || user.email.includes(query));
         setSearchResults(filteredUsers);
      } else {
         setSearchResults([]);
      }
   };

   const handleAddParticipant = user => {
      if (!participants.some(p => p.id === user.id)) {
         setParticipants([...participants, user]);
         setSearchQuery('');
         setSearchResults([]);
      }
   };

   const handleRemoveParticipant = id => setParticipants(participants.filter(p => p.id !== id));
   const handleAddTimeRange = () => setPreferredTimeRangesInput([...preferredTimeRangesInput, { startDate: '', endDate: '', startTime: '', endTime: '' }]);
   const handleRemoveTimeRange = index => setPreferredTimeRangesInput(preferredTimeRangesInput.filter((_, i) => i !== index));
   const handleTimeRangeChange = (index, field, value) => {
      const newRanges = [...preferredTimeRangesInput];
      newRanges[index][field] = value;
      setPreferredTimeRangesInput(newRanges);
   };

   const handleSubmit = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
         showAlert('로그인이 필요합니다.', 'warning', '로그인 필요', false, () => onClose());
         return;
      }
      const proposalData = {
         title, description, duration: parseInt(duration),
         preferredTimeRanges: preferredTimeRangesInput.map(range => range.startDate && range.endDate && range.startTime && range.endTime ? { start: new Date(`${range.startDate}T${range.startTime}:00`).toISOString(), end: new Date(`${range.endDate}T${range.endTime}:00`).toISOString() } : null).filter(Boolean),
         participants: participants.map(p => p.id),
         externalParticipants: externalParticipants.split(',').map(email => ({ email: email.trim() })).filter(p => p.email),
         priority: parseInt(priority),
      };
      try {
         const response = await fetch('http://localhost:5000/api/proposals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
            body: JSON.stringify(proposalData),
         });
         if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Failed to create proposal');
         }
         const data = await response.json();
         showAlert('일정 조율 요청이 성공적으로 생성되었습니다!', 'success', '생성 완료', false, () => {
           onProposalCreated(data);
           onClose();
         });
      } catch (error) {
         console.error('Error creating proposal:', error.message);
         showAlert(`일정 조율 요청 실패: ${error.message}`, 'error', '생성 실패');
      }
   };

   return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
         <div className="bg-white w-11/12 max-w-2xl rounded-lg shadow-xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
               <h2 className="text-xl font-bold text-gray-800">새 일정 조율 요청</h2>
               <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                  <input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="일정 제목" value={title} onChange={e => setTitle(e.target.value)} />
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">설명 (선택)</label>
                  <textarea className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="일정에 대한 설명" rows={3} value={description} onChange={e => setDescription(e.target.value)} />
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">소요 시간</label>
                  <select className="w-full border border-gray-300 rounded-md px-3 py-2" value={duration} onChange={e => setDuration(e.target.value)}>
                     <option value="15">15분</option>
                     <option value="30">30분</option>
                     <option value="60">1시간</option>
                     <option value="90">1시간 30분</option>
                     <option value="120">2시간</option>
                  </select>
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">선호 시간 범위</label>
                  {preferredTimeRangesInput.map((range, index) => (
                     <div key={index} className="flex flex-col sm:flex-row items-center mb-2 space-y-2 sm:space-y-0 sm:space-x-2">
                        <input type="date" className="w-full border border-gray-300 rounded-md px-3 py-2" value={range.startDate} onChange={e => handleTimeRangeChange(index, 'startDate', e.target.value)} />
                        <input type="time" className="w-full border border-gray-300 rounded-md px-3 py-2" value={range.startTime} onChange={e => handleTimeRangeChange(index, 'startTime', e.target.value)} />
                        <span className="hidden sm:block">~</span>
                        <input type="date" className="w-full border border-gray-300 rounded-md px-3 py-2" value={range.endDate} onChange={e => handleTimeRangeChange(index, 'endDate', e.target.value)} />
                        <input type="time" className="w-full border border-gray-300 rounded-md px-3 py-2" value={range.endTime} onChange={e => handleTimeRangeChange(index, 'endTime', e.target.value)} />
                        {preferredTimeRangesInput.length > 1 && <button type="button" onClick={() => handleRemoveTimeRange(index)} className="p-2 text-red-500 hover:text-red-700"><X size={18} /></button>}
                     </div>
                  ))}
                  <button type="button" onClick={handleAddTimeRange} className="text-blue-500 text-sm hover:underline">+ 시간 범위 추가</button>
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">우선순위</label>
                  <select className="w-full border border-gray-300 rounded-md px-3 py-2" value={priority} onChange={e => setPriority(e.target.value)}>
                     <option value="1">1 - 매우 낮음</option>
                     <option value="2">2 - 낮음</option>
                     <option value="3">3 - 보통</option>
                     <option value="4">4 - 높음</option>
                     <option value="5">5 - 매우 높음</option>
                  </select>
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">내부 참가자</label>
                  <div className="flex items-center">
                     <input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="이름 또는 이메일로 검색" value={searchQuery} onChange={e => handleSearchChange(e)} />
                     <button className="ml-2 p-2 border border-gray-300 rounded-md" onClick={() => handleAddParticipant({ id: 'dummyId' + Math.random(), name: searchQuery })}><UserPlus size={18} /></button>
                  </div>
                  {searchResults.length > 0 && searchQuery && (
                     <div className="mt-2 border border-gray-200 rounded-md bg-white shadow-lg max-h-40 overflow-y-auto">
                        {searchResults.map(user => (
                           <div key={user.id} className="p-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center" onClick={() => handleAddParticipant(user)}>
                              <span>{user.name} ({user.email})</span>
                              <UserPlus size={16} className="text-blue-500" />
                           </div>
                        ))}
                     </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                     {participants.map(p => <ParticipantChip key={p.id} name={p.name} onRemove={() => handleRemoveParticipant(p.id)} />)}
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">외부 참가자 (이메일, 쉼표로 구분)</label>
                  <textarea className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="external1@example.com, external2@example.com" rows={2} value={externalParticipants} onChange={e => setExternalParticipants(e.target.value)} />
               </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
               <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">취소</button>
               <button onClick={handleSubmit} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">조율 요청 생성</button>
            </div>
         </div>
         
         <CustomAlertModal
           isOpen={alertModal.isOpen}
           onClose={closeAlert}
           onConfirm={alertModal.onConfirm}
           title={alertModal.title}
           message={alertModal.message}
           type={alertModal.type}
           showCancel={alertModal.showCancel}
         />
      </div>
   );
};

export default CreateProposalModal;