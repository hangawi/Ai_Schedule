import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, LogOut, Calendar, Clipboard, ClipboardX, Phone, User } from 'lucide-react';
import { auth } from '../../config/firebaseConfig';
import CoordinationTab from '../tabs/CoordinationTab';
import BottomNavigation from './BottomNavigation';
import { useBackgroundMonitoring } from '../../hooks/useBackgroundMonitoring';
import AutoDetectedScheduleModal from '../modals/AutoDetectedScheduleModal';
import { useToast } from '../../contexts/ToastContext';
import './MobileGroupsView.css';

const MobileGroupsView = ({ user, isClipboardMonitoring, setIsClipboardMonitoring, isVoiceEnabled, setIsVoiceEnabled }) => {
   const navigate = useNavigate();
   const { showToast } = useToast();
   const location = useLocation();
   const [exchangeRequestCount, setExchangeRequestCount] = useState(0);
   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
   const [eventAddedKey, setEventAddedKey] = useState(0);
   const backgroundRecognitionRef = useRef(null);
   
   // 백그라운드 대화 감지 훅
   const dummyEventActions = { addEvent: async () => {} };
   const {
      isBackgroundMonitoring,
      toggleBackgroundMonitoring,
      processTranscript,
      detectedSchedules,
      confirmSchedule,
      dismissSchedule,
      isAnalyzing: isBackgroundAnalyzing,
   } = useBackgroundMonitoring(dummyEventActions, setEventAddedKey);
   const [isInRoom, setIsInRoom] = useState(false);
   const [effectiveIsInRoom, setEffectiveIsInRoom] = useState(false);
   const [refreshKey, setRefreshKey] = useState(0);

   const handleRefresh = useCallback(() => {
      setRefreshKey(prev => prev + 1);
   }, []);

   // 방 상태 추적 및 초기화
   useEffect(() => {
      // 컴포넌트 마운트 시 무조건 방 목록으로 초기화
      localStorage.removeItem('currentRoomId');
      localStorage.removeItem('currentRoomData');
      window.dispatchEvent(new CustomEvent('clearCurrentRoom'));

      const handleRestore = () => {
         setIsInRoom(true);
         setEffectiveIsInRoom(true);
      };
      const handleClear = () => {
         setIsInRoom(false);
         setEffectiveIsInRoom(false);
      };

      window.addEventListener('restoreRoom', handleRestore);
      window.addEventListener('clearCurrentRoom', handleClear);
      return () => {
         window.removeEventListener('restoreRoom', handleRestore);
         window.removeEventListener('clearCurrentRoom', handleClear);
      };
   }, [location.key]);

   // isInRoom 상태가 변경될 때마다 effectiveIsInRoom 동기화
   useEffect(() => {
      setEffectiveIsInRoom(isInRoom || !!localStorage.getItem('currentRoomId'));
   }, [isInRoom]);

   // 백그라운드 모니터링 활성화 시 음성 인식 시작
   useEffect(() => {
      if (!isBackgroundMonitoring) {
         if (backgroundRecognitionRef.current) {
            backgroundRecognitionRef.current.stop();
            backgroundRecognitionRef.current = null;
         }
         return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
         showToast('이 브라우저에서는 음성 인식을 지원하지 않습니다.');
         return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'ko-KR';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
         for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            const isFinal = event.results[i].isFinal;
            processTranscript(transcript, isFinal);
         }
      };

      recognition.onerror = (event) => {
         console.warn('백그라운드 음성 인식 오류:', event.error);
         if (event.error === 'not-allowed') {
            showToast('마이크 권한이 필요합니다.');
         }
      };

      recognition.onend = () => {
         if (isBackgroundMonitoring && backgroundRecognitionRef.current) {
            try {
               recognition.start();
            } catch (e) {
               console.warn('음성 인식 재시작 실패:', e);
            }
         }
      };

      try {
         recognition.start();
         backgroundRecognitionRef.current = recognition;
      } catch (e) {
         console.error('음성 인식 시작 실패:', e);
      }

      return () => {
         if (backgroundRecognitionRef.current) {
            backgroundRecognitionRef.current.stop();
            backgroundRecognitionRef.current = null;
         }
      };
   }, [isBackgroundMonitoring, processTranscript]);

   const handleLogout = async () => {
      try {
         await auth.signOut();
         localStorage.removeItem('loginMethod');
         navigate('/auth');
      } catch (error) {
         console.error('Logout error:', error);
      }
   };

   return (
      <div className="mobile-groups-view">
         {/* 사이드바 오버레이 */}
         {isSidebarOpen && (
            <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
         )}

         {/* 사이드바 */}
         <nav className={`mobile-sidebar ${isSidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
               <h2 className="sidebar-title">메뉴</h2>
               <button className="sidebar-close-btn" onClick={() => setIsSidebarOpen(false)}>✕</button>
            </div>
            <div className="sidebar-menu">
               <button className="sidebar-item" onClick={() => navigate('/')}>
                  🏠 홈으로
               </button>
               <button className="sidebar-item" onClick={() => navigate('/mobile/schedule')}>
                  📅 내 일정
               </button>
               <button className="sidebar-item" onClick={() => navigate('/mobile/groups')}>
                  👥 그룹
               </button>
               <button className="sidebar-item" onClick={() => navigate('/mobile/calendar')}>
                  📆 달력
               </button>
               <button className="sidebar-item" onClick={() => navigate('/mobile/settings')}>
                  ⚙️ 설정
               </button>
            </div>
         </nav>

         {/* 모바일 헤더 */}
         <header className="mobile-header">
            <div className="mobile-header-content">
               {/* 왼쪽: 햄버거 메뉴 + 로고 */}
               <div className="mobile-header-left">
                  <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}>
                     <Menu size={24} />
                  </button>
                  <div className="mobile-logo-btn" onClick={() => navigate('/')}>
                     <div className="mobile-logo-wrapper">
                        <img src="/heyheylogo.png" alt="MeetAgent Logo" className="mobile-logo-img" />
                        <div className={`mobile-login-indicator ${user?.google?.refreshToken ? 'google' : 'local'}`}></div>
                     </div>
                     <h1 className="mobile-logo-text">MeetAgent</h1>
                  </div>
               </div>

               {/* 오른쪽: 버튼들 */}
               <div className="mobile-header-right">
                  {/* 클립보드 모니터링 */}
                  <button
                     className={`mobile-icon-btn ${isClipboardMonitoring ? 'active' : ''}`}
                     onClick={() => setIsClipboardMonitoring(!isClipboardMonitoring)}
                     title={isClipboardMonitoring ? "클립보드 ON" : "클립보드 OFF"}>
                     {isClipboardMonitoring ? <Clipboard size={18} /> : <ClipboardX size={18} />}
                  </button>

                  {/* 백그라운드 모니터링 */}
                  <button
                     className={`mobile-icon-btn ${isBackgroundMonitoring ? 'active' : ''}`}
                     onClick={toggleBackgroundMonitoring}
                     title={isBackgroundMonitoring ? "통화감지 ON" : "통화감지 OFF"}>
                     <Phone size={18} />
                  </button>

                  {/* 프로필 버튼 */}
                  <button className="mobile-profile-btn" onClick={() => navigate('/mobile/settings')} title="설정">
                     {user && user.firstName ? user.firstName : <User size={18} />}
                  </button>

                  {/* 로그아웃 버튼 */}
                  <button
                     className="mobile-logout-btn"
                     onClick={handleLogout}
                     title="로그아웃">
                     <LogOut size={16} />
                  </button>
               </div>
            </div>
         </header>

         {/* 페이지 제목 (방 목록일 때만 표시) */}
         {!effectiveIsInRoom && (
            <div className="groups-page-title">
               <div className="title-with-badge">
                  <h2>그룹</h2>
                  {exchangeRequestCount > 0 && (
                     <span className="notification-badge">{exchangeRequestCount}</span>
                  )}
               </div>
               
               <div className="group-action-buttons">
                  <button 
                     className="group-action-btn create-btn"
                     onClick={() => window.dispatchEvent(new CustomEvent('openCreateRoom'))}
                  >
                     새 조율방 생성
                  </button>
                  <button 
                     className="group-action-btn join-btn"
                     onClick={() => window.dispatchEvent(new CustomEvent('openJoinRoom'))}
                  >
                     조율방 참여
                  </button>
               </div>
            </div>
         )}
         
         {/* 그룹 컨텐츠 */}
         <div className={`groups-content ${!effectiveIsInRoom ? 'with-bottom-nav' : ''}`}>
            <CoordinationTab
               key={`${location.key}-${refreshKey}`}
               user={user} 
               onExchangeRequestCountChange={setExchangeRequestCount}
               hideHeader={true}
               initialClear={true}
               isMobile={true}
               onRoomStatusChange={setIsInRoom}
            />
         </div>

         {/* 하단 네비게이션 바 (방 목록에 있을 때만 표시) */}
         {!effectiveIsInRoom && (
            <BottomNavigation
               onRefresh={handleRefresh}
            />
         )}

         {/* 자동 감지된 일정 모달 */}
         {detectedSchedules.length > 0 && (
            <AutoDetectedScheduleModal
               schedules={detectedSchedules}
               onConfirm={confirmSchedule}
               onDismiss={dismissSchedule}
               isAnalyzing={isBackgroundAnalyzing}
            />
         )}
      </div>
   );
};

export default MobileGroupsView;