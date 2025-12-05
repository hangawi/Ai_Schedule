/**
 * ===================================================================================================
 * BackgroundGuide.js - 백그라운드 대화 감지 기능 가이드 모달 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/guides
 *
 * 🎯 주요 기능:
 *    - 백그라운드 대화 감지 기능의 사용법을 단계별로 안내하는 가이드 제공
 *    - 사용자가 '다음'/'이전' 버튼을 통해 각 단계를 탐색할 수 있음
 *    - 각 단계별로 아이콘, 제목, 내용, 팁을 시각적으로 구분하여 표시
 *    - 마지막 단계에서 '완료' 버튼을 누르면 모달이 닫힘
 *
 * 🔗 연결된 파일:
 *    - 이 컴포넌트를 호출하는 상위 컴포넌트 (예: 백그라운드 감지 기능 최초 사용 시)
 *    - lucide-react: 아이콘 라이브러리
 *
 * 💡 UI 위치:
 *    - 백그라운드 감지 기능에 대한 안내가 필요할 때 화면 전체를 덮는 모달로 표시됨
 *
 * ✏️ 수정 가이드:
 *    - 가이드 내용 추가/수정: `steps` 배열에 새로운 단계 객체를 추가하거나 기존 객체의 내용을 수정
 *    - UI 디자인 변경: 컴포넌트의 JSX 구조 및 Tailwind CSS 클래스 수정
 *
 * 📝 참고사항:
 *    - `steps` 배열에 정의된 내용을 기반으로 동적으로 가이드가 생성됩니다.
 *    - `useState`를 사용하여 현재 사용자가 보고 있는 단계를 관리합니다.
 *
 * ===================================================================================================
 */

import React, { useState } from 'react';
import { X, Info, Mic, Phone, Brain, Calendar } from 'lucide-react';

/**
 * BackgroundGuide
 *
 * @description 백그라운드 대화 감지 기능의 사용법을 단계별로 안내하는 모달 컴포넌트입니다.
 * @param {Object} props - 컴포넌트 프롭스
 * @param {Function} props.onClose - 모달을 닫는 함수
 * @returns {JSX.Element} 백그라운드 감지 가이드 모달 UI
 *
 * @example
 * <BackgroundGuide onClose={() => setShowGuide(false)} />
 */
const BackgroundGuide = ({ onClose }) => {
   const [currentStep, setCurrentStep] = useState(0);

   const steps = [
      {
         icon: <Info className="w-8 h-8 text-blue-500" />,
         title: "백그라운드 대화 녹음이란?",
         content: "AI가 백그라운드에서 대화를 녹음하다가 일정 관련 얘기가 나오면 자동으로 요약해서 일정 추가를 제안하는 기능입니다.",
         tip: "대화가 끝나면 자동으로 요약됩니다!"
      },
      {
         icon: <Mic className="w-8 h-8 text-green-500" />,
         title: "시작하기",
         content: "상단의 '백그라운드 OFF' 버튼을 클릭하면 모니터링이 시작됩니다. 마이크 권한을 허용해주세요.",
         tip: "한 번만 설정하면 계속 작동해요"
      },
      {
         icon: <Phone className="w-8 h-8 text-red-500" />,
         title: "대화 중 사용법",
         content: "친구와 얘기하거나 전화하면서 자연스럽게 일정 얘기를 하세요. 예: '어 내일 오후 4시 장어집? 알았어!'",
         tip: "평소처럼 대화하면 됩니다"
      },
      {
         icon: <Brain className="w-8 h-8 text-purple-500" />,
         title: "AI가 감지하는 것들",
         content: "• 날짜: 내일, 다음주 화요일, tuesday, 3월 15일\n• 시간: 4시, 오후, 점심시간\n• 장소: 장어집, 카페, 회의실\n• 참석자: 친구들, 팀원들",
         tip: "tuesday는 자동으로 화요일로 변환됩니다"
      },
      {
         icon: <Calendar className="w-8 h-8 text-blue-500" />,
         title: "일정 등록",
         content: "대화가 끝나면 AI가 대화 내용을 요약하고 일정 추가 여부를 묻는 모달이 나타납니다. 확인 후 등록하세요!",
         tip: "원하지 않으면 '무시' 클릭하세요"
      }
   ];

   const nextStep = () => {
      if (currentStep < steps.length - 1) {
         setCurrentStep(currentStep + 1);
      } else {
         onClose();
      }
   };

   const prevStep = () => {
      if (currentStep > 0) {
         setCurrentStep(currentStep - 1);
      }
   };

   return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
         <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-6 border-b">
               <h2 className="text-xl font-bold text-gray-900">
                  백그라운드 감지 가이드
               </h2>
               <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
               </button>
            </div>

            {/* 내용 */}
            <div className="p-6">
               <div className="text-center mb-6">
                  {steps[currentStep].icon}
               </div>

               <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                  {steps[currentStep].title}
               </h3>

               <div className="text-gray-600 mb-4 whitespace-pre-line leading-relaxed">
                  {steps[currentStep].content}
               </div>

               {steps[currentStep].tip && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                     <p className="text-blue-700 text-sm font-medium">
                        💡 {steps[currentStep].tip}
                     </p>
                  </div>
               )}

               {/* 진행 표시 */}
               <div className="flex justify-center mb-6">
                  <div className="flex space-x-2">
                     {steps.map((_, index) => (
                        <div
                           key={index}
                           className={`w-2 h-2 rounded-full ${ index === currentStep ? 'bg-blue-500' : 'bg-gray-300'}`}
                        />
                     ))}
                  </div>
               </div>
            </div>

            {/* 푸터 */}
            <div className="flex justify-between items-center p-6 border-t bg-gray-50 rounded-b-lg">
               <button
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className="px-4 py-2 text-sm font-medium text-gray-600 disabled:text-gray-400 hover:text-gray-800 disabled:cursor-not-allowed"
               >
                  이전
               </button>

               <span className="text-sm text-gray-500">
                  {currentStep + 1} / {steps.length}
               </span>

               <button
                  onClick={nextStep}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
               >
                  {currentStep === steps.length - 1 ? '완료' : '다음'}
               </button>
            </div>
         </div>
      </div>
   );
};

export default BackgroundGuide;
