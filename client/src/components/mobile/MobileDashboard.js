/**
 * MobileDashboard.js - 모바일 메인 대시보드
 * 
 * 기능:
 * - 상단: 헤더 (삼선 버튼 등)
 * - 중앙: 3개 메뉴 버튼 (일정, 그룹, 달력)
 * - 하단: 네비게이션 바 (새로고침, 카메라, 채팅, 마이크)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, Calendar, Clipboard, ClipboardX, Phone, User } from 'lucide-react';
import { auth } from '../../config/firebaseConfig';
import BottomNavigation from './BottomNavigation';
import { useBackgroundMonitoring } from '../../hooks/useBackgroundMonitoring';
import AutoDetectedScheduleModal from '../modals/AutoDetectedScheduleModal';
import { useToast } from '../../contexts/ToastContext';
import './MobileDashboard.css';

const MobileDashboard = ({ user, isClipboardMonitoring, setIsClipboardMonitoring, isVoiceEnabled, setIsVoiceEnabled }) => {
   const navigate = useNavigate();
   const { showToast } = useToast();
   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
   const [refreshKey, setRefreshKey] = useState(0);
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

   const handleRefresh = useCallback(() => {
      setRefreshKey(prev => prev + 1);
   }, []);

   const handleLogout = async () => {
      try {
         await auth.signOut();
         localStorage.removeItem('loginMethod');
         navigate('/auth');
      } catch (error) {
         console.error('Logout error:', error);
      }
   };

   // 메뉴 버튼 클릭 핸들러
   const handleScheduleClick = () => {
      console.log('일정 버튼 클릭 - 빈 페이지(헤더만)로 이동');
      navigate('/mobile/schedule');
   };

   const handleGroupClick = () => {
      console.log('그룹 버튼 클릭 - 일정맞추기 그룹으로 이동');
      navigate('/mobile/groups');
   };

   const handleCalendarClick = () => {
      console.log('달력 버튼 클릭 - 상세 일정(FullCalendar)으로 이동');
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
                     <div className="mobile-logo-wrapper">
                        <img src="/heyheylogo.png" alt="MeetAgent Logo" className="mobile-logo-img" />
                        <div className={`mobile-login-indicator ${localStorage.getItem('loginMethod') === 'google' ? 'google' : 'local'}`}></div>
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
                  <button className="mobile-profile-btn" onClick={() => navigate('/')} title="프로필">
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

         {/* 하단 네비게이션 바 */}
         <BottomNavigation
            onRefresh={handleRefresh}
         />

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

export default MobileDashboard;
