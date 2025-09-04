import React, { useState, useMemo, useEffect } from 'react';
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

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function App() {
   const { isLoggedIn, user, loginMethod, handleLoginSuccess, handleLogout } = useAuth();
   const [eventAddedKey, setEventAddedKey] = useState(0);
   const [isVoiceRecognitionEnabled, setIsVoiceRecognitionEnabled] = useState(true);
   const [eventActions, setEventActions] = useState(null);
   const [areEventActionsReady, setAreEventActionsReady] = useState(false);
   const { isListening, modalText, setModalText, micVolume } = useVoiceRecognition(isLoggedIn, isVoiceRecognitionEnabled, eventActions, areEventActionsReady, setEventAddedKey);
   const { handleChatMessage } = useChat(isLoggedIn, setEventAddedKey);
   const [sharedText, setSharedText] = useState(null);
   const [copiedText, setCopiedText] = useState(null); // New state for copied text

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
   const readClipboard = async () => {
      if (!navigator.clipboard) {
         console.warn('Clipboard API not available.');
         return;
      }
      try {
         const text = await navigator.clipboard.readText();
         // Only set if text is not empty, not already being processed by sharedText, and not the same as current copiedText
         if (text && text.trim() !== '' && text !== sharedText && text !== copiedText) {
            setCopiedText(text);
         }
      } catch (err) {
         console.error('Failed to read clipboard contents: ', err);
      }
   };

   // Effect for handling copied text
   useEffect(() => {
      // Initial check on mount
      readClipboard();

      // Check when window gains focus (e.g., app comes to foreground)
      window.addEventListener('focus', readClipboard);

      return () => {
         window.removeEventListener('focus', readClipboard);
      };
   }, [sharedText]); // Re-run if sharedText changes, to avoid showing both modals

   const schedulingSystemProps = useMemo(() => ({
      isLoggedIn,
      user,
      handleLogout,
      isListening,
      eventAddedKey,
      setEventActions,
      setAreEventActionsReady,
      isVoiceRecognitionEnabled,
      setIsVoiceRecognitionEnabled,
      loginMethod
   }), [isLoggedIn, user, handleLogout, isListening, eventAddedKey, isVoiceRecognitionEnabled, loginMethod]);

   const handleConfirmSharedText = (text) => {
      handleChatMessage(`다음 내용으로 일정 추가: ${text}`);
      setSharedText(null);
   };

   const handleConfirmCopiedText = (text) => {
      handleChatMessage(`다음 내용으로 일정 추가: ${text}`);
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
               onClose={() => setCopiedText(null)}
               onConfirm={handleConfirmCopiedText}
            />
         )}
      </Router>
   );
}

export default App;
