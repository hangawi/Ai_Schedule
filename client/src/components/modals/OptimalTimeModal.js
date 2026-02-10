import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Calendar, Users, Clock, Check, Plus } from 'lucide-react';
import { auth } from '../../config/firebaseConfig';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const OptimalTimeModal = ({ isOpen, onClose, roomId }) => {
   const [loading, setLoading] = useState(false);
   const [candidates, setCandidates] = useState([]);
   const [totalMembers, setTotalMembers] = useState(0);
   const [error, setError] = useState(null);
   const [creating, setCreating] = useState(null); // 생성 중인 candidate index
   const [titleInput, setTitleInput] = useState({ show: false, idx: null, candidate: null, value: '' });
   const [toast, setToast] = useState(null);

   useEffect(() => {
      if (isOpen && roomId) {
         fetchOptimalTimes();
      }
      if (!isOpen) {
         setCandidates([]);
         setError(null);
         setCreating(null);
      }
   }, [isOpen, roomId]);

   const fetchOptimalTimes = async () => {
      setLoading(true);
      setError(null);
      try {
         const token = await auth.currentUser?.getIdToken();
         if (!token) throw new Error('인증 토큰을 가져올 수 없습니다.');
         const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/find-optimal-time`, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${token}`
            }
         });
         if (!response.ok) throw new Error('API 호출 실패');
         const data = await response.json();

         // 선호시간 없음 또는 겹치는 시간 없음 체크
         if (data.success === false) {
            setError(data.message || '시간표를 만들 수 없습니다.');
            setCandidates([]);
            setTotalMembers(data.totalMembers || 0);
            return;
         }

         setCandidates(data.candidates || []);
         setTotalMembers(data.totalMembers || 0);
      } catch (err) {
         console.error('최적 시간 조회 실패:', err);
         setError('선호시간을 분석할 수 없습니다. 멤버들이 선호시간을 설정했는지 확인해주세요.');
      } finally {
         setLoading(false);
      }
   };

   const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

   const handleCandidateClick = (candidate, idx) => {
      if (creating !== null) return;
      setTitleInput({ show: true, idx, candidate, value: '' });
   };

   const handleCreateSuggestion = async () => {
      const { candidate, idx, value } = titleInput;
      setTitleInput({ show: false, idx: null, candidate: null, value: '' });
      setCreating(idx);
      try {
         const token = await auth.currentUser?.getIdToken();
         if (!token) throw new Error('인증 토큰을 가져올 수 없습니다.');
         const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/create-from-optimal`, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
               dayOfWeek: candidate.dayOfWeek,
               startTime: candidate.startTime,
               endTime: candidate.endTime,
               summary: value || '최적 시간 일정'
            })
         });
         if (!response.ok) throw new Error('일정 생성 실패');
         // 확정된 candidate를 목록에서 즉시 제거
         setCandidates(prev => prev.filter((_, i) => i !== idx));
         window.dispatchEvent(new CustomEvent('calendarUpdate', { detail: { type: 'suggestion_created' } }));
         window.dispatchEvent(new CustomEvent('suggestionUpdate', { detail: { roomId } }));
         showToast('일정이 제안되었습니다!');
      } catch (err) {
         console.error('일정 생성 실패:', err);
         showToast('일정 생성에 실패했습니다.');
      } finally {
         setCreating(null);
      }
   };

   if (!isOpen) return null;

   const modalContent = (
      <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
         <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col" style={{ maxHeight: '80vh' }}>
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
               <div className="flex items-center">
                  <Calendar size={20} className="text-green-500 mr-2" />
                  <h3 className="text-lg font-bold text-gray-800">최적 만남 시간</h3>
               </div>
               <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={20} className="text-gray-500" />
               </button>
            </div>

            {/* 내용 */}
            <div className="flex-1 px-5 py-4" style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', minHeight: 0 }}>
               {loading && (
                  <div className="flex items-center justify-center py-12">
                     <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
                     <span className="ml-3 text-gray-500">선호시간 분석 중...</span>
                  </div>
               )}

               {error && (
                  <div className="text-center py-8">
                     <p className="text-red-500 text-sm">{error}</p>
                  </div>
               )}

               {!loading && !error && candidates.length === 0 && (
                  <div className="text-center py-8">
                     <Calendar size={48} className="mx-auto text-gray-300 mb-3" />
                     <p className="text-gray-500 text-sm">겹치는 선호시간이 없습니다.</p>
                     <p className="text-gray-400 text-xs mt-1">멤버들이 선호시간을 설정했는지 확인해주세요.</p>
                  </div>
               )}

               {!loading && !error && candidates.length > 0 && (
                  <div className="space-y-3">
                     <p className="text-sm text-gray-500 mb-3">
                        총 {totalMembers}명의 멤버 선호시간을 분석했습니다.
                        <br />
                        <span className="text-xs text-gray-400">시간대를 눌러 일정을 제안할 수 있습니다.</span>
                     </p>

                     {candidates.map((c, idx) => (
                        <div
                           key={idx}
                           onClick={() => handleCandidateClick(c, idx)}
                           className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                              c.isAllMembers
                                 ? 'border-green-400 bg-green-50 hover:border-green-500'
                                 : 'border-gray-200 bg-gray-50 hover:border-blue-400'
                           }`}
                        >
                           <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center">
                                 {c.isAllMembers && <Check size={16} className="text-green-500 mr-1" />}
                                 <span className="font-bold text-gray-800 text-lg">{c.dayName}요일</span>
                              </div>
                              <div className="flex items-center gap-2">
                                 <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                                    c.isAllMembers
                                       ? 'bg-green-100 text-green-700'
                                       : 'bg-blue-100 text-blue-700'
                                 }`}>
                                    {c.count}/{c.totalMembers}명
                                 </span>
                                 {creating === idx ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                                 ) : (
                                    <Plus size={18} className="text-gray-400" />
                                 )}
                              </div>
                           </div>

                           <div className="flex items-center text-sm text-gray-600 mb-2">
                              <Clock size={14} className="mr-1" />
                              {c.startTime} ~ {c.endTime}
                           </div>

                           <div className="flex items-center text-xs text-gray-500">
                              <Users size={12} className="mr-1" />
                              {c.memberNames.join(', ')}
                           </div>
                        </div>
                     ))}
                  </div>
               )}
            </div>

            {/* 하단 */}
            <div className="px-5 py-3 border-t border-gray-200">
               <button
                  onClick={onClose}
                  className="w-full py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
               >
                  닫기
               </button>
            </div>
         </div>

         {/* 제목 입력 모달 */}
         {titleInput.show && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
               <div className="bg-white rounded-xl shadow-2xl w-80 mx-4 p-5">
                  <h4 className="text-base font-bold text-gray-800 mb-3">일정 제목</h4>
                  <input
                     type="text"
                     className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
                     value={titleInput.value}
                     onChange={(e) => setTitleInput(prev => ({ ...prev, value: e.target.value }))}
                     placeholder="일정 제목을 입력하세요"
                     autoFocus
                     onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSuggestion(); }}
                  />
                  <div className="flex gap-2">
                     <button
                        onClick={() => setTitleInput({ show: false, idx: null, candidate: null, value: '' })}
                        className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
                     >
                        취소
                     </button>
                     <button
                        onClick={handleCreateSuggestion}
                        className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium"
                     >
                        생성
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* 토스트 */}
         {toast && (
            <div style={{ position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 100001 }}>
               <div className="bg-gray-800 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium whitespace-nowrap">
                  {toast}
               </div>
            </div>
         )}
      </div>
   );

   // Portal로 body에 직접 렌더링 (z-index, overflow 문제 해결)
   return ReactDOM.createPortal(modalContent, document.body);
};

export default OptimalTimeModal;
