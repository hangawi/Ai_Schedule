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
   const { handleChatMessage } = useChat(isLoggedIn, setEventAddedKey);
   
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
         const improvedPatterns = [
            /(오늘|내일|모레|월요일|화요일|수요일|목요일|금요일|토요일|일요일|tuesday|다음주|이번주|저번주)/i,
            /\d{1,2}:\d{2}|\d{1,2}시|(오전|오후|새벽|밤|점심|저녁|아침)/,
            /(약속|미팅|회의|모임|만남|식사|영화|공연)/,
            /(카페|식당|영화관|극장|백화점|공원)/,
            /(보기|먹기|만나기|가기|하기|보러|먹으러|만나러|가러|하러)/
         ];
         const matchCount = improvedPatterns.filter(pattern => pattern.test(text)).length;
         return matchCount >= 2;
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
            setCopiedText(text);
            setIsAnalyzing(true);
            
            const isSchedule = await analyzeClipboard(text);
            setIsAnalyzing(false);
            if (!isSchedule) {
               setCopiedText(null);
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
