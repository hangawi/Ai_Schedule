/**
 * ===================================================================================================
 * TimeSelectionModal.js - 제안된 시간 중 하나를 선택하여 최종 확정하는 모달 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/forms
 *
 * 🎯 주요 기능:
 *    - 서버로부터 제안된 여러 시간 옵션을 목록으로 표시
 *    - 각 시간 옵션의 점수와 설명을 함께 제공
 *    - 사용자가 최종 시간을 선택하고 '시간 확정' 버튼으로 제출하는 기능
 *    - 선택된 시간 정보를 서버로 전송하여 최종 이벤트를 생성
 *
 * 🔗 연결된 파일:
 *    - ../modals/CustomAlertModal - 유효성 검사 실패 또는 API 오류 시 경고 메시지 표시
 *    - ../../config/firebaseConfig - 사용자 인증 정보 확인을 위해 사용
 *
 * 💡 UI 위치:
 *    - 'Proposals' 탭에서 '시간 선택' 버튼을 클릭했을 때 표시됨
 *
 * ✏️ 수정 가이드:
 *    - 제안된 시간 옵션의 UI 변경: `proposal.suggestedTimes.map(...)` 내부의 JSX 구조 수정
 *    - 시간 확정 API 엔드포인트 변경: `fetch` 함수의 URL 주소 수정
 *    - 최종 확정 시 서버로 보내는 데이터 변경: `fetch` 함수의 body 데이터 구조 수정
 *
 * 📝 참고사항:
 *    - 사용자는 제안된 시간 중 하나를 반드시 선택해야 '시간 확정' 버튼이 활성화됩니다.
 *    - API 요청 시 Firebase 인증 토큰을 헤더에 포함시켜 전송합니다.
 *    - 시간 확정이 성공하면 `onFinalize` 콜백을 통해 생성된 최종 이벤트 정보를 부모 컴포넌트에 전달합니다.
 *
 * ===================================================================================================
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import CustomAlertModal from '../modals/CustomAlertModal';
import { auth } from '../../config/firebaseConfig';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

/**
 * TimeSelectionModal
 *
 * @description 제안된 여러 시간 옵션 중 하나를 선택하여 최종 일정을 확정하는 모달 컴포넌트입니다.
 * @param {Object} props - 컴포넌트 프롭스
 * @param {Function} props.onClose - 모달을 닫는 함수
 * @param {Object} props.proposal - 시간 옵션을 포함한 제안 데이터
 * @param {Function} props.onFinalize - 시간 확정이 완료되었을 때 호출될 콜백 함수. 생성된 이벤트 객체를 인자로 받습니다.
 * @returns {JSX.Element} 시간 선택 및 확정 모달 UI
 *
 * @example
 * <TimeSelectionModal
 *   onClose={() => setModalOpen(false)}
 *   proposal={selectedProposal}
 *   onFinalize={(newEvent) => console.log('Event created:', newEvent)}
 * />
 */
const TimeSelectionModal = ({ onClose, proposal, onFinalize }) => {
   const [selectedTimeIndex, setSelectedTimeIndex] = useState(null);
   const [customAlert, setCustomAlert] = useState({ show: false, message: '' });

   const showAlert = (message) => setCustomAlert({ show: true, message });
   const closeAlert = () => setCustomAlert({ show: false, message: '' });

   const handleFinalize = async () => {
      if (selectedTimeIndex === null) {
         showAlert('시간을 선택해주세요.');
         return;
      }

      const currentUser = auth.currentUser;
      if (!currentUser) {
         showAlert('로그인이 필요합니다.');
         return;
      }

      const finalTime = proposal.suggestedTimes[selectedTimeIndex].startTime;
      try {
         const response = await fetch(`${API_BASE_URL}/api/proposals/${proposal._id}/finalize`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await currentUser.getIdToken()}` },
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
         showAlert(`시간 확정에 실패했습니다: ${error.message}`);
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
               <button onClick={handleFinalize} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600" disabled={!proposal.suggestedTimes || proposal.suggestedTimes.length === 0 || selectedTimeIndex === null}>시간 확정</button>
            </div>
         </div>

         <CustomAlertModal
           isOpen={customAlert.show}
           onClose={closeAlert}
           message={customAlert.message}
           type="warning"
         />
      </div>
   );
};

export default TimeSelectionModal;
