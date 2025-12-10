/**
 * ===================================================================================================
 * useIntegratedVoiceSystem.js - 통합 음성 인식 시스템을 관리하는 최상위 React Hook
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks
 *
 * 🎯 주요 기능:
 *    - 여러 음성 관련 훅(`useBackgroundMonitoring`, `useVoiceCommands`, `useSharedAudioStream`, `useAudioManager`)을 통합 관리
 *    - Web Speech API (`SpeechRecognition`)의 생명주기 관리 (초기화, 시작, 재시작, 종료)
 *    - 음성 인식 결과(transcript)를 분석하여 '명령어' 또는 '백그라운드 모니터링'으로 라우팅
 *    - 통합된 음성 상태(`voiceStatus`, `isAnalyzing`) 및 마이크 볼륨(`micVolume`) 제공
 *
 * 🔗 연결된 파일:
 *    - src/App.js - 앱의 최상위 컴포넌트에서 음성 시스템 전체를 제어하기 위해 사용
 *    - ./useBackgroundMonitoring.js - 백그라운드 일정 감지 훅
 *    - ./useVoiceCommands.js - 음성 명령어 처리 훅
 *    - ./useSharedAudioStream.js - 마이크 스트림 공유 훅
 *    - ./useAudioManager.js - 마이크 볼륨 분석 훅
 *
 * ✏️ 수정 가이드:
 *    - 음성 인식 언어 변경: `initializeRecognition` 함수 내 `recognition.lang` 값을 수정
 *    - 음성 결과 처리 로직 변경: `recognition.onresult` 이벤트 핸들러 내부의 로직을 수정하여 결과 라우팅 방식을 변경
 *    - 음성 시스템 활성화 조건 변경: `useEffect` 내의 `shouldBeRunning` 상수 로직을 수정
 *
 * 📝 참고사항:
 *    - 이 훅은 음성 기능의 핵심 컨트롤 타워 역할을 합니다.
 *    - `isVoiceRecognitionEnabled` 상태에 따라 음성 결과를 `useVoiceCommands`로 보낼지 결정합니다.
 *    - 명령어로 처리되지 않은 음성 결과는 `isBackgroundMonitoring`이 활성화된 경우 `useBackgroundMonitoring`으로 전달됩니다.
 *
 * ===================================================================================================
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useBackgroundMonitoring } from './useBackgroundMonitoring';
import { useVoiceCommands } from './useVoiceCommands';
import { useSharedAudioStream } from './useSharedAudioStream';
import { useAudioManager } from './useAudioManager';

/**
 * useIntegratedVoiceSystem - 음성 인식, 명령어 처리, 백그라운드 모니터링을 통합 관리하는 훅
 *
 * @description 이 훅은 앱의 모든 음성 관련 기능을 총괄하며, `SpeechRecognition` API를 관리하고
 *              음성 결과를 적절한 하위 훅(명령어 처리 또는 백그라운드 모니터링)으로 전달합니다.
 * @param {boolean} isLoggedIn - 사용자 로그인 여부
 * @param {boolean} isVoiceRecognitionEnabled - 음성 명령어 모드 활성화 여부
 * @param {object} eventActions - 이벤트 관련 함수들 (일정 추가 등)
 * @param {boolean} areEventActionsReady - 이벤트 액션 함수들이 준비되었는지 여부
 * @param {Function} setEventAddedKey - 일정 추가 시 UI 갱신을 위한 키 설정 함수
 * @param {Function} handleChatMessage - 챗봇 메시지 처리 함수
 * @returns {object} 통합 음성 시스템의 상태 및 제어 함수들을 포함하는 객체
 * @property {boolean} isListening - `SpeechRecognition`이 활성화되어 음성을 듣고 있는지 여부
 * @property {string} modalText - 음성 명령어 모달에 표시될 텍스트
 * @property {Function} setModalText - 음성 명령어 모달 텍스트를 설정하는 함수
 * @property {boolean} isBackgroundMonitoring - 백그라운드 모니터링 활성화 여부
 * @property {string} voiceStatus - 현재 통합 음성 시스템의 상태 ('waiting', 'recording', 'ending', 'analyzing', 'command')
 * @property {boolean} isAnalyzing - 백그라운드 또는 명령어 분석이 진행 중인지 여부
 * @property {number} micVolume - 현재 마이크 볼륨 (0.0 ~ 1.0)
 * @property {object|null} notification - 사용자에게 표시할 알림 객체
 * @property {Function} clearNotification - 알림을 지우는 함수
 */
