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
      <div className="flex items-center bg-gradient-to-r from-white to-gray-50 rounded-2xl shadow-lg border border-white/50 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:shadow-xl">
         <button
            onClick={onToggleMonitoring}
            className={`flex items-center px-4 py-2.5 transition-all duration-300 h-full font-semibold text-sm ${
               isMonitoring
                  ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg hover:from-green-600 hover:to-green-700 hover:scale-105'
                  : 'bg-gradient-to-r from-gray-200 to-gray-300 text-gray-700 hover:from-gray-300 hover:to-gray-400 hover:scale-105'
            } rounded-2xl relative overflow-hidden`}
            title={isMonitoring ? "백그라운드 모니터링 활성화됨" : "백그라운드 모니터링 비활성화됨"}
         >
            {/* 반짝이는 효과 */}
            {isMonitoring && (
               <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
            )}
            
            <div className="relative flex items-center space-x-2">
               {isMonitoring ? 
                  <Mic size={16} className="drop-shadow-sm" /> : 
                  <MicOff size={16} className="" />
               }
               <span className="hidden sm:inline tracking-wide">
                  {isMonitoring ? '백그라운드 ON' : '백그라운드 OFF'}
               </span>
            </div>
         </button>
         
         {statusInfo && (
            <div className="flex items-center px-3 py-2.5 bg-gradient-to-r from-gray-50 to-white">
               <div className="w-px h-6 bg-gradient-to-b from-gray-200 via-gray-400 to-gray-200 mr-3"></div>
               <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${
                     statusInfo.color.includes('green') ? 'bg-green-500' :
                     statusInfo.color.includes('red') ? 'bg-red-500' :
                     statusInfo.color.includes('yellow') ? 'bg-yellow-500' :
                     statusInfo.color.includes('purple') ? 'bg-purple-500' :
                     'bg-blue-500'
                  }`}></div>
                  <span className={`${statusInfo.color} font-medium text-sm`}>{statusInfo.text}</span>
               </div>
            </div>
         )}
      </div>
   );
};

export default BackgroundCallIndicator;