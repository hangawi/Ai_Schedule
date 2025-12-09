/**
 * ===================================================================================================
 * [파일명] AgentTab.js - '내 AI 비서' 설정 탭 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > [client/src/components/tabs/AgentTab.js]
 *
 * 🎯 주요 기능:
 *    - AI 비서의 기본 설정 (이름, 성격, 자율성 수준) 변경
 *    - 알림 설정 (이메일, 푸시, 요약 주기) 변경
 *    - AI의 시간 선호도 학습 기능 제어 및 확인
 *
 * 🔗 연결된 파일:
 *    - SchedulingSystem.js (상위 컴포넌트로 추정): 이 탭을 포함하는 메인 레이아웃
 *
 * 💡 UI 위치:
 *    - [AI 비서] 탭 (가칭, 현재는 메뉴에 없음)
 *    - 이 컴포넌트는 앱의 특정 탭을 구성하는 UI를 정의합니다.
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: '내 AI 비서' 탭의 UI 레이아웃 및 정적 컨텐츠가 변경됩니다.
 *    - 설정 저장 로직 추가: '변경사항 저장' 버튼에 onClick 핸들러를 추가하고 API 호출 로직을 구현해야 합니다.
 *    - 각 설정 항목(입력, 셀렉트, 토글)에 대해 상태(state)와 핸들러를 연결해야 합니다.
 *
 * 📝 참고사항:
 *    - 현재 이 컴포넌트는 UI만 구현되어 있으며, 실제 기능(상태 관리, API 연동)은 연결되지 않은 상태입니다.
 *    - '자율성 수준' 슬라이더 외에는 대부분의 상호작용이 시각적으로만 구현되어 있습니다.
 *    - 향후 백엔드와 연동하여 실제 AI 비서의 설정을 저장하고 불러오는 기능이 추가되어야 합니다.
 *
 * ===================================================================================================
 */
import React, { useState } from 'react';

/**
 * [AgentTab]
 *
 * @description '내 AI 비서'에 대한 다양한 설정을 관리하는 UI를 제공하는 탭 컴포넌트입니다.
 *              사용자는 AI 비서의 이름, 성격, 자율성 수준, 알림 방식, 학습 기능 등을 설정할 수 있습니다.
 * @returns {JSX.Element} AI 비서 설정 탭의 JSX 엘리먼트
 *
 * @note 현재는 UI 중심의 정적 컴포넌트로, 대부분의 기능이 실제 로직과 연결되어 있지 않습니다.
 *       `autonomyLevel` 상태 하나만 내부적으로 관리되고 있습니다.
 */
const AgentTab = () => {
   const [autonomyLevel, setAutonomyLevel] = useState(3);
   return (
      <div>
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2 sm:mb-0">내 AI 비서</h2>
            <button className="bg-blue-500 text-white rounded-md px-3 py-1.5 text-sm">변경사항 저장</button>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
               <h3 className="text-lg font-semibold text-gray-800 mb-4">기본 설정</h3>
               <div className="space-y-4">
                  <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">비서 이름</label>
                     <input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="내 AI 비서" defaultValue="큐브" />
                  </div>
                  <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">비서 성격</label>
                     <select className="w-full border border-gray-300 rounded-md px-3 py-2">
                        <option>직관적</option>
                        <option>친근한</option>
                        <option>효율적</option>
                        <option>세심한</option>
                     </select>
                  </div>
                  <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">자율성 수준</label>
                     <div className="flex items-center">
                        <span className="text-xs text-gray-500">승인 필요</span>
                        <input type="range" min="1" max="5" value={autonomyLevel} onChange={e => setAutonomyLevel(parseInt(e.target.value))} className="mx-2 flex-1" />
                        <span className="text-xs text-gray-500">완전 자동</span>
                     </div>
                     <p className="mt-1 text-sm text-gray-500">
                        {autonomyLevel === 1 && '모든 결정에 사용자 승인이 필요합니다.'}
                        {autonomyLevel === 2 && '중요한 결정에만 사용자 승인이 필요합니다.'}
                        {autonomyLevel === 3 && '중간 수준의 자율성으로 작동합니다.'}
                        {autonomyLevel === 4 && '대부분의 결정을 자동으로 처리합니다.'}
                        {autonomyLevel === 5 && '모든 일정 조율을 자동으로 처리합니다.'}
                     </p>
                  </div>
               </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
               <h3 className="text-lg font-semibold text-gray-800 mb-4">알림 설정</h3>
               <div className="space-y-4">
                  <div className="flex items-center justify-between">
                     <span className="text-sm text-gray-700">이메일 알림</span>
                     <label className="flex items-center cursor-pointer"><div className="relative"><input type="checkbox" className="sr-only" defaultChecked /><div className="w-10 h-5 bg-gray-200 rounded-full shadow-inner"></div><div className="dot absolute w-5 h-5 bg-blue-500 rounded-full shadow -left-1 -top-0 transition"></div></div></label>
                  </div>
                  <div className="flex items-center justify-between">
                     <span className="text-sm text-gray-700">푸시 알림</span>
                     <label className="flex items-center cursor-pointer"><div className="relative"><input type="checkbox" className="sr-only" defaultChecked /><div className="w-10 h-5 bg-gray-200 rounded-full shadow-inner"></div><div className="dot absolute w-5 h-5 bg-blue-500 rounded-full shadow -left-1 -top-0 transition"></div></div></label>
                  </div>
                  <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">알림 요약</label>
                     <select className="w-full border border-gray-300 rounded-md px-3 py-2">
                        <option>즉시</option>
                        <option>일일 요약</option>
                        <option>주간 요약</option>
                     </select>
                  </div>
               </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 md:col-span-2">
               <h3 className="text-lg font-semibold text-gray-800 mb-4">시간 선호도 학습</h3>
               <div className="space-y-4">
                  <div>
                     <p className="text-sm text-gray-700 mb-2">AI 비서는 시간이 지남에 따라 귀하의 선호도를 학습합니다.</p>
                     <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">학습된 선호 패턴</h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                           <li>• 월요일 오전에는 회의를 선호하지 않음</li>
                           <li>• 화/목요일 오후 2-4시 사이에 회의 선호</li>
                           <li>• 금요일 오후 4시 이후 회의 회피</li>
                        </ul>
                     </div>
                  </div>
                  <div className="flex items-center justify-between">
                     <span className="text-sm text-gray-700">학습 활성화</span>
                     <label className="flex items-center cursor-pointer"><div className="relative"><input type="checkbox" className="sr-only" defaultChecked /><div className="w-10 h-5 bg-gray-200 rounded-full shadow-inner"></div><div className="dot absolute w-5 h-5 bg-blue-500 rounded-full shadow -left-1 -top-0 transition"></div></div></label>
                  </div>
                  <button className="text-blue-500 text-sm hover:underline">학습 데이터 초기화</button>
               </div>
            </div>
         </div>
      </div>
   );
};

export default AgentTab;
