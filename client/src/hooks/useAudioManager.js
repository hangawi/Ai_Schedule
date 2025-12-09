/**
 * ===================================================================================================
 * useAudioManager.js - 마이크 오디오 관리 및 실시간 볼륨 분석 React Hook
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks
 *
 * 🎯 주요 기능:
 *    - 사용자의 마이크 오디오 스트림을 분석하여 실시간 볼륨 레벨 측정
 *    - `AudioContext`, `AnalyserNode` 웹 API를 활용하여 오디오 데이터 처리
 *    - 마이크 볼륨 상태(`micVolume`) 제공
 *    - 오디오 분석 설정(`setupAudioAnalysis`) 및 리소스 정리(`cleanupAudioResources`) 기능
 *
 * 🔗 연결된 파일:
 *    - src/hooks/useIntegratedVoiceSystem.js - 통합 음성 시스템 훅에서 오디오 관리 기능 사용
 *    - src/hooks/useSharedAudioStream.js - 공유 오디오 스트림 훅에서 오디오 분석 기능 사용
 *
 * ✏️ 수정 가이드:
 *    - 오디오 분석 방식 변경: `setupAudioAnalysis` 내의 `analyser` 설정 또는 `dataArray` 처리 로직 수정
 *    - 새로운 오디오 이벤트 처리: `setupAudioAnalysis` 내에 추가적인 이벤트 리스너 또는 `AudioNode` 연결 추가
 *
 * 📝 참고사항:
 *    - Web Audio API를 사용하므로 브라우저 지원 여부 확인 필요
 *    - `cleanupAudioResources` 호출을 통해 메모리 누수를 방지하는 것이 중요합니다.
 *    - `onVolumeUpdate` 콜백을 통해 외부에서 실시간 볼륨 업데이트를 받을 수 있습니다.
 *
 * ===================================================================================================
 */
import { useState, useCallback, useRef } from 'react';

/**
 * useAudioManager - 마이크 오디오 입력의 실시간 볼륨을 분석하고 관리하는 커스텀 훅
 *
 * @returns {object} 마이크 볼륨 관련 상태 및 함수를 포함하는 객체
 * @property {number} micVolume - 현재 마이크의 정규화된 볼륨 레벨 (0.0 ~ 1.0)
 * @property {Function} setupAudioAnalysis - 오디오 스트림을 받아 분석을 시작하는 함수
 *   @param {MediaStream} stream - 분석할 미디어 스트림 (마이크 입력)
 *   @param {Function} [onVolumeUpdate] - 실시간 볼륨 업데이트를 받을 콜백 함수
 * @property {Function} cleanupAudioResources - 오디오 리소스를 정리하고 분석을 중지하는 함수
 */
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