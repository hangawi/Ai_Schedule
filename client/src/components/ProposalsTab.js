import React from 'react';

const ProposalRow = ({ proposal, onClick }) => {
   const statusInfo = { pending: { text: '대기 중', color: 'bg-yellow-100 text-yellow-800' }, in_progress: { text: '조율 중', color: 'bg-blue-100 text-blue-800' }, suggestions_ready: { text: '제안 준비됨', color: 'bg-purple-100 text-purple-800' }, finalized: { text: '확정됨', color: 'bg-green-100 text-green-800' } };
   return (
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={proposal.status === 'suggestions_ready' ? () => onClick(proposal) : undefined}>
         <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{proposal.title}</div></td>
         <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-500">{proposal.initiator}</div></td>
         <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-500">{proposal.participants.length}명</div></td>
         <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusInfo[proposal.status]?.color || 'bg-gray-100'}`}>{statusInfo[proposal.status]?.text || proposal.status}</span></td>
         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{proposal.date || new Date(proposal.createdAt).toLocaleDateString('ko-KR')}</td>
      </tr>
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

const ProposalsTab = ({ onSelectTime, proposals }) => {
   return (
      <div>
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2 sm:mb-0">조율 내역</h2>
            <div className="flex items-center space-x-3">
               <select className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
                  <option>전체</option>
                  <option>진행 중</option>
                  <option>완료</option>
               </select>
            </div>
         </div>
         <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hidden md:block">
            <table className="min-w-full divide-y divide-gray-200">
               <thead className="bg-gray-50">
                  <tr>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">제목</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">진행자</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">참가자</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">생성일</th>
                  </tr>
               </thead>
               <tbody className="bg-white divide-y divide-gray-200">
                  {proposals.map(proposal => <ProposalRow key={proposal.id || proposal._id} proposal={proposal} onClick={onSelectTime} />)}
               </tbody>
            </table>
         </div>
         <div className="space-y-4 md:hidden">
            {proposals.map(proposal => <ProposalCard key={proposal.id || proposal._id} proposal={proposal} onClick={onSelectTime} />)}
         </div>
      </div>
   );
};

export default ProposalsTab;