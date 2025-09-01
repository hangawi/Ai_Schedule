import React, { useState, useEffect, useCallback } from 'react';
import moment from 'moment';
import {
   ChevronDown,
   ChevronUp,
   Calendar,
   Clock,
   Users,
   UserPlus,
   Star,
   LogOut,
   X,
   Menu as MenuIcon,
} from 'lucide-react';
import MyCalendar from './Calendar';

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

const SchedulingSystem = ({ isLoggedIn, user, handleLogout, isListening, eventAddedKey, speak, setEventActions, setAreEventActionsReady, isVoiceRecognitionEnabled, setIsVoiceRecognitionEnabled }) => {
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

   return (
      <div className="flex flex-col h-screen bg-gray-50">
         <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex-shrink-0">
            <div className="flex items-center justify-between">
               <div className="flex items-center">
                  <button className="md:hidden mr-3 text-gray-600 hover:text-gray-800" onClick={() => setIsSidebarOpen(true)}>
                     <MenuIcon size={24} />
                  </button>
                  <button onClick={() => setActiveTab('dashboard')} className="flex items-center cursor-pointer">
                     <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold mr-3">
                        MA
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
                  <button onClick={() => setIsVoiceRecognitionEnabled(prev => !prev)} title={isVoiceRecognitionEnabled ? "음성 인식 활성화됨 (클릭하여 비활성화)" : "음성 인식 비활성화됨 (클릭하여 활성화)"} className={`mr-2 sm:mr-4 text-xl transition-colors ${isVoiceRecognitionEnabled ? (isListening ? 'text-red-500 hover:text-red-600' : 'text-blue-500 hover:text-blue-600') : 'text-gray-400 hover:text-gray-500'}`}>
                     {isVoiceRecognitionEnabled ? (isListening ? '🎤' : '🎙️') : '🔇'}
                  </button>
                  <button className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center cursor-pointer" onClick={handleManualLogout}>
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
               {activeTab === 'googleCalendar' && <MyCalendar isListening={isListening} onEventAdded={eventAddedKey} isVoiceRecognitionEnabled={isVoiceRecognitionEnabled} />}
               {activeTab === 'agent' && <AgentTab />}
            </main>
         </div>

         {showCreateModal && <CreateProposalModal onClose={() => setShowCreateModal(false)} onProposalCreated={newProposal => { setGlobalProposals(prev => [...prev, { ...newProposal, id: newProposal._id || newProposal.id }]); }} />}
         {showTimeSelectionModal && selectedProposal && <TimeSelectionModal onClose={() => { setShowTimeSelectionModal(false); setSelectedProposal(null); }} proposal={selectedProposal} onFinalize={newEvent => { setGlobalEvents(prevEvents => [...prevEvents, formatEventForClient(newEvent, 'green')]); setShowTimeSelectionModal(false); setSelectedProposal(null); }} />}
         {showEditModal && editingEvent && <EventFormModal onClose={() => { setShowEditModal(false); setEditingEvent(null); }} onSubmitEvent={handleUpdateEvent} event={editingEvent} />}
      </div>
   );
};

