import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SchedulingSystem from './SchedulingSystem';
import { AuthScreen } from './components/auth/AuthScreen';
import ChatBox from './components/chat/ChatBox';
import CommandModal from './components/modals/CommandModal';
import SharedTextModal from './components/modals/SharedTextModal';
import CopiedTextModal from './components/modals/CopiedTextModal'; // Import the new modal
import AutoDetectedScheduleModal from './components/modals/AutoDetectedScheduleModal';
import BackgroundGuide from './components/guides/BackgroundGuide';
import MobileStatusIndicator from './components/indicators/MobileStatusIndicator';
import { useAuth } from './hooks/useAuth';
import { useIntegratedVoiceSystem } from './hooks/useIntegratedVoiceSystem';
import { useChat } from './hooks/useChat';
import { speak } from './utils';


function App() { // Trigger auto-deploy

   const { isLoggedIn, user, loginMethod, handleLoginSuccess, handleLogout } = useAuth();
   const [eventAddedKey, setEventAddedKey] = useState(0);
   const [isVoiceRecognitionEnabled, setIsVoiceRecognitionEnabled] = useState(() => {
      const saved = localStorage.getItem('voiceRecognitionEnabled');
      return saved !== null ? JSON.parse(saved) : true;
   });
   const [eventActions, setEventActions] = useState(null);
   const [areEventActionsReady, setAreEventActionsReady] = useState(false);
   const { handleChatMessage } = useChat(isLoggedIn, setEventAddedKey);
   
   // 통합된 음성 시스템
   const {
      // 기존 음성 명령 관련
      isListening,
      modalText,
      setModalText,
      micVolume,
      // 백그라운드 감지 관련
      isBackgroundMonitoring,
      isCallDetected,
      callStartTime,
      detectedSchedules,
      backgroundTranscript,
      toggleBackgroundMonitoring,
      confirmSchedule,
      dismissSchedule
   } = useIntegratedVoiceSystem(isLoggedIn, isVoiceRecognitionEnabled, eventActions, areEventActionsReady, setEventAddedKey, handleChatMessage);
   const [sharedText, setSharedText] = useState(null);
   const [copiedText, setCopiedText] = useState(null); // New state for copied text
  const [isAnalyzing, setIsAnalyzing] = useState(false); // 분석 중 상태
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
   
   const [showBackgroundGuide, setShowBackgroundGuide] = useState(() => {
      return !localStorage.getItem('backgroundGuideShown');
   });


   // Effect for handling shared text from URL
   useEffect(() => {
      const queryParams = new URLSearchParams(window.location.search);
      const text = queryParams.get('text');
      if (text) {
         setSharedText(text);
         window.history.replaceState({}, document.title, window.location.pathname);
      }
   }, []);

   // Function to analyze clipboard content using LLM
   const analyzeClipboard = useCallback(async (text) => {
      try {
         const token = localStorage.getItem('token');
         if (!token) return false;

         const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/call-analysis/analyze-clipboard`, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
               'x-auth-token': token,
            },
            body: JSON.stringify({ text }),
         });

         if (response.ok) {
            const data = await response.json();
            if (data.success && data.data.isScheduleRelated && data.data.confidence >= 0.5) {
               return true;
            }
         }
         return false;
      } catch (error) {
         // LLM 분석 실패시 개선된 패턴 매칭으로 폴백
         const improvedPatterns = [
            // 날짜 패턴
            /(오늘|내일|모레|월요일|화요일|수요일|목요일|금요일|토요일|일요일|tuesday|다음주|이번주|저번주)/i,
            // 시간 패턴  
            /\d{1,2}:\d{2}/,
            /\d{1,2}시/,
            /(오전|오후|새벽|밤|점심|저녁|아침)/,
            // 활동 패턴
            /(약속|미팅|회의|모임|만남|식사|점심|저녁|영화|공연|콘서트|쇼핑)/,
            // 장소 패턴
            /(카페|식당|영화관|극장|백화점|마트|공원|집|사무실|학교|회사)/,
            // 동사 패턴
            /(보기|먹기|만나기|가기|하기|보러|먹으러|만나러|가러|하러)/
         ];
         
         // 최소 2개 이상의 패턴이 매칭되어야 일정으로 판단
         const matchCount = improvedPatterns.filter(pattern => pattern.test(text)).length;
         return matchCount >= 2;
      }
   }, []);

   // Function to read clipboard content
   const readClipboard = useCallback(async () => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      // 클립보드 API 지원 확인
      if (!navigator.clipboard || !navigator.clipboard.readText) {
         // 클립보드 API가 사용할 수 없는 환경입니다
         return;
      }
      
      // 모바일에서는 더 엄격한 조건 적용
      if (isMobile) {
         // iOS는 특히 제한적 - HTTPS + 사용자 제스처 + 포커스 모두 필요
         if (isIOS && (!document.hasFocus() || document.visibilityState !== 'visible')) {
            // iOS: 포커스 및 가시성 요구사항 미충족
            return;
         }
         
         // 모바일에서는 사용자 제스처가 최근에 발생해야 함
         if (document.visibilityState !== 'visible') {
            // 모바일: 문서가 백그라운드 상태
            return;
         }
      } else {
         // 데스크톱에서는 기존 조건 유지
         if (document.visibilityState !== 'visible' || !document.hasFocus()) {
            // 데스크톱: 문서가 포커스되지 않아 클립보드 접근 건너뜀
            return;
         }
      }
      
      // 권한 상태 확인 - 모바일에서는 더 상세히
      if (navigator.permissions) {
         try {
            const result = await navigator.permissions.query({name: 'clipboard-read'});
            if (result.state === 'denied') {
               // 클립보드 읽기 권한이 거부되었습니다
               return;
            }
            // iOS에서는 prompt 상태에서도 실패할 수 있음
            if (isIOS && result.state === 'prompt') {
               // iOS: 클립보드 권한이 prompt 상태
            }
         } catch (err) {
            // 권한 확인 실패, 계속 진행
         }
      }
      
      try {
         const text = await navigator.clipboard.readText();
         
         // 적절한 조건으로 일정 텍스트 감지
         const minLength = 5; // 최소 텍스트 길이
         
         if (text && text.trim().length >= minLength && text !== sharedText && text !== copiedText && !dismissedCopiedTexts.has(text)) {
            // 즉시 모달 표시 (분석 중 상태)
            setCopiedText(text);
            setIsAnalyzing(true);
            
            // 백그라운드에서 LLM 분석 수행
            analyzeClipboard(text).then(isScheduleText => {
               setIsAnalyzing(false);
               if (!isScheduleText) {
                  // 일정과 관련 없는 텍스트면 모달 숨김
                  setCopiedText(null);
                  // 다시 표시되지 않도록 취소 목록에 추가
                  addToDismissedTexts(text);
               }
               // 일정 관련 텍스트면 모달은 그대로 유지
            }).catch(error => {
               console.error('클립보드 분석 오류:', error);
               setIsAnalyzing(false);
               // 분석 실패시 폴백으로 패턴 매칭 사용
               const improvedPatterns = [
                  /(오늘|내일|모레|월요일|화요일|수요일|목요일|금요일|토요일|일요일|tuesday|다음주|이번주)/i,
                  /\d{1,2}:\d{2}|\d{1,2}시|(오전|오후|새벽|밤|점심|저녁|아침)/,
                  /(약속|미팅|회의|모임|만남|식사|점심|저녁|영화|공연|콘서트|쇼핑|카페|식당|영화관)/,
                  /(보기|먹기|만나기|가기|하기|보러|먹으러|만나러|가러|하러|보자|먹자|만나자|가자)/
               ];
               const matchCount = improvedPatterns.filter(pattern => pattern.test(text)).length;
               if (matchCount < 2) {
                  setCopiedText(null);
                  addToDismissedTexts(text);
               }
            });
         }
      } catch (err) {
         // 클립보드 접근 실패
      }
   }, [sharedText, copiedText, dismissedCopiedTexts, analyzeClipboard]);

   // Effect for handling copied text - 복사 즉시 감지 가능하도록 개선
   useEffect(() => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // 디바운싱을 위한 타이머
      let clipboardCheckTimer;
      
      // 클립보드 체크 디바운스 함수
      const debouncedReadClipboard = () => {
         if (clipboardCheckTimer) {
            clearTimeout(clipboardCheckTimer);
         }
         clipboardCheckTimer = setTimeout(readClipboard, 1000); // 1초로 단축
      };

      // 즉시 클립보드 체크 (디바운싱 없이)
      const immediateReadClipboard = () => {
         if (clipboardCheckTimer) {
            clearTimeout(clipboardCheckTimer);
         }
         // 포커스 상태 확인 후 실행
         if (document.hasFocus() && document.visibilityState === 'visible') {
            readClipboard();
         } else {
            // 문서가 포커스되지 않아 클립보드 체크 건너뜀
         }
      };

      // 앱 포그라운드 전환 시
      const handleVisibilityChange = () => {
         if (document.visibilityState === 'visible') {
            // 앱이 포그라운드로 전환됨
            // 약간의 지연 후 체크 (포커스가 완전히 설정될 때까지 대기)
            setTimeout(immediateReadClipboard, 100);
         }
      };
      
      // 창 포커스 시 (데스크톱에서 중요)
      const handleFocus = () => {
         // 창 포커스
         // 포커스 이벤트는 이미 포커스 상태이므로 바로 실행
         setTimeout(() => readClipboard(), 100);
      };

      // 모바일에서 터치 후 체크 (복사 후 바로 감지용)
      const handleTouchEnd = () => {
         if (isMobile) {
            // 터치 후 클립보드 체크
            debouncedReadClipboard();
         }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocus);
      if (isMobile) {
         document.addEventListener('touchend', handleTouchEnd, { passive: true });
      }
      
      // 최초 로드 시 한 번 체크
      setTimeout(immediateReadClipboard, 500);
      
      return () => {
         document.removeEventListener('visibilitychange', handleVisibilityChange);
         window.removeEventListener('focus', handleFocus);
         if (isMobile) {
            document.removeEventListener('touchend', handleTouchEnd);
         }
         if (clipboardCheckTimer) clearTimeout(clipboardCheckTimer);
      };
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
      loginMethod,
      // 통합 음성 시스템
      isBackgroundMonitoring,
      isCallDetected,
      toggleBackgroundMonitoring
   }), [isLoggedIn, user, handleLogout, isListening, eventAddedKey, isVoiceRecognitionEnabled, handleToggleVoiceRecognition, loginMethod, isBackgroundMonitoring, isCallDetected, toggleBackgroundMonitoring]);

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
            // localStorage에 취소된 텍스트 저장 실패
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
      setIsAnalyzing(false);
   };

   const handleCloseBackgroundGuide = () => {
      localStorage.setItem('backgroundGuideShown', 'true');
      setShowBackgroundGuide(false);
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
               isAnalyzing={isAnalyzing}
               onClose={() => handleCloseCopiedText(copiedText)}
               onConfirm={handleConfirmCopiedText}
            />
         )}
         {isLoggedIn && detectedSchedules.length > 0 && (
            <AutoDetectedScheduleModal
               detectedSchedules={detectedSchedules}
               onConfirm={confirmSchedule}
               onDismiss={dismissSchedule}
               onClose={() => detectedSchedules.forEach(dismissSchedule)}
               backgroundTranscript={backgroundTranscript}
               callStartTime={callStartTime}
            />
         )}
         {isLoggedIn && showBackgroundGuide && (
            <BackgroundGuide onClose={handleCloseBackgroundGuide} />
         )}
         {/* 모바일 환경에서 상태 표시 */}
         {isLoggedIn && (
            <MobileStatusIndicator 
               isBackgroundMonitoring={isBackgroundMonitoring}
               isCallDetected={isCallDetected}
               micVolume={micVolume}
            />
         )}
      </Router>
   );
}

export default App;