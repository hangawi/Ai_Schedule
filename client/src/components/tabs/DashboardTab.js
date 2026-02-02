/**
 * ===================================================================================================
 * [파일명] DashboardTab.js - 대시보드 탭 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > [client/src/components/tabs/DashboardTab.js]
 *
 * 🎯 주요 기능:
 *    - 사용자의 일정 관련 주요 정보를 요약하여 보여주는 대시보드 UI
 *    - 진행 중인 조율, 오늘 일정, 다가오는 일정의 수치를 보여주는 통계 카드 표시
 *    - 진행 중인 조율 목록, 다가오는 일정 목록, 오늘의 일정 목록을 카드 형태로 표시
 *
 * 🔗 연결된 파일:
 *    - SchedulingSystem.js (상위 컴포넌트로 추정): 대시보드에 필요한 데이터(proposals, events)를 props로 전달
 *
 * 💡 UI 위치:
 *    - [대시보드] 탭 (가칭, 현재는 메뉴에 없음)
 *    - 앱의 메인 화면으로 사용될 수 있는 요약 정보 페이지
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 대시보드 전체의 레이아웃과 표시되는 정보의 종류가 변경됩니다.
 *    - 통계 수치 변경: `StatCard`에 전달되는 `value` prop의 계산 로직을 상위 컴포넌트에서 수정해야 합니다. (현재 일부 값 하드코딩)
 *    - 목록 아이템 클릭 동작 변경: `ProposalCard`, `EventCard`의 onClick 이벤트를 수정합니다.
 *    - '모두 보기' 기능 구현: 각 섹션의 '모두 보기' 버튼에 onClick 핸들러와 라우팅 기능을 추가해야 합니다.
 *
 * 📝 참고사항:
 *    - 이 컴포넌트는 데이터를 props로 받아 화면에 표시하는 역할에 집중합니다. (Presentational Component)
 *    - `StatCard`, `ProposalCard`, `EventCard`라는 세 종류의 재사용 가능한 카드 컴포넌트를 내부에서 정의하고 사용합니다.
 *    - 현재 필터링, '모두 보기' 등 일부 상호작용 기능은 UI만 구현되어 있고 실제 로직은 연결되지 않았습니다.
 *
 * ===================================================================================================
 */
import React from 'react';
import { ChevronUp, ChevronDown, Star } from 'lucide-react';

/**
 * [StatCard]
 * @description 대시보드 상단에 표시되는 단일 통계 정보를 위한 카드 컴포넌트
 * @param {string} title - 카드의 제목 (예: '오늘 일정')
 * @param {string|number} value - 표시될 주된 수치
 * @param {string} change - 변화량을 나타내는 문자열 (예: '+1')
 * @param {string} changeType - 변화의 종류 ('increase', 'decrease', 'neutral')에 따라 아이콘과 색상 결정
 * @returns {JSX.Element} 통계 카드 컴포넌트
 */
const StatCard = ({ title, value, change, changeType }) => {
   const colors = { increase: 'text-green-500', decrease: 'text-red-500', neutral: 'text-gray-500' };
   const icons = { increase: <ChevronUp size={14} />, decrease: <ChevronDown size={14} />, neutral: null };
   return (
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
         <h3 className="text-sm font-medium text-gray-500">{title}</h3>
         <div className="mt-2 flex items-baseline">
            <p className="text-3xl font-semibold text-gray-800">{value}</p>
            {change && <span className={`ml-2 flex items-center text-sm ${colors[changeType]}`}>{icons[changeType]}{change}</span>}
         </div>
      </div>
   );
};

/**
 * [EventCard]
 * @description '오늘의 일정' 또는 '다가오는 일정' 항목 하나를 표시하기 위한 카드 컴포넌트
 * @param {string} title - 일정 제목
 * @param {string} time - 일정 시간
 * @param {number} participants - 참가자 수
 * @param {number} priority - 중요도 (1-5), 별 모양으로 시각화됨
 * @param {boolean} isCoordinated - 일정 맞추기로 확정된 일정인지 여부
 * @param {string} roomName - 조율방 이름 (isCoordinated일 때만)
 * @returns {JSX.Element} 일정 카드 컴포넌트
 */
