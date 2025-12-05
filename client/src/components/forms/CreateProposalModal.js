/**
 * ===================================================================================================
 * CreateProposalModal.js - 새 일정 조율 제안을 생성하는 모달 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/forms
 *
 * 🎯 주요 기능:
 *    - 새 일정 조율 제안을 생성하기 위한 폼 제공 (제목, 설명, 소요 시간, 선호 시간 등)
 *    - 내부/외부 참가자 추가 기능
 *    - 폼 데이터 유효성 검사 및 서버 전송
 *    - API 요청 결과(성공/실패)를 사용자에게 알림
 *
 * 🔗 연결된 파일:
 *    - ../modals/CustomAlertModal - API 응답 메시지를 표시하기 위한 커스텀 알림 모달
 *    - ../../config/firebaseConfig - 사용자 인증 정보 확인을 위해 사용
 *
 * 💡 UI 위치:
 *    - 'Proposals' 탭 또는 다른 관련 UI에서 '새 제안 생성' 버튼 클릭 시 표시됨
 *
 * ✏️ 수정 가이드:
 *    - 폼 필드 추가/제거: `useState`를 사용하여 새 상태를 추가하고 JSX에 해당 필드를 렌더링
 *    - 참가자 검색 로직 변경: `handleSearchChange` 함수에서 `dummyUsers` 대신 실제 API를 호출하도록 수정
 *    - 서버 전송 데이터 형식 변경: `handleSubmit` 함수 내 `proposalData` 객체의 구조 수정
 *
 * 📝 참고사항:
 *    - 현재 내부 참가자 검색은 `dummyUsers`라는 더미 데이터를 사용하고 있습니다. 실제 구현 시에는 백엔드 API를 호출해야 합니다.
 *    - `CustomAlertModal`을 사용하여 사용자에게 피드백을 제공합니다. 이는 `showAlert` 유틸리티 함수를 통해 제어됩니다.
 *    - API 요청 시 Firebase 인증 토큰을 헤더에 포함시켜 전송합니다.
 *
 * ===================================================================================================
 */

import React, { useState, useCallback } from 'react';
import { X, UserPlus } from 'lucide-react';
import CustomAlertModal from '../modals/CustomAlertModal';
import { auth } from '../../config/firebaseConfig';

/**
 * ParticipantChip
 * @description 선택된 참가자를 표시하는 작은 칩 UI 컴포넌트
 */
const ParticipantChip = ({ name, onRemove }) => (
   <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center">
      {name}
      <button onClick={onRemove} className="ml-1 text-blue-500 hover:text-blue-700"><X size={14} /></button>
   </div>
);

/**
 * CreateProposalModal
 *
 * @description 새 일정 조율 제안을 생성하는 전체 모달 컴포넌트입니다.
 * @param {Object} props - 컴포넌트 프롭스
 * @param {Function} props.onClose - 모달을 닫는 함수
 * @param {Function} props.onProposalCreated - 제안 생성이 성공적으로 완료되었을 때 호출되는 콜백 함수
 * @returns {JSX.Element} 새 일정 조율 제안 생성 모달 UI
 *
 * @example
 * <CreateProposalModal
 *   onClose={() => setModalOpen(false)}
 *   onProposalCreated={(newProposal) => console.log(newProposal)}
 * />
 */
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
   const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '', type: 'info', showCancel: false, onConfirm: null });

   const showAlert = useCallback((message, type = 'info', title = '', showCancel = false, onConfirm = null) => {
     setAlertModal({ isOpen: true, title, message, type, showCancel, onConfirm });
   }, []);

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
      const currentUser = auth.currentUser;
      if (!currentUser) {
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
         const response = await fetch(`${process.env.REACT_APP_API_URL}/api/proposals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await currentUser.getIdToken()}` },
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
