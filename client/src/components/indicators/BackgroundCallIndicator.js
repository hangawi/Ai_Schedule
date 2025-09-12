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
            return { text: '명령 처리 중', color: 'text-blue-600' };
         case 'recording':
            return { text: '녹음 중', color: 'text-red-600' };
         case 'ending':
            return { text: '녹음 종료', color: 'text-yellow-600' };
         case 'waiting':
         case 'idle':
         default:
            return { text: '대기 중', color: 'text-green-600' };
      }
   };

   const statusInfo = getStatusInfo();

   return (
      <div className="flex items-center">
         <button
            onClick={onToggleMonitoring}
            className={`flex items-center px-3 py-2 rounded-full transition-colors duration-200 text-sm ${
               isMonitoring
                  ? 'bg-green-100 text-green-600 hover:text-green-700'
                  : 'bg-gray-100 text-gray-600 hover:text-gray-700'
            }`}
            title={isMonitoring ? "백그라운드 모니터링 활성화됨" : "백그라운드 모니터링 비활성화됨"}
         >
            <div className="flex items-center space-x-2">
               {isMonitoring ? 
                  <Mic size={16} /> : 
                  <MicOff size={16} />
               }
               <span className="hidden sm:inline font-medium">
                  {isMonitoring ? '백그라운드 ON' : '백그라운드 OFF'}
               </span>
            </div>
         </button>
         
         {statusInfo && (
            <div className="flex items-center ml-3 px-2 py-1 bg-gray-50 rounded-full">
               <div className={`w-2 h-2 rounded-full mr-2 ${
                  statusInfo.color.includes('green') ? 'bg-green-500' :
                  statusInfo.color.includes('red') ? 'bg-red-500 animate-pulse' :
                  statusInfo.color.includes('yellow') ? 'bg-yellow-500' :
                  statusInfo.color.includes('purple') ? 'bg-purple-500 animate-pulse' :
                  'bg-blue-500 animate-pulse'
               }`}></div>
               <span className={`${statusInfo.color} font-medium text-xs`}>{statusInfo.text}</span>
            </div>
         )}
      </div>
   );
};

export default BackgroundCallIndicator;