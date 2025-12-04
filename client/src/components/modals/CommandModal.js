/**
 * ===================================================================================================
 * CommandModal.js - 음성 명령 인식 시 사용자에게 시각적 피드백을 제공하는 모달
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/CommandModal.js
 *
 * 🎯 주요 기능:
 *    - 사용자의 음성 명령이 인식되고 있음을 시각적으로 표시.
 *    - STT(Speech-to-Text)를 통해 변환된 텍스트를 실시간으로 보여줌.
 *    - 마이크 입력 볼륨(`micVolume`)에 따라 모달 크기와 VU 미터가 동적으로 반응하는 애니메이션 효과 제공.
 *    - 모달의 배경(backdrop)을 클릭하여 닫을 수 있는 사용자 친화적 기능 포함.
 *
 * 🔗 연결된 파일:
 *    - ../../hooks/useIntegratedVoiceSystem.js - 음성 인식 상태 및 변환된 텍스트(`modalText`), 마이크 볼륨을 이 컴포넌트로 전달.
 *    - ./SchedulingSystem.js - 최종적으로 이 모달을 렌더링하는 컴포넌트.
 *
 * 💡 UI 위치:
 *    - 음성 인식이 활성화되었을 때, 사용자의 목소리가 감지되면 화면 중앙에 나타나는 팝업 모달.
 *
 * ✏️ 수정 가이드:
 *    - 모달의 전체적인 디자인(색상, 폰트 등)을 변경하려면 이 파일의 Tailwind CSS 클래스를 수정합니다.
 *    - 마이크 볼륨에 따른 애니메이션(모달 크기, VU 미터) 강도를 조절하려면 `style` prop 내부의 계산식을 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 컴포넌트는 순수하게 시각적 피드백을 제공하는 프레젠테이셔널 컴포넌트입니다.
 *    - `micVolume` prop을 활용한 시각 효과는 사용자에게 시스템이 "듣고 있다"는 느낌을 명확하게 전달하는 데 중요한 역할을 합니다.
 *
 * ===================================================================================================
 */
import React, { useRef, useState, useEffect } from 'react';
import { Mic } from 'lucide-react';

/**
 * CommandModal
 * @description 사용자의 음성 명령을 시각적으로 보여주는 피드백 모달. 마이크 볼륨에 따라 반응합니다.
 * @param {object} props - 컴포넌트 props
 * @param {string} props.text - 모달에 표시될 음성 인식 텍스트.
 * @param {function} props.onClose - 모달을 닫기 위해 호출되는 함수.
 * @param {number} props.micVolume - 0과 1 사이의 마이크 입력 볼륨 값. 애니메이션에 사용됨.
 * @returns {JSX.Element}
 */
const CommandModal = ({ text, onClose, micVolume }) => {
  const modalContentRef = useRef(null);
  const [animatedText, setAnimatedText] = useState('');

  useEffect(() => {
    setAnimatedText(text); // Directly set the text without animation or clearing
  }, [text]);

  const handleBackdropClick = (e) => {
    if (modalContentRef.current && !modalContentRef.current.contains(e.target)) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 transition-opacity duration-300 ease-in-out"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalContentRef}
        className="bg-gradient-to-br from-blue-600 to-purple-700 rounded-2xl shadow-2xl p-8 w-11/12 max-w-md text-center transform scale-95 transition-all duration-300 ease-out"
        style={{ transform: `scale(${0.95 + micVolume * 0.05})` }} // Subtle scale based on volume
      >
        <div className="flex justify-center items-center mb-6">
          <Mic className="text-white" size={32} />
          <h2 className="text-2xl font-extrabold ml-3 text-white">음성 명령</h2>
        </div>
        <p className="text-white text-2xl font-semibold py-4 tracking-wide leading-relaxed" style={{ fontFamily: 'Spoqa Han Sans Neo', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
          {animatedText}
        </p>

        {/* VU Meter */}
        <div className="flex justify-center items-end h-12 mt-6 space-x-1.5">
          {[...Array(5)].map((_, i) => (
            <div 
              key={i}
              className="w-3 bg-white rounded-full transition-all duration-100 ease-out"
              style={{ height: `${Math.max(10, micVolume * 100 * (1 + i * 0.1))}px`, opacity: `${0.3 + micVolume * 0.7}` }}
            ></div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CommandModal;