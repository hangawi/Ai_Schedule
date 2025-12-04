/**
 * ===================================================================================================
 * AutoDetectedScheduleModal.js - AI가 음성/텍스트에서 자동 감지한 일정 확인 모달
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/AutoDetectedScheduleModal.js
 *
 * 🎯 주요 기능:
 *    - 백그라운드 음성 모니터링 또는 클립보드 분석을 통해 AI가 감지한 일정 후보들을 사용자에게 제시.
 *    - 각 일정 카드를 통해 제목, 날짜, 시간, 참여자, 장소 등 상세 정보 표시.
 *    - AI의 예측 신뢰도(confidence)를 '높음', '보통', '낮음' 등급과 색상으로 시각화.
 *    - 사용자는 각 일정을 '일정 추가' 하거나 '무시'할 수 있음.
 *    - '일정 추가' 시, 실수를 방지하기 위해 요약 정보를 보여주는 2단계 확인 절차를 거침.
 *    - 전체 대화 내용을 펼쳐볼 수 있는 기능 제공하여 사용자가 맥락을 파악할 수 있도록 지원.
 *
 * 🔗 연결된 파일:
 *    - ../../hooks/useIntegratedVoiceSystem.js - 이 모달을 띄우고, 감지된 일정 데이터를 전달하는 주체.
 *    - ./SchedulingSystem.js - 최종적으로 이 모달을 렌더링하는 최상위 컴포넌트 중 하나.
 *
 * 💡 UI 위치:
 *    - 통화 종료 후 또는 클립보드에서 일정이 감지되었을 때 자동으로 화면 중앙에 나타나는 팝업 모달.
 *
 * ✏️ 수정 가이드:
 *    - AI 신뢰도에 따른 색상이나 텍스트를 변경하려면 `getConfidenceColor`, `getConfidenceText` 함수를 수정합니다.
 *    - 2단계 확인 절차에서 보여주는 요약 정보의 형식을 변경하려면 `generateScheduleSummary` 함수를 수정합니다.
 *    - 카드 레이아웃이나 상세 정보 표시 방식을 변경하려면 JSX의 '일정 목록' 부분을 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 모달은 사용자가 AI의 제안을 검토하고 최종 결정을 내리는 중요한 상호작용 지점입니다.
 *    - 클릭 이벤트 전파를 막기 위해 `e.stopPropagation()`이 사용된 부분이 있습니다.
 *
 * ===================================================================================================
 */
import React, { useState } from 'react';
import { Calendar, Clock, Users, MapPin, CheckCircle, XCircle, Brain, Volume2, FileText } from 'lucide-react';

/**
 * AutoDetectedScheduleModal
 * @description AI가 감지한 일정 목록을 보여주고, 사용자가 이를 확정하거나 무시할 수 있도록 하는 모달 컴포넌트.
 * @param {object} props - 컴포넌트 props
 * @param {Array<object>} props.detectedSchedules - AI가 감지한 일정 객체들의 배열.
 * @param {function} props.onConfirm - 사용자가 특정 일정을 확정했을 때 호출되는 콜백 함수.
 * @param {function} props.onDismiss - 사용자가 특정 일정을 무시했을 때 호출되는 콜백 함수.
 * @param {function} props.onClose - 모달 전체를 닫을 때 호출되는 함수.
 * @param {string} props.backgroundTranscript - 일정이 감지된 전체 대화 내용.
 * @param {number} props.callStartTime - 통화 또는 모니터링이 시작된 시간의 타임스탬프.
 * @returns {JSX.Element|null} 감지된 일정이 있을 경우에만 모달을 렌더링.
 */
