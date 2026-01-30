/**
 * ===================================================================================================
 * SchedulingSystem.js - 애플리케이션의 메인 시스템 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/SchedulingSystem.js
 *
 * 🎯 주요 기능:
 *    - 애플리케이션의 전체 레이아웃(헤더, 사이드바, 메인 콘텐츠) 구성
 *    - 탭 기반 네비게이션 및 라우팅 관리 (대시보드, 프로필, 일정, 조율, 관리자 등)
 *    - 전역 상태 관리 (모달, 이벤트, 제안, 알림 등)
 *    - 핵심 기능 통합 (챗봇, 음성 인식, 클립보드 모니터링)
 *    - API 연동을 통한 데이터 관리 (이벤트, 조율 요청 등)
 *    - 사용자 인증 및 관리자 모드에 따른 UI 동적 변경
 *
 * 🔗 연결된 파일:
 *    - ./components/tabs/* - 각 탭 화면 컴포넌트
 *    - ./components/modals/* - 각종 모달 컴포넌트
 *    - ./hooks/useChat.js, ./hooks/useChat/enhanced.js - 챗봇 기능 훅
 *    - ./hooks/useIntegratedVoiceSystem.js - 통합 음성 인식 시스템 훅
 *    - ./contexts/AdminContext.js - 관리자 상태 컨텍스트
 *    - ./services/coordinationService.js - 조율 관련 API 서비스
 *    - ./config/firebaseConfig.js - Firebase 인증 설정
 *
 * 💡 UI 위치:
 *    - 로그인 후 표시되는 메인 애플리케이션 전체 화면
 *    - 헤더, 사이드바, 그리고 중앙에 표시되는 각 탭의 콘텐츠 영역을 포함
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 앱의 전체 구조, 탭 관리, 핵심 상태 관리 로직이 변경될 수 있습니다.
 *    - 새로운 탭 추가:
 *      1. `NavItem` 목록에 새 탭 버튼 추가
 *      2. 메인 콘텐츠 영역에 탭 컴포넌트 조건부 렌더링 추가
 *      3. `enhancedSetActiveTab` 함수 로직에 필요시 특별 처리 추가
 *    - 챗봇 동작 변경: `handleTabSpecificChatMessage` 함수 또는 `useChat` 관련 훅 수정
 *    - 음성 인식/클립보드 기능 수정: `useIntegratedVoiceSystem` 훅 및 관련 컴포넌트 수정
 *
 * 📝 참고사항:
 *    - `localStorage`를 사용하여 현재 활성 탭과 조율방 ID를 기억합니다.
 *    - 브라우저의 `history` API를 사용하여 탭 이동을 관리합니다. (뒤로/앞으로 가기 지원)
 *    - `USE_ENHANCED_CHAT` 상수를 통해 신규/기존 챗봇 시스템을 전환할 수 있습니다.
 *    - 관리자(admin) 여부에 따라 사이드바 메뉴와 대시보드가 동적으로 변경됩니다.
 *
 * ===================================================================================================
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MobileDashboard from './components/mobile/MobileDashboard';
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
   ClipboardX,
   Shield,
   Users,
   Building2
} from 'lucide-react';
import MyCalendar from './components/calendar/Calendar';
import EventFormModal from './components/forms/EventFormModal';
import DashboardTab from './components/tabs/DashboardTab';
import ProposalsTab from './components/tabs/ProposalsTab';
import EventsTab from './components/tabs/EventsTab';
import AgentTab from './components/tabs/AgentTab';
import ProfileTab from './components/tabs/ProfileTab';
import CoordinationTab from './components/tabs/CoordinationTab';
import AdminUserManagement from './components/admin/AdminUserManagement';
import AdminRoomManagement from './components/admin/AdminRoomManagement';
import AdminDashboard from './components/admin/AdminDashboard';
import AdminCodeModal from './components/admin/AdminCodeModal';
import { useAdmin } from './contexts/AdminContext';
import CreateProposalModal from './components/forms/CreateProposalModal';
import TimeSelectionModal from './components/forms/TimeSelectionModal';
import CustomAlertModal from './components/modals/CustomAlertModal';
import ChatBox from './components/chat/ChatBox';
import CommandModal from './components/modals/CommandModal';
import AutoDetectedScheduleModal from './components/modals/AutoDetectedScheduleModal';
import MobileStatusIndicator from './components/indicators/MobileStatusIndicator';
import NotificationModal from './components/modals/NotificationModal';
import { coordinationService } from './services/coordinationService';
import { auth } from './config/firebaseConfig';

// 백그라운드 음성 인식 관련 imports
import BackgroundCallIndicator from './components/indicators/BackgroundCallIndicator';
import { useIntegratedVoiceSystem } from './hooks/useIntegratedVoiceSystem';
import { useChat } from './hooks/useChat';
import { useChatEnhanced } from './hooks/useChat/enhanced';

/**
 * NavItem
 * @description 사이드바 네비게이션 메뉴 아이템 컴포넌트
 * @param {object} props - { icon, label, active, onClick, badge }
 * @property {JSX.Element} icon - 메뉴 아이콘
 * @property {string} label - 메뉴 텍스트
 * @property {boolean} active - 활성화 상태 여부
 * @property {function} onClick - 클릭 이벤트 핸들러
 * @property {string|number} [badge] - 우측에 표시할 배지 내용 (선택적)
 * @returns {JSX.Element}
 */
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

