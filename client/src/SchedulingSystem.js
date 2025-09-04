import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
   Calendar,
   Clock,
   Users,
   UserPlus,
   LogOut,
   X,
   Menu as MenuIcon,
} from 'lucide-react';
import MyCalendar from './components/calendar/Calendar';
import EventFormModal from './components/EventFormModal';
import DashboardTab from './components/DashboardTab';
import ProposalsTab from './components/ProposalsTab';
import EventsTab from './components/EventsTab';
import AgentTab from './components/AgentTab';
import CreateProposalModal from './components/CreateProposalModal';
import TimeSelectionModal from './components/TimeSelectionModal';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const formatEventForClient = (event, color) => {
   if (!event || !event.startTime) {
      return { ...event, date: '', time: '' };
   }
   const localStartTime = new Date(event.startTime);
   const year = localStartTime.getFullYear();
   const month = String(localStartTime.getMonth() + 1).padStart(2, '0');
   const day = String(localStartTime.getDate()).padStart(2, '0');
   const hours = String(localStartTime.getHours()).padStart(2, '0');
   const minutes = String(localStartTime.getMinutes()).padStart(2, '0');

   return {
      id: event.id || event._id,
      title: event.title,
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}`,
      participants: event.participants ? event.participants.length : 0,
      priority: event.priority || 3,
      color: color || event.color || 'blue',
   };
};

const NavItem = ({ icon, label, active, onClick, badge }) => (
   <button onClick={onClick} className={`w-full flex items-center px-3 py-2 rounded-lg ${active ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}>
      <span className="mr-3">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge && <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">{badge}</span>}
   </button>
);