// 네비게이션 아이템 컴포넌트
const NavItem = ({ icon, label, active, onClick, badge }) => (
   <button onClick={onClick} className={`w-full flex items-center px-3 py-2 rounded-lg ${active ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}>
      <span className="mr-3">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge && <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">{badge}</span>}
   </button>
);

// 일정 추가/수정 모달
const EventFormModal = ({ onClose, onSubmitEvent, event }) => {
   const [title, setTitle] = useState(event ? event.title : '');
   const [date, setDate] = useState(event ? event.date : '');
   const [time, setTime] = useState(event ? event.time : '');
   const [color, setColor] = useState(event ? event.color : 'blue');

   const isEditMode = !!event;

   const handleSubmit = async () => {
      if (title && date && time) {
         await onSubmitEvent({ title, date, time, color }, event ? event.id : null);
      } else {
         alert('모든 필드를 채워주세요.');
      }
   };

   return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
         <div className="bg-white w-11/12 max-w-md rounded-lg shadow-xl p-6">
            <div className="flex justify-between items-center mb-4">
               <h2 className="text-xl font-bold text-gray-800">{isEditMode ? '일정 수정' : '새 일정 추가'}</h2>
               <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                  <input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" value={title} onChange={e => setTitle(e.target.value)} />
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                  <input type="date" className="w-full border border-gray-300 rounded-md px-3 py-2" value={date} onChange={e => setDate(e.target.value)} />
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">시간</label>
                  <input type="time" className="w-full border border-gray-300 rounded-md px-3 py-2" value={time} onChange={e => setTime(e.target.value)} />
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">색상</label>
                  <select className="w-full border border-gray-300 rounded-md px-3 py-2" value={color} onChange={e => setColor(e.target.value)}>
                     <option value="blue">파랑</option>
                     <option value="purple">보라</option>
                     <option value="green">초록</option>
                     <option value="red">빨강</option>
                  </select>
               </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
               <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">취소</button>
               <button onClick={handleSubmit} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">{isEditMode ? '수정' : '추가'}</button>
            </div>
         </div>
      </div>
   );
};

// 대시보드 탭
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

// 통계 카드 컴포넌트
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

// 조율 요청 카드 컴포넌트
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

// 일정 카드 컴포넌트
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

// 조율 내역 탭
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

// 조율 행 컴포넌트
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

// 일정 탭 컴포넌트
const EventsTab = ({ events, onAddEvent, isLoggedIn, onDeleteEvent, onEditEvent }) => {
   const [showAddEventModal, setShowAddEventModal] = useState(false);
   const [currentMonth, setCurrentMonth] = useState(new Date());

   const goToPreviousMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
   const goToNextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

   const handleAddEvent = async newEventData => {
      try {
         await onAddEvent(newEventData);
         setShowAddEventModal(false);
         alert('일정이 성공적으로 추가되었습니다!');
      } catch (error) {
         alert(`일정 추가 실패: ${error.message}`);
      }
   };

   const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
   const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

   const calendarDates = Array.from({ length: getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth()) }, (_, i) => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1));

   if (!isLoggedIn) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">로그인 후 일정을 확인할 수 있습니다.</p></div>;

   const getEventColorClass = (color) => ({ blue: 'border-blue-500', purple: 'border-purple-500', green: 'border-green-500', red: 'border-red-500' }[color] || 'border-gray-500');

   return (
      <div>
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2 sm:mb-0">나의 일정</h2>
            <div className="flex items-center space-x-3">
               <button className="border border-gray-300 rounded-md px-3 py-1.5 text-sm" onClick={() => setCurrentMonth(new Date())}>오늘</button>
               <button className="bg-blue-500 text-white rounded-md px-3 py-1.5 text-sm" onClick={() => setShowAddEventModal(true)}>+ 일정 추가</button>
            </div>
         </div>

         <div className="flex justify-between items-center mb-4">
            <button onClick={goToPreviousMonth} className="px-3 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">이전 달</button>
            <h3 className="text-xl font-semibold text-gray-800">{currentMonth.toLocaleString('ko-KR', { year: 'numeric', month: 'long' })}</h3>
            <button onClick={goToNextMonth} className="px-3 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">다음 달</button>
         </div>

         <div className="md:hidden space-y-4">
            {calendarDates.map(date => {
               const dayEvents = events.filter(event => new Date(event.date).toDateString() === date.toDateString());
               if (dayEvents.length === 0) return null;
               return (
                  <div key={date.toISOString()}>
                     <p className="font-semibold text-blue-600 pl-2 mb-2">{moment(date).format('M월 D일 (ddd)')}</p>
                     <div className="bg-white p-3 rounded-lg shadow-sm space-y-3">
                        {dayEvents.map(event => (
                           <div key={event.id} className={`pl-3 border-l-4 ${getEventColorClass(event.color)}`}>
                              <div className="flex justify-between items-center">
                                 <div>
                                    <p className="font-medium text-gray-800">{event.title}</p>
                                    <p className="text-sm text-gray-500">{event.time}</p>
                                 </div>
                                 <div className="flex items-center space-x-3">
                                    <button onClick={() => onEditEvent(event)} className="text-gray-400 hover:text-blue-600">✏️</button>
                                    <button onClick={() => onDeleteEvent(event.id)} className="text-gray-400 hover:text-red-600"><X size={16} /></button>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               );
            })}
         </div>

         <div className="hidden md:grid grid-cols-7 gap-1">
            {['일', '월', '화', '수', '목', '금', '토'].map(day => <div key={day} className="text-center font-medium text-gray-500 py-2">{day}</div>)}
            {Array.from({ length: getFirstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth()) }).map((_, idx) => <div key={`empty-${idx}`} className="border rounded-lg bg-gray-50"></div>)}
            {calendarDates.map(date => {
               const isToday = date.toDateString() === new Date().toDateString();
               const dayEvents = events.filter(event => new Date(event.date).toDateString() === date.toDateString());
               return (
                  <div key={date.toISOString()} className={`h-36 p-1 border rounded-lg ${isToday ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
                     <div className="text-right text-sm mb-1">{date.getDate()}</div>
                     <div className="overflow-y-auto h-24 space-y-1">
                        {dayEvents.map(event => (
                           <div key={event.id} className={`text-xs p-1 rounded truncate flex justify-between items-center bg-${event.color}-100 text-${event.color}-800`}>
                              <span className="font-medium">{event.title}</span>
                              <div className="flex items-center transition-opacity">
                                 <button onClick={() => onEditEvent(event)} className="text-gray-500 hover:text-blue-600">✏️</button>
                                 <button onClick={() => onDeleteEvent(event.id)} className="text-gray-500 hover:text-red-600"><X size={10} /></button>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               );
            })}
         </div>

         {showAddEventModal && <EventFormModal onClose={() => setShowAddEventModal(false)} onSubmitEvent={handleAddEvent} />}
      </div>
   );
};

