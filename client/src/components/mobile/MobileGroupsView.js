import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, LogOut, Calendar, Clipboard, ClipboardX, Phone, User } from 'lucide-react';
import { auth } from '../../config/firebaseConfig';
import CoordinationTab from '../tabs/CoordinationTab';
import './MobileGroupsView.css';

const MobileGroupsView = ({ user }) => {
   const navigate = useNavigate();
   const location = useLocation();
   const [exchangeRequestCount, setExchangeRequestCount] = useState(0);
   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
   const [isClipboardMonitoring, setIsClipboardMonitoring] = useState(false);
   const [isBackgroundMonitoring, setIsBackgroundMonitoring] = useState(false);
   const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
   const [isInRoom, setIsInRoom] = useState(false);

   // 방 상태 추적 및 초기화
   useEffect(() => {
      // 컴포넌트 마운트 시 무조건 방 목록으로 초기화
      localStorage.removeItem('currentRoomId');
      localStorage.removeItem('currentRoomData');
      window.dispatchEvent(new CustomEvent('clearCurrentRoom'));

      const handleRestore = () => setIsInRoom(true);
      const handleClear = () => setIsInRoom(false);

      // 초기 상태는 항상 방 목록 화면 (isInRoom = false)
      // restoreRoom 이벤트가 발생할 때만 방에 들어가도록 함

      window.addEventListener('restoreRoom', handleRestore);
      window.addEventListener('clearCurrentRoom', handleClear);
      return () => {
         window.removeEventListener('restoreRoom', handleRestore);
         window.removeEventListener('clearCurrentRoom', handleClear);
      };
   }, [location.key]); // location.key가 바뀔 때마다 실행

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
                     <img src="/image.png" alt="MeetAgent Logo" className="mobile-logo-img" />
                     <h1 className="mobile-logo-text">MeetAgent</h1>
                  </div>
               </div>

               {/* 오른쪽: 버튼들 */}
               <div className="mobile-header-right">
                  {/* 캘린더 버튼 */}
                  <button className="mobile-icon-btn" onClick={() => navigate('/')} title="캘린더">
                     <Calendar size={20} />
                  </button>

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
                     onClick={() => setIsBackgroundMonitoring(!isBackgroundMonitoring)}
                     title={isBackgroundMonitoring ? "통화감지 ON" : "통화감지 OFF"}>
                     <Phone size={18} />
                  </button>

                  {/* 프로필 버튼 */}
                  <button className="mobile-profile-btn" onClick={() => navigate('/')} title="프로필">
                     {user && user.firstName ? user.firstName : <User size={18} />}
                  </button>

                  {/* 음성 인식 버튼 */}
                  <button
                     className="mobile-voice-btn"
                     onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                     title={isVoiceEnabled ? "음성 인식 ON" : "음성 인식 OFF"}>
                     {isVoiceEnabled ? '🎙️' : '🔇'}
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

         {/* 페이지 제목 */}
         <div className="groups-page-title">
            <div className="title-with-badge">
               <h2>그룹</h2>
               {exchangeRequestCount > 0 && (
                  <span className="notification-badge">{exchangeRequestCount}</span>
               )}
            </div>
            
            {!isInRoom && (
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
            )}
         </div>
         
         {/* 그룹 컨텐츠 */}
         <div className="groups-content">
            <CoordinationTab 
               key={location.key}
               user={user} 
               onExchangeRequestCountChange={setExchangeRequestCount}
               hideHeader={true}
               initialClear={true}
               isMobile={true}
            />
         </div>
      </div>
   );
};

export default MobileGroupsView;