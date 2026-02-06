/**
 * ===================================================================================================
 * Header.js - 애플리케이션의 메인 헤더 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/layout
 *
 * 🎯 주요 기능:
 *    - 앱 로고 및 타이틀 표시
 *    - 모바일 환경에서 사이드바를 열기 위한 메뉴 버튼 제공
 *    - 백그라운드 감지, 클립보드 감지, 음성 인식 기능의 ON/OFF 상태 표시 및 토글 버튼 제공
 *    - 로그인한 사용자의 프로필 정보(이름) 및 로그아웃 버튼 표시
 *    - Google Calendar 탭으로 이동하는 바로가기 버튼 제공
 *
 * 🔗 연결된 파일:
 *    - ../indicators/BackgroundCallIndicator - 백그라운드 감지 상태를 표시하는 자식 컴포넌트
 *    - SchedulingSystem.js - 이 헤더 컴포넌트를 사용하는 메인 레이아웃 컴포넌트
 *
 * 💡 UI 위치:
 *    - 애플리케이션의 최상단에 고정되어 항상 표시되는 헤더 영역
 *
 * ✏️ 수정 가이드:
 *    - 헤더에 새로운 버튼이나 인디케이터 추가: JSX 내의 `flex items-center space-x-1` div에 새로운 요소 추가
 *    - 로고 또는 타이틀 변경: `<button onClick={() => setActiveTab('dashboard')} ...>` 부분의 내용 수정
 *    - 로그아웃 로직 변경: 로그아웃 버튼의 `onClick` 핸들러 내부 로직 수정
 *
 * 📝 참고사항:
 *    - 헤더의 일부 요소(예: BackgroundCallIndicator, Calendar 버튼 등)는 sm(640px) 이상의 화면 크기에서만 표시됩니다.
 *    - 로그아웃 시 `localStorage`에서 관련 상태(현재 방 ID 등)를 제거하는 로직이 포함되어 있습니다.
 *
 * ===================================================================================================
 */

import React from 'react';
import { Calendar, LogOut, Menu as MenuIcon } from 'lucide-react';
import BackgroundCallIndicator from '../indicators/BackgroundCallIndicator';

/**
 * Header
 *
 * @description 앱의 메인 헤더 영역을 렌더링하는 컴포넌트입니다. 로고, 네비게이션, 상태 표시기 및 사용자 관련 액션을 포함합니다.
 * @param {Object} props - 컴포넌트 프롭스
 * @param {Function} props.setIsSidebarOpen - 모바일 사이드바 열림 상태를 설정하는 함수
 * @param {Function} props.setActiveTab - 현재 활성화된 탭을 변경하는 함수
 * @param {string} props.loginMethod - 로그인 방식 ('google' 등)
 * @param {boolean} props.isBackgroundMonitoring - 백그라운드 감지 활성화 여부
 * @param {boolean} props.isCallDetected - 통화 감지 여부
 * @param {Function} props.toggleBackgroundMonitoring - 백그라운드 감지 상태를 토글하는 함수
 * @param {string} props.voiceStatus - 음성 인식 현재 상태
 * @param {boolean} props.isAnalyzing - 텍스트 분석 중인지 여부
 * @param {boolean} props.isLoggedIn - 로그인 상태 여부
 * @param {Object} props.user - 현재 로그인된 사용자 정보
 * @param {Function} props.showAlert - 알림 메시지를 표시하는 함수
 * @param {boolean} props.isVoiceRecognitionEnabled - 음성 인식 활성화 여부
 * @param {Function} props.setIsVoiceRecognitionEnabled - 음성 인식 상태를 설정하는 함수
 * @param {boolean} props.isClipboardMonitoring - 클립보드 감지 활성화 여부
 * @param {Function} props.setIsClipboardMonitoring - 클립보드 감지 상태를 설정하는 함수
 * @param {Function} props.handleManualLogout - 로그아웃을 처리하는 함수
 * @returns {JSX.Element} 헤더 컴포넌트 UI
 */
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
  isClipboardMonitoring,
  setIsClipboardMonitoring,
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
              <img src="/heyheylogo.png" alt="MeetAgent Logo" className="w-full h-full object-cover rounded-lg" />
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
          <button className="hidden sm:block text-gray-600 hover:text-gray-800" onClick={() => setActiveTab('googleCalendar')} title="Google Calendar">
            <Calendar size={20} />
          </button>
          {isLoggedIn && (
            <button className="hidden sm:flex w-auto min-w-[32px] h-7 bg-blue-100 text-blue-600 rounded-full items-center justify-center cursor-pointer px-2 mr-2 text-sm" onClick={() => setActiveTab('profile')} title="프로필 보기">
              {user && user.firstName ? user.firstName : '프로필'}
            </button>
          )}
          <button
            onClick={() => setIsClipboardMonitoring(prev => !prev)}
            title={isClipboardMonitoring ? "클립보드 감지 활성화됨" : "클립보드 감지 비활성화됨"}
            aria-label={isClipboardMonitoring ? "클립보드 감지 비활성화" : "클립보드 감지 활성화"}
            className={`text-lg sm:text-xl transition-colors ${isClipboardMonitoring ? 'text-green-500 hover:text-green-600' : 'text-gray-400 hover:text-gray-500'}`}>
            {'📋'}
          </button>
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
