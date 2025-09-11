import React from 'react';
import { Mic, MicOff } from 'lucide-react';

const BackgroundCallIndicator = ({ 
   isMonitoring, 
   onToggleMonitoring,
   voiceStatus,
   isAnalyzing
}) => {

   const getStatusInfo = () => {
      if (!isMonitoring) return null;

      if (isAnalyzing || voiceStatus === 'analyzing') {
         return { text: '요약 중...', color: 'text-purple-600' };
      }

      switch (voiceStatus) {
         case 'command':
            return { text: '명령 처리 중...', color: 'text-blue-600' };
         case 'recording':
            return { text: '녹음 중', color: 'text-red-600' };
         case 'ending':
            return { text: '녹음 종료', color: 'text-yellow-600' };
         case 'idle':
         default:
            return { text: '대기 중', color: 'text-green-600' };
      }
   };

   const statusInfo = getStatusInfo();

   return (
      <div className="flex items-center rounded-full bg-gray-100 text-sm font-medium transition-all overflow-hidden border border-gray-200 shadow-sm">
         <button
            onClick={onToggleMonitoring}
            className={`flex items-center pl-3 pr-2 py-1 transition-colors h-full ${
               isMonitoring
                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={isMonitoring ? "백그라운드 모니터링 활성화됨" : "백그라운드 모니터링 비활성화됨"}
         >
            {isMonitoring ? <Mic size={14} className="mr-1.5" /> : <MicOff size={14} className="mr-1.5" />}
            <span className="hidden sm:inline">
               {isMonitoring ? '백그라운드 ON' : '백그라운드 OFF'}
            </span>
         </button>
         
         {statusInfo && (
            <div className={`flex items-center pr-3 pl-2 py-1 bg-white h-full`}>
               <span className="border-l border-gray-300 h-4 mr-2"></span>
               <span className={`${statusInfo.color}`}>{statusInfo.text}</span>
            </div>
         )}
      </div>
   );
};

export default BackgroundCallIndicator;