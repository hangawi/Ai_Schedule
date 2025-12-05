/**
 * ===================================================================================================
 * BackgroundCallIndicator.js - 백그라운드 대화 감지 상태 표시기 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/indicators
 *
 * 🎯 주요 기능:
 *    - 백그라운드 대화 감지 기능의 활성화(ON/OFF) 여부를 표시
 *    - ON/OFF 상태를 토글하는 버튼 제공
 *    - 감지 기능이 활성화된 경우, 현재 상태('대기 중', '녹음 중', '요약 중' 등)를 텍스트와 색상으로 표시
 *    - '녹음 중', '요약 중' 등 특정 상태에서는 애니메이션 효과(pulse)를 주어 시각적 피드백 강화
 *
 * 🔗 연결된 파일:
 *    - SchedulingSystem.js - 이 컴포넌트를 사용하여 백그라운드 감지 상태를 표시하고 제어
 *    - lucide-react: 아이콘 라이브러리
 *
 * 💡 UI 위치:
 *    - 앱의 메인 헤더 또는 상태 표시줄 영역
 *
 * ✏️ 수정 가이드:
 *    - 새로운 상태 추가: `getStatusInfo` 함수에 새로운 `case`를 추가하여 텍스트와 색상 정의
 *    - 아이콘 또는 버튼 디자인 변경: JSX 구조 및 Tailwind CSS 클래스 수정
 *    - 애니메이션 효과 변경: `statusInfo`를 렌더링하는 부분의 `className` 수정
 *
 * 📝 참고사항:
 *    - `isMonitoring` prop으로 기능의 전체 ON/OFF 상태를 제어합니다.
 *    - `voiceStatus`와 `isAnalyzing` prop을 조합하여 세부적인 현재 상태를 판단하고 표시합니다.
 *
 * ===================================================================================================
 */

import React from 'react';
import { Mic, MicOff } from 'lucide-react';

/**
 * BackgroundCallIndicator
 *
 * @description 백그라운드 대화 감지 기능의 활성화 여부와 현재 상태를 시각적으로 표시하는 컴포넌트입니다.
 * @param {Object} props - 컴포넌트 프롭스
 * @param {boolean} props.isMonitoring - 백그라운드 감지 기능이 활성화되었는지 여부
 * @param {Function} props.onToggleMonitoring - 감지 기능 ON/OFF 토글 시 호출될 콜백 함수
 * @param {string} props.voiceStatus - 음성 인식의 현재 상태 ('idle', 'recording', 'command' 등)
 * @param {boolean} props.isAnalyzing - 대화 내용 요약 분석 중인지 여부
 * @returns {JSX.Element} 백그라운드 감지 상태 표시기 UI
 *
 * @example
 * <BackgroundCallIndicator
 *   isMonitoring={isMonitoring}
 *   onToggleMonitoring={toggleMonitoring}
 *   voiceStatus={currentVoiceStatus}
 *   isAnalyzing={isAnalyzingText}
 * />
 */
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
               {isMonitoring ? <Mic size={16} /> : <MicOff size={16} />}
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