export const useIntegratedVoiceSystem = (
  isLoggedIn,
  isVoiceRecognitionEnabled,
  eventActions,
  areEventActionsReady,
  setEventAddedKey,
  handleChatMessage,
) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const [isCommandProcessing, setIsCommandProcessing] = useState(false);

  const { getStream, stopStream } = useSharedAudioStream();
  const { micVolume } = useAudioManager();

  // 백그라운드 모니터링 훅 사용
  const {
    isBackgroundMonitoring,
    processTranscript,
    voiceStatus: backgroundVoiceStatus, // 이름 충돌 방지를 위해 변경
    isAnalyzing: isBackgroundAnalyzing, // 이름 충돌 방지를 위해 변경
    notification,
    clearNotification,
    ...backgroundMonitoringProps
  } = useBackgroundMonitoring(eventActions, setEventAddedKey);

  // 음성 명령어 처리 시작/종료 핸들러
  const handleCommandStart = useCallback(() => setIsCommandProcessing(true), []);
  const handleCommandEnd = useCallback(() => setIsCommandProcessing(false), []);

  // 음성 명령어 훅 사용
  const {
    modalText,
    setModalText,
    handleVoiceResult,
  } = useVoiceCommands(isLoggedIn, isVoiceRecognitionEnabled, handleChatMessage, {
    onCommandStart: handleCommandStart,
    onCommandEnd: handleCommandEnd,
  });

  const isMountedRef = useRef(true);

  // 주요 상태 및 함수를 ref로 관리하여 onresult 콜백에서 최신 값을 참조하도록 함
  const isBackgroundMonitoringRef = useRef(isBackgroundMonitoring);
  const isVoiceRecognitionEnabledRef = useRef(isVoiceRecognitionEnabled);
  const processTranscriptRef = useRef(processTranscript);
  const handleVoiceResultRef = useRef(handleVoiceResult);

  useEffect(() => { isBackgroundMonitoringRef.current = isBackgroundMonitoring; }, [isBackgroundMonitoring]);
  useEffect(() => { isVoiceRecognitionEnabledRef.current = isVoiceRecognitionEnabled; }, [isVoiceRecognitionEnabled]);
  useEffect(() => { processTranscriptRef.current = processTranscript; }, [processTranscript]);
  useEffect(() => { handleVoiceResultRef.current = handleVoiceResult; }, [handleVoiceResult]);

  // Web Speech API 초기화 및 설정
  const initializeRecognition = useCallback(async () => {
    await getStream();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ko-KR';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    // 음성 인식 결과 처리
    recognition.onresult = event => {
      let currentTranscript = '';
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        currentTranscript += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      
      let wasHandledByVoiceCommand = false;
      // 음성 명령어 모드가 활성화된 경우, 우선적으로 명령어 처리
      if (isVoiceRecognitionEnabledRef.current) {
        wasHandledByVoiceCommand = handleVoiceResultRef.current(currentTranscript, isFinal, recognition);
      }

      // 명령어로 처리되지 않았고, 백그라운드 모니터링이 활성화된 경우, 백그라운드 처리
      if (isBackgroundMonitoringRef.current && !wasHandledByVoiceCommand) {
        if (currentTranscript.trim()) {
          processTranscriptRef.current(currentTranscript, isFinal);
        }
      }
    };

    const restart = () => {
      if (recognitionRef.current && isMountedRef.current) {
        try {
          recognition.start();
        } catch (e) {
          // 이미 시작 중일 수 있으므로 에러는 무시
        }
      }
    }

    recognition.onerror = event => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        // 'no-speech'나 'aborted' 외의 에러는 조용히 처리
      }
    };

    // 인식 세션이 끝나면 자동으로 재시작
    recognition.onend = () => {
      if (isMountedRef.current && recognitionRef.current) {
        restart();
      }
    };

    try {
      recognition.start();
    } catch (error) {
      // 시작 에러는 조용히 처리
    }
  }, [getStream]);

  // 컴포넌트 마운트/언마운트 및 조건에 따라 음성 인식 시스템 생명주기 관리
  useEffect(() => {
    isMountedRef.current = true;
    const shouldBeRunning = isLoggedIn && areEventActionsReady && (isVoiceRecognitionEnabled || isBackgroundMonitoring);

    if (shouldBeRunning) {
      if (!recognitionRef.current) initializeRecognition();
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    }
    return () => { isMountedRef.current = false; };
  }, [isLoggedIn, areEventActionsReady, isVoiceRecognitionEnabled, isBackgroundMonitoring, initializeRecognition]);

  // 컴포넌트 언마운트 시 모든 리소스 정리
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      stopStream();
    };
  }, [stopStream]);

  // UI에 표시될 최종 음성 상태 결정 (백그라운드 상태가 우선순위를 가짐)
  const voiceStatus = backgroundVoiceStatus !== 'waiting' ? backgroundVoiceStatus : (isCommandProcessing ? 'command' : 'waiting');
  const isAnalyzing = isBackgroundAnalyzing || isCommandProcessing;

  return { 
    isListening, 
    modalText,
    setModalText,
    isBackgroundMonitoring,
    voiceStatus,
    isAnalyzing,
    micVolume,
    notification,
    clearNotification,
    ...backgroundMonitoringProps
  };
};
