/**
 * MobileDashboard.js - 모바일 메인 대시보드
 * 
 * 기능:
 * - 상단: 헤더 (삼선 버튼 등)
 * - 중앙: 3개 메뉴 버튼 (일정, 그룹, 달력)
 * - 하단: 네비게이션 바 (새로고침, 카메라, 채팅, 마이크)
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, Calendar, Clipboard, ClipboardX, Phone, User } from 'lucide-react';
import './MobileDashboard.css';

const MobileDashboard = ({ user }) => {
   const navigate = useNavigate();
   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
   const [isClipboardMonitoring, setIsClipboardMonitoring] = useState(false);
   const [isBackgroundMonitoring, setIsBackgroundMonitoring] = useState(false);
   const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);

   const handleLogout = () => {
      localStorage.removeItem('token');
      window.location.href = '/auth';
   };

   // 메뉴 버튼 클릭 핸들러
   const handleScheduleClick = () => {
      console.log('일정 버튼 클릭 - 내 프로필 탭으로 이동');
      navigate('/mobile/schedule');
   };

   const handleGroupClick = () => {
      console.log('그룹 버튼 클릭 - 일정맞추기 그룹으로 이동');
      navigate('/mobile/groups');
   };

   const handleCalendarClick = () => {
      console.log('달력 버튼 클릭 - FullCalendar로 이동');
      navigate('/mobile/calendar');
   };

   return (
      <div className="mobile-dashboard">
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

         {/* 중앙 메뉴 버튼 영역 */}
         <main className="dashboard-content">
            <div className="menu-buttons-container">
               {/* 일정 버튼 */}
               <button 
                  className="menu-card schedule-card"
                  onClick={handleScheduleClick}
               >
                  <h2 className="card-title">일정</h2>
                  <p className="card-description">내 프로필 및 일정 관리</p>
               </button>

               {/* 그룹 버튼 */}
               <button 
                  className="menu-card group-card"
                  onClick={handleGroupClick}
               >
                  <h2 className="card-title">그룹</h2>
                  <p className="card-description">일정맞추기 그룹 목록</p>
               </button>

               {/* 달력 버튼 */}
               <button 
                  className="menu-card calendar-card"
                  onClick={handleCalendarClick}
               >
                  <h2 className="card-title">달력</h2>
                  <p className="card-description">전체 일정 달력 보기</p>
               </button>
            </div>
         </main>
      </div>
   );
};

export default MobileDashboard;
