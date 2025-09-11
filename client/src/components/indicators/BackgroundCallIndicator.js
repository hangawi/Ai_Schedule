import React from 'react';
import { Mic, MicOff } from 'lucide-react';

const BackgroundCallIndicator = ({ 
   isMonitoring, 
   onToggleMonitoring 
}) => {
   const handleToggle = async () => {
      try {
         await onToggleMonitoring();
      } catch (error) {
         console.error('모니터링 토글 오류:', error);
      }
   };

   return (
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
   );
};

export default BackgroundCallIndicator;