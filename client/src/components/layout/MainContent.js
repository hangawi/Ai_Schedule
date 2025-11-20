import React from 'react';
import MyCalendar from '../calendar/Calendar';
import DashboardTab from '../tabs/DashboardTab';
import ProposalsTab from '../tabs/ProposalsTab';
import EventsTab from '../tabs/EventsTab';
import AgentTab from '../tabs/AgentTab';

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