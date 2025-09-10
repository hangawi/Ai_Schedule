import { useState, useEffect, useCallback, useRef } from 'react';
import { useBackgroundMonitoring } from './useBackgroundMonitoring';
import { useVoiceCommands } from './useVoiceCommands';
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

  const { getStream, stopStream } = useSharedAudioStream();

  const {
    isBackgroundMonitoring,
    processTranscript,
    ...backgroundMonitoringProps
  } = useBackgroundMonitoring(eventActions, setEventAddedKey);

  const {
    modalText,
    setModalText,
    handleVoiceResult,
  } = useVoiceCommands(isLoggedIn, isVoiceRecognitionEnabled, handleChatMessage, setEventAddedKey);

  const isMountedRef = useRef(true);

  // Refs to hold the latest values to avoid stale closures in event handlers
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
      
      if (isBackgroundMonitoringRef.current && isFinal) {
        processTranscriptRef.current(currentTranscript);
      }
      if (isVoiceRecognitionEnabledRef.current) {
        handleVoiceResultRef.current(currentTranscript, isFinal, recognition);
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
  }, [getStream]);

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

  return { 
    isListening, 
    modalText,
    setModalText,
    isBackgroundMonitoring,
    ...backgroundMonitoringProps
  };
};