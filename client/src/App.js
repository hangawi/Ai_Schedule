/**
 * ===================================================================================================
 * App.js - React 애플리케이션 최상위 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/App.js
 *
 * 🎯 주요 기능:
 *    - React Router 기반 라우팅 설정 (/auth, /)
 *    - 전역 상태 관리 (AdminContext Provider)
 *    - Google Maps API 로딩 (LoadScript)
 *    - 인증 상태 관리 및 보호된 라우트
 *    - 클립보드 모니터링 및 일정 자동 감지
 *    - 음성 인식 설정 관리
 *    - 공유 텍스트 처리 (URL 파라미터)
 *
 * 🔗 연결된 파일:
 *    - ./SchedulingSystem.js - 메인 스케줄링 시스템
 *    - ./components/auth/AuthScreen.js - 로그인/회원가입 화면
 *    - ./contexts/AdminContext.js - 관리자 컨텍스트
 *    - ./hooks/useAuth.js - 인증 훅
 *    - ./hooks/useChat.js - 챗봇 훅
 *    - ./components/modals/SharedTextModal.js - 공유 텍스트 모달
 *    - ./components/modals/CopiedTextModal.js - 복사 텍스트 모달
 *    - ./components/guides/BackgroundGuide.js - 백그라운드 가이드
 *
 * 💡 UI 위치:
 *    - 앱 전체의 루트 컴포넌트
 *    - 라우트: /auth (로그인), / (메인 앱)
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 전체 앱의 라우팅 및 최상위 상태 관리가 변경됨
 *    - 새 라우트 추가: Routes 내에 <Route> 추가
 *    - 전역 기능 추가: App 컴포넌트 내 상태 및 로직 추가
 *    - 클립보드 모니터링 로직: analyzeClipboard, readClipboard 함수 수정
 *    - Google Maps 설정: LoadScript의 googleMapsApiKey, libraries 수정
 *
 * 📝 참고사항:
 *    - 클립보드 모니터링은 isClipboardMonitoring 상태로 ON/OFF 가능
 *    - 음성 인식은 localStorage에 설정 저장됨
 *    - 로그인하지 않으면 /auth로 리다이렉트
 *    - Google Maps API 키는 환경변수 REACT_APP_MY_GOOGLE_KEY 사용
 *    - 클립보드 일정 감지는 최소 2개 패턴 매칭 + 최소 10자 조건
 *
 * ===================================================================================================
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LoadScript } from '@react-google-maps/api';
import SchedulingSystem from './SchedulingSystem';
import AuthScreen from './components/auth/AuthScreen';
import MobileDashboard from './components/mobile/MobileDashboard';
import MobileCalendarView from './components/mobile/MobileCalendarView';
import MobileScheduleView from './components/mobile/MobileScheduleView';
import MobileGroupsView from './components/mobile/MobileGroupsView';
import { AdminProvider } from './contexts/AdminContext';
import SharedTextModal from './components/modals/SharedTextModal';
import CopiedTextModal from './components/modals/CopiedTextModal';
import BackgroundGuide from './components/guides/BackgroundGuide';
import { useAuth } from './hooks/useAuth';
import { useChat } from './hooks/useChat';
import { useMobileDetection } from './components/chat/hooks/useMobileDetection';
import { speak } from './utils';
import { auth } from './config/firebaseConfig';

const libraries = ['places'];

function App() {
   const { isLoggedIn, user, loginMethod, handleLoginSuccess, handleLogout } = useAuth();
   const isMobile = useMobileDetection();
   const [eventAddedKey, setEventAddedKey] = useState(0);
   const [isVoiceRecognitionEnabled, setIsVoiceRecognitionEnabled] = useState(() => {
      const saved = localStorage.getItem('voiceRecognitionEnabled');
      return saved !== null ? JSON.parse(saved) : true;
   });
   const [isClipboardMonitoring, setIsClipboardMonitoring] = useState(false); // 클립보드 모니터링 ON/OFF
   const [eventActions, setEventActions] = useState(null);
   const { handleChatMessage } = useChat(isLoggedIn, setEventAddedKey, eventActions);

   
   const [sharedText, setSharedText] = useState(null);
   const [copiedText, setCopiedText] = useState(null);
   const [isAnalyzing, setIsAnalyzing] = useState(false);
   const [dismissedCopiedTexts, setDismissedCopiedTexts] = useState(() => {
      try {
         const saved = localStorage.getItem('dismissedCopiedTexts');
         const recentTexts = (saved ? JSON.parse(saved) : []).slice(-100);
         return new Set(recentTexts);
      } catch (error) {
         return new Set();
      }
   });
   
   const [showBackgroundGuide, setShowBackgroundGuide] = useState(() => {
      return !localStorage.getItem('backgroundGuideShown');
   });

   useEffect(() => {
      const queryParams = new URLSearchParams(window.location.search);
      const text = queryParams.get('text');
      if (text) {
         setSharedText(text);
         window.history.replaceState({}, document.title, window.location.pathname);
      }
   }, []);

   const analyzeClipboard = useCallback(async (text) => {
      try {
         const currentUser = auth.currentUser;
         if (!currentUser) return false;

         const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/call-analysis/analyze-clipboard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await currentUser.getIdToken()}` },
            body: JSON.stringify({ text }),
         });

         if (response.ok) {
            const data = await response.json();
            return data.success && data.data.isScheduleRelated && data.data.confidence >= 0.5;
         }
         return false;
      } catch (error) {
         // 더 정확한 일정 감지 패턴
         const schedulePatterns = [
            // 시간 패턴 (더 구체적)
            /\d{1,2}:\d{2}|\d{1,2}시\s*\d{0,2}분?|(오전|오후|새벽|저녁|아침)\s*\d{1,2}시?/,
            // 날짜 패턴 (더 구체적)
            /(오늘|내일|모레|월요일|화요일|수요일|목요일|금요일|토요일|일요일|다음주|이번주|다음달|이번달)\s*(에|부터|까지)?/i,
            // 만남/일정 관련 동사
            /(만나|만날|만나자|만나요|보자|보요|가자|가요|하자|하요|먹자|먹어요)/,
            // 일정 관련 명사
            /(약속|미팅|회의|모임|만남|식사|점심|저녁|영화|공연|수업|강의|프로젝트)/,
            // 장소 패턴
            /(카페|식당|영화관|극장|백화점|공원|학교|회사|사무실|집|기숙사)에?서?/
         ];

         const matchCount = schedulePatterns.filter(pattern => pattern.test(text)).length;

         // 텍스트 길이도 고려 (너무 짧으면 일정이 아닐 가능성 높음)
         const hasMinimumLength = text.length >= 10;

         // 최소 2개 패턴 매칭 + 최소 길이 조건
         return matchCount >= 2 && hasMinimumLength;
      }
   }, []);

   const addToDismissedTexts = useCallback((text) => {
      setDismissedCopiedTexts(prev => {
         const newSet = new Set(prev).add(text);
         localStorage.setItem('dismissedCopiedTexts', JSON.stringify(Array.from(newSet)));
         return newSet;
      });
   }, []);

   const readClipboard = useCallback(async () => {
      // 클립보드 모니터링이 OFF면 종료
      if (!isClipboardMonitoring) return;

      if (!navigator.clipboard?.readText || document.visibilityState !== 'visible') return;

      try {
         const text = await navigator.clipboard.readText();
         const trimmedText = text.trim();

         // 50자 이내, 5자 이상, 이미 무시한 텍스트가 아닐 때만
         if (trimmedText.length >= 5 && trimmedText.length <= 50 && !dismissedCopiedTexts.has(text)) {
            // 날짜/요일 패턴 체크
            const hasDateOrDay = /(\d{1,2}월|\d{1,2}일|\d{4}년|월요일|화요일|수요일|목요일|금요일|토요일|일요일|오늘|내일|모레|다음주|이번주)/.test(trimmedText);

            // 날짜/요일이 있을 때만 분석
            if (hasDateOrDay) {
               analyzeClipboard(text).then(isSchedule => {
                 if (isSchedule) {
                    setCopiedText(text);
                    setIsAnalyzing(true);
                    setTimeout(() => setIsAnalyzing(false), 500);
                 } else {
                    addToDismissedTexts(text);
                 }
               });
            } else {
               // 날짜/요일 없으면 무시 목록에 추가
               addToDismissedTexts(text);
            }
         } else if (trimmedText.length > 50) {
            // 50자 초과하면 무시 목록에 추가
            addToDismissedTexts(text);
         }
      } catch (err) {
         // Clipboard read failed - silently handle error
      }
   }, [isClipboardMonitoring, dismissedCopiedTexts, analyzeClipboard, addToDismissedTexts]);

   useEffect(() => {
      const handleVisibilityChange = () => {
         if (document.visibilityState === 'visible') {
            setTimeout(readClipboard, 100);
         }
      };
      window.addEventListener('focus', readClipboard);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
         window.removeEventListener('focus', readClipboard);
         document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
   }, [readClipboard]);

   const handleToggleVoiceRecognition = useCallback(() => {
      setIsVoiceRecognitionEnabled(prev => {
         const newValue = !prev;
         localStorage.setItem('voiceRecognitionEnabled', JSON.stringify(newValue));
         return newValue;
      });
   }, []);

   const schedulingSystemProps = useMemo(() => ({
      isLoggedIn, user, handleLogout, isVoiceRecognitionEnabled,
      setIsVoiceRecognitionEnabled: handleToggleVoiceRecognition,
      isClipboardMonitoring, setIsClipboardMonitoring, loginMethod
   }), [isLoggedIn, user, handleLogout, isVoiceRecognitionEnabled, handleToggleVoiceRecognition, isClipboardMonitoring, loginMethod]);

   const handleConfirmSharedText = (text) => {
      handleChatMessage(`다음 내용으로 일정 추가: ${text}`);
      setSharedText(null);
   };

   const handleConfirmCopiedText = (text) => {
      handleChatMessage(`다음 내용으로 일정 추가: ${text}`);
      addToDismissedTexts(text);
      setCopiedText(null);
   };

   const handleCloseCopiedText = (text) => {
      addToDismissedTexts(text);
      setCopiedText(null);
      setIsAnalyzing(false);
   };

   const handleCloseBackgroundGuide = () => {
      localStorage.setItem('backgroundGuideShown', 'true');
      setShowBackgroundGuide(false);
   };

   // 새로운 환경 변수 이름 사용
   const GOOGLE_API_KEY = process.env.REACT_APP_MY_GOOGLE_KEY;
   console.log('🔑 새 환경 변수:', process.env.REACT_APP_MY_GOOGLE_KEY);
   console.log('🔑 최종 키:', GOOGLE_API_KEY);
   console.log('🔑 끝부분:', GOOGLE_API_KEY?.slice(-10));

   return (
      <LoadScript
         googleMapsApiKey={GOOGLE_API_KEY}
         libraries={libraries}
         language="ko"
      >
         <Router>
            <Routes>
               <Route path="/auth" element={
                  (() => {
                     const params = new URLSearchParams(window.location.search);
                     const hasCalendarCallback = params.get('calendarConnected') || params.get('calendarError');
                     if (isLoggedIn && !hasCalendarCallback) return <Navigate to="/" />;
                     return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
                  })()
               } />
               <Route path="/" element={
                  isLoggedIn ? (
                     <AdminProvider user={user}>
                        <SchedulingSystem {...schedulingSystemProps} speak={speak} isMobile={isMobile} />
                     </AdminProvider>
                  ) : <Navigate to="/auth" />
               } />
               <Route path="/mobile/schedule" element={
                  isLoggedIn ? <MobileScheduleView user={user} /> : <Navigate to="/auth" />
               } />
               <Route path="/mobile/groups" element={
                  isLoggedIn ? <MobileGroupsView user={user} /> : <Navigate to="/auth" />
               } />
               <Route path="/mobile/calendar" element={
                  isLoggedIn ? <MobileCalendarView user={user} /> : <Navigate to="/auth" />
               } />
            </Routes>
            {isLoggedIn && sharedText && (
               <SharedTextModal text={sharedText} onClose={() => setSharedText(null)} onConfirm={handleConfirmSharedText} />
            )}
            {isLoggedIn && copiedText && !sharedText && (
               <CopiedTextModal text={copiedText} isAnalyzing={isAnalyzing} onClose={() => handleCloseCopiedText(copiedText)} onConfirm={handleConfirmCopiedText} />
            )}
            {isLoggedIn && showBackgroundGuide && <BackgroundGuide onClose={handleCloseBackgroundGuide} />}
         </Router>
      </LoadScript>
   );
}

export default App;
