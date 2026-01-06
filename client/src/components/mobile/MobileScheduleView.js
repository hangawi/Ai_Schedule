import React, { useState } from 'react';
import { Menu, LogOut, User, Calendar, Clipboard, ClipboardX, Phone } from 'lucide-react';
import './MobileScheduleView.css';

const MobileScheduleView = ({ user }) => {
   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
   const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
   const [isClipboardMonitoring, setIsClipboardMonitoring] = useState(false);
   const [isBackgroundMonitoring, setIsBackgroundMonitoring] = useState(false);
   const [activeTab, setActiveTab] = useState('upcoming'); // 'past', 'recent', 'upcoming'

   const handleLogout = () => {
      localStorage.removeItem('token');
      window.location.href = '/auth';
   };

   return (
      <div className="mobile-schedule-view">
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
               <button className="sidebar-item" onClick={() => window.location.href = '/'}>
                  🏠 홈으로
               </button>
               <button className="sidebar-item" onClick={() => window.location.href = '/mobile/schedule'}>
                  📅 내 일정
               </button>
               <button className="sidebar-item" onClick={() => window.location.href = '/mobile/groups'}>
                  👥 그룹
               </button>
               <button className="sidebar-item" onClick={() => window.location.href = '/mobile/calendar'}>
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
                  <div className="mobile-logo-btn" onClick={() => window.location.href = '/'}>
                     <img src="/image.png" alt="MeetAgent Logo" className="mobile-logo-img" />
                     <h1 className="mobile-logo-text">MeetAgent</h1>
                  </div>
               </div>

               {/* 오른쪽: 버튼들 */}
               <div className="mobile-header-right">
                  {/* 캘린더 버튼 */}
                  <button className="mobile-icon-btn" onClick={() => window.location.href = '/'} title="캘린더">
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
                  <button className="mobile-profile-btn" onClick={() => window.location.href = '/'} title="프로필">
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

         {/* 상단 탭 버튼 */}
         <div className="schedule-tabs">
            <button 
               className={`tab-btn ${activeTab === 'past' ? 'active' : ''}`}
               onClick={() => setActiveTab('past')}
            >
               지난 일정
            </button>
            <button 
               className={`tab-btn ${activeTab === 'recent' ? 'active' : ''}`}
               onClick={() => setActiveTab('recent')}
            >
               최근 일정
            </button>
            <button 
               className={`tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
               onClick={() => setActiveTab('upcoming')}
            >
               예정 일정
            </button>
         </div>

         {/* 컨텐츠 영역 */}
         <div className="schedule-content">
            {activeTab === 'past' && <div className="tab-content">지난 일정 내용이 여기에 표시됩니다.</div>}
            {activeTab === 'recent' && <div className="tab-content">최근 일정 내용이 여기에 표시됩니다.</div>}
            {activeTab === 'upcoming' && <div className="tab-content">예정 일정 내용이 여기에 표시됩니다.</div>}
         </div>
      </div>
   );
};

export default MobileScheduleView;