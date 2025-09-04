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
import { usePullToRefresh } from './hooks/usePullToRefresh';
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

   // Pull to refresh 핸들러
   const handleRefresh = useCallback(async () => {
      console.log('새로고침 중...');
      // 페이지 새로고침
      window.location.reload();
   }, []);

   // Pull to refresh 기능 활성화
   const { isRefreshing } = usePullToRefresh(handleRefresh);

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
      // 모바일 환경 감지
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isPWA = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
      
      // 클립보드 API 지원 확인
      if (!navigator.clipboard || !navigator.clipboard.readText) {
         console.warn('Clipboard API not available.');
         return;
      }
      
      // iOS는 특별한 처리가 필요
      if (isIOS) {
         console.log('iOS 클립보드 접근 시도');
         
         // iOS에서는 사용자 상호작용이 반드시 필요
         if (document.visibilityState !== 'visible') {
            console.log('iOS에서 백그라운드 상태로 클립보드 접근 건너뜀');
            return;
         }
         
         // iOS에서는 HTTPS에서만 클립보드 접근 가능
         if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
            console.warn('iOS에서는 HTTPS에서만 클립보드 접근 가능');
            return;
         }
         
         // iOS Safari에서는 focus 이벤트 직후에만 클립보드 접근 가능
         const lastFocusTime = sessionStorage.getItem('lastFocusTime');
         const currentTime = Date.now();
         if (!lastFocusTime || (currentTime - parseInt(lastFocusTime)) > 5000) { // 5초 이내
            console.log('iOS에서 최근 사용자 상호작용 없음, 클립보드 접근 건너뜀');
            sessionStorage.setItem('lastFocusTime', currentTime.toString());
            return;
         }
      } else if (isMobile || isPWA) {
         // 다른 모바일에서는 더 엄격한 권한 확인
         if (document.visibilityState !== 'visible') {
            console.log('모바일에서 백그라운드 상태로 클립보드 접근 건너뜀');
            return;
         }
         
         // 권한 상태 확인 (모바일에서 중요)
         if (navigator.permissions) {
            try {
               const result = await navigator.permissions.query({name: 'clipboard-read'});
               if (result.state === 'denied') {
                  console.warn('모바일에서 클립보드 읽기 권한 거부됨');
                  return;
               } else if (result.state === 'prompt') {
                  console.log('모바일에서 클립보드 권한 프롬프트 필요');
                  return;
               }
            } catch (err) {
               console.log('모바일 권한 확인 실패, 계속 진행:', err);
            }
         }
      }
      
      try {
         const text = await navigator.clipboard.readText();
         
         // 적절한 조건으로 일정 텍스트 감지
         const minLength = 5; // 최소 텍스트 길이
         
         if (text && text.trim().length >= minLength && text !== sharedText && text !== copiedText && !dismissedCopiedTexts.has(text)) {
            // 일정 키워드
            const scheduleKeywords = [
               '일정', '약속', '미팅', '회의', '모임', '만남', '식사', '점심', '저녁'
            ];
            
            // 시간 관련 표현
            const timePattern = /(\d{1,2}:\d{2}|\d{1,2}시|\d{1,2}분|\d{1,2}월\s*\d{1,2}일|\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|오전|오후|새벽|밤)/;
            
            // 날짜 관련 표현
            const datePattern = /(오늘|내일|모레|어제|이번주|다음주|월요일|화요일|수요일|목요일|금요일|토요일|일요일)/;
            
            const hasScheduleKeyword = scheduleKeywords.some(keyword => 
               text.includes(keyword)
            );
            
            const hasTimeExpression = timePattern.test(text);
            const hasDateExpression = datePattern.test(text);
            
            // 다음 중 하나라도 만족하면 감지
            // 1. 일정 키워드만 있어도 OK
            // 2. 시간 표현 + 날짜 표현
            // 3. 일정 키워드 + (시간 또는 날짜) 표현
            if (hasScheduleKeyword || (hasTimeExpression && hasDateExpression) || (hasScheduleKeyword && (hasTimeExpression || hasDateExpression))) {
               console.log('일정 관련 텍스트 감지:', text.substring(0, 50));
               setCopiedText(text);
            }
         }
      } catch (err) {
         // 모바일에서 클립보드 접근 실패는 일반적
         if (isMobile) {
            console.log('모바일 클립보드 접근 실패 (정상):', err.message);
         } else {
            console.error('클립보드 접근 실패:', err);
         }
      }
   }, [sharedText, copiedText, dismissedCopiedTexts]);

   // Effect for handling copied text - 최소한의 이벤트만 사용
   useEffect(() => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      // 디바운싱을 위한 타이머
      let clipboardCheckTimer;
      
      // 클립보드 체크 디바운스 함수
      const debouncedReadClipboard = () => {
         if (clipboardCheckTimer) {
            clearTimeout(clipboardCheckTimer);
         }
         clipboardCheckTimer = setTimeout(readClipboard, 2000); // 2초 디바운싱
      };

      // iOS - 앱 포그라운드 전환 시에만 체크
      if (isIOS) {
         const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
               console.log('iOS에서 앱이 포그라운드로 전환됨');
               sessionStorage.setItem('lastFocusTime', Date.now().toString());
               debouncedReadClipboard();
            }
         };
         
         document.addEventListener('visibilitychange', handleVisibilityChange);
         
         return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (clipboardCheckTimer) clearTimeout(clipboardCheckTimer);
         };
      } else if (isMobile) {
         // 모바일 - 앱 포그라운드 전환과 페이지 쇼 이벤트만
         const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
               console.log('모바일에서 앱이 포그라운드로 전환됨');
               debouncedReadClipboard();
            }
         };
         
         document.addEventListener('visibilitychange', handleVisibilityChange);
         
         return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (clipboardCheckTimer) clearTimeout(clipboardCheckTimer);
         };
      } else {
         // 데스크톱 - 창 포커스 시에만
         const handleFocus = () => {
            console.log('데스크톱에서 창 포커스');
            debouncedReadClipboard();
         };
         
         window.addEventListener('focus', handleFocus);
         
         return () => {
            window.removeEventListener('focus', handleFocus);
            if (clipboardCheckTimer) clearTimeout(clipboardCheckTimer);
         };
      }
   }, [sharedText, dismissedCopiedTexts, readClipboard]);

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
