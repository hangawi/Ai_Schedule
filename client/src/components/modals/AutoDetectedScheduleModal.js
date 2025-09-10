import React, { useState } from 'react';
import { X, Calendar, Clock, Users, MapPin, CheckCircle, XCircle, Brain, Volume2, FileText } from 'lucide-react';

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
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-lg">
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
               <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
               >
                  <X size={24} />
               </button>
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