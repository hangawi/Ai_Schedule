import React, { useState, useEffect, useCallback, useMemo } from 'react';
import EventFormModal from './components/forms/EventFormModal';
import CreateProposalModal from './components/forms/CreateProposalModal';
import TimeSelectionModal from './components/forms/TimeSelectionModal';
import CustomAlertModal from './components/modals/CustomAlertModal';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import MainContent from './components/layout/MainContent';
import { coordinationService } from './services/coordinationService';

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


const SchedulingSystem = ({ isLoggedIn, user, handleLogout, isListening, eventAddedKey, speak, setEventActions, setAreEventActionsReady, isVoiceRecognitionEnabled, setIsVoiceRecognitionEnabled, loginMethod, isBackgroundMonitoring, isCallDetected, toggleBackgroundMonitoring, voiceStatus, isAnalyzing }) => {
   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
   const [activeTab, setActiveTab] = useState(() => {
     const savedTab = localStorage.getItem('activeTab');
     return savedTab || 'dashboard';
   });

   // Effect to write to localStorage when activeTab changes
   useEffect(() => {
     localStorage.setItem('activeTab', activeTab);
   }, [activeTab]);
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
         console.error('Failed to load exchange requests count:', error);
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
         console.error('Failed to refresh exchange requests count:', error);
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
       console.error('Failed to refresh exchange requests count:', error);
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
         console.error('Error fetching events:', error.message);
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
            console.error('Error deleting event:', error);
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
         console.error('Error updating event:', error);
         showAlert(`일정 수정 실패: ${error.message}`, 'error', '수정 실패');
      }
   }, [showAlert]);

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
         <Header
            setIsSidebarOpen={setIsSidebarOpen}
            setActiveTab={setActiveTab}
            loginMethod={loginMethod}
            isBackgroundMonitoring={isBackgroundMonitoring}
            isCallDetected={isCallDetected}
            toggleBackgroundMonitoring={toggleBackgroundMonitoring}
            voiceStatus={voiceStatus}
            isAnalyzing={isAnalyzing}
            isLoggedIn={isLoggedIn}
            user={user}
            showAlert={showAlert}
            isVoiceRecognitionEnabled={isVoiceRecognitionEnabled}
            setIsVoiceRecognitionEnabled={setIsVoiceRecognitionEnabled}
            handleManualLogout={handleManualLogout}
         />

         <div className="flex flex-1 overflow-hidden">
            <Sidebar
               isSidebarOpen={isSidebarOpen}
               setIsSidebarOpen={setIsSidebarOpen}
               activeTab={activeTab}
               setActiveTab={setActiveTab}
               setShowCreateModal={setShowCreateModal}
               exchangeRequestCount={exchangeRequestCount}
            />

            <MainContent
               activeTab={activeTab}
               handleSelectProposalForTime={handleSelectProposalForTime}
               globalProposals={globalProposals}
               todayEvents={todayEvents}
               upcomingEvents={upcomingEvents}
               globalEvents={globalEvents}
               handleAddGlobalEvent={handleAddGlobalEvent}
               isLoggedIn={isLoggedIn}
               handleDeleteEvent={handleDeleteEvent}
               handleEditEvent={handleEditEvent}
               isListening={isListening}
               eventAddedKey={eventAddedKey}
               isVoiceRecognitionEnabled={isVoiceRecognitionEnabled}
               setIsVoiceRecognitionEnabled={setIsVoiceRecognitionEnabled}
               user={user}
               setExchangeRequestCount={setExchangeRequestCount}
               refreshExchangeRequestCount={refreshExchangeRequestCount}
            />
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
      </div>
   );
};

// Toggle switch styles are handled by Tailwind CSS classes

export default SchedulingSystem;