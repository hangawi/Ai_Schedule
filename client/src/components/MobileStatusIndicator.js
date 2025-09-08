import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, Mic, MicOff, Wifi, WifiOff, Volume2, VolumeX, Clipboard, HelpCircle } from 'lucide-react';
import MobileGuideModal from './modals/MobileGuideModal';

const MobileStatusIndicator = ({ isBackgroundMonitoring, isCallDetected, micVolume }) => {
  // 즉시 모바일 감지
  const detectMobile = () => {
    const userAgent = navigator.userAgent;
    const isDesktop = /Windows NT|Macintosh|X11.*Linux/i.test(userAgent) && 
                      !/Mobile|Tablet/i.test(userAgent);
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
    return !isDesktop && (isMobileUA || window.innerWidth <= 768);
  };

  const [deviceInfo, setDeviceInfo] = useState({
    isMobile: detectMobile(), // 초기에 즉시 감지
    isIOS: false,
    isAndroid: false,
    browser: '',
    isPWA: false,
    hasClipboardAccess: false,
    hasMicrophoneAccess: null, // null로 초기화해서 깜빡임 방지
    isDocumentVisible: true,
    isDocumentFocused: true
  });

  const [expandedView, setExpandedView] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const permissionListenerRef = useRef(null);

  useEffect(() => {
    const checkDeviceCapabilities = async () => {
      const userAgent = navigator.userAgent;
      // 강력한 모바일 감지: 데스크톱을 확실히 제외하는 방식
      const isDesktop = /Windows NT|Macintosh|X11.*Linux/i.test(userAgent) && 
                        !/Mobile|Tablet/i.test(userAgent);
      
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
      
      const isMobile = !isDesktop && (isMobileUA || window.innerWidth <= 768);
      
      const isIOS = /iPad|iPhone|iPod/.test(userAgent);
      const isAndroid = /Android/.test(userAgent);
      
      let browser = 'Unknown';
      if (userAgent.includes('Chrome')) browser = 'Chrome';
      else if (userAgent.includes('Safari')) browser = 'Safari';
      else if (userAgent.includes('Firefox')) browser = 'Firefox';
      else if (userAgent.includes('Edge')) browser = 'Edge';

      const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                    window.navigator.standalone === true;

      // 클립보드 접근 권한 확인 (iOS는 특별 처리)
      let hasClipboardAccess = false;
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          if (isIOS) {
            hasClipboardAccess = true;
          } else {
            const permission = await navigator.permissions.query({name: 'clipboard-read'});
            hasClipboardAccess = permission.state === 'granted' || permission.state === 'prompt';
          }
        }
      } catch (error) {
        hasClipboardAccess = isIOS;
      }

      // 마이크 접근 권한 확인 - 간단하고 안정적으로
      let hasMicrophoneAccess = false;
      try {
        const permission = await navigator.permissions.query({name: 'microphone'});
        hasMicrophoneAccess = permission.state === 'granted';
      } catch (error) {
        // 마이크 권한 확인 실패 시 조용히 처리
      }

      const newDeviceInfo = {
        isMobile,
        isIOS,
        isAndroid,
        browser,
        isPWA,
        hasClipboardAccess,
        hasMicrophoneAccess,
        isDocumentVisible: document.visibilityState === 'visible',
        isDocumentFocused: document.hasFocus()
      };
      
      setDeviceInfo(newDeviceInfo);
    };

    checkDeviceCapabilities();

    // 문서 가시성 변경 감지
    const handleVisibilityChange = () => {
      setDeviceInfo(prev => ({
        ...prev,
        isDocumentVisible: document.visibilityState === 'visible'
      }));
    };

    // 문서 포커스 변경 감지
    const handleFocus = () => {
      setDeviceInfo(prev => ({ ...prev, isDocumentFocused: true }));
    };

    const handleBlur = () => {
      setDeviceInfo(prev => ({ ...prev, isDocumentFocused: false }));
    };

    // 리사이즈 이벤트로 모바일 감지 업데이트
    const handleResize = () => {
      const isMobile = detectMobile();
      setDeviceInfo(prev => ({
        ...prev,
        isMobile
      }));
    };

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
  }, [detectMobile]);

  // 모바일에서만 표시
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
    if (isBackgroundMonitoring) return '백그라운드 모니터링 활성';
    return '대기 중';
  };

  return (
    <div className="fixed bottom-4 left-4 z-40">
      {/* 간단한 상태 인디케이터 */}
      {!expandedView && (
        <button
          onClick={() => setExpandedView(true)}
          className={`flex items-center space-x-2 bg-white rounded-full shadow-lg px-3 py-2 border-2 transition-all ${
            getStatusColor().includes('green') ? 'border-green-500' :
            getStatusColor().includes('yellow') ? 'border-yellow-500' : 
            'border-red-500'
          }`}
        >
          <Smartphone size={16} className={getStatusColor()} />
          {micVolume > 0 && (
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          )}
        </button>
      )}

      {/* 확장된 상태 창 */}
      {expandedView && (
        <div className="bg-white rounded-lg shadow-xl p-4 min-w-[280px] max-w-[320px] border">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-800">모바일 상태</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowGuide(true)}
                className="text-blue-500 hover:text-blue-600"
                title="사용 가이드"
              >
                <HelpCircle size={18} />
              </button>
              <button
                onClick={() => setExpandedView(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {/* 기본 정보 */}
            <div className="flex items-center space-x-2">
              <Smartphone size={14} />
              <span className="text-sm">
                {deviceInfo.isIOS ? 'iOS' : deviceInfo.isAndroid ? 'Android' : 'Mobile'} · 
                {deviceInfo.browser} · 
                {deviceInfo.isPWA ? 'PWA' : 'Web'}
              </span>
            </div>

            {/* 마이크 상태 */}
            <div className="flex items-center space-x-2">
              {deviceInfo.hasMicrophoneAccess === null ? (
                <Mic size={14} className="text-gray-400" />
              ) : deviceInfo.hasMicrophoneAccess ? 
                <Mic size={14} className="text-green-500" /> : 
                <MicOff size={14} className="text-red-500" />
              }
              <span className="text-sm">
                마이크: {deviceInfo.hasMicrophoneAccess === null ? '확인 중...' : deviceInfo.hasMicrophoneAccess ? '허용됨' : '권한 필요'}
              </span>
              {micVolume > 0 && (
                <div className={`w-2 h-2 rounded-full animate-pulse ${
                  micVolume > 50 ? 'bg-green-500' : 
                  micVolume > 20 ? 'bg-yellow-500' : 'bg-blue-500'
                }`}></div>
              )}
            </div>

            {/* 문서 상태 */}
            <div className="flex items-center space-x-2">
              {deviceInfo.isDocumentVisible && deviceInfo.isDocumentFocused ? 
                <Wifi size={14} className="text-green-500" /> : 
                <WifiOff size={14} className="text-red-500" />
              }
              <span className="text-sm">
                상태: {deviceInfo.isDocumentVisible ? 
                  (deviceInfo.isDocumentFocused ? '활성' : '비활성') : 
                  '백그라운드'
                }
              </span>
            </div>

            {/* 클립보드 접근 */}
            <div className="flex items-center space-x-2">
              {deviceInfo.hasClipboardAccess ? 
                <Clipboard size={14} className="text-green-500" /> : 
                <Clipboard size={14} className="text-yellow-500" />
              }
              <span className="text-sm">
                클립보드: {deviceInfo.isIOS ? '조건부 접근' : deviceInfo.hasClipboardAccess ? '접근 가능' : '제한됨'}
              </span>
            </div>

            {/* 백그라운드 모니터링 상태 */}
            <div className="flex items-center space-x-2">
              {isBackgroundMonitoring ? 
                <Volume2 size={14} className="text-blue-500" /> : 
                <VolumeX size={14} className="text-gray-500" />
              }
              <span className="text-sm">
                백그라운드: {isBackgroundMonitoring ? '활성화' : '비활성화'}
              </span>
            </div>

            {/* 통화 감지 상태 */}
            {isCallDetected && (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-red-600 font-medium">통화 감지됨</span>
              </div>
            )}

            {/* 현재 상태 요약 */}
            <div className={`mt-3 p-2 rounded text-sm ${
              getStatusColor().includes('green') ? 'bg-green-50 text-green-700' :
              getStatusColor().includes('yellow') ? 'bg-yellow-50 text-yellow-700' : 
              'bg-red-50 text-red-700'
            }`}>
              {getStatusText()}
            </div>

            {/* 도움말 */}
            {(!deviceInfo.isDocumentVisible || !deviceInfo.isDocumentFocused || !deviceInfo.hasMicrophoneAccess) && (
              <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                💡 팁: 음성인식이 작동하려면 앱이 활성화된 상태여야 하고 마이크 권한이 필요합니다.
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* 가이드 모달 */}
      <MobileGuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </div>
  );
};

export default MobileStatusIndicator;