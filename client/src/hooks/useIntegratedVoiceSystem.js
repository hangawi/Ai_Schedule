import { useState, useEffect, useCallback, useRef } from 'react';
import { useBackgroundMonitoring } from './useBackgroundMonitoring';
import { useVoiceCommands } from './useVoiceCommands';
import { useAudioManager } from './useAudioManager';

export const useIntegratedVoiceSystem = (
  isLoggedIn,
  isVoiceRecognitionEnabled,
  eventActions,
  areEventActionsReady,
  setEventAddedKey,
) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // 분리된 훅들 사용
  const backgroundMonitoring = useBackgroundMonitoring(eventActions, setEventAddedKey);
  const voiceCommands = useVoiceCommands(isLoggedIn, isVoiceRecognitionEnabled, eventActions, setEventAddedKey);
  const audioManager = useAudioManager();

  // 음성 인식 초기화
  const initializeRecognition = useCallback(() => {
    if (recognitionRef.current) return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'ko-KR';
    recognitionRef.current.maxAlternatives = 3;

    const recognition = recognitionRef.current;

    recognition.onstart = () => {
      setIsListening(true);
      if (voiceCommands.listeningModeRef.current !== 'command') {
        voiceCommands.listeningModeRef.current = 'hotword';
      }
    };

    recognition.onresult = event => {
      let currentTranscript = '';
      let isFinal = false;
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        let bestAlternative = event.results[i][0];
        for (let j = 1; j < event.results[i].length; j++) {
          if (event.results[i][j].confidence > bestAlternative.confidence) {
            bestAlternative = event.results[i][j];
          }
        }
        currentTranscript += bestAlternative.transcript;
        if (event.results[i].isFinal) isFinal = true;
      }

      // 백그라운드 모니터링 처리
      if (backgroundMonitoring.isBackgroundMonitoring && isFinal && currentTranscript.trim()) {
        backgroundMonitoring.processTranscript(currentTranscript);
      }

      // 음성 명령 처리
      if (isVoiceRecognitionEnabled) {
        voiceCommands.handleVoiceResult(currentTranscript, isFinal, recognition);
      }
    };

    recognition.onerror = event => {
      setIsListening(false);
      if (event.error === 'aborted') return;
      
      if (event.error === 'no-speech') {
        if (voiceCommands.listeningModeRef.current === 'command') {
          voiceCommands.setModalText('음성이 들리지 않습니다');
          setTimeout(() => {
            voiceCommands.setModalText('');
            voiceCommands.listeningModeRef.current = 'hotword';
          }, 2000);
        } else {
          voiceCommands.listeningModeRef.current = 'hotword';
        }
      } else {
        voiceCommands.setModalText(`음성인식 오류: ${event.error}`);
        setTimeout(() => {
          voiceCommands.setModalText('');
          voiceCommands.listeningModeRef.current = 'hotword';
        }, 2000);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
      audioManager.setupAudioAnalysis(backgroundMonitoring.detectCallActivity);
    } catch (error) {
      if (recognitionRef.current) {
        recognitionRef.current = null;
      }
      audioManager.cleanupAudioResources();
    }
  }, [
    backgroundMonitoring,
    voiceCommands,
    audioManager,
    isVoiceRecognitionEnabled
  ]);

  // 음성 인식 시스템 시작
  useEffect(() => {
    if (!isLoggedIn || !areEventActionsReady || (!isVoiceRecognitionEnabled && !backgroundMonitoring.isBackgroundMonitoring)) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
          recognitionRef.current = null;
        } catch (e) {}
      }
      audioManager.cleanupAudioResources();
      setIsListening(false);
      return;
    }

    if (recognitionRef.current) return;

    initializeRecognition();
  }, [
    isLoggedIn,
    areEventActionsReady,
    isVoiceRecognitionEnabled,
    backgroundMonitoring.isBackgroundMonitoring,
    initializeRecognition
  ]);

  // 정리
  useEffect(() => {
    return () => {
      try {
        if (recognitionRef.current) {
          recognitionRef.current.abort();
          recognitionRef.current = null;
        }
      } catch (e) {}
      audioManager.cleanupAudioResources();
    };
  }, [audioManager]);

  return { 
    // 기존 음성 명령 관련
    isListening, 
    modalText: voiceCommands.modalText, 
    setModalText: voiceCommands.setModalText, 
    micVolume: audioManager.micVolume,
    // 백그라운드 감지 관련
    isBackgroundMonitoring: backgroundMonitoring.isBackgroundMonitoring,
    isCallDetected: backgroundMonitoring.isCallDetected,
    callStartTime: backgroundMonitoring.callStartTime,
    detectedSchedules: backgroundMonitoring.detectedSchedules,
    backgroundTranscript: backgroundMonitoring.backgroundTranscript,
    toggleBackgroundMonitoring: backgroundMonitoring.toggleBackgroundMonitoring,
    confirmSchedule: backgroundMonitoring.confirmSchedule,
    dismissSchedule: backgroundMonitoring.dismissSchedule
  };
};