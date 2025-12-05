/**
 * ===================================================================================================
 * MobileStatusIndicator.js - 모바일 환경에서의 백그라운드 감지 상태 표시기
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/indicators
 *
 * 🎯 주요 기능:
 *    - 모바일 환경에서만 표시되는 상태 표시기
 *    - 백그라운드 감지 기능과 관련된 다양한 상태(마이크 권한, 문서 가시성, 녹음 상태 등)를 종합적으로 표시
 *    - 간단한 아이콘 뷰와 상세 정보가 포함된 확장 뷰를 토글하여 제공
 *    - 마이크 입력 볼륨을 시각적으로 표시
 *    - 사용자를 위한 가이드 모달(`MobileGuideModal`)을 여는 기능 제공
 *
 * 🔗 연결된 파일:
 *    - ../modals/MobileGuideModal - 이 컴포넌트에서 호출하는 가이드 모달
 *    - SchedulingSystem.js - 이 컴포넌트를 사용하여 모바일 환경의 상태를 표시
 *
 * 💡 UI 위치:
 *    - 모바일 화면의 좌측 하단에 고정된 부유 버튼 및 확장 패널
 *
 * ✏️ 수정 가이드:
 *    - 새로운 상태 추가/수정: `deviceInfo` 상태 객체에 새로운 속성을 추가하고 `checkDeviceCapabilities` 함수에서 값을 설정
 *    - 상태별 UI 변경: `getStatusColor`, `getStatusText` 함수 및 JSX의 조건부 렌더링 로직 수정
 *    - 확장 뷰의 정보 항목 변경: `expandedView`가 true일 때 렌더링되는 JSX 내용 수정
 *
 * 📝 참고사항:
 *    - 이 컴포넌트는 `detectMobile` 함수를 통해 모바일 환경을 감지하고, 모바일이 아닐 경우 아무것도 렌더링하지 않습니다.
 *    - `useEffect`를 사용하여 사용자의 기기 환경, 권한, 문서 상태 등을 비동기적으로 확인하고 상태를 업데이트합니다.
 *    - `document.visibilityState`, `document.hasFocus` 등을 사용하여 앱의 활성 상태를 감지하고, 이에 따라 다른 상태 텍스트를 표시합니다.
 *
 * ===================================================================================================
 */

import React, { useState, useEffect } from 'react';
import { Smartphone, Mic, MicOff, Wifi, WifiOff, Volume2, VolumeX, Clipboard, HelpCircle } from 'lucide-react';
import MobileGuideModal from '../modals/MobileGuideModal';

/**
 * MobileStatusIndicator
 *
 * @description 모바일 환경에서 백그라운드 감지 기능의 다양한 상태를 종합적으로 보여주는 인디케이터 컴포넌트입니다.
 * @param {Object} props - 컴포넌트 프롭스
 * @param {boolean} props.isBackgroundMonitoring - 백그라운드 감지 기능 활성화 여부
 * @param {boolean} props.isCallDetected - 통화 상태 감지 여부
 * @param {number} props.micVolume - 현재 마이크 입력 볼륨 (0-100)
 * @param {string} props.voiceStatus - 음성 인식의 현재 상태
 * @param {boolean} props.isAnalyzing - 대화 내용 요약 분석 중인지 여부
 * @returns {JSX.Element | null} 모바일 환경일 경우 상태 표시기 UI, 아닐 경우 null
 *
 * @example
 * <MobileStatusIndicator
 *   isBackgroundMonitoring={isMonitoring}
 *   isCallDetected={isCallActive}
 *   micVolume={volume}
 *   voiceStatus={status}
 *   isAnalyzing={isAnalyzingText}
 * />
 */