const EventCard = ({ title, time, participants, priority, isCoordinated, roomName, participantNames, totalMembers }) => {
   const [showNames, setShowNames] = React.useState(false);
   const stars = Array.from({ length: 5 }, (_, i) => <Star key={i} size={14} className={i < priority ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />);
   // 🆕 확정 조건: 참석자 2명 이상 (isCoordinated는 확정 여부를 나타냄)
   const isConfirmed = isCoordinated && participants >= 2;
   const hasNameInfo = participantNames && participantNames.length > 0;
   return (
      <div className={`p-4 rounded-lg shadow-sm border ${isConfirmed ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'} hover:shadow-md transition-shadow cursor-pointer`}>
         <div className="flex justify-between items-start">
            <div className="flex-1">
               <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-gray-800 truncate">{title}</h4>
                  {isCoordinated && (
                     <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full flex-shrink-0">
                        확정
                     </span>
                  )}
               </div>
               {isCoordinated && roomName && (
                  <p className="text-xs text-gray-500">📅 {roomName}</p>
               )}
            </div>
            <div className="flex flex-shrink-0">{stars}</div>
         </div>
         <div className="mt-2 text-sm text-gray-500">
            <p>{time}</p>
            <p
               className={hasNameInfo ? 'cursor-pointer hover:text-blue-500 transition-colors' : ''}
               onClick={hasNameInfo ? (e) => { e.stopPropagation(); setShowNames(!showNames); } : undefined}
            >
               참가자: {participants}명{totalMembers > 0 && ` / ${totalMembers}명`}
               {hasNameInfo && <span className="ml-1 text-xs">{showNames ? '▲' : '▼'}</span>}
            </p>
            {showNames && hasNameInfo && (
               <div className="mt-1 flex flex-wrap gap-1">
                  {participantNames.map((name, idx) => (
                     <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                        {name}
                     </span>
                  ))}
               </div>
            )}
         </div>
      </div>
   );
};

/**
 * [DashboardTab]
 * @description 사용자의 일정 현황을 요약해서 보여주는 대시보드 탭의 메인 컴포넌트
 * @param {Array<object>} pastEvents - 지난 일정 목록 (30일 전까지)
 * @param {Array<object>} todayEvents - 오늘의 일정 목록 데이터
 * @param {Array<object>} upcomingEvents - 다가오는 일정 목록 데이터
 * @returns {JSX.Element} 대시보드 탭 컴포넌트
 */
const DashboardTab = ({ pastEvents = [], todayEvents, upcomingEvents }) => {
   return (
      <div>
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2 sm:mb-0">대시보드</h2>
            <div className="flex items-center space-x-3">
               <select className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
                  <option>이번 주</option>
                  <option>다음 주</option>
                  <option>이번 달</option>
               </select>
            </div>
         </div>

         {/* 통계 카드 */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
            <StatCard title="지난 일정 (30일)" value={pastEvents.length} change="0" changeType="neutral" />
            <StatCard title="오늘 일정" value={todayEvents.length} change="0" changeType="neutral" />
            <StatCard title="예정된 일정" value={upcomingEvents.length} change="+2" changeType="increase" />
         </div>

         {/* 일정 섹션 */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 왼쪽 열 */}
            <div className="space-y-6">
               {/* 지난 일정 (30일) */}
               <div>
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="text-lg font-semibold text-gray-800">지난 일정 (30일)</h3>
                     <button className="text-blue-500 text-sm font-medium hover:underline">모두 보기</button>
                  </div>
                  <div className="space-y-3">
                     {pastEvents.length > 0 ? (
                        pastEvents.slice(0, 3).map(event => (
                           <EventCard 
                              key={event.id} 
                              title={event.title} 
                              time={`${event.date} ${event.time}`} 
                              participants={event.participants} 
                              priority={event.priority}
                              isCoordinated={event.isCoordinated}
                              roomName={event.roomName}
                              participantNames={event.participantNames}
                              totalMembers={event.totalMembers}
                           />
                        ))
                     ) : (
                        <p className="text-gray-500 text-sm">지난 30일간 일정이 없습니다.</p>
                     )}
                  </div>
               </div>
            </div>
            
            {/* 오른쪽 열 */}
            <div className="space-y-6">
               {/* 예정된 일정 */}
               <div>
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="text-lg font-semibold text-gray-800">예정된 일정</h3>
                     <button className="text-blue-500 text-sm font-medium hover:underline">모두 보기</button>
                  </div>
                  <div className="space-y-3">
                     {upcomingEvents.length > 0 ? (
                        upcomingEvents.slice(0, 3).map(event => (
                           <EventCard 
                              key={event.id} 
                              title={event.title} 
                              time={`${event.date} ${event.time}`} 
                              participants={event.participants} 
                              priority={event.priority}
                              isCoordinated={event.isCoordinated}
                              roomName={event.roomName}
                              participantNames={event.participantNames}
                              totalMembers={event.totalMembers}
                           />
                        ))
                     ) : (
                        <p className="text-gray-500 text-sm">예정된 일정이 없습니다.</p>
                     )}
                  </div>
               </div>
               
               {/* 오늘의 일정 */}
               <div>
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="text-lg font-semibold text-gray-800">오늘의 일정</h3>
                     <button className="text-blue-500 text-sm font-medium hover:underline">모두 보기</button>
                  </div>
                  <div className="space-y-3">
                     {todayEvents.length > 0 ? (
                        todayEvents.slice(0, 3).map(event => (
                           <EventCard 
                              key={event.id} 
                              title={event.title} 
                              time={`${event.time}`} 
                              participants={event.participants} 
                              priority={event.priority}
                              isCoordinated={event.isCoordinated}
                              roomName={event.roomName}
                              participantNames={event.participantNames}
                              totalMembers={event.totalMembers}
                           />
                        ))
                     ) : (
                        <p className="text-gray-500 text-sm">오늘 일정이 없습니다.</p>
                     )}
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
};

export default DashboardTab;
