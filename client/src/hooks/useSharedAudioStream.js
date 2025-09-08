import { useState, useEffect, useCallback, useRef } from 'react';

export const useSharedAudioStream = () => {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const streamRef = useRef(null);

  const getStream = useCallback(async () => {
    if (streamRef.current) {
      return streamRef.current;
    }
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      streamRef.current = audioStream;
      setStream(audioStream);
      return audioStream;
    } catch (e) {
      setError(e);
      console.error('Error getting audio stream:', e);
      return null;
    }
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return { stream, error, getStream, stopStream };
};