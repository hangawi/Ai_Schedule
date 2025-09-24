import { useState, useCallback, useRef } from 'react';

export const useAudioManager = () => {
  const [micVolume, setMicVolume] = useState(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameId = useRef(null);

  const cleanupAudioResources = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      // The underlying stream is managed externally, so we only close the context.
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const setupAudioAnalysis = useCallback((stream, onVolumeUpdate) => {
    if (!stream || audioContextRef.current) return;

    try {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = context;
      
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = context.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
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
    } catch (err) {
      // Error setting up audio analysis - silently handle error
    }
  }, []);

  return {
    micVolume,
    setupAudioAnalysis,
    cleanupAudioResources
  };
};