/**
 * formatEventForClient
 * @description 서버에서 받은 이벤트 데이터를 클라이언트에서 사용하기 좋은 형태로 변환합니다.
 * @param {object} event - 서버로부터 받은 이벤트 객체
 * @param {string} [color] - 이벤트에 지정할 색상 (선택적)
 * @returns {object} 클라이언트용으로 포맷된 이벤트 객체
 */
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


/**
 * SchedulingSystem
 * @description 애플리케이션의 메인 UI 및 상태를 관리하는 최상위 시스템 컴포넌트
 * @param {object} props - 컴포넌트에 전달되는 props
 * @param {boolean} props.isLoggedIn - 사용자 로그인 상태
 * @param {object} props.user - 현재 로그인된 사용자 정보
 * @param {function} props.handleLogout - 로그아웃 처리 함수
 * @param {function} props.speak - TTS(Text-to-Speech) 함수
 * @param {boolean} props.isVoiceRecognitionEnabled - 음성 인식 활성화 여부
 * @param {function} props.setIsVoiceRecognitionEnabled - 음성 인식 상태 변경 함수
 * @param {boolean} props.isClipboardMonitoring - 클립보드 모니터링 활성화 여부
 * @param {function} props.setIsClipboardMonitoring - 클립보드 모니터링 상태 변경 함수
 * @param {string} props.loginMethod - 로그인 방식 (e.g., 'google')
 * @returns {JSX.Element}
 */
