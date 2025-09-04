import React, { useState, useMemo, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SchedulingSystem from './SchedulingSystem';
import { AuthScreen } from './components/auth/AuthScreen';
import ChatBox from './components/chat/ChatBox';
import CommandModal from './components/modals/CommandModal';
import SharedTextModal from './components/modals/SharedTextModal'; // Import the new modal
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

   useEffect(() => {
      const queryParams = new URLSearchParams(window.location.search);
      const text = queryParams.get('text');
      if (text) {
         setSharedText(text);
         // Clean the URL to avoid re-triggering on refresh
         window.history.replaceState({}, document.title, window.location.pathname);
      }
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
      setIsVoiceRecognitionEnabled,
      loginMethod // Pass loginMethod
   }), [isLoggedIn, user, handleLogout, isListening, eventAddedKey, isVoiceRecognitionEnabled, loginMethod]);

   const handleConfirmSharedText = (text) => {
      handleChatMessage(`다음 내용으로 일정 추가: ${text}`);
      setSharedText(null);
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
      </Router>
   );
}

export default App;
