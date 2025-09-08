import { useState, useCallback, useRef } from 'react';

export const useAudioManager = () => {
  const [micVolume, setMicVolume] = useState(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameId = useRef(null);

  const cleanupAudioResources = useCallback(() => {
    if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    if (sourceRef.current) sourceRef.current.disconnect();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const setupAudioAnalysis = useCallback(async (onVolumeUpdate) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        } 
      });
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.fftSize = 256;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
          animationFrameId.current = requestAnimationFrame(draw);
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
          const normalizedVolume = average / 128;
          setMicVolume(normalizedVolume);

          if (onVolumeUpdate) {
            onVolumeUpdate(normalizedVolume);
          }
        };
        draw();
      }
    } catch (err) {
      // 마이크 접근 실패 시 조용히 처리
    }
  }, []);

  return {
    micVolume,
    setupAudioAnalysis,
    cleanupAudioResources
  };
};