const SchedulingSystem = ({ isLoggedIn, user, handleLogout, speak, isVoiceRecognitionEnabled, setIsVoiceRecognitionEnabled, isClipboardMonitoring, setIsClipboardMonitoring, loginMethod, isMobile }) => {
   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
   const [showAdminCodeModal, setShowAdminCodeModal] = useState(false);
   const { isAdmin } = useAdmin();
   const [activeTab, setActiveTab] = useState(() => {
     const savedTab = localStorage.getItem('activeTab');
     return savedTab || 'dashboard';
   });

   // 모바일에서 PC 버전 강제 표시 플래그
   const [forceDesktopMode, setForceDesktopMode] = useState(() => {
     return localStorage.getItem('forceDesktopMode') === 'true';
   });

   // forceDesktopMode 플래그 확인 및 제거
   useEffect(() => {
     if (forceDesktopMode) {
       localStorage.removeItem('forceDesktopMode');
     }
   }, [forceDesktopMode]);

   // 관리자 상태 변경 시 적절한 대시보드로 이동
   useEffect(() => {
     if (isAdmin) {
       // 관리자인데 일반 탭에 있으면 관리자 대시보드로 이동
       if (!activeTab.startsWith('admin')) {
         setActiveTab('adminDashboard');
         localStorage.setItem('activeTab', 'adminDashboard');
       }
     } else {
       // 일반 사용자인데 관리자 탭에 있으면 일반 대시보드로 이동
       if (activeTab.startsWith('admin')) {
         setActiveTab('dashboard');
         localStorage.setItem('activeTab', 'dashboard');
       }
     }
   }, [isAdmin]);

   // 🆕 페이지 새로고침 시 채팅방 복원
   useEffect(() => {
     const currentRoomId = localStorage.getItem('currentRoomId');
     const savedTab = localStorage.getItem('activeTab');

     // 새로고침 시 coordination 탭이고 currentRoomId가 있으면 채팅방 복원
     if (savedTab === 'coordination' && currentRoomId) {
       // CoordinationTab이 마운트될 때까지 약간 대기 후 복원 이벤트 발송
       setTimeout(() => {
         console.log('🔄 페이지 새로고침 - 채팅방 복원:', currentRoomId);
         window.dispatchEvent(new CustomEvent('restoreRoom', {
           detail: { roomId: currentRoomId }
         }));
       }, 100);
     }
   }, []); // 최초 마운트 시 한 번만 실행

   /**
    * enhancedSetActiveTab
    * @description 활성 탭을 변경하고, 브라우저 히스토리에 상태를 저장하는 함수
    * @param {string} newTab - 새로 활성화할 탭의 ID
    */
   const enhancedSetActiveTab = useCallback((newTab) => {
     setActiveTab(newTab);
     localStorage.setItem('activeTab', newTab);

     // 'coordination' 탭을 벗어날 때 현재 방 정보를 로컬 스토리지에서 제거
     if (newTab !== 'coordination') {
       localStorage.removeItem('currentRoomId');
       localStorage.removeItem('currentRoomData');
     }

     // 브라우저 히스토리에 새 상태 push
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
   const [personalTimes, setPersonalTimes] = useState([]); // 개인시간 (확정된 일정 포함)
   const [personalTimesLoaded, setPersonalTimesLoaded] = useState(false);
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

   /**
    * showAlert
    * @description 전역 알림(Alert) 모달을 표시하는 유틸리티 함수
    * @param {string} message - 알림 메시지
    * @param {string} [type='info'] - 알림 종류 ('info', 'success', 'warning', 'error')
    * @param {string} [title=''] - 알림 제목
    * @param {boolean} [showCancel=false] - 취소 버튼 표시 여부
    * @param {function|null} [onConfirm=null] - 확인 버튼 클릭 시 실행할 콜백 함수
    */
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

   /**
    * closeAlert
    * @description 열려있는 전역 알림(Alert) 모달을 닫는 함수
    */
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

    /**
    * fetchEvents
    * @description 서버에서 사용자의 모든 이벤트를 가져와 상태에 저장합니다.
    */
    const fetchEvents = useCallback(async () => {
      if (!isLoggedIn) return;
      try {
         const currentUser = auth.currentUser;
         if (!currentUser) {
            handleLogout();
            return;
         }
         const response = await fetch(`${API_BASE_URL}/api/events`, {
            headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` },
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


   /**
    * fetchPersonalTimes
    * @description 사용자의 개인시간(personalTimes)을 가져와 상태에 저장합니다.
    * 일정 맞추기에서 확정된 일정도 여기에 포함됩니다.
    */
   const fetchPersonalTimes = useCallback(async () => {
      if (!isLoggedIn) return;
      try {
         const currentUser = auth.currentUser;
         if (!currentUser) {
            handleLogout();
            return;
         }
         const response = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
            headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` },
         });
         if (!response.ok) {
            if (response.status === 401) handleLogout();
            throw new Error('Failed to fetch personal times');
         }
         const data = await response.json();

         // personalTimes를 Event 형식으로 변환
         const formattedPersonalTimes = (data.personalTimes || [])
            .filter(pt => pt.specificDate) // 특정 날짜가 있는 것만 (확정된 일정)
            .map(pt => ({
               id: `pt-${pt.id}`,
               title: pt.title || '개인 일정',
               date: pt.specificDate,
               time: pt.startTime,
               endTime: pt.endTime,
               participants: 1,
               priority: 3,
               color: pt.color || '#10B981',
               isCoordinated: pt.title && pt.title.includes('-'), // 타이틀에 '-'가 있으면 확정된 일정
               roomName: pt.title && pt.title.includes('-') ? pt.title.split('-')[0].trim() : undefined
            }));

         setPersonalTimes(formattedPersonalTimes);
         setPersonalTimesLoaded(true);
      } catch (error) {
         console.error('Fetch personal times error:', error);
         setPersonalTimesLoaded(true);
      }
   }, [isLoggedIn, handleLogout]);

   /**
    * handleAddGlobalEvent
    * @description 새 이벤트를 서버에 추가하고 전역 상태를 업데이트합니다.
    * @description 챗봇 입력(`startDateTime`)과 폼 입력(`date`, `time`) 등 다양한 데이터 형식을 처리합니다.
    * @param {object} eventData - 추가할 이벤트 데이터
    * @returns {Promise<object>} 추가된 이벤트 객체
    * @throws {Error} 이벤트 추가 실패 시 에러 발생
    */
   const handleAddGlobalEvent = useCallback(async eventData => {
      try {
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
         const currentUser = auth.currentUser;
         if (!currentUser) return;

         const response = await fetch(`${API_BASE_URL}/api/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await currentUser.getIdToken()}` },
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

   /**
    * handleDeleteEvent
    * @description 특정 이벤트를 삭제 확인 후 서버와 클라이언트에서 제거합니다.
    * @param {string} eventId - 삭제할 이벤트의 ID
    */
   const handleDeleteEvent = useCallback(async eventId => {
      const performDelete = async () => {
         try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
               showAlert('로그인이 필요합니다.', 'error', '로그인 필요');
               return;
            }

            const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`, {
               method: 'DELETE',
               headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` },
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

   /**
    * handleUpdateEvent
    * @description 수정된 이벤트 정보를 서버에 업데이트하고 클라이언트 상태를 갱신합니다.
    * @param {object} eventData - 수정된 이벤트 데이터
    * @param {string} eventId - 수정할 이벤트 ID
    */
   const handleUpdateEvent = useCallback(async (eventData, eventId) => {
      try {
         const currentUser = auth.currentUser;
         if (!currentUser) {
            showAlert('로그인이 필요합니다.', 'error', '로그인 필요');
            return;
         }
         const payload = { title: eventData.title, date: eventData.date, time: eventData.time, color: eventData.color };

         const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await currentUser.getIdToken()}` },
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

   // 확정된 일정 로드
   useEffect(() => {
      if (isLoggedIn && !personalTimesLoaded) {
         fetchPersonalTimes();
      }
   }, [isLoggedIn, personalTimesLoaded, fetchPersonalTimes]);

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
   // 두 hooks를 모두 호출 (React Hooks 규칙 준수)
   const chatLegacy = useChat(isLoggedIn, setEventAddedKey, eventActions);
   const chatEnhanced = useChatEnhanced(isLoggedIn, setEventAddedKey, eventActions);

   // 강화된 채팅 시스템 사용 여부 (true: 신규 기능 활성화, false: 기존 기능)
   const USE_ENHANCED_CHAT = true;
   const { handleChatMessage } = USE_ENHANCED_CHAT ? chatEnhanced : chatLegacy;

   const { pastEvents, todayEvents, upcomingEvents } = useMemo(() => {
      const today = new Date();
      const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

      // 30일 전 날짜
      const thirtyDaysAgoDate = new Date(today);
      thirtyDaysAgoDate.setDate(today.getDate() - 30);
      const thirtyDaysAgoStr = new Date(thirtyDaysAgoDate.getTime() - (thirtyDaysAgoDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

      // 모든 일정 병합 (나의 일정 + 개인시간(확정된 일정 포함))
      const allEvents = [...globalEvents, ...personalTimes];

      // 시간순 정렬 함수 (오름차순)
      const sortByDateTime = (a, b) => {
         const dateCompare = a.date.localeCompare(b.date);
         if (dateCompare !== 0) return dateCompare;
         const timeA = a.time || '00:00';
         const timeB = b.time || '00:00';
         return timeA.localeCompare(timeB);
      };

      const pastEvents = allEvents
         .filter(event => {
            return event.date >= thirtyDaysAgoStr && event.date < todayStr;
         })
         .sort(sortByDateTime);

      const todayEvents = allEvents
         .filter(event => {
            return event.date === todayStr;
         })
         .sort(sortByDateTime);

      const upcomingEvents = allEvents
         .filter(event => {
            return event.date > todayStr;
         })
         .sort(sortByDateTime);

      return { pastEvents, todayEvents, upcomingEvents };
   }, [globalEvents, personalTimes]);

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
         {/* 모바일일 때는 헤더 숨김 */}
         {!(isMobile && !forceDesktopMode) && (
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
                     {isAdmin && (
                        <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full hidden sm:inline-flex items-center gap-1">
                           <Shield size={10} /> 관리자
                        </span>
                     )}
                  </button>
               </div>
               <div className="flex items-center space-x-1 sm:space-x-2">
                  {/* 관리자 버튼 - 캘린더 왼쪽 */}
                  <button
                     onClick={() => setShowAdminCodeModal(true)}
                     className={`hidden sm:flex items-center p-2 rounded-full transition-colors duration-200 ${
                        isAdmin
                           ? 'text-purple-600 hover:bg-purple-100'
                           : 'text-gray-600 hover:bg-gray-100'
                     }`}
                     title={isAdmin ? "관리자 모드" : "관리자 인증"}
                  >
                     <Shield size={20} />
                  </button>

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
         )}

         <div className="flex flex-1 overflow-hidden">
            <div className={`fixed inset-0 bg-black md:hidden ${isSidebarOpen ? 'bg-opacity-50' : 'bg-opacity-0 pointer-events-none'} transition-opacity duration-300 ease-in-out z-30`} onClick={() => setIsSidebarOpen(false)}></div>
            <nav className={`fixed md:relative inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out w-64 bg-white border-r border-gray-200 p-6 z-40 shadow-lg md:shadow-none`}>
               <div className="flex justify-between items-center mb-6 md:hidden">
                  <h2 className="text-lg font-bold">메뉴</h2>
                  <button onClick={() => setIsSidebarOpen(false)}><X size={24} /></button>
               </div>
               {!isAdmin && (
                  <div className="mb-6">
                     <button onClick={() => { setShowCreateModal(true); setIsSidebarOpen(false); }} className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center justify-center">
                        <span>+ 새 일정 조율</span>
                     </button>
                  </div>
               )}
               <div className="space-y-1">
                  {isAdmin ? (
                     <>
                        <NavItem icon={<LayoutDashboard size={18} />} label="대시보드" active={activeTab === 'adminDashboard'} onClick={() => { enhancedSetActiveTab('adminDashboard'); setIsSidebarOpen(false); }} />
                        <NavItem icon={<Users size={18} />} label="회원 관리" active={activeTab === 'adminUsers'} onClick={() => { enhancedSetActiveTab('adminUsers'); setIsSidebarOpen(false); }} />
                        <NavItem icon={<Building2 size={18} />} label="방 관리" active={activeTab === 'adminRooms'} onClick={() => { enhancedSetActiveTab('adminRooms'); setIsSidebarOpen(false); }} />
                     </>
                  ) : (
                     <>
                        <NavItem icon={<LayoutDashboard size={18} />} label="대시보드" active={activeTab === 'dashboard'} onClick={() => { enhancedSetActiveTab('dashboard'); setIsSidebarOpen(false); }} />
                        <NavItem icon={<User size={18} />} label="내 프로필" active={activeTab === 'profile'} onClick={() => { enhancedSetActiveTab('profile'); setIsSidebarOpen(false); }} />
                        <NavItem icon={<ListTodo size={18} />} label="나의 일정" active={activeTab === 'events'} onClick={() => { enhancedSetActiveTab('events'); setIsSidebarOpen(false); }} />
                        <NavItem icon={<Calendar size={18} />} label="Google 캘린더" active={activeTab === 'googleCalendar'} onClick={() => { enhancedSetActiveTab('googleCalendar'); setIsSidebarOpen(false); }} />
                        <NavItem icon={<History size={18} />} label="조율 내역" active={activeTab === 'proposals'} onClick={() => { enhancedSetActiveTab('proposals'); setIsSidebarOpen(false); }} />
                        <NavItem icon={<CalendarCheck size={18} />} label="일정 맞추기" active={activeTab === 'coordination'} onClick={() => { enhancedSetActiveTab('coordination'); setIsSidebarOpen(false); }} badge={exchangeRequestCount > 0 ? exchangeRequestCount.toString() : undefined} />
                        <NavItem icon={<Bot size={18} />} label="내 AI 비서" active={activeTab === 'agent'} onClick={() => { enhancedSetActiveTab('agent'); setIsSidebarOpen(false); }} />
                     </>
                  )}
               </div>
            </nav>

            <main className={`flex-1 overflow-y-auto ${isMobile && !forceDesktopMode ? '' : 'p-4 sm:p-6'}`}>
               {isMobile && !forceDesktopMode ? (
                  <MobileDashboard user={user} />
               ) : (
                  <>
                     {activeTab === 'dashboard' && <DashboardTab pastEvents={pastEvents} todayEvents={todayEvents} upcomingEvents={upcomingEvents} />}
               {activeTab === 'proposals' && <ProposalsTab onSelectTime={handleSelectProposalForTime} proposals={globalProposals} />}
               {activeTab === 'events' && <EventsTab events={globalEvents} onAddEvent={handleAddGlobalEvent} isLoggedIn={isLoggedIn} onDeleteEvent={handleDeleteEvent} onEditEvent={handleEditEvent} />}
               {activeTab === 'googleCalendar' && <MyCalendar isListening={isListening} onEventAdded={eventAddedKey} isVoiceRecognitionEnabled={isVoiceRecognitionEnabled} onToggleVoiceRecognition={() => setIsVoiceRecognitionEnabled(prev => !prev)} />}
               {activeTab === 'coordination' && <CoordinationTab user={user} onExchangeRequestCountChange={setExchangeRequestCount} onRefreshExchangeCount={refreshExchangeRequestCount} />}
               {activeTab === 'agent' && <AgentTab />}
               {activeTab === 'profile' && <ProfileTab user={user} onEditingChange={setIsProfileEditing} />}
               {activeTab === 'adminDashboard' && <AdminDashboard />}
                     {activeTab === 'adminUsers' && <AdminUserManagement />}
                     {activeTab === 'adminRooms' && <AdminRoomManagement />}
                  </>
               )}
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

         {/* 관리자 코드 입력 모달 */}
         <AdminCodeModal
            isOpen={showAdminCodeModal}
            onClose={() => setShowAdminCodeModal(false)}
         />

         {/* 탭별 컨텍스트를 가진 ChatBox - 내 프로필 탭에서는 편집 모드일 때만 활성화 */}
         {(!isMobile || forceDesktopMode) && (activeTab !== 'profile' || isProfileEditing) && (
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

         {(!isMobile || forceDesktopMode) && (
            <MobileStatusIndicator
               isListening={isListening}
               isBackgroundMonitoring={isBackgroundMonitoring}
               isCallDetected={isCallDetected}
               callStartTime={callStartTime}
               voiceStatus={voiceStatus}
               isAnalyzing={voiceAnalyzing}
               micVolume={micVolume}
            />
         )}

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