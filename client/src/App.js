import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LoadScript } from '@react-google-maps/api';
import SchedulingSystem from './SchedulingSystem';
import AuthScreen from './components/auth/AuthScreen';
import { AdminProvider } from './contexts/AdminContext';
import SharedTextModal from './components/modals/SharedTextModal';
import CopiedTextModal from './components/modals/CopiedTextModal';
import BackgroundGuide from './components/guides/BackgroundGuide';
import { useAuth } from './hooks/useAuth';
import { useChat } from './hooks/useChat';
import { speak } from './utils';
import { auth } from './config/firebaseConfig';

const libraries = ['places'];

function App() {
   const { isLoggedIn, user, loginMethod, handleLoginSuccess, handleLogout } = useAuth();
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
               const isSchedule = await analyzeClipboard(text);
               if (isSchedule) {
                  setCopiedText(text);
                  setIsAnalyzing(true);
                  setTimeout(() => setIsAnalyzing(false), 500);
               } else {
                  addToDismissedTexts(text);
               }
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

   // API 키 디버깅
   const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'AIzaSyD-vRy7OPDKSxKUy2w52LBkqfSj2lJCwdY';
   console.log('Google Maps API Key:', GOOGLE_MAPS_API_KEY);

   return (
      <LoadScript
         googleMapsApiKey={GOOGLE_MAPS_API_KEY}
         libraries={libraries}
         language="ko"
      >
         <Router>
            <Routes>
               <Route path="/auth" element={isLoggedIn ? <Navigate to="/" /> : <AuthScreen onLoginSuccess={handleLoginSuccess} />} />
               <Route path="/" element={isLoggedIn ? (
                  <AdminProvider user={user}>
                     <SchedulingSystem {...schedulingSystemProps} speak={speak} />
                  </AdminProvider>
               ) : <Navigate to="/auth" />} />
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
