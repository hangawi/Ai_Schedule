import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
   Calendar,
   CalendarCheck,
   LogOut,
   X,
   Menu as MenuIcon,
   LayoutDashboard,
   ListTodo,
   Bot,
   History,
   User,
   Clipboard,
   ClipboardX
} from 'lucide-react';
import MyCalendar from './components/calendar/Calendar';
import EventFormModal from './components/forms/EventFormModal';
import DashboardTab from './components/tabs/DashboardTab';
import ProposalsTab from './components/tabs/ProposalsTab';
import EventsTab from './components/tabs/EventsTab';
import AgentTab from './components/tabs/AgentTab';
import ProfileTab from './components/tabs/ProfileTab';
import CoordinationTab from './components/tabs/CoordinationTab';
import CreateProposalModal from './components/forms/CreateProposalModal';
import TimeSelectionModal from './components/forms/TimeSelectionModal';
import CustomAlertModal from './components/modals/CustomAlertModal';
import ChatBox from './components/chat/ChatBox';
import CommandModal from './components/modals/CommandModal';
import AutoDetectedScheduleModal from './components/modals/AutoDetectedScheduleModal';
import MobileStatusIndicator from './components/indicators/MobileStatusIndicator';
import NotificationModal from './components/modals/NotificationModal';
import { coordinationService } from './services/coordinationService';

// 백그라운드 음성 인식 관련 imports
import BackgroundCallIndicator from './components/indicators/BackgroundCallIndicator';
import { useIntegratedVoiceSystem } from './hooks/useIntegratedVoiceSystem';
import { useChat } from './hooks/useChat';

// NavItem component
const NavItem = ({ icon, label, active, onClick, badge }) => (
   <button
      className={`w-full flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
         active ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
      }`}
      onClick={onClick}
   >
      {icon}
      <span className="ml-3 flex-1 text-left">{label}</span>
      {badge && (
         <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] h-5 flex items-center justify-center">
            {badge}
         </span>
      )}
   </button>
);

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


