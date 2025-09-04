import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SchedulingSystem from './SchedulingSystem';
import { AuthScreen } from './components/auth/AuthScreen';
import ChatBox from './components/chat/ChatBox';
import CommandModal from './components/modals/CommandModal';
import SharedTextModal from './components/modals/SharedTextModal';
import CopiedTextModal from './components/modals/CopiedTextModal'; // Import the new modal
import { useAuth } from './hooks/useAuth';
import { useVoiceRecognition } from './hooks/useVoiceRecognition';
import { useChat } from './hooks/useChat';
import { speak } from './utils.js';


function App() { // Trigger auto-deploy

   const { isLoggedIn, user, loginMethod, handleLoginSuccess, handleLogout } = useAuth();
   const [eventAddedKey, setEventAddedKey] = useState(0);
   const [isVoiceRecognitionEnabled, setIsVoiceRecognitionEnabled] = useState(() => {
      const saved = localStorage.getItem('voiceRecognitionEnabled');
      return saved !== null ? JSON.parse(saved) : true;
   });
   const [eventActions, setEventActions] = useState(null);
   const [areEventActionsReady, setAreEventActionsReady] = useState(false);
   const { isListening, modalText, setModalText, micVolume } = useVoiceRecognition(isLoggedIn, isVoiceRecognitionEnabled, eventActions, areEventActionsReady, setEventAddedKey);
   const { handleChatMessage } = useChat(isLoggedIn, setEventAddedKey);
   const [sharedText, setSharedText] = useState(null);
   const [copiedText, setCopiedText] = useState(null); // New state for copied text
   const [dismissedCopiedTexts, setDismissedCopiedTexts] = useState(() => {
      try {
         const saved = localStorage.getItem('dismissedCopiedTexts');
         const savedArray = saved ? JSON.parse(saved) : [];
         
         // 너무 많은 데이터가 쌓이는 것을 방지하기 위해 최근 100개만 유지
         const recentTexts = savedArray.slice(-100);
         
         if (recentTexts.length !== savedArray.length) {
            localStorage.setItem('dismissedCopiedTexts', JSON.stringify(recentTexts));
         }
         
         return new Set(recentTexts);
      } catch (error) {
         return new Set();
      }
   }); // 취소한 복사 텍스트들

   // Effect for handling shared text from URL
   useEffect(() => {
      const queryParams = new URLSearchParams(window.location.search);
      const text = queryParams.get('text');
      if (text) {
         setSharedText(text);
         window.history.replaceState({}, document.title, window.location.pathname);
      }
   }, []);

   // Function to read clipboard content
   const readClipboard = useCallback(async () => {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
         console.warn('Clipboard API not available.');
         return;
      }
      
      // 모바일에서는 사용자 제스처가 필요하므로 권한 확인
      if (navigator.permissions) {
         try {
            const result = await navigator.permissions.query({name: 'clipboard-read'});
            if (result.state === 'denied') {
               console.warn('Clipboard read permission denied.');
               return;
            }
         } catch (err) {
            // 권한 API가 지원되지 않는 브라우저에서는 계속 진행
         }
      }
      
      try {
         const text = await navigator.clipboard.readText();
         // 텍스트가 있고, 길이가 5자 이상이며, 일정 관련 키워드가 포함된 경우에만 표시
         if (text && text.trim().length >= 5 && text !== sharedText && text !== copiedText && !dismissedCopiedTexts.has(text)) {
            const scheduleKeywords = ['일정', '약속', '미팅', '회의', '모임', '시간', '날짜', '월', '화', '수', '목', '금', '토', '일', '오늘', '내일', '모레', '오후', '오전'];
            const hasScheduleKeyword = scheduleKeywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()));
            
            // 일정 관련 키워드가 있거나 시간 형식(예: 13:00, 1시, 오후 2시)이 포함된 경우
            const timePattern = /(\d{1,2}:\d{2}|\d{1,2}시|\b오전|\b오후)/;
            const datePattern = /(\d{1,2}월|\d{1,2}일|월요일|화요일|수요일|목요일|금요일|토요일|일요일)/;
            
            if (hasScheduleKeyword || timePattern.test(text) || datePattern.test(text)) {
               setCopiedText(text);
            }
         }
      } catch (err) {
         console.error('Failed to read clipboard contents: ', err);
      }
   }, [sharedText, copiedText, dismissedCopiedTexts]);

   // Effect for handling copied text
   useEffect(() => {
      // Initial check on mount
      readClipboard();

      // Check when window gains focus (e.g., app comes to foreground)
      window.addEventListener('focus', readClipboard);

      return () => {
         window.removeEventListener('focus', readClipboard);
      };
   }, [sharedText, dismissedCopiedTexts, readClipboard]); // Re-run if sharedText, dismissedCopiedTexts, or readClipboard changes

   // 음성인식 토글 함수 (localStorage에 저장)
   const handleToggleVoiceRecognition = useCallback(() => {
      setIsVoiceRecognitionEnabled(prev => {
         const newValue = !prev;
         localStorage.setItem('voiceRecognitionEnabled', JSON.stringify(newValue));
         return newValue;
      });
   }, []);

   const schedulingSystemProps = useMemo(() => ({
      isLoggedIn,
      user,
      handleLogout,
      isListening,
      eventAddedKey,
      setEventActions,
      setAreEventActionsReady,
      isVoiceRecognitionEnabled,
      setIsVoiceRecognitionEnabled: handleToggleVoiceRecognition,
      loginMethod
   }), [isLoggedIn, user, handleLogout, isListening, eventAddedKey, isVoiceRecognitionEnabled, handleToggleVoiceRecognition, loginMethod]);

   const handleConfirmSharedText = (text) => {
      handleChatMessage(`다음 내용으로 일정 추가: ${text}`);
      setSharedText(null);
   };

   // dismissedCopiedTexts를 업데이트하고 localStorage에 저장하는 helper 함수
   const addToDismissedTexts = useCallback((text) => {
      setDismissedCopiedTexts(prev => {
         const newSet = new Set(prev).add(text);
         try {
            localStorage.setItem('dismissedCopiedTexts', JSON.stringify(Array.from(newSet)));
         } catch (error) {
            console.warn('Failed to save dismissed texts to localStorage:', error);
         }
         return newSet;
      });
   }, []);

   const handleConfirmCopiedText = (text) => {
      handleChatMessage(`다음 내용으로 일정 추가: ${text}`);
      // 확인 후 취소한 텍스트 목록에도 추가해서 다시 표시되지 않도록 함
      addToDismissedTexts(text);
      setCopiedText(null);
   };

   const handleCloseCopiedText = (text) => {
      // 취소한 텍스트를 Set에 추가해서 다시 표시되지 않도록 함
      addToDismissedTexts(text);
      setCopiedText(null);
   };

   return (
      <Router>
         <Routes>
            <Route
               path="/auth"
               element={isLoggedIn ? <Navigate to="/" /> : <AuthScreen onLoginSuccess={handleLoginSuccess} />}
            />
            <Route
               path="/"
               element={
                  isLoggedIn ? (
                     <SchedulingSystem {...schedulingSystemProps} speak={speak} />
                  ) : (
                     <Navigate to="/auth" />
                  )
               }
            />
         </Routes>
         {isLoggedIn && <ChatBox onSendMessage={handleChatMessage} speak={speak} />}
         {modalText && <CommandModal text={modalText} onClose={() => setModalText('')} micVolume={micVolume} />}
         {isLoggedIn && sharedText && (
            <SharedTextModal 
               text={sharedText} 
               onClose={() => setSharedText(null)} 
               onConfirm={handleConfirmSharedText} 
            />
         )}
         {isLoggedIn && copiedText && !sharedText && (
            <CopiedTextModal
               text={copiedText}
               onClose={() => handleCloseCopiedText(copiedText)}
               onConfirm={handleConfirmCopiedText}
            />
         )}
      </Router>
   );
}

export default App;