const AutoDetectedScheduleModal = ({ 
   detectedSchedules, 
   onConfirm, 
   onDismiss, 
   onClose,
   backgroundTranscript,
   callStartTime
}) => {
   const [selectedSchedule, setSelectedSchedule] = useState(null);
   const [showConfirmDialog, setShowConfirmDialog] = useState(null);

   if (!detectedSchedules || detectedSchedules.length === 0) return null;

   const formatDate = (dateStr) => {
      if (!dateStr) return '날짜 미정';
      const date = new Date(dateStr);
      return date.toLocaleDateString('ko-KR', { 
         year: 'numeric', 
         month: 'long', 
         day: 'numeric',
         weekday: 'short'
      });
   };

   const formatTime = (timeStr) => {
      if (!timeStr) return '시간 미정';
      return timeStr;
   };

   const getConfidenceColor = (confidence) => {
      if (confidence >= 0.8) return 'text-green-600 bg-green-50 border-green-200';
      if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      return 'text-red-600 bg-red-50 border-red-200';
   };

   const getConfidenceText = (confidence) => {
      if (confidence >= 0.8) return '높음';
      if (confidence >= 0.6) return '보통';
      return '낮음';
   };

   const getCallDuration = () => {
      if (!callStartTime) return '';
      const duration = Math.floor((Date.now() - callStartTime) / 1000);
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      return `${minutes}분 ${seconds}초`;
   };

   const handleConfirmClick = (schedule) => {
      setShowConfirmDialog(schedule);
   };

   const handleFinalConfirm = () => {
      if (showConfirmDialog) {
         onConfirm(showConfirmDialog);
         setShowConfirmDialog(null);
      }
   };

   const generateScheduleSummary = (schedule) => {
      const parts = [];
      
      if (schedule.title) parts.push(`📅 ${schedule.title}`);
      if (schedule.date) parts.push(`📆 ${formatDate(schedule.date)}`);
      if (schedule.time) parts.push(`🕐 ${schedule.time}`);
      if (schedule.location) parts.push(`📍 ${schedule.location}`);
      if (schedule.participants && schedule.participants.length > 0) {
         parts.push(`👥 ${schedule.participants.join(', ')}`);
      }
      
      return parts.join('\n');
   };

   return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
         <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto animate-in fade-in duration-300">
            {/* 헤더 */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg">
               <div className="flex items-center">
                  <Brain className="w-6 h-6 text-purple-600 mr-2" />
                  <div>
                     <h2 className="text-xl font-bold text-gray-900">AI가 일정을 감지했습니다</h2>
                     <p className="text-sm text-gray-500 flex items-center">
                        <Volume2 size={14} className="mr-1" />
                        {callStartTime ? `통화 시간: ${getCallDuration()}` : '백그라운드 감지'}
                        <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                           {detectedSchedules.length}개 감지
                        </span>
                     </p>
                  </div>
               </div>
            </div>

            {/* 일정 목록 */}
            <div className="p-6 space-y-4">
               {detectedSchedules.map((schedule, index) => (
                  <div
                     key={index}
                     className={`border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer ${
                        selectedSchedule === schedule ? 'border-purple-300 bg-purple-50' : 'border-gray-200'
                     }`}
                     onClick={() => setSelectedSchedule(selectedSchedule === schedule ? null : schedule)}
                  >
                     {/* 일정 헤더 */}
                     <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                           <h3 className="font-semibold text-gray-900 text-lg">
                              {schedule.title || '제목 없음'}
                           </h3>
                           <div className="flex items-center mt-1 space-x-2">
                              <span className="text-sm text-gray-500">AI 신뢰도:</span>
                              <span className={`text-xs px-2 py-1 rounded-full font-medium border ${getConfidenceColor(schedule.confidence)}`}>
                                 {getConfidenceText(schedule.confidence)} ({Math.round(schedule.confidence * 100)}%)
                              </span>
                              {schedule.category && (
                                 <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                                    {schedule.category}
                                 </span>
                              )}
                           </div>
                        </div>
                     </div>

                     {/* 일정 정보 그리드 */}
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                        <div className="flex items-center text-gray-600">
                           <Calendar size={16} className="mr-2 text-purple-500" />
                           <span className="text-sm">{formatDate(schedule.date)}</span>
                        </div>
                        
                        <div className="flex items-center text-gray-600">
                           <Clock size={16} className="mr-2 text-purple-500" />
                           <span className="text-sm">{formatTime(schedule.time)}</span>
                        </div>
                        
                        {schedule.participants && schedule.participants.length > 0 && (
                           <div className="flex items-center text-gray-600">
                              <Users size={16} className="mr-2 text-purple-500" />
                              <span className="text-sm">{schedule.participants.join(', ')}</span>
                           </div>
                        )}
                        
                        {schedule.location && (
                           <div className="flex items-center text-gray-600">
                              <MapPin size={16} className="mr-2 text-purple-500" />
                              <span className="text-sm">{schedule.location}</span>
                           </div>
                        )}
                     </div>

                     {/* 설명 */}
                     {schedule.description && (
                        <div className="mb-4">
                           <p className="text-sm text-gray-700">
                              <strong>설명:</strong> {schedule.description}
                           </p>
                        </div>
                     )}

                     {/* 원본 대화 (선택된 경우에만 표시) */}
                     {selectedSchedule === schedule && (
                        <div className="bg-gray-50 rounded-md p-3 mb-4">
                           <p className="text-xs text-gray-500 mb-2">감지된 대화 내용:</p>
                           <p className="text-sm text-gray-700 italic">
                              "{schedule.originalText}"
                           </p>
                        </div>
                     )}

                     {/* 액션 버튼 */}
                     <div className="flex space-x-3">
                        <button
                           onClick={(e) => {
                              e.stopPropagation();
                              handleConfirmClick(schedule);
                           }}
                           className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors flex items-center justify-center"
                           disabled={!schedule.title}
                        >
                           <CheckCircle size={16} className="mr-2" />
                           일정 추가하시겠습니까?
                        </button>
                        <button
                           onClick={(e) => {
                              e.stopPropagation();
                              onDismiss(schedule);
                           }}
                           className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors flex items-center justify-center"
                        >
                           <XCircle size={16} className="mr-2" />
                           무시
                        </button>
                     </div>
                  </div>
               ))}
            </div>

            {/* 전체 대화 내용 (접을 수 있는 섹션) */}
            {backgroundTranscript && (
               <div className="border-t border-gray-200 p-6">
                  <details className="group">
                     <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center">
                        <Volume2 size={16} className="mr-2" />
                        전체 대화 내용 보기
                        <span className="ml-2 text-xs text-gray-500">
                           ({Math.round(backgroundTranscript.length / 50)}초 분량)
                        </span>
                     </summary>
                     <div className="mt-3 p-3 bg-gray-50 rounded-md max-h-40 overflow-y-auto">
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">
                           {backgroundTranscript}
                        </p>
                     </div>
                  </details>
               </div>
            )}

            
         </div>

         {/* 확인 다이얼로그 */}
         {showConfirmDialog && (
            <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-10">
               <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 animate-in zoom-in duration-200">
                  <div className="p-6">
                     {/* 다이얼로그 헤더 */}
                     <div className="flex items-center mb-4">
                        <FileText className="w-6 h-6 text-blue-600 mr-3" />
                        <h3 className="text-lg font-semibold text-gray-900">
                           일정을 추가하시겠습니까?
                        </h3>
                     </div>

                     {/* 일정 요약 */}
                     <div className="bg-blue-50 rounded-lg p-4 mb-6">
                        <h4 className="font-medium text-blue-900 mb-2">감지된 일정 요약:</h4>
                        <div className="text-sm text-blue-800 whitespace-pre-line leading-relaxed">
                           {generateScheduleSummary(showConfirmDialog)}
                        </div>
                        
                        {/* 신뢰도 표시 */}
                        <div className="mt-3 pt-3 border-t border-blue-200">
                           <span className="text-xs text-blue-700">
                              AI 신뢰도: <span className="font-semibold">
                                 {Math.round(showConfirmDialog.confidence * 100)}%
                              </span>
                           </span>
                        </div>
                     </div>

                     {/* 원본 대화 미리보기 */}
                     {showConfirmDialog.originalText && (
                        <div className="bg-gray-50 rounded-lg p-3 mb-6">
                           <p className="text-xs text-gray-500 mb-2">원본 대화:</p>
                           <p className="text-sm text-gray-700 italic line-clamp-3">
                              "{showConfirmDialog.originalText}"
                           </p>
                        </div>
                     )}

                     {/* 액션 버튼 */}
                     <div className="flex space-x-3">
                        <button
                           onClick={() => setShowConfirmDialog(null)}
                           className="flex-1 px-4 py-3 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                        >
                           취소
                        </button>
                        <button
                           onClick={handleFinalConfirm}
                           className="flex-1 px-4 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                           네, 추가하겠습니다
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};

export default AutoDetectedScheduleModal;