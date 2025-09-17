import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SchedulingSystem from './SchedulingSystem';
import AuthScreen from './components/auth/AuthScreen';
import ChatBox from './components/chat/ChatBox';
import CommandModal from './components/modals/CommandModal';
import SharedTextModal from './components/modals/SharedTextModal';
import CopiedTextModal from './components/modals/CopiedTextModal';
import AutoDetectedScheduleModal from './components/modals/AutoDetectedScheduleModal';
import BackgroundGuide from './components/guides/BackgroundGuide';
import MobileStatusIndicator from './components/indicators/MobileStatusIndicator';
import NotificationModal from './components/modals/NotificationModal';
import { useAuth } from './hooks/useAuth';
import { useIntegratedVoiceSystem } from './hooks/useIntegratedVoiceSystem';
import { useChat } from './hooks/useChat';
import { speak } from './utils';

function App() {
   const { isLoggedIn, user, loginMethod, handleLoginSuccess, handleLogout } = useAuth();
   const [eventAddedKey, setEventAddedKey] = useState(0);
   const [isVoiceRecognitionEnabled, setIsVoiceRecognitionEnabled] = useState(() => {
      const saved = localStorage.getItem('voiceRecognitionEnabled');
      return saved !== null ? JSON.parse(saved) : true;
   });
   const [eventActions, setEventActions] = useState(null);
   const [areEventActionsReady, setAreEventActionsReady] = useState(false);
   const { handleChatMessage } = useChat(isLoggedIn, setEventAddedKey, eventActions);
   
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
   } = useIntegratedVoiceSystem(isLoggedIn, isVoiceRecognitionEnabled, eventActions, areEventActionsReady, setEventAddedKey, handleChatMessage);

   
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
         const token = localStorage.getItem('token');
         if (!token) return false;

         const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/call-analysis/analyze-clipboard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
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
      if (!navigator.clipboard?.readText || document.visibilityState !== 'visible') return;

      try {
         const text = await navigator.clipboard.readText();
         if (text && text.trim().length >= 5 && !dismissedCopiedTexts.has(text)) {
            // 먼저 백그라운드에서 분석하고, 일정이 맞을 때만 모달 표시
            const isSchedule = await analyzeClipboard(text);
            if (isSchedule) {
               setCopiedText(text);
               setIsAnalyzing(true);
               // 짧은 시간 후 분석 완료 상태로 변경
               setTimeout(() => setIsAnalyzing(false), 500);
            } else {
               // 일정이 아니면 바로 무시 목록에 추가
               addToDismissedTexts(text);
            }
         }
      } catch (err) {
         console.error('Clipboard read failed: ', err);
      }
   }, [dismissedCopiedTexts, analyzeClipboard, addToDismissedTexts]);

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
      isLoggedIn, user, handleLogout, isListening, eventAddedKey, setEventAddedKey,
      setEventActions, setAreEventActionsReady, isVoiceRecognitionEnabled,
      setIsVoiceRecognitionEnabled: handleToggleVoiceRecognition, loginMethod,
      isBackgroundMonitoring, isCallDetected, callStartTime, toggleBackgroundMonitoring,
      voiceStatus, 
      isAnalyzing: voiceAnalyzing
   }), [isLoggedIn, user, handleLogout, isListening, eventAddedKey, setEventAddedKey, isVoiceRecognitionEnabled, handleToggleVoiceRecognition, loginMethod, isBackgroundMonitoring, isCallDetected, callStartTime, toggleBackgroundMonitoring, voiceStatus, voiceAnalyzing]);

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

   return (
      <Router>
         <Routes>
            <Route path="/auth" element={isLoggedIn ? <Navigate to="/" /> : <AuthScreen onLoginSuccess={handleLoginSuccess} />} />
            <Route path="/" element={isLoggedIn ? <SchedulingSystem {...schedulingSystemProps} speak={speak} /> : <Navigate to="/auth" />} />
         </Routes>
         {isLoggedIn && <ChatBox onSendMessage={handleChatMessage} speak={speak} />}
         {modalText && <CommandModal text={modalText} onClose={() => setModalText('')} />}
         {isLoggedIn && sharedText && (
            <SharedTextModal text={sharedText} onClose={() => setSharedText(null)} onConfirm={handleConfirmSharedText} />
         )}
         {isLoggedIn && copiedText && !sharedText && (
            <CopiedTextModal text={copiedText} isAnalyzing={isAnalyzing} onClose={() => handleCloseCopiedText(copiedText)} onConfirm={handleConfirmCopiedText} />
         )}
         {isLoggedIn && detectedSchedules.length > 0 && (
            <AutoDetectedScheduleModal
               detectedSchedules={detectedSchedules}
               backgroundTranscript={backgroundTranscript}
               callStartTime={callStartTime}
               onConfirm={confirmSchedule}
               onDismiss={dismissSchedule}
               onClose={() => detectedSchedules.forEach(dismissSchedule)}
            />
         )}
         {isLoggedIn && showBackgroundGuide && <BackgroundGuide onClose={handleCloseBackgroundGuide} />}
         {isLoggedIn && notification && (
            <NotificationModal
               isOpen={!!notification}
               onClose={clearNotification}
               type={notification.type}
               title={notification.title}
               message={notification.message}
            />
         )}
         {isLoggedIn && (
            <MobileStatusIndicator 
               isBackgroundMonitoring={isBackgroundMonitoring}
               isCallDetected={isCallDetected}
               micVolume={micVolume}
               voiceStatus={voiceStatus}
               isAnalyzing={voiceAnalyzing}
            />
         )}
      </Router>
   );
}

export default App;
