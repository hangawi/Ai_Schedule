import React from 'react';
import { ChevronUp, ChevronDown, Star } from 'lucide-react';

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

const ProposalCard = ({ proposal, onClick }) => {
   const statusInfo = {
      pending: { text: '대기 중', color: 'bg-yellow-100 text-yellow-800' },
      in_progress: { text: '조율 중', color: 'bg-blue-100 text-blue-800' },
      suggestions_ready: { text: '제안 준비됨', color: 'bg-purple-100 text-purple-800' },
      finalized: { text: '확정됨', color: 'bg-green-100 text-green-800' },
   };
   return (
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer" onClick={proposal.status === 'suggestions_ready' ? () => onClick(proposal) : undefined}>
         <div className="flex justify-between items-start">
            <h4 className="font-medium text-gray-800 truncate pr-2">{proposal.title}</h4>
            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusInfo[proposal.status]?.color || 'bg-gray-100'}`}>{statusInfo[proposal.status]?.text || proposal.status}</span>
         </div>
         <div className="mt-2 text-sm text-gray-500">
            <p>진행자: {proposal.initiator}</p>
            <p>참가자: {proposal.participants.length}명</p>
         </div>
      </div>
   );
};

const EventCard = ({ title, time, participants, priority }) => {
    const stars = Array.from({ length: 5 }, (_, i) => <Star key={i} size={14} className={i < priority ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />);
   return (
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
         <div className="flex justify-between items-start">
            <h4 className="font-medium text-gray-800 truncate pr-2">{title}</h4>
            <div className="flex flex-shrink-0">{stars}</div>
         </div>
         <div className="mt-2 text-sm text-gray-500">
            <p>{time}</p>
            <p>참가자: {participants}명</p>
         </div>
      </div>
   );
};

const DashboardTab = ({ onSelectTime, proposals, todayEvents, upcomingEvents }) => {
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
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
            <StatCard title="진행 중인 조율" value={proposals.filter(p => p.status !== 'finalized').length} change="+1" changeType="increase" />
            <StatCard title="오늘 일정" value={todayEvents.length} change="0" changeType="neutral" />
            <StatCard title="다가오는 일정" value={upcomingEvents.length} change="+2" changeType="increase" />
         </div>
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
               <div>
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="text-lg font-semibold text-gray-800">진행 중인 조율</h3>
                     <button className="text-blue-500 text-sm font-medium hover:underline">모두 보기</button>
                  </div>
                  <div className="space-y-3">
                     {proposals.slice(0, 3).map(proposal => <ProposalCard key={proposal.id || proposal._id} proposal={proposal} onClick={onSelectTime} />)}
                  </div>
               </div>
               <div>
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="text-lg font-semibold text-gray-800">다가오는 일정</h3>
                     <button className="text-blue-500 text-sm font-medium hover:underline">모두 보기</button>
                  </div>
                  <div className="space-y-3">
                     {upcomingEvents.slice(0, 3).map(event => <EventCard key={event.id} title={event.title} time={`${event.date} ${event.time}`} participants={event.participants} priority={event.priority} />)}
                  </div>
               </div>
            </div>
            <div>
               <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">오늘의 일정</h3>
                  <button className="text-blue-500 text-sm font-medium hover:underline">모두 보기</button>
               </div>
               <div className="space-y-3">
                  {todayEvents.slice(0, 3).map(event => <EventCard key={event.id} title={event.title} time={`${event.time}`} participants={event.participants} priority={event.priority} />)}
               </div>
            </div>
         </div>
      </div>
   );
};

export default DashboardTab;