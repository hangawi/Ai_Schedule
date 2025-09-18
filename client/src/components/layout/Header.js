import React from 'react';
import {
   Calendar,
   LogOut,
   Menu as MenuIcon
} from 'lucide-react';
import BackgroundCallIndicator from '../indicators/BackgroundCallIndicator';

const Header = ({
  setIsSidebarOpen,
  setActiveTab,
  loginMethod,
  isBackgroundMonitoring,
  isCallDetected,
  toggleBackgroundMonitoring,
  voiceStatus,
  isAnalyzing,
  isLoggedIn,
  user,
  showAlert,
  isVoiceRecognitionEnabled,
  setIsVoiceRecognitionEnabled,
  handleManualLogout
}) => {
  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button className="md:hidden mr-3 text-gray-600 hover:text-gray-800" onClick={() => setIsSidebarOpen(true)}>
            <MenuIcon size={24} />
          </button>
          <button onClick={() => setActiveTab('dashboard')} className="flex items-center cursor-pointer">
            <div className="relative w-10 h-10 rounded-lg mr-3">
              <img src="/image.png" alt="MeetAgent Logo" className="w-full h-full object-cover rounded-lg" />
              {loginMethod && (
                <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${loginMethod === 'google' ? 'bg-green-500' : 'bg-red-500'} border-2 border-white z-10`}></div>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-800 hidden sm:block">MeetAgent</h1>
          </button>
        </div>
        <div className="flex items-center space-x-1 sm:space-x-2">
          <div className="hidden sm:block">
            <BackgroundCallIndicator
              isMonitoring={isBackgroundMonitoring}
              isCallDetected={isCallDetected}
              callStartTime={null}
              onToggleMonitoring={toggleBackgroundMonitoring}
              voiceStatus={voiceStatus}
              isAnalyzing={isAnalyzing}
            />
          </div>
          <button className="hidden sm:block text-gray-600 hover:text-gray-800" onClick={() => setActiveTab('googleCalendar')}>
            <Calendar size={20} />
          </button>
          {isLoggedIn && (
            <button className="hidden sm:flex w-auto min-w-[32px] h-7 bg-blue-100 text-blue-600 rounded-full items-center justify-center cursor-pointer px-2 mr-2 text-sm" onClick={() => showAlert('프로필 페이지로 이동 (구현 예정)', 'info', '알림')}>
              {user && user.firstName ? user.firstName : '프로필'}
            </button>
          )}
          <button 
            onClick={() => setIsVoiceRecognitionEnabled(prev => !prev)} 
            title={isVoiceRecognitionEnabled ? "음성 인식 활성화됨 (클릭하여 비활성화)" : "음성 인식 비활성화됨 (클릭하여 활성화)"} 
            aria-label={isVoiceRecognitionEnabled ? "음성 인식 비활성화" : "음성 인식 활성화"}
            className={`text-lg sm:text-xl transition-colors ${isVoiceRecognitionEnabled ? 'text-blue-500 hover:text-blue-600' : 'text-gray-400 hover:text-gray-500'}`}>
            {isVoiceRecognitionEnabled ? '🎙️' : '🔇'}
          </button>
          <button
            className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center cursor-pointer ml-1 sm:ml-2"
            onClick={() => {
              // Clear coordination room state on logout
              localStorage.removeItem('currentRoomId');
              localStorage.removeItem('currentRoomData');
              localStorage.removeItem('activeTab');
              handleManualLogout();
            }}
            aria-label="로그아웃"
            title="로그아웃">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;