/**
 * ===================================================================================================
 * MainContent.js - 메인 컨텐츠 영역 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/layout
 *
 * 🎯 주요 기능:
 *    - `activeTab` 상태에 따라 해당하는 탭 컴포넌트를 동적으로 렌더링
 *    - 대시보드, 제안, 이벤트, 구글 캘린더, 조율, 에이전트 탭 등 다양한 뷰를 표시
 *    - 각 탭 컴포넌트에 필요한 데이터와 핸들러 함수를 props로 전달
 *
 * 🔗 연결된 파일:
 *    - ../calendar/Calendar.js - 'googleCalendar' 탭에 사용되는 캘린더 컴포넌트
 *    - ../tabs/* - 각 탭에 해당하는 컴포넌트들
 *    - SchedulingSystem.js - 이 컴포넌트를 사용하는 메인 레이아웃 컴포넌트
 *
 * 💡 UI 위치:
 *    - 헤더와 사이드바를 제외한 애플리케이션의 중앙 메인 영역
 *
 * ✏️ 수정 가이드:
 *    - 새로운 탭 추가: 새로운 탭 컴포넌트를 import하고, `activeTab` 값에 따라 조건부 렌더링 JSX를 추가
 *    - 특정 탭에 새로운 데이터 전달: 해당 탭 컴포넌트의 props에 새로운 데이터 또는 핸들러 추가
 *
 * 📝 참고사항:
 *    - 이 컴포넌트는 '라우터'와 유사한 역할을 하여, `activeTab` 상태를 기준으로 보여줄 화면을 결정합니다.
 *    - 모든 탭 컴포넌트가 동일한 props를 받는 것이 아니라, 각자에게 필요한 props만 선별적으로 전달받습니다.
 *
 * ===================================================================================================
 */

import React from 'react';
import MyCalendar from '../calendar/Calendar';
import DashboardTab from '../tabs/DashboardTab';
import ProposalsTab from '../tabs/ProposalsTab';
import EventsTab from '../tabs/EventsTab';
import AgentTab from '../tabs/AgentTab';
import CoordinationTab from '../tabs/CoordinationTab';

/**
 * MainContent
 *
 * @description `activeTab` 상태에 따라 적절한 탭 컴포넌트를 렌더링하는 메인 컨텐츠 영역 컴포넌트입니다.
 * @param {Object} props - 컴포넌트 프롭스
 * @param {string} props.activeTab - 현재 활성화된 탭의 ID
 * @param {Function} props.handleSelectProposalForTime - 제안의 시간을 선택하는 핸들러
 * @param {Array<Object>} props.globalProposals - 전체 제안 목록
 * @param {Array<Object>} props.todayEvents - 오늘 예정된 이벤트 목록
 * @param {Array<Object>} props.upcomingEvents - 다가오는 이벤트 목록
 * @param {Array<Object>} props.globalEvents - 전체 이벤트 목록
 * @param {Function} props.handleAddGlobalEvent - 전역 이벤트를 추가하는 핸들러
 * @param {boolean} props.isLoggedIn - 로그인 상태 여부
 * @param {Function} props.handleDeleteEvent - 이벤트를 삭제하는 핸들러
 * @param {Function} props.handleEditEvent - 이벤트를 수정하는 핸들러
 * @param {boolean} props.isListening - 음성 인식이 활성화되어 듣고 있는지 여부
 * @param {any} props.eventAddedKey - 이벤트 추가 시 갱신되는 키 (캘린더 리렌더링 유도)
 * @param {boolean} props.isVoiceRecognitionEnabled - 음성 인식 기능 활성화 여부
 * @param {Function} props.setIsVoiceRecognitionEnabled - 음성 인식 상태를 설정하는 함수
 * @param {Object} props.user - 현재 로그인된 사용자 정보
 * @param {Function} props.setExchangeRequestCount - 교환 요청 개수 상태를 설정하는 함수
 * @param {Function} props.refreshExchangeRequestCount - 교환 요청 개수를 새로고침하는 함수
 * @returns {JSX.Element} 현재 활성화된 탭에 해당하는 UI
 */
const MainContent = ({
  activeTab,
  handleSelectProposalForTime,
  globalProposals,
  todayEvents,
  upcomingEvents,
  globalEvents,
  handleAddGlobalEvent,
  isLoggedIn,
  handleDeleteEvent,
  handleEditEvent,
  isListening,
  eventAddedKey,
  isVoiceRecognitionEnabled,
  setIsVoiceRecognitionEnabled,
  user,
  setExchangeRequestCount,
  refreshExchangeRequestCount
}) => {
  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-6">
      {activeTab === 'dashboard' && <DashboardTab onSelectTime={handleSelectProposalForTime} proposals={globalProposals} todayEvents={todayEvents} upcomingEvents={upcomingEvents} />}
      {activeTab === 'proposals' && <ProposalsTab onSelectTime={handleSelectProposalForTime} proposals={globalProposals} />}
      {activeTab === 'events' && <EventsTab events={globalEvents} onAddEvent={handleAddGlobalEvent} isLoggedIn={isLoggedIn} onDeleteEvent={handleDeleteEvent} onEditEvent={handleEditEvent} />}
      {activeTab === 'googleCalendar' && <MyCalendar isListening={isListening} onEventAdded={eventAddedKey} isVoiceRecognitionEnabled={isVoiceRecognitionEnabled} onToggleVoiceRecognition={() => setIsVoiceRecognitionEnabled(prev => !prev)} />}
      {activeTab === 'coordination' && <CoordinationTab user={user} onExchangeRequestCountChange={setExchangeRequestCount} onRefreshExchangeCount={refreshExchangeRequestCount} />}
      {activeTab === 'agent' && <AgentTab />}
    </main>
  );
};

export default MainContent;
