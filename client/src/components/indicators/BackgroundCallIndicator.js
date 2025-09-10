import React from 'react';
import { Mic, MicOff, Phone, Activity } from 'lucide-react';

const BackgroundCallIndicator = ({ 
   isMonitoring, 
   isCallDetected, 
   callStartTime,
   onToggleMonitoring 
}) => {
   const handleToggle = async () => {
      try {
         await onToggleMonitoring();
      } catch (error) {
         console.error('모니터링 토글 오류:', error);
         alert('모니터링 전환에 실패했습니다. 다시 시도해주세요.');
      }
   };
   const getCallDuration = () => {
      if (!callStartTime) return '';
      const duration = Math.floor((Date.now() - callStartTime) / 1000);
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
   };

   return (
      <div className="flex items-center space-x-2">
         {/* 백그라운드 모니터링 토글 */}
         <button
            onClick={handleToggle}
            className={`flex items-center px-3 py-1 rounded-full text-sm font-medium transition-all ${
               isMonitoring
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            title={isMonitoring ? "백그라운드 모니터링 활성화됨 (클릭하여 비활성화)" : "백그라운드 모니터링 비활성화됨 (클릭하여 활성화)"}
         >
            {isMonitoring ? (
               <Mic size={14} className="mr-1" />
            ) : (
               <MicOff size={14} className="mr-1" />
            )}
            <span className="hidden sm:inline">
               {isMonitoring ? '백그라운드 ON' : '백그라운드 OFF'}
            </span>
         </button>

         {/* 통화 감지 상태 */}
         {isMonitoring && (
            <div className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${
               isCallDetected
                  ? 'bg-red-100 text-red-700 animate-pulse'
                  : 'bg-blue-100 text-blue-700'
            }`}>
               {isCallDetected ? (
                  <>
                     <Phone size={14} className="mr-1" />
                     <span className="hidden sm:inline">통화 중</span>
                     {callStartTime && (
                        <span className="ml-1 font-mono text-xs">
                           {getCallDuration()}
                        </span>
                     )}
                  </>
               ) : (
                  <>
                     <Activity size={14} className="mr-1" />
                     <span className="hidden sm:inline">대기 중</span>
                  </>
               )}
            </div>
         )}
      </div>
   );
};

export default BackgroundCallIndicator;