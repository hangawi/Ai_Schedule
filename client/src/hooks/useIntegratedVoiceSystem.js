import { useState, useEffect, useCallback, useRef } from 'react';
import { useBackgroundMonitoring } from './useBackgroundMonitoring';
import { useVoiceCommands } from './useVoiceCommands';
import { useAudioManager } from './useAudioManager';
import { useSharedAudioStream } from './useSharedAudioStream';

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

  const { stream, getStream, stopStream } = useSharedAudioStream();

  const {
    isBackgroundMonitoring,
    processTranscript,
    detectCallActivity,
    ...backgroundMonitoringProps
  } = useBackgroundMonitoring(eventActions, setEventAddedKey);

  const {
    modalText,
    setModalText,
    handleVoiceResult,
    ...voiceCommandsProps
  } = useVoiceCommands(isLoggedIn, isVoiceRecognitionEnabled, handleChatMessage, setEventAddedKey);

  const {
    micVolume,
    setupAudioAnalysis,
    cleanupAudioResources
  } = useAudioManager();

  const initializeRecognition = useCallback(async () => {
    const audioStream = await getStream();
    if (!audioStream) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ko-KR';
    recognition.maxAlternatives = 3;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = event => {
      let currentTranscript = '';
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        currentTranscript += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      if (isBackgroundMonitoring && isFinal) processTranscript(currentTranscript);
      if (isVoiceRecognitionEnabled) handleVoiceResult(currentTranscript, isFinal, recognition);
    };

    const restart = () => {
        if (recognitionRef.current) {
            try { recognition.start(); } catch(e) {}
        }
    }

    recognition.onerror = event => {
      setIsListening(false);
      if (event.error !== 'aborted') {
        setTimeout(restart, 250);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setTimeout(restart, 250);
    };

    try {
      recognition.start();
      setupAudioAnalysis(audioStream, detectCallActivity);
    } catch (error) {
      cleanupAudioResources();
    }
  }, [ 
    getStream, isBackgroundMonitoring, processTranscript, 
    isVoiceRecognitionEnabled, handleVoiceResult, setupAudioAnalysis, 
    detectCallActivity, cleanupAudioResources
  ]);

  useEffect(() => {
    const shouldBeRunning = isLoggedIn && areEventActionsReady && (isVoiceRecognitionEnabled || isBackgroundMonitoring);

    if (shouldBeRunning) {
      if (!recognitionRef.current) initializeRecognition();
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      stopStream();
      cleanupAudioResources();
      setIsListening(false);
    }

  }, [ 
    isLoggedIn, areEventActionsReady, isVoiceRecognitionEnabled, 
    isBackgroundMonitoring, initializeRecognition, stopStream, cleanupAudioResources
  ]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      stopStream();
      cleanupAudioResources();
    };
  }, [stopStream, cleanupAudioResources]);

  return { 
    isListening, 
    modalText,
    setModalText,
    micVolume,
    isBackgroundMonitoring,
    isCallDetected: backgroundMonitoringProps.isCallDetected,
    callStartTime: backgroundMonitoringProps.callStartTime,
    detectedSchedules: backgroundMonitoringProps.detectedSchedules,
    backgroundTranscript: backgroundMonitoringProps.backgroundTranscript,
    toggleBackgroundMonitoring: backgroundMonitoringProps.toggleBackgroundMonitoring,
    confirmSchedule: backgroundMonitoringProps.confirmSchedule,
    dismissSchedule: backgroundMonitoringProps.dismissSchedule
  };
};