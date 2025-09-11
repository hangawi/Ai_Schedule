import { useState, useEffect, useCallback, useRef } from 'react';
import { useBackgroundMonitoring } from './useBackgroundMonitoring';
import { useVoiceCommands } from './useVoiceCommands';
import { useSharedAudioStream } from './useSharedAudioStream';
import { useAudioManager } from './useAudioManager';

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

  const {
    isBackgroundMonitoring,
    processTranscript,
    voiceStatus: backgroundVoiceStatus, // Rename to avoid conflict
    isAnalyzing: isBackgroundAnalyzing, // Rename to avoid conflict
    notification,
    clearNotification,
    ...backgroundMonitoringProps
  } = useBackgroundMonitoring(eventActions, setEventAddedKey);

  const handleCommandStart = useCallback(() => setIsCommandProcessing(true), []);
  const handleCommandEnd = useCallback(() => setIsCommandProcessing(false), []);

  const {
    modalText,
    setModalText,
    handleVoiceResult,
  } = useVoiceCommands(isLoggedIn, isVoiceRecognitionEnabled, handleChatMessage, {
    onCommandStart: handleCommandStart,
    onCommandEnd: handleCommandEnd,
  });

  const isMountedRef = useRef(true);

  const isBackgroundMonitoringRef = useRef(isBackgroundMonitoring);
  const isVoiceRecognitionEnabledRef = useRef(isVoiceRecognitionEnabled);
  const processTranscriptRef = useRef(processTranscript);
  const handleVoiceResultRef = useRef(handleVoiceResult);

  useEffect(() => { isBackgroundMonitoringRef.current = isBackgroundMonitoring; }, [isBackgroundMonitoring]);
  useEffect(() => { isVoiceRecognitionEnabledRef.current = isVoiceRecognitionEnabled; }, [isVoiceRecognitionEnabled]);
  useEffect(() => { processTranscriptRef.current = processTranscript; }, [processTranscript]);
  useEffect(() => { handleVoiceResultRef.current = handleVoiceResult; }, [handleVoiceResult]);

  const initializeRecognition = useCallback(async () => {
    await getStream();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Speech Recognition not supported.");
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ko-KR';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = event => {
      let currentTranscript = '';
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        currentTranscript += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      
      let wasHandledByVoiceCommand = false;
      if (isVoiceRecognitionEnabledRef.current) {
        wasHandledByVoiceCommand = handleVoiceResultRef.current(currentTranscript, isFinal, recognition);
      }

      if (isBackgroundMonitoringRef.current && !wasHandledByVoiceCommand) {
        // 실시간 상태 업데이트를 위해 중간 결과에서도 호출
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
          // It might already be starting, which is fine.
        }
      }
    }

    recognition.onerror = event => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.error("Speech recognition error:", event.error);
      }
    };

    recognition.onend = () => {
      if (isMountedRef.current && recognitionRef.current) {
        restart();
      }
    };

    try {
      recognition.start();
    } catch (error) {
      console.error("Error starting recognition: ", error);
    }
  }, [getStream, handleVoiceResult]);

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

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      stopStream();
    };
  }, [stopStream]);

  // Determine the final status to display - 백그라운드 상태 우선
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