const MobileStatusIndicator = ({ isBackgroundMonitoring, isCallDetected, micVolume, voiceStatus, isAnalyzing }) => {
  const detectMobile = () => {
    const userAgent = navigator.userAgent;
    const isDesktop = /Windows NT|Macintosh|X11.*Linux/i.test(userAgent) && !/Mobile|Tablet/i.test(userAgent);
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
    return !isDesktop && (isMobileUA || window.innerWidth <= 768);
  };

  const [deviceInfo, setDeviceInfo] = useState({
    isMobile: detectMobile(),
    isIOS: false,
    isAndroid: false,
    browser: '',
    isPWA: false,
    hasClipboardAccess: false,
    hasMicrophoneAccess: null,
    isDocumentVisible: true,
    isDocumentFocused: true
  });

  const [expandedView, setExpandedView] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const checkDeviceCapabilities = async () => {
      const userAgent = navigator.userAgent;
      const isDesktop = /Windows NT|Macintosh|X11.*Linux/i.test(userAgent) && !/Mobile|Tablet/i.test(userAgent);
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
      const isMobile = !isDesktop && (isMobileUA || window.innerWidth <= 768);
      const isIOS = /iPad|iPhone|iPod/.test(userAgent);
      const isAndroid = /Android/.test(userAgent);
      
      let browser = 'Unknown';
      if (userAgent.includes('Chrome')) browser = 'Chrome';
      else if (userAgent.includes('Safari')) browser = 'Safari';
      else if (userAgent.includes('Firefox')) browser = 'Firefox';
      else if (userAgent.includes('Edge')) browser = 'Edge';

      const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

      let hasClipboardAccess = false;
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          if (isIOS) hasClipboardAccess = true;
          else {
            const permission = await navigator.permissions.query({name: 'clipboard-read'});
            hasClipboardAccess = permission.state === 'granted' || permission.state === 'prompt';
          }
        }
      } catch (error) { hasClipboardAccess = isIOS; }

      let hasMicrophoneAccess = false;
      try {
        const permission = await navigator.permissions.query({name: 'microphone'});
        hasMicrophoneAccess = permission.state === 'granted';
      } catch (error) {}

      setDeviceInfo({
        isMobile, isIOS, isAndroid, browser, isPWA, hasClipboardAccess, hasMicrophoneAccess,
        isDocumentVisible: document.visibilityState === 'visible',
        isDocumentFocused: document.hasFocus()
      });
    };

    checkDeviceCapabilities();

    const handleVisibilityChange = () => setDeviceInfo(prev => ({...prev, isDocumentVisible: document.visibilityState === 'visible'}));
    const handleFocus = () => setDeviceInfo(prev => ({ ...prev, isDocumentFocused: true }));
    const handleBlur = () => setDeviceInfo(prev => ({ ...prev, isDocumentFocused: false }));
    const handleResize = () => setDeviceInfo(prev => ({ ...prev, isMobile: detectMobile() }));

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (!deviceInfo.isMobile) return null;

  const getStatusColor = () => {
    if (!deviceInfo.isDocumentVisible || !deviceInfo.isDocumentFocused) return 'text-red-500';
    if (deviceInfo.hasMicrophoneAccess === null) return 'text-gray-500';
    if (!deviceInfo.hasMicrophoneAccess) return 'text-yellow-500';
    if (isBackgroundMonitoring && deviceInfo.hasMicrophoneAccess) return 'text-green-500';
    return 'text-gray-500';
  };

  const getStatusText = () => {
    if (!deviceInfo.isDocumentVisible) return '백그라운드 (음성인식 불가)';
    if (!deviceInfo.isDocumentFocused) return '포커스 없음 (제한적)';
    if (deviceInfo.hasMicrophoneAccess === null) return '권한 확인 중...';
    if (!deviceInfo.hasMicrophoneAccess) return '마이크 권한 필요';
    if (isBackgroundMonitoring) {
      if (voiceStatus === 'recording') return '🎤 녹음 중';
      if (voiceStatus === 'ending') return '⏹️ 녹음 종료';
      if (isAnalyzing || voiceStatus === 'analyzing') return '🔍 요약 중';
      return '👂 대기 중';
    }
    return '😴 대기 중';
  };

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {!expandedView && (
        <button onClick={() => setExpandedView(true)} className={`flex items-center space-x-2 bg-white rounded-full shadow-lg px-3 py-2 border-2 transition-all ${getStatusColor().replace('text-', 'border-')}`}>
          <Smartphone size={16} className={getStatusColor()} />
          {micVolume > 0 && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>}
        </button>
      )}

      {expandedView && (
        <div className="bg-white rounded-lg shadow-xl p-4 min-w-[280px] max-w-[320px] border">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-800">모바일 상태</h3>
            <div className="flex items-center space-x-2">
              <button onClick={() => setShowGuide(true)} className="text-blue-500 hover:text-blue-600" title="사용 가이드"><HelpCircle size={18} /></button>
              <button onClick={() => setExpandedView(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2"><Smartphone size={14} /><span className="text-sm">{deviceInfo.isIOS ? 'iOS' : deviceInfo.isAndroid ? 'Android' : 'Mobile'} · {deviceInfo.browser} · {deviceInfo.isPWA ? 'PWA' : 'Web'}</span></div>
            <div className="flex items-center space-x-2">
              {deviceInfo.hasMicrophoneAccess === null ? <Mic size={14} className="text-gray-400" /> : deviceInfo.hasMicrophoneAccess ? <Mic size={14} className="text-green-500" /> : <MicOff size={14} className="text-red-500" />}
              <span className="text-sm">마이크: {deviceInfo.hasMicrophoneAccess === null ? '확인 중...' : deviceInfo.hasMicrophoneAccess ? '허용됨' : '권한 필요'}</span>
              {micVolume > 0 && <div className={`w-2 h-2 rounded-full animate-pulse ${micVolume > 50 ? 'bg-green-500' : micVolume > 20 ? 'bg-yellow-500' : 'bg-blue-500'}`}></div>}
            </div>
            <div className="flex items-center space-x-2">
              {deviceInfo.isDocumentVisible && deviceInfo.isDocumentFocused ? <Wifi size={14} className="text-green-500" /> : <WifiOff size={14} className="text-red-500" />}
              <span className="text-sm">상태: {deviceInfo.isDocumentVisible ? (deviceInfo.isDocumentFocused ? '활성' : '비활성') : '백그라운드'}</span>
            </div>
            <div className="flex items-center space-x-2">
              {deviceInfo.hasClipboardAccess ? <Clipboard size={14} className="text-green-500" /> : <Clipboard size={14} className="text-yellow-500" />}
              <span className="text-sm">클립보드: {deviceInfo.isIOS ? '조건부 접근' : deviceInfo.hasClipboardAccess ? '접근 가능' : '제한됨'}</span>
            </div>
            <div className="flex items-center space-x-2">
              {isBackgroundMonitoring ? <Volume2 size={14} className="text-blue-500" /> : <VolumeX size={14} className="text-gray-500" />}
              <span className="text-sm">백그라운드: {isBackgroundMonitoring ? '활성화' : '비활성화'}</span>
            </div>
            {isCallDetected && <div className="flex items-center space-x-2"><div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div><span className="text-sm text-red-600 font-medium">통화 감지됨</span></div>}
            <div className={`mt-3 p-2 rounded text-sm ${getStatusColor().replace('text-', 'bg-').replace('-500', '-50').replace('-600', '-50')} ${getStatusColor().replace('-500', '-700').replace('-600', '-700')}`}>{getStatusText()}</div>
            {(!deviceInfo.isDocumentVisible || !deviceInfo.isDocumentFocused || !deviceInfo.hasMicrophoneAccess) && <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">💡 팁: 음성인식이 작동하려면 앱이 활성화된 상태여야 하고 마이크 권한이 필요합니다.</div>}
          </div>
        </div>
      )}
      <MobileGuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </div>
  );
};

export default MobileStatusIndicator;
