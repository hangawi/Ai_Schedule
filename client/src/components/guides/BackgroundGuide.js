import React, { useState } from 'react';
import { X, Info, Mic, Phone, Brain, Calendar } from 'lucide-react';

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
                           className={`w-2 h-2 rounded-full ${
                              index === currentStep ? 'bg-blue-500' : 'bg-gray-300'
                           }`}
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