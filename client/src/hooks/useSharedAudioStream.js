/**
 * ===================================================================================================
 * useSharedAudioStream.js - 마이크 오디오 스트림을 관리하고 공유하는 React Hook
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks
 *
 * 🎯 주요 기능:
 *    - `navigator.mediaDevices.getUserMedia`를 사용하여 마이크 오디오 스트림 획득
 *    - 획득한 스트림을 ref에 저장하여 애플리케이션의 여러 컴포넌트에서 공유
 *    - 스트림 중복 요청 방지 (이미 스트림이 있으면 기존 스트림 반환)
 *    - 오디오 트랙을 중지하고 리소스를 정리하는 기능 제공
 *
 * 🔗 연결된 파일:
 *    - ./useIntegratedVoiceSystem.js - 통합 음성 시스템에서 마이크 스트림을 얻기 위해 사용
 *    - ./useAudioManager.js - 오디오 시각화 및 분석을 위해 스트림을 얻는 데 사용될 수 있음
 *
 * ✏️ 수정 가이드:
 *    - 오디오 제약 조건 변경: `getStream` 함수 내의 `getUserMedia` 호출 시 전달되는 `audio` 옵션(예: `echoCancellation`)을 수정
 *
 * 📝 참고사항:
 *    - 이 훅은 마이크 접근 권한을 요청하며, 사용자의 승인이 필요합니다.
 *    - 싱글톤 패턴과 유사하게, 한 번 생성된 스트림은 `stopStream`이 호출될 때까지 재사용됩니다.
 *    - 컴포넌트 언마운트 시 자동으로 스트림을 정리하는 로직이 포함되어 있습니다.
 *
 * ===================================================================================================
 */
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useSharedAudioStream - 마이크 오디오 스트림을 한 번만 요청하고 앱 전체에서 공유하는 커스텀 훅
 *
 * @description 이 훅은 `getUserMedia`를 통해 마이크 스트림을 획득하고,
 *              여러 컴포넌트가 동일한 스트림을 재사용할 수 있도록 관리합니다.
 *              이를 통해 불필요한 마이크 접근 요청을 방지하고 리소스를 효율적으로 사용합니다.
 * @returns {object} 오디오 스트림과 제어 함수를 포함하는 객체
 * @property {MediaStream|null} stream - 현재 활성화된 마이크 오디오 스트림 객체
 * @property {Error|null} error - 스트림 획득 과정에서 발생한 에러 객체
 * @property {Function} getStream - 오디오 스트림을 획득하거나 기존 스트림을 반환하는 함수
 * @property {Function} stopStream - 현재 오디오 스트림의 모든 트랙을 중지하고 리소스를 해제하는 함수
 */
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
      // 스트림 획득 에러는 조용히 처리
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

  // 컴포넌트가 언마운트될 때 스트림 리소스를 정리합니다.
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return { stream, error, getStream, stopStream };
};