const SchedulingSystem = ({ isLoggedIn, user, handleLogout, isListening, eventAddedKey, speak, setEventActions, setAreEventActionsReady, isVoiceRecognitionEnabled, setIsVoiceRecognitionEnabled, loginMethod }) => {
   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
   const [activeTab, setActiveTab] = useState('dashboard');
   const [showCreateModal, setShowCreateModal] = useState(false);
   const [showTimeSelectionModal, setShowTimeSelectionModal] = useState(false);
   const [globalEvents, setGlobalEvents] = useState([]);
   const [eventsLoaded, setEventsLoaded] = useState(false);
   const [selectedProposal, setSelectedProposal] = useState(null);
   const [globalProposals, setGlobalProposals] = useState([]);
   const [showEditModal, setShowEditModal] = useState(false);
   const [editingEvent, setEditingEvent] = useState(null);

   const handleManualLogout = () => {
      handleLogout();
      alert('로그아웃 되었습니다.');
   };

   const handleSelectProposalForTime = useCallback(proposal => {
      setSelectedProposal(proposal);
      setShowTimeSelectionModal(true);
   }, []);

    const fetchEvents = useCallback(async () => {
      if (!isLoggedIn) return;
      try {
         const token = localStorage.getItem('token');
         if (!token) {
            handleLogout();
            return;
         }
         const response = await fetch(`${API_BASE_URL}/api/events`, {
            headers: { 'x-auth-token': token },
         });
         if (!response.ok) {
            if (response.status === 401) handleLogout();
            throw new Error('Failed to fetch events');
         }
         const data = await response.json();
         const formattedEvents = data.events.map(event => formatEventForClient(event));
         setGlobalEvents(formattedEvents);
         setEventsLoaded(true);
      } catch (error) {
         console.error('Error fetching events:', error.message);
         setEventsLoaded(true);
      }
   }, [isLoggedIn, handleLogout]);

   const handleAddGlobalEvent = useCallback(async eventData => {
      try {
         const token = localStorage.getItem('token');
         if (!token) {
            alert('로그인이 필요합니다.');
            return;
         }
         const payload = {
            title: eventData.title,
            date: eventData.date,
            time: eventData.time,
            color: eventData.color,
            description: eventData.description || '',
            priority: eventData.priority || 3,
            category: eventData.category || 'general',
            isFlexible: false,
            participants: [],
            externalParticipants: [],
         };
         const response = await fetch(`${API_BASE_URL}/api/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
            body: JSON.stringify(payload),
         });
         if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Failed to add event');
         }
         const savedEvent = await response.json();
         const newEvent = formatEventForClient(savedEvent, eventData.color);
         setGlobalEvents(prevEvents => [...prevEvents, newEvent]);
         return newEvent;
      } catch (error) {
         console.error('Error adding global event:', error.message);
         throw error;
      }
   }, []);

   const handleDeleteEvent = useCallback(async eventId => {
      if (!window.confirm('정말로 이 일정을 삭제하시겠습니까?')) return;
      try {
         const token = localStorage.getItem('token');
         if (!token) {
            alert('로그인이 필요합니다.');
            return;
         }
         const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`, {
            method: 'DELETE',
            headers: { 'x-auth-token': token },
         });
         if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Failed to delete event');
         }
         setGlobalEvents(prevEvents => prevEvents.filter(event => event.id !== eventId));
         alert('일정이 성공적으로 삭제되었습니다!');
      } catch (error) {
         console.error('Error deleting event:', error);
         alert(`일정 삭제 실패: ${error.message}`);
      }
   }, []);

   useEffect(() => {
       if (setEventActions) {
           setEventActions({ addEvent: handleAddGlobalEvent, deleteEvent: handleDeleteEvent });
           setAreEventActionsReady(true);
       }
   }, [setEventActions, handleAddGlobalEvent, handleDeleteEvent, setAreEventActionsReady]);

   const handleEditEvent = useCallback(event => {
      setEditingEvent(event);
      setShowEditModal(true);
   }, []);

   const handleUpdateEvent = useCallback(async (eventData, eventId) => {
      try {
         const token = localStorage.getItem('token');
         if (!token) {
            alert('로그인이 필요합니다.');
            return;
         }
         const payload = { title: eventData.title, date: eventData.date, time: eventData.time, color: eventData.color };
         const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
            body: JSON.stringify(payload),
         });
         if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Failed to update event');
         }
         const updatedEventFromServer = await response.json();
         const updatedEventForClient = formatEventForClient(updatedEventFromServer);
         setGlobalEvents(prevEvents => prevEvents.map(event => (event.id === updatedEventForClient.id ? updatedEventForClient : event)));
         setShowEditModal(false);
         setEditingEvent(null);
         alert('일정이 성공적으로 수정되었습니다!');
      } catch (error) {
         console.error('Error updating event:', error);
         alert(`일정 수정 실패: ${error.message}`);
      }
   }, []);

   useEffect(() => {
      if (isLoggedIn && !eventsLoaded) {
         fetchEvents();
      }
   }, [isLoggedIn, eventsLoaded, fetchEvents]);

   const { todayEvents, upcomingEvents } = useMemo(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayEvents = globalEvents.filter(event => {
         const eventDate = new Date(event.date);
         return eventDate.getTime() === today.getTime();
      });

      const upcomingEvents = globalEvents.filter(event => {
         const eventDate = new Date(event.date);
         return eventDate > today;
      });

      return { todayEvents, upcomingEvents };
   }, [globalEvents]);

   return (
      <div className="flex flex-col h-screen bg-gray-50">
         <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex-shrink-0">
            <div className="flex items-center justify-between">
               <div className="flex items-center">
                  <button className="md:hidden mr-3 text-gray-600 hover:text-gray-800" onClick={() => setIsSidebarOpen(true)}>
                     <MenuIcon size={24} />
                  </button>
                  <button onClick={() => setActiveTab('dashboard')} className="flex items-center cursor-pointer">
                     <div className="relative w-10 h-10 rounded-lg mr-3">
                        <img src="/image.png" alt="MeetAgent Logo" className="w-full h-full object-cover rounded-lg" />
                        {loginMethod && (
                           <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${loginMethod === 'google' ? 'bg-green-500' : 'bg-red-500'} border-2 border-white z-10`}></div>
                        )}
                     </div>
                     <h1 className="text-xl font-bold text-gray-800 hidden sm:block">MeetAgent</h1>
                  </button>
               </div>
               <div className="flex items-center">
                  <button className="text-gray-600 mr-4 hover:text-gray-800" onClick={() => setActiveTab('googleCalendar')}>
                     <Calendar size={20} />
                  </button>
                  {isLoggedIn && (
                     <button className="w-auto min-w-[40px] h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center cursor-pointer px-3 mr-2" onClick={() => alert('프로필 페이지로 이동 (구현 예정)')}>
                        {user && user.firstName ? user.firstName : '프로필'}
                     </button>
                  )}
                  <button 
                     onClick={() => setIsVoiceRecognitionEnabled(prev => !prev)} 
                     title={isVoiceRecognitionEnabled ? "음성 인식 활성화됨 (클릭하여 비활성화)" : "음성 인식 비활성화됨 (클릭하여 활성화)"} 
                     aria-label={isVoiceRecognitionEnabled ? "음성 인식 비활성화" : "음성 인식 활성화"}
                     className={`mr-2 sm:mr-4 text-xl transition-colors ${isVoiceRecognitionEnabled ? 'text-blue-500 hover:text-blue-600' : 'text-gray-400 hover:text-gray-500'}`}>
                     {isVoiceRecognitionEnabled ? '🎙️' : '🔇'}
                  </button>
                  <button 
                     className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center cursor-pointer" 
                     onClick={handleManualLogout}
                     aria-label="로그아웃"
                     title="로그아웃">
                     <LogOut size={16} />
                  </button>
               </div>
            </div>
         </header>

         <div className="flex flex-1 overflow-hidden">
            <div className={`fixed inset-0 bg-black md:hidden ${isSidebarOpen ? 'bg-opacity-50' : 'bg-opacity-0 pointer-events-none'} transition-opacity duration-300 ease-in-out z-30`} onClick={() => setIsSidebarOpen(false)}></div>
            <nav className={`fixed md:relative inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out w-64 bg-white border-r border-gray-200 p-6 z-40 shadow-lg md:shadow-none`}>
               <div className="flex justify-between items-center mb-6 md:hidden">
                  <h2 className="text-lg font-bold">메뉴</h2>
                  <button onClick={() => setIsSidebarOpen(false)}><X size={24} /></button>
               </div>
               <div className="mb-6">
                  <button onClick={() => { setShowCreateModal(true); setIsSidebarOpen(false); }} className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center justify-center">
                     <span>+ 새 일정 조율</span>
                  </button>
               </div>
               <div className="space-y-1">
                  <NavItem icon={<Calendar size={18} />} label="대시보드" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} />
                  <NavItem icon={<Clock size={18} />} label="나의 일정" active={activeTab === 'events'} onClick={() => { setActiveTab('events'); setIsSidebarOpen(false); }} />
                  <NavItem icon={<Calendar size={18} />} label="Google 캘린더" active={activeTab === 'googleCalendar'} onClick={() => { setActiveTab('googleCalendar'); setIsSidebarOpen(false); }} />
                  <NavItem icon={<Users size={18} />} label="조율 내역" active={activeTab === 'proposals'} onClick={() => { setActiveTab('proposals'); setIsSidebarOpen(false); }} badge="3" />
                  <NavItem icon={<UserPlus size={18} />} label="내 AI 비서" active={activeTab === 'agent'} onClick={() => { setActiveTab('agent'); setIsSidebarOpen(false); }} />
               </div>
            </nav>

            <main className="flex-1 overflow-y-auto p-4 sm:p-6">
               {activeTab === 'dashboard' && <DashboardTab onSelectTime={handleSelectProposalForTime} proposals={globalProposals} todayEvents={todayEvents} upcomingEvents={upcomingEvents} />}
               {activeTab === 'proposals' && <ProposalsTab onSelectTime={handleSelectProposalForTime} proposals={globalProposals} />}
               {activeTab === 'events' && <EventsTab events={globalEvents} onAddEvent={handleAddGlobalEvent} isLoggedIn={isLoggedIn} onDeleteEvent={handleDeleteEvent} onEditEvent={handleEditEvent} />}
               {activeTab === 'googleCalendar' && <MyCalendar isListening={isListening} onEventAdded={eventAddedKey} isVoiceRecognitionEnabled={isVoiceRecognitionEnabled} onToggleVoiceRecognition={() => setIsVoiceRecognitionEnabled(prev => !prev)} />}
               {activeTab === 'agent' && <AgentTab />}
            </main>
         </div>

         {showCreateModal && <CreateProposalModal onClose={() => setShowCreateModal(false)} onProposalCreated={newProposal => { setGlobalProposals(prev => [...prev, { ...newProposal, id: newProposal._id || newProposal.id }]); }} />}
         {showTimeSelectionModal && selectedProposal && <TimeSelectionModal onClose={() => { setShowTimeSelectionModal(false); setSelectedProposal(null); }} proposal={selectedProposal} onFinalize={newEvent => { setGlobalEvents(prevEvents => [...prevEvents, formatEventForClient(newEvent, 'green')]); setShowTimeSelectionModal(false); setSelectedProposal(null); }} />}
         {showEditModal && editingEvent && <EventFormModal onClose={() => { setShowEditModal(false); setEditingEvent(null); }} onSubmitEvent={handleUpdateEvent} event={editingEvent} />}
      </div>
   );
};

// Toggle switch styles are handled by Tailwind CSS classes

export default SchedulingSystem;