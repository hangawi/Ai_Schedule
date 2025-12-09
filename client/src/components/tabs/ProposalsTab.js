/**
 * ===================================================================================================
 * [파일명] ProposalsTab.js - '조율 내역' 전체 목록 탭 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > [client/src/components/tabs/ProposalsTab.js]
 *
 * 🎯 주요 기능:
 *    - 모든 일정 조율 제안(proposal) 목록을 표시
 *    - 반응형 UI: 데스크탑에서는 테이블 뷰, 모바일에서는 카드 뷰로 목록을 렌더링
 *    - 상태별 필터링 UI 제공 (현재 기능은 미구현)
 *
 * 🔗 연결된 파일:
 *    - SchedulingSystem.js (상위 컴포넌트로 추정): `proposals` 데이터와 `onSelectTime` 핸들러를 props로 전달
 *
 * 💡 UI 위치:
 *    - [조율 내역] 탭 (가칭)
 *    - 사용자가 참여하거나 생성한 모든 조율 현황을 전체적으로 확인할 수 있는 페이지
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: '조율 내역' 탭의 전체적인 UI와 목록 표시 방식이 변경됩니다.
 *    - 필터링 기능 구현: 상단 `select` 요소에 `onChange` 핸들러를 추가하고, `proposals` 배열을 필터링하는 로직을 구현해야 합니다.
 *    - 목록 아이템 클릭 동작 변경: `ProposalRow`와 `ProposalCard` 컴포넌트의 `onClick` 로직을 수정합니다.
 *
 * 📝 참고사항:
 *    - `ProposalCard` 컴포넌트는 `DashboardTab.js`에서도 사용된 것과 유사한 카드 UI를 제공합니다.
 *    - `statusInfo` 객체를 통해 제안의 상태(`pending`, `finalized` 등)에 따라 적절한 텍스트와 색상을 동적으로 표시합니다.
 *    - 제안의 상태가 `suggestions_ready`일 때만 클릭 이벤트가 활성화됩니다.
 *
 * ===================================================================================================
 */
import React from 'react';

/**
 * [ProposalRow]
 * @description 데스크탑 뷰에서 조율 내역 테이블의 한 행(row)을 렌더링하는 컴포넌트
 * @param {object} proposal - 표시할 조율 제안 데이터
 * @param {function} onClick - '제안 준비됨' 상태의 행을 클릭했을 때 호출될 함수
 * @returns {JSX.Element} 테이블 행(`<tr>`) JSX 엘리먼트
 */
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

/**
 * [ProposalCard]
 * @description 모바일 뷰에서 조율 내역 목록의 한 항목(card)을 렌더링하는 컴포넌트
 * @param {object} proposal - 표시할 조율 제안 데이터
 * @param {function} onClick - '제안 준비됨' 상태의 카드를 클릭했을 때 호출될 함수
 * @returns {JSX.Element} 카드 `<div>` JSX 엘리먼트
 */
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

/**
 * [ProposalsTab]
 * @description 모든 일정 조율 제안 내역을 목록 형태로 보여주는 탭 컴포넌트.
 *              화면 크기에 따라 테이블 뷰(데스크탑) 또는 카드 뷰(모바일)로 자동 전환됩니다.
 * @param {function} onSelectTime - '제안 준비됨' 상태의 항목을 클릭했을 때 호출될 함수
 * @param {Array<object>} proposals - 표시할 조율 제안 객체의 배열
 * @returns {JSX.Element} '조율 내역' 탭 컴포넌트
 */
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
         {/* Desktop View: Table */}
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
         {/* Mobile View: Cards */}
         <div className="space-y-4 md:hidden">
            {proposals.map(proposal => <ProposalCard key={proposal.id || proposal._id} proposal={proposal} onClick={onSelectTime} />)}
         </div>
      </div>
   );
};

export default ProposalsTab;