// AI 비서 설정 탭
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

// 일정 조율 생성 모달
const CreateProposalModal = ({ onClose, onProposalCreated }) => {
   const [title, setTitle] = useState('');
   const [description, setDescription] = useState('');
   const [duration, setDuration] = useState('60');
   const [preferredTimeRangesInput, setPreferredTimeRangesInput] = useState([{ startDate: '', endDate: '', startTime: '', endTime: '' }]);
   const [priority, setPriority] = useState('3');
   const [participants, setParticipants] = useState([]);
   const [externalParticipants, setExternalParticipants] = useState('');
   const [searchQuery, setSearchQuery] = useState('');
   const [searchResults, setSearchResults] = useState([]);

   const dummyUsers = [
      { id: '60d5ec49a4d2a13e4c8b4567', name: '김철수', email: 'kim@example.com' },
      { id: '60d5ec49a4d2a13e4c8b4568', name: '이영희', email: 'lee@example.com' },
      { id: '60d5ec49a4d2a13e4c8b4569', name: '박민수', email: 'park@example.com' },
   ];

   const handleSearchChange = e => {
      const query = e.target.value;
      setSearchQuery(query);
      if (query.length > 0) {
         const filteredUsers = dummyUsers.filter(user => user.name.includes(query) || user.email.includes(query));
         setSearchResults(filteredUsers);
      } else {
         setSearchResults([]);
      }
   };

   const handleAddParticipant = user => {
      if (!participants.some(p => p.id === user.id)) {
         setParticipants([...participants, user]);
         setSearchQuery('');
         setSearchResults([]);
      }
   };

   const handleRemoveParticipant = id => setParticipants(participants.filter(p => p.id !== id));
   const handleAddTimeRange = () => setPreferredTimeRangesInput([...preferredTimeRangesInput, { startDate: '', endDate: '', startTime: '', endTime: '' }]);
   const handleRemoveTimeRange = index => setPreferredTimeRangesInput(preferredTimeRangesInput.filter((_, i) => i !== index));
   const handleTimeRangeChange = (index, field, value) => {
      const newRanges = [...preferredTimeRangesInput];
      newRanges[index][field] = value;
      setPreferredTimeRangesInput(newRanges);
   };

   const handleSubmit = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
         alert('로그인이 필요합니다.');
         onClose();
         return;
      }
      const proposalData = {
         title, description, duration: parseInt(duration),
         preferredTimeRanges: preferredTimeRangesInput.map(range => range.startDate && range.endDate && range.startTime && range.endTime ? { start: new Date(`${range.startDate}T${range.startTime}:00`).toISOString(), end: new Date(`${range.endDate}T${range.endTime}:00`).toISOString() } : null).filter(Boolean),
         participants: participants.map(p => p.id),
         externalParticipants: externalParticipants.split(',').map(email => ({ email: email.trim() })).filter(p => p.email),
         priority: parseInt(priority),
      };
      try {
         const response = await fetch('http://localhost:5000/api/proposals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
            body: JSON.stringify(proposalData),
         });
         if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Failed to create proposal');
         }
         const data = await response.json();
         alert('일정 조율 요청이 성공적으로 생성되었습니다!');
         onProposalCreated(data);
         onClose();
      } catch (error) {
         console.error('Error creating proposal:', error.message);
         alert(`일정 조율 요청 실패: ${error.message}`);
      }
   };

   return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
         <div className="bg-white w-11/12 max-w-2xl rounded-lg shadow-xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
               <h2 className="text-xl font-bold text-gray-800">새 일정 조율 요청</h2>
               <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                  <input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="일정 제목" value={title} onChange={e => setTitle(e.target.value)} />
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">설명 (선택)</label>
                  <textarea className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="일정에 대한 설명" rows={3} value={description} onChange={e => setDescription(e.target.value)} />
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">소요 시간</label>
                  <select className="w-full border border-gray-300 rounded-md px-3 py-2" value={duration} onChange={e => setDuration(e.target.value)}>
                     <option value="15">15분</option>
                     <option value="30">30분</option>
                     <option value="60">1시간</option>
                     <option value="90">1시간 30분</option>
                     <option value="120">2시간</option>
                  </select>
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">선호 시간 범위</label>
                  {preferredTimeRangesInput.map((range, index) => (
                     <div key={index} className="flex flex-col sm:flex-row items-center mb-2 space-y-2 sm:space-y-0 sm:space-x-2">
                        <input type="date" className="w-full border border-gray-300 rounded-md px-3 py-2" value={range.startDate} onChange={e => handleTimeRangeChange(index, 'startDate', e.target.value)} />
                        <input type="time" className="w-full border border-gray-300 rounded-md px-3 py-2" value={range.startTime} onChange={e => handleTimeRangeChange(index, 'startTime', e.target.value)} />
                        <span className="hidden sm:block">~</span>
                        <input type="date" className="w-full border border-gray-300 rounded-md px-3 py-2" value={range.endDate} onChange={e => handleTimeRangeChange(index, 'endDate', e.target.value)} />
                        <input type="time" className="w-full border border-gray-300 rounded-md px-3 py-2" value={range.endTime} onChange={e => handleTimeRangeChange(index, 'endTime', e.target.value)} />
                        {preferredTimeRangesInput.length > 1 && <button type="button" onClick={() => handleRemoveTimeRange(index)} className="p-2 text-red-500 hover:text-red-700"><X size={18} /></button>}
                     </div>
                  ))}
                  <button type="button" onClick={handleAddTimeRange} className="text-blue-500 text-sm hover:underline">+ 시간 범위 추가</button>
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">우선순위</label>
                  <select className="w-full border border-gray-300 rounded-md px-3 py-2" value={priority} onChange={e => setPriority(e.target.value)}>
                     <option value="1">1 - 매우 낮음</option>
                     <option value="2">2 - 낮음</option>
                     <option value="3">3 - 보통</option>
                     <option value="4">4 - 높음</option>
                     <option value="5">5 - 매우 높음</option>
                  </select>
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">내부 참가자</label>
                  <div className="flex items-center">
                     <input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="이름 또는 이메일로 검색" value={searchQuery} onChange={e => handleSearchChange(e)} />
                     <button className="ml-2 p-2 border border-gray-300 rounded-md" onClick={() => handleAddParticipant({ id: 'dummyId' + Math.random(), name: searchQuery })}><UserPlus size={18} /></button>
                  </div>
                  {searchResults.length > 0 && searchQuery && (
                     <div className="mt-2 border border-gray-200 rounded-md bg-white shadow-lg max-h-40 overflow-y-auto">
                        {searchResults.map(user => (
                           <div key={user.id} className="p-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center" onClick={() => handleAddParticipant(user)}>
                              <span>{user.name} ({user.email})</span>
                              <UserPlus size={16} className="text-blue-500" />
                           </div>
                        ))}
                     </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                     {participants.map(p => <ParticipantChip key={p.id} name={p.name} onRemove={() => handleRemoveParticipant(p.id)} />)}
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">외부 참가자 (이메일, 쉼표로 구분)</label>
                  <textarea className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="external1@example.com, external2@example.com" rows={2} value={externalParticipants} onChange={e => setExternalParticipants(e.target.value)} />
               </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
               <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">취소</button>
               <button onClick={handleSubmit} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">조율 요청 생성</button>
            </div>
         </div>
      </div>
   );
};

const TimeSelectionModal = ({ onClose, proposal, onFinalize }) => {
   const [selectedTimeIndex, setSelectedTimeIndex] = useState(null);

   const handleFinalize = async () => {
      if (selectedTimeIndex === null) {
         alert('시간을 선택해주세요.');
         return;
      }
      const token = localStorage.getItem('token');
      if (!token) {
         alert('로그인이 필요합니다.');
         return;
      }
      const finalTime = proposal.suggestedTimes[selectedTimeIndex].startTime;
      try {
         const response = await fetch(`${API_BASE_URL}/api/proposals/${proposal._id}/finalize`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
            body: JSON.stringify({ finalTime }),
         });
         if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Failed to finalize time');
         }
         const newEvent = await response.json();
         onFinalize(newEvent);
         onClose();
      } catch (error) {
         console.error('Error finalizing time:', error);
         alert(`시간 확정에 실패했습니다: ${error.message}`);
      }
   };

   return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
         <div className="bg-white w-11/12 max-w-md rounded-lg shadow-xl p-6">
            <div className="flex justify-between items-center mb-4">
               <h2 className="text-xl font-bold text-gray-800">일정 시간 확정</h2>
               <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
            </div>
            <p className="text-gray-600 mb-4">
               '<span className="font-semibold">{proposal.title}</span>' 일정에 대한 시간을 확정해주세요.
            </p>
            {proposal.suggestedTimes && proposal.suggestedTimes.length > 0 ? (
               <div className="space-y-3 mb-6">
                  {proposal.suggestedTimes.map((time, index) => (
                     <div key={index} className={`p-3 border rounded-md cursor-pointer ${selectedTimeIndex === index ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`} onClick={() => setSelectedTimeIndex(index)}>
                        <p className="font-medium text-gray-800">{new Date(time.startTime).toLocaleString('ko-KR', { dateStyle: 'full', timeStyle: 'short' })}{' '}-{new Date(time.endTime).toLocaleString('ko-KR', { timeStyle: 'short' })}</p>
                        {time.score !== undefined && (
                           <div className="flex items-center mt-1">
                              <span className="text-sm font-semibold mr-2" style={{ color: time.score >= 90 ? '#22C55E' : time.score >= 70 ? '#F59E0B' : '#EF4444' }}>{time.score}</span>
                              <span className="text-xs text-gray-500">{time.description}</span>
                           </div>
                        )}
                     </div>
                  ))}
               </div>
            ) : (
               <p className="text-gray-500 mb-6">제안된 시간이 없습니다.</p>
            )}
            <div className="flex justify-end space-x-3">
               <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">취소</button>
               <button onClick={handleFinalize} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600" disabled={proposal.suggestedTimes.length === 0 || selectedTimeIndex === null}>시간 확정</button>
            </div>
         </div>
      </div>
   );
};

// 참가자 칩 컴포넌트
const ParticipantChip = ({ name, onRemove }) => (
   <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center">
      {name}
      <button onClick={onRemove} className="ml-1 text-blue-500 hover:text-blue-700"><X size={14} /></button>
   </div>
);

// CSS Override for Toggle Switch
const style = document.createElement('style');
style.textContent = `
  input:checked ~ .dot {
    transform: translateX(100%);
    background-color: #3b82f6;
  }
`;
document.head.appendChild(style);

export default SchedulingSystem;