const SchedulingSystem = ({ isLoggedIn, user, handleLogout, speak, isVoiceRecognitionEnabled, setIsVoiceRecognitionEnabled, isClipboardMonitoring, setIsClipboardMonitoring, loginMethod }) => {
   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
   const [activeTab, setActiveTab] = useState(() => {
     const savedTab = localStorage.getItem('activeTab');
     return savedTab || 'dashboard';
   });

   // Enhanced setActiveTab that includes browser history management
   const enhancedSetActiveTab = useCallback((newTab) => {
     setActiveTab(newTab);
     localStorage.setItem('activeTab', newTab);

     // Clear room state when switching away from coordination tab
     if (newTab !== 'coordination') {
       localStorage.removeItem('currentRoomId');
       localStorage.removeItem('currentRoomData');
     }

     // Push new state to browser history
     window.history.pushState({ tab: newTab }, '', `#${newTab}`);
   }, []);

   // Handle browser navigation (back/forward buttons)
   useEffect(() => {
     const handlePopState = (event) => {
       const tab = event.state?.tab || 'dashboard';
       const roomState = event.state?.roomState || null;
       const roomId = event.state?.roomId || null;

       setActiveTab(tab);
       localStorage.setItem('activeTab', tab);

       // Handle room navigation
       if (tab === 'coordination') {
         if (roomState === 'inRoom' && roomId) {
           // Forward navigation - restore room state
           window.dispatchEvent(new CustomEvent('restoreRoom', { detail: { roomId } }));
         } else if (!roomState) {
           // Back navigation - clear current room state
           const currentRoomId = localStorage.getItem('currentRoomId');
           if (currentRoomId) {
             localStorage.removeItem('currentRoomId');
             localStorage.removeItem('currentRoomData');
             // Trigger a custom event to notify CoordinationTab
             window.dispatchEvent(new CustomEvent('clearCurrentRoom'));
           }
         }
       }
     };

     window.addEventListener('popstate', handlePopState);
     return () => window.removeEventListener('popstate', handlePopState);
   }, []);

   // Initialize browser history with current tab on component mount
   useEffect(() => {
     window.history.replaceState({ tab: activeTab }, '', `#${activeTab}`);
   }, []); // Only run once on mount
   const [showCreateModal, setShowCreateModal] = useState(false);
   const [showTimeSelectionModal, setShowTimeSelectionModal] = useState(false);
   const [globalEvents, setGlobalEvents] = useState([]);
   const [eventsLoaded, setEventsLoaded] = useState(false);
   const [selectedProposal, setSelectedProposal] = useState(null);
   const [globalProposals, setGlobalProposals] = useState([]);
   const [showEditModal, setShowEditModal] = useState(false);
   const [editingEvent, setEditingEvent] = useState(null);
   
   // 교환 요청 수 관리
   const [exchangeRequestCount, setExchangeRequestCount] = useState(0);
   const [eventAddedKey, setEventAddedKey] = useState(0);
   const [eventActions, setEventActions] = useState(null);
   const [areEventActionsReady, setAreEventActionsReady] = useState(false);
   const [isProfileEditing, setIsProfileEditing] = useState(false);
   const [pendingRequest, setPendingRequest] = useState(null); // 챗봇 확인 대기 중인 시간 변경 요청

   // CustomAlert 상태
   const [alertModal, setAlertModal] = useState({
     isOpen: false,
     title: '',
     message: '',
     type: 'info',
     showCancel: false,
     onConfirm: null
   });

   // Alert 표시 유틸리티 함수
   const showAlert = useCallback((message, type = 'info', title = '', showCancel = false, onConfirm = null) => {
     setAlertModal({
       isOpen: true,
       title,
       message,
       type,
       showCancel,
       onConfirm
     });
   }, []);

   // Alert 닫기 함수
   const closeAlert = useCallback(() => {
     setAlertModal(prev => ({ ...prev, isOpen: false }));
   }, []);


   // 로그인 후 교환 요청 수 자동 로드
   useEffect(() => {
     const loadExchangeRequestCount = async () => {
       if (!isLoggedIn || !user) return;
       
       try {
         const result = await coordinationService.getExchangeRequestsCount();
         if (result.success) {
           setExchangeRequestCount(result.count);
         }
       } catch (error) {
         setExchangeRequestCount(0);
       }
     };

     loadExchangeRequestCount();
   }, [isLoggedIn, user]);

   // 주기적으로 교환 요청 수 업데이트 (선택적)
   useEffect(() => {
     if (!isLoggedIn || !user) return;

     const interval = setInterval(async () => {
       try {
         const result = await coordinationService.getExchangeRequestsCount();
         if (result.success) {
           setExchangeRequestCount(result.count);
         }
       } catch (error) {
         // Silently handle refresh errors
       }
     }, 30000); // 30초마다 업데이트

     return () => clearInterval(interval);
   }, [isLoggedIn, user]);

   // 교환 요청 수 새로고침 함수
   const refreshExchangeRequestCount = useCallback(async () => {
     if (!isLoggedIn || !user) return;
     
     try {
       const result = await coordinationService.getExchangeRequestsCount();
       if (result.success) {
         setExchangeRequestCount(result.count);
       }
     } catch (error) {
       // Silently handle refresh errors
     }
   }, [isLoggedIn, user]);

   const handleManualLogout = () => {
      handleLogout();
      showAlert('로그아웃 되었습니다.', 'success', '로그아웃');
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
         setEventsLoaded(true);
      }
   }, [isLoggedIn, handleLogout]);

   const handleAddGlobalEvent = useCallback(async eventData => {
      try {
         const token = localStorage.getItem('token');
         if (!token) {
            showAlert('로그인이 필요합니다.', 'error', '로그인 필요');
            return;
         }

         // Handle different input formats
         let date, time, duration;

         if (eventData.startDateTime) {
            // Format from chat: startDateTime and endDateTime
            const startDate = new Date(eventData.startDateTime);
            const endDate = eventData.endDateTime ? new Date(eventData.endDateTime) : new Date(startDate.getTime() + 60 * 60 * 1000);

            date = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
            time = startDate.toTimeString().substring(0, 5); // HH:MM
            duration = Math.round((endDate - startDate) / (60 * 1000)); // duration in minutes
         } else {
            // Original format: separate date and time
            date = eventData.date;
            time = eventData.time;
            duration = eventData.duration || 60;
         }

         const payload = {
            title: eventData.title,
            date: date,
            time: time,
            duration: duration,
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
         throw error;
      }
   }, [showAlert]);

   const handleDeleteEvent = useCallback(async eventId => {
      const performDelete = async () => {
         try {
            const token = localStorage.getItem('token');
            if (!token) {
               showAlert('로그인이 필요합니다.', 'error', '로그인 필요');
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
            showAlert('일정이 성공적으로 삭제되었습니다!', 'success', '삭제 완료');
         } catch (error) {
            showAlert(`일정 삭제 실패: ${error.message}`, 'error', '삭제 실패');
         }
      };
      
      showAlert('정말로 이 일정을 삭제하시겠습니까?', 'warning', '일정 삭제', true, performDelete);
   }, [showAlert]);

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
            showAlert('로그인이 필요합니다.', 'error', '로그인 필요');
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
         showAlert('일정이 성공적으로 수정되었습니다!', 'success', '수정 완료');
      } catch (error) {
         showAlert(`일정 수정 실패: ${error.message}`, 'error', '수정 실패');
      }
   }, [showAlert]);

   useEffect(() => {
      if (isLoggedIn && !eventsLoaded) {
         fetchEvents();
      }
   }, [isLoggedIn, eventsLoaded, fetchEvents]);

   // eventAddedKey가 변경될 때마다 로컬 이벤트를 다시 가져옴 (실시간 동기화)
   useEffect(() => {
      if (isLoggedIn && eventAddedKey > 0) {
         fetchEvents();
      }
   }, [eventAddedKey, isLoggedIn, fetchEvents]);

   // eventActions 설정
   useEffect(() => {
      if (isLoggedIn) {
         setEventActions({
            addEvent: handleAddGlobalEvent,
            deleteEvent: handleDeleteEvent,
            editEvent: handleEditEvent
         });
         setAreEventActionsReady(true);
      }
   }, [isLoggedIn, handleAddGlobalEvent, handleDeleteEvent, handleEditEvent]);

   // SchedulingSystem 내에서 useChat 호출
   const { handleChatMessage } = useChat(isLoggedIn, setEventAddedKey, eventActions);

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

   // 탭별 챗봇 메시지 처리 함수
   const handleTabSpecificChatMessage = async (message, additionalContext = {}) => {
      try {
         // 현재 탭에 따라 다른 처리
         switch (activeTab) {
            case 'profile':
               // 내 프로필 탭 - 로컬 일정 관리
               return await handleChatMessage(message, {
                  context: 'profile',
                  tabType: 'local',
                  currentEvents: globalEvents,
                  ...additionalContext
               });

            case 'events':
               // 나의 일정 탭 - 로컬 일정 관리
               return await handleChatMessage(message, {
                  context: 'events',
                  tabType: 'local',
                  currentEvents: globalEvents,
                  ...additionalContext
               });

            case 'googleCalendar':
               // Google 캘린더 탭 - Google 캘린더 연동
               return await handleChatMessage(message, {
                  context: 'googleCalendar',
                  tabType: 'google',
                  currentEvents: globalEvents,
                  ...additionalContext
               });

            case 'coordination':
               // 조율방 탭 - 시간 변경 요청
               const currentRoomId = localStorage.getItem('currentRoomId');
               const result = await handleChatMessage(message, {
                  context: 'coordination',
                  roomId: currentRoomId,
                  currentEvents: globalEvents,
                  pendingRequest: pendingRequest,
                  ...additionalContext
               });

               // 응답 처리: pendingRequest 상태 업데이트
               if (result.needsConfirmation && result.pendingRequest) {
                  console.log('✅ [SchedulingSystem] Saving pending request:', result.pendingRequest);
                  setPendingRequest(result.pendingRequest);
               } else if (result.clearPending) {
                  console.log('✅ [SchedulingSystem] Clearing pending request');
                  setPendingRequest(null);
               }

               return result;

            default:
               // 기본값 - 일반 처리
               return await handleChatMessage(message, {
                  context: activeTab,
                  tabType: 'default',
                  currentEvents: globalEvents,
                  ...additionalContext
               });
         }
      } catch (error) {
         return {
            success: false,
            message: '메시지 처리 중 오류가 발생했습니다.'
         };
      }
   };

   // useIntegratedVoiceSystem을 SchedulingSystem 내에서 호출
   const {
      isListening,
      modalText,
      setModalText,
      isBackgroundMonitoring,
      isCallDetected,
      callStartTime,
      detectedSchedules,
      backgroundTranscript,
      toggleBackgroundMonitoring,
      confirmSchedule,
      dismissSchedule,
      voiceStatus,
      isAnalyzing: voiceAnalyzing,
      micVolume,
      notification,
      clearNotification
   } = useIntegratedVoiceSystem(isLoggedIn, isVoiceRecognitionEnabled, eventActions, areEventActionsReady, setEventAddedKey, handleTabSpecificChatMessage);

   return (
      <div className="flex flex-col h-screen bg-gray-50">
         <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex-shrink-0">
            <div className="flex items-center justify-between">
               <div className="flex items-center">
                  <button className="md:hidden mr-3 text-gray-600 hover:text-gray-800" onClick={() => setIsSidebarOpen(true)}>
                     <MenuIcon size={24} />
                  </button>
                  <button onClick={() => enhancedSetActiveTab('dashboard')} className="flex items-center cursor-pointer">
                     <div className="relative w-10 h-10 rounded-lg mr-3">
                        <img src="/image.png" alt="MeetAgent Logo" className="w-full h-full object-cover rounded-lg" />
                        {loginMethod && (
                           <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${loginMethod === 'google' ? 'bg-green-500' : 'bg-red-500'} border-2 border-white z-10`}></div>
                        )}
                     </div>
                     <h1 className="text-xl font-bold text-gray-800 hidden sm:block">MeetAgent</h1>
                  </button>
               </div>
               <div className="flex items-center space-x-1 sm:space-x-2">
                  <button className="hidden sm:block text-gray-600 hover:text-gray-800" onClick={() => enhancedSetActiveTab('googleCalendar')}>
                     <Calendar size={20} />
                  </button>
                  
                  {/* 백그라운드 모니터링 & 클립보드 버튼 */}
                  <div className="hidden sm:flex items-center space-x-2">
                     <button
                        onClick={() => setIsClipboardMonitoring(prev => !prev)}
                        className={`flex items-center px-3 py-2 rounded-full transition-colors duration-200 text-sm ${
                           isClipboardMonitoring
                              ? 'bg-green-100 text-green-600 hover:text-green-700'
                              : 'bg-gray-100 text-gray-600 hover:text-gray-700'
                        }`}
                        title={isClipboardMonitoring ? "클립보드 감지 활성화됨" : "클립보드 감지 비활성화됨"}
                     >
                        <div className="flex items-center space-x-2">
                           {isClipboardMonitoring ?
                              <Clipboard size={16} /> :
                              <ClipboardX size={16} />
                           }
                           <span className="font-medium">
                              {isClipboardMonitoring ? '클립보드 ON' : '클립보드 OFF'}
                           </span>
                        </div>
                     </button>

                     <BackgroundCallIndicator
                        isMonitoring={isBackgroundMonitoring}
                        isCallDetected={isCallDetected}
                        callStartTime={callStartTime}
                        onToggleMonitoring={toggleBackgroundMonitoring}
                        voiceStatus={voiceStatus}
                        isAnalyzing={voiceAnalyzing}
                     />
                  </div>

                  {isLoggedIn && (
                     <button className="hidden sm:flex w-auto min-w-[40px] h-8 bg-blue-100 text-blue-600 rounded-full items-center justify-center cursor-pointer px-3 mr-2" onClick={() => enhancedSetActiveTab('profile')}>
                        {user && user.firstName ? user.firstName : '프로필'}
                     </button>
                  )}
                  <button
                     onClick={() => setIsVoiceRecognitionEnabled(prev => !prev)}
                     title={isVoiceRecognitionEnabled ? "음성 인식 활성화됨 (클릭하여 비활성화)" : "음성 인식 비활성화됨 (클릭하여 활성화)"}
                     aria-label={isVoiceRecognitionEnabled ? "음성 인식 비활성화" : "음성 인식 활성화"}
                     className={`text-lg sm:text-xl transition-colors ${isVoiceRecognitionEnabled ? 'text-blue-500 hover:text-blue-600' : 'text-gray-400 hover:text-gray-500'}`}>
                     {isVoiceRecognitionEnabled ? '🎙️' : '🔇'}
                  </button>
                  <button 
                     className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center cursor-pointer ml-1 sm:ml-2" 
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
                  <NavItem icon={<LayoutDashboard size={18} />} label="대시보드" active={activeTab === 'dashboard'} onClick={() => { enhancedSetActiveTab('dashboard'); setIsSidebarOpen(false); }} />
                  <NavItem icon={<User size={18} />} label="내 프로필" active={activeTab === 'profile'} onClick={() => { enhancedSetActiveTab('profile'); setIsSidebarOpen(false); }} />
                  <NavItem icon={<ListTodo size={18} />} label="나의 일정" active={activeTab === 'events'} onClick={() => { enhancedSetActiveTab('events'); setIsSidebarOpen(false); }} />
                  <NavItem icon={<Calendar size={18} />} label="Google 캘린더" active={activeTab === 'googleCalendar'} onClick={() => { enhancedSetActiveTab('googleCalendar'); setIsSidebarOpen(false); }} />
                  <NavItem icon={<History size={18} />} label="조율 내역" active={activeTab === 'proposals'} onClick={() => { enhancedSetActiveTab('proposals'); setIsSidebarOpen(false); }} />
                  <NavItem icon={<CalendarCheck size={18} />} label="일정 맞추기" active={activeTab === 'coordination'} onClick={() => { enhancedSetActiveTab('coordination'); setIsSidebarOpen(false); }} badge={exchangeRequestCount > 0 ? exchangeRequestCount.toString() : undefined} />
                  <NavItem icon={<Bot size={18} />} label="내 AI 비서" active={activeTab === 'agent'} onClick={() => { enhancedSetActiveTab('agent'); setIsSidebarOpen(false); }} />
               </div>
            </nav>

            <main className="flex-1 overflow-y-auto p-4 sm:p-6">
               {activeTab === 'dashboard' && <DashboardTab onSelectTime={handleSelectProposalForTime} proposals={globalProposals} todayEvents={todayEvents} upcomingEvents={upcomingEvents} />}
               {activeTab === 'proposals' && <ProposalsTab onSelectTime={handleSelectProposalForTime} proposals={globalProposals} />}
               {activeTab === 'events' && <EventsTab events={globalEvents} onAddEvent={handleAddGlobalEvent} isLoggedIn={isLoggedIn} onDeleteEvent={handleDeleteEvent} onEditEvent={handleEditEvent} />}
               {activeTab === 'googleCalendar' && <MyCalendar isListening={isListening} onEventAdded={eventAddedKey} isVoiceRecognitionEnabled={isVoiceRecognitionEnabled} onToggleVoiceRecognition={() => setIsVoiceRecognitionEnabled(prev => !prev)} />}
               {activeTab === 'coordination' && <CoordinationTab user={user} onExchangeRequestCountChange={setExchangeRequestCount} onRefreshExchangeCount={refreshExchangeRequestCount} />}
               {activeTab === 'agent' && <AgentTab />}
               {activeTab === 'profile' && <ProfileTab user={user} onEditingChange={setIsProfileEditing} />}
            </main>
         </div>

         {showCreateModal && <CreateProposalModal onClose={() => setShowCreateModal(false)} onProposalCreated={newProposal => { setGlobalProposals(prev => [...prev, { ...newProposal, id: newProposal._id || newProposal.id }]); }} />}
         {showTimeSelectionModal && selectedProposal && <TimeSelectionModal onClose={() => { setShowTimeSelectionModal(false); setSelectedProposal(null); }} proposal={selectedProposal} onFinalize={newEvent => { setGlobalEvents(prevEvents => [...prevEvents, formatEventForClient(newEvent, 'green')]); setShowTimeSelectionModal(false); setSelectedProposal(null); }} />}
         {showEditModal && editingEvent && <EventFormModal onClose={() => { setShowEditModal(false); setEditingEvent(null); }} onSubmitEvent={handleUpdateEvent} event={editingEvent} />}
         
         <CustomAlertModal
            isOpen={alertModal.isOpen}
            onClose={closeAlert}
            onConfirm={alertModal.onConfirm}
            title={alertModal.title}
            message={alertModal.message}
            type={alertModal.type}
            showCancel={alertModal.showCancel}
         />

         {/* 탭별 컨텍스트를 가진 ChatBox - 내 프로필 탭에서는 편집 모드일 때만 활성화 */}
         {(activeTab !== 'profile' || isProfileEditing) && (
            <ChatBox
               onSendMessage={handleTabSpecificChatMessage}
               speak={speak}
               currentTab={activeTab}
               onEventUpdate={() => setEventAddedKey(prev => prev + 1)}
            />
         )}

         {/* Voice System 관련 모달들 */}
         {modalText && <CommandModal text={modalText} onClose={() => setModalText('')} />}

         {detectedSchedules.length > 0 && (
            <AutoDetectedScheduleModal
               detectedSchedules={detectedSchedules}
               backgroundTranscript={backgroundTranscript}
               callStartTime={callStartTime}
               onConfirm={confirmSchedule}
               onDismiss={dismissSchedule}
               onClose={() => detectedSchedules.forEach(dismissSchedule)}
            />
         )}

         <MobileStatusIndicator
            isListening={isListening}
            isBackgroundMonitoring={isBackgroundMonitoring}
            isCallDetected={isCallDetected}
            callStartTime={callStartTime}
            voiceStatus={voiceStatus}
            isAnalyzing={voiceAnalyzing}
            micVolume={micVolume}
         />

         {notification && (
            <NotificationModal
               isOpen={!!notification}
               onClose={clearNotification}
               type={notification.type}
               title={notification.title}
               message={notification.message}
            />
         )}

      </div>
   );
};

// Toggle switch styles are handled by Tailwind CSS classes

export default SchedulingSystem;