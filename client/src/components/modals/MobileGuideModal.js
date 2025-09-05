import React from 'react';
import { Smartphone, Mic, Wifi, Copy, AlertTriangle, CheckCircle } from 'lucide-react';

const MobileGuideModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <Smartphone className="mr-2 text-blue-500" size={24} />
              모바일 사용 가이드
            </h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>

          <div className="space-y-4">
            {/* 중요 알림 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="text-yellow-600 mt-1" size={20} />
                <div>
                  <h3 className="font-semibold text-yellow-800">중요한 제한사항</h3>
                  <p className="text-yellow-700 text-sm mt-1">
                    모바일에서는 앱이 백그라운드에 있을 때 음성인식이 작동하지 않습니다.
                  </p>
                </div>
              </div>
            </div>

            {/* 음성인식 */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2 flex items-center">
                <Mic className="mr-2 text-green-500" size={18} />
                음성인식 사용법
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <CheckCircle size={16} className="text-green-500" />
                  <span>앱이 화면에 보이는 상태에서만 작동</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle size={16} className="text-green-500" />
                  <span>마이크 권한 허용 필요</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle size={16} className="text-green-500" />
                  <span>🎙️ 버튼으로 "비서야" 명령어 사용</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle size={16} className="text-green-500" />
                  <span>백그라운드로 통화 내용 자동 감지</span>
                </div>
              </div>
            </div>

            {/* 클립보드 */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2 flex items-center">
                <Copy className="mr-2 text-blue-500" size={18} />
                복사한 텍스트 감지
              </h3>
              <div className="space-y-2 text-sm">
                {isIOS ? (
                  <div className="bg-orange-50 p-3 rounded">
                    <p className="text-orange-800">
                      <strong>iOS Safari 제한사항:</strong> 클립보드 접근이 매우 제한적입니다.
                    </p>
                    <ul className="mt-2 text-orange-700 space-y-1">
                      <li>• <strong>앱이 포그라운드에서만</strong> 접근 가능</li>
                      <li>• 텍스트 복사 후 <strong>즉시 앱으로 전환</strong></li>
                      <li>• 백그라운드에서는 감지 불가능</li>
                      <li>• 권한 허용 팝업이 매번 나타날 수 있음</li>
                    </ul>
                    <div className="mt-2 text-xs text-orange-600 bg-orange-100 p-2 rounded">
                      💡 <strong>추천:</strong> 음성 명령("비서야")을 더 많이 활용하세요!
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <CheckCircle size={16} className="text-green-500" />
                      <span>앱이 활성화될 때 자동 감지</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle size={16} className="text-green-500" />
                      <span>일정 관련 키워드 포함 시 알림</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* PWA 설치 권장 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">💡 더 나은 경험을 위해</h3>
              <p className="text-blue-700 text-sm mb-3">
                앱을 홈 화면에 추가하면 더 안정적으로 사용할 수 있습니다.
              </p>
              <div className="text-xs text-blue-600">
                {isIOS ? (
                  <p>Safari → 공유 버튼 → "홈 화면에 추가"</p>
                ) : (
                  <p>Chrome → 메뉴 → "홈 화면에 추가"</p>
                )}
              </div>
            </div>

            {/* 연결 상태 */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2 flex items-center">
                <Wifi className="mr-2 text-purple-500" size={18} />
                최적 사용 환경
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <CheckCircle size={16} className="text-green-500" />
                  <span>안정적인 Wi-Fi 또는 4G/5G 연결</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle size={16} className="text-green-500" />
                  <span>조용한 환경에서 음성인식</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle size={16} className="text-green-500" />
                  <span>화면 우하단 상태 표시기로 상태 확인</span>
                </div>
              </div>
            </div>

            {/* 문제 해결 */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold mb-2">🔧 문제가 있을 때</h3>
              <div className="space-y-1 text-sm text-gray-700">
                <p>1. 페이지 새로고침 (당겨서 새로고침)</p>
                <p>2. 브라우저 앱 완전 종료 후 재시작</p>
                <p>3. 마이크 권한 재설정</p>
                <p>4. 다른 브라우저에서 테스트</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              확인했습니다
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileGuideModal;