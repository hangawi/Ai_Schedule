/**
 * ===================================================================================================
 * useVoiceCommands.js - 음성 명령어를 처리하고 상태를 관리하는 React Hook
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks
 *
 * 🎯 주요 기능:
 *    - '핫워드' 감지 및 '명령어' 모드 전환 관리
 *    - 핫워드(예: "큐브야") 감지 시, 사용자에게 응답하고 명령어 수신 대기
 *    - 명령어 감지 시, `handleChatMessage`를 통해 챗봇(AI)에게 전달하여 처리
 *    - 음성 처리 상태를 시각적으로 표시하기 위한 텍스트(`modalText`) 관리
 *
 * 🔗 연결된 파일:
 *    - ./useIntegratedVoiceSystem.js - 이 훅을 사용하여 음성 인식 결과를 명령어로서 처리
 *    - ../utils/index.js - `speak` 함수를 사용하여 사용자에게 음성 피드백 제공
 *
 * ✏️ 수정 가이드:
 *    - 핫워드 변경/추가: `handleVoiceResult` 함수 내의 `HOTWORDS` 배열에 원하는 단어 추가
 *    - 명령어 처리 로직 변경: `processVoiceCommand` 함수에서 `handleChatMessage` 호출 부분을 수정
 *    - 음성 피드백 변경: `speak()` 함수에 전달되는 텍스트를 수정
 *
 * 📝 참고사항:
 *    - 이 훅은 `listeningModeRef`를 사용하여 'hotword'와 'command' 두 가지 모드를 전환하며 동작합니다.
 *    - 'hotword' 모드에서는 핫워드를, 'command' 모드에서는 실제 명령어를 기다립니다.
 *    - 음성 명령어 처리는 `isVoiceRecognitionEnabled` 플래그가 true일 때만 활성화됩니다.
 *
 * ===================================================================================================
 */
import { useState, useCallback, useRef } from 'react';
import { speak } from '../utils';

/**
 * useVoiceCommands - 핫워드 감지 및 음성 명령어 처리를 담당하는 커스텀 훅
 *
 * @description 핫워드를 감지하여 명령어 입력 모드로 전환하고, 입력된 음성 명령어를
 *              챗봇 메시지로 변환하여 처리하도록 요청합니다.
 * @param {boolean} isLoggedIn - 사용자 로그인 여부
 * @param {boolean} isVoiceRecognitionEnabled - 음성 명령어 기능 활성화 여부
 * @param {Function} handleChatMessage - 감지된 음성 명령어를 챗봇 메시지로 처리하는 함수
 * @param {object} callbacks - 명령어 처리 시작/종료 시 호출될 콜백 함수 객체
 * @param {Function} callbacks.onCommandStart - 명령어 처리 시작 시 호출될 콜백
 * @param {Function} callbacks.onCommandEnd - 명령어 처리 종료 시 호출될 콜백
 * @returns {object} 음성 명령어 관련 상태 및 핸들러 함수를 포함하는 객체
 * @property {string} modalText - 음성 인식 상태를 표시하기 위한 모달 텍스트
 * @property {Function} setModalText - 모달 텍스트를 직접 설정하는 함수
 * @property {Function} handleVoiceResult - 음성 인식 결과를 받아 핫워드 또는 명령어로 처리하는 메인 함수
 * @property {object} listeningModeRef - 현재 음성 수신 모드('hotword' 또는 'command')를 저장하는 ref 객체
 */
export const useVoiceCommands = (isLoggedIn, isVoiceRecognitionEnabled, handleChatMessage, { onCommandStart, onCommandEnd }) => {
  const [modalText, setModalText] = useState('');
  // 'hotword': 핫워드 대기 모드, 'command': 명령어 대기 모드
  const listeningModeRef = useRef('hotword');

  const processVoiceCommand = useCallback(async (command) => {
    if (!isLoggedIn || !isVoiceRecognitionEnabled) {
      setModalText('로그인이 필요하거나 음성인식이 비활성화되어 있습니다.');
      setTimeout(() => setModalText(''), 2000);
      return;
    }

    if (!command) {
      speak('네, 무엇을 도와드릴까요?');
      return;
    }

    setModalText(`"${command}" 처리 중...`);

    if (onCommandStart) onCommandStart();

    try {
      const commandStartTime = performance.now();
      // 8초 타임아웃과 함께 명령어 처리 요청
      const result = await Promise.race([
        handleChatMessage(command),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('명령 처리 시간이 너무 깁니다')), 8000)
        )
      ]);
      const commandEndTime = performance.now();

      speak(result.message);
    } catch (error) {
      speak(`음성 명령 처리에 실패했습니다. ${error.message}`);
    } finally {
      setModalText('');
      if (onCommandEnd) onCommandEnd();
    }
  }, [isLoggedIn, isVoiceRecognitionEnabled, handleChatMessage, onCommandStart, onCommandEnd]);

  const handleVoiceResult = useCallback((transcript, isFinal) => {
    // 명령어 모드에서 중간 결과가 들어오면 모달에 표시
    if (listeningModeRef.current === 'command' && !isFinal) {
        setModalText(transcript);
        return true; // 이 음성 결과는 처리되었음을 알림
    }

    // 최종 결과가 있고, 내용이 있을 때만 처리
    if (isFinal && transcript) {
      const command = transcript.trim();
      
      // 핫워드 모드일 때
      if (listeningModeRef.current === 'hotword' && command) {
        const HOTWORDS = ['큐브야', '비서야', '자비스', '큐브', '비서'];
        const normalizedCommand = command.toLowerCase().replace(/[~!?.]/g, '');
        // 핫워드가 포함되어 있는지 확인
        if (HOTWORDS.some(h => normalizedCommand.includes(h.toLowerCase()))) {
          speak('네, 말씀하세요.');
          listeningModeRef.current = 'command'; // 명령어 모드로 전환
          setModalText('말씀하세요...');
          return true; // 핫워드가 처리되었음을 알림
        }
      } else if (listeningModeRef.current === 'command' && command) {
        // 명령어 모드일 때, 실제 명령어 처리
        processVoiceCommand(command);
        listeningModeRef.current = 'hotword'; // 다시 핫워드 모드로 전환
        return true; // 명령어가 처리되었음을 알림
      }
    }
    // 이 음성 결과가 명령어 시스템에서 처리되지 않았음을 알림
    return false;
  }, [processVoiceCommand]);

  return {
    modalText,
    setModalText,
    handleVoiceResult,
    listeningModeRef
  };
};
