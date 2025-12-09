/**
 * ===================================================================================================
 * useBackgroundMonitoring.js - 백그라운드 음성 모니터링 및 일정 자동 감지 React Hook
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks
 *
 * 🎯 주요 기능:
 *    - 사용자의 음성 입력을 백그라운드에서 모니터링
 *    - 음성 감지 시 실시간으로 텍스트로 변환(transcript) 및 버퍼링
 *    - 일정 관련 키워드 및 패턴을 분석하여 잠재적인 일정 자동 감지
 *    - 감지된 일정을 Google Calendar에 추가하는 기능 (`confirmSchedule`)
 *    - 음성 녹음 상태(`voiceStatus`) 및 분석 상태(`isAnalyzing`) 관리
 *
 * 🔗 연결된 파일:
 *    - src/App.js - 앱 최상위 레벨에서 이 훅을 사용하여 백그라운드 모니터링 활성화/비활성화
 *    - src/config/firebaseConfig.js - Firebase 인증 인스턴스 `auth` 사용
 *    - src/components/indicators/BackgroundCallIndicator.js - `isCallDetected` 상태를 사용하여 UI 표시
 *    - src/components/modals/AutoDetectedScheduleModal.js - `detectedSchedules`를 사용하여 감지된 일정 표시
 *    - 백엔드 API (`/api/call-analysis/analyze`, `/api/calendar/events/google`)와 통신
 *
 * ✏️ 수정 가이드:
 *    - 음성 분석 로직 변경: `analyzeFullTranscript` 함수 내부의 백엔드 API 호출 방식 또는 데이터 처리 수정
 *    - 일정 감지 로직 개선: `processTranscript` 함수 내부의 버퍼링 및 분석 트리거 조건 수정
 *    - 일정 확인/거부 액션 변경: `confirmSchedule` 및 `dismissSchedule` 함수 수정
 *    - 침묵 감지 시간 변경: `processTranscript` 내 `setTimeout` 시간 조절
 *
 * 📝 참고사항:
 *    - Firebase 인증 (`auth.currentUser`)이 필요합니다.
 *    - 백엔드 API (`/api/call-analysis/analyze`)를 통해 실제 분석이 이루어집니다.
 *    - `eventActions` prop을 통해 외부에서 제공되는 이벤트 처리 함수를 사용합니다.
 *    - `notification` 상태를 통해 사용자에게 작업 결과를 알릴 수 있습니다.
 *
 * ===================================================================================================
 */
import { useState, useCallback, useRef } from 'react';
import { auth } from '../config/firebaseConfig';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

/**
 * useBackgroundMonitoring - 백그라운드에서 음성을 모니터링하고 일정을 자동 감지하는 커스텀 훅
 *
 * @param {object} eventActions - 외부에서 제공되는 이벤트 관련 액션 함수들
 * @param {Function} eventActions.addEvent - 일정을 추가하는 함수
 * @param {Function} setEventAddedKey - 일정 추가 시 UI 업데이트를 위한 키 설정 함수
 *
 * @returns {object} 백그라운드 모니터링 관련 상태 및 함수를 포함하는 객체
 * @property {boolean} isBackgroundMonitoring - 백그라운드 모니터링 활성화 여부
 * @property {boolean} isCallDetected - 음성 통화(또는 음성 입력) 감지 여부
 * @property {number|null} callStartTime - 음성 통화 감지 시작 시간 (타임스탬프)
 * @property {Array<object>} detectedSchedules - 감지된 일정 목록
 * @property {string} backgroundTranscript - 현재까지 버퍼링된 또는 실시간으로 표시되는 음성 텍스트
 * @property {string} voiceStatus - 음성 처리 상태 ('waiting', 'recording', 'ending', 'analyzing')
 * @property {boolean} isAnalyzing - 백엔드에서 음성을 분석 중인지 여부
 * @property {object|null} notification - 사용자에게 표시할 알림 메시지 객체
 * @property {Function} toggleBackgroundMonitoring - 백그라운드 모니터링 활성화/비활성화 함수
 * @property {Function} confirmSchedule - 감지된 일정을 확인하고 Google Calendar에 추가하는 함수
 * @property {Function} dismissSchedule - 감지된 일정을 목록에서 제거하는 함수
 * @property {Function} processTranscript - 실시간 음성 텍스트를 처리하는 함수
 *   @param {string} transcript - 음성 인식 결과 텍스트
 *   @param {boolean} [isFinal=true] - 최종 음성 인식 결과인지 여부
 * @property {Function} clearNotification - 현재 알림을 지우는 함수
 */
export const useBackgroundMonitoring = (eventActions, setEventAddedKey) => {
  const [isBackgroundMonitoring, setIsBackgroundMonitoring] = useState(false);
  const [isCallDetected, setIsCallDetected] = useState(false);
  const [callStartTime, setCallStartTime] = useState(null);
  const [detectedSchedules, setDetectedSchedules] = useState([]);
  const [backgroundTranscript, setBackgroundTranscript] = useState('');
  
  // 새로운 상태 추가: 음성 인식 상태 세분화
  const [voiceStatus, setVoiceStatus] = useState('waiting'); // 'waiting', 'recording', 'ending', 'analyzing'
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // 알림 상태 추가
  const [notification, setNotification] = useState(null);

  
  const transcriptBufferRef = useRef('');
  const silenceTimeoutRef = useRef(null);
  const lastSpeechTimeRef = useRef(null);

  const analyzeFullTranscript = useCallback(async () => {
    const transcriptToAnalyze = transcriptBufferRef.current;
    transcriptBufferRef.current = ''; // Clear buffer immediately
    
    if (!transcriptToAnalyze || transcriptToAnalyze.length < 10) { // 더 짧은 임계값
      setBackgroundTranscript('');
      setVoiceStatus('waiting');
      return;
    }

    // 분석 시작 상태로 변경
    setVoiceStatus('analyzing');
    setIsAnalyzing(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setVoiceStatus('waiting');
        setIsAnalyzing(false);
        return;
      }

      const analysisStartTime = performance.now();
      const response = await Promise.race([
        fetch(`${API_BASE_URL}/api/call-analysis/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await currentUser.getIdToken()}` },
          body: JSON.stringify({ transcript: transcriptToAnalyze }),
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('분석 시간 초과')), 3000)
        )
      ]);
      const analysisEndTime = performance.now();

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.schedules.length > 0) {
          const newSchedules = data.data.schedules.filter(schedule => 
            !detectedSchedules.some(existing => existing.originalText === schedule.originalText)
          );
          if (newSchedules.length > 0) {
            setDetectedSchedules(prev => [...prev, ...newSchedules]);
            // Pass the full transcript to the modal
            setBackgroundTranscript(transcriptToAnalyze);
          }
        }
      }
    } catch (error) {
      // Error analyzing full transcript - silently handle error
    } finally {
      // 분석 완료 후 대기 상태로 복귀
      setIsAnalyzing(false);
      setVoiceStatus('waiting');
    }
  }, [detectedSchedules]);

  const toggleBackgroundMonitoring = useCallback(() => {
    if (isBackgroundMonitoring) {
      setIsBackgroundMonitoring(false);
      setIsCallDetected(false);
      setCallStartTime(null);
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      transcriptBufferRef.current = '';
      setBackgroundTranscript('');
    } else {
      setIsBackgroundMonitoring(true);
    }
  }, [isBackgroundMonitoring]);

  const processTranscript = useCallback((transcript, isFinal = true) => {
    if (!isBackgroundMonitoring || !transcript.trim()) {
      return;
    }

    // 첫 번째 음성 감지 시 즉시 "녹음중"으로 변경 (중간 결과에서도 즉시 반응)
    if (!isCallDetected) {
      setIsCallDetected(true);
      setCallStartTime(Date.now());
      setVoiceStatus('recording');
    } else if (voiceStatus !== 'recording' && voiceStatus !== 'analyzing') {
      // 이미 호출이 감지된 상태에서 추가 음성이 감지되면 다시 녹음중으로 변경
      setVoiceStatus('recording');
    }

    // 마지막 음성 감지 시간 업데이트 (중간 결과와 최종 결과 모두에서)
    lastSpeechTimeRef.current = Date.now();
    
    // Final 결과만 버퍼에 추가하되 중간 결과도 실시간 표시
    if (isFinal) {
      transcriptBufferRef.current += transcript + ' ';
      setBackgroundTranscript(transcriptBufferRef.current);
    } else {
      // 중간 결과도 실시간으로 표시 (버퍼에는 추가하지 않음)
      setBackgroundTranscript(transcriptBufferRef.current + transcript);
    }

    // 기존 타이머 클리어
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }

    // 2.5초 침묵 감지 타이머 설정 (더 빠른 반응)
    silenceTimeoutRef.current = setTimeout(() => {
      setVoiceStatus('ending');
      
      // 더 빨리 분석 시작
      setTimeout(() => {
        setIsCallDetected(false);
        setCallStartTime(null);
        analyzeFullTranscript(); 
      }, 300); // 0.3초 후 즉시 분석
      
    }, 2500); // 2.5초로 단축
    
  }, [isBackgroundMonitoring, isCallDetected, analyzeFullTranscript, voiceStatus]);

  const confirmSchedule = useCallback(async (schedule) => {
    try {
      // Check if eventActions are available
      if (!eventActions || !eventActions.addEvent) {
        setNotification({
          type: 'error',
          title: '이벤트 액션 없음',
          message: '일정 추가 기능이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.'
        });
        return;
      }

      // Combine date and time into ISO 8601 format for Google Calendar
      const startDateTime = new Date(`${schedule.date}T${schedule.time || '09:00'}:00`).toISOString();
      // Assume a 1-hour duration if no end time is detected
      const endDateTime = new Date(new Date(startDateTime).getTime() + 60 * 60 * 1000).toISOString();

      const eventData = {
        title: schedule.title || '감지된 약속',
        description: `AI가 자동 감지한 일정\n\n원본 내용: ${schedule.originalText}\n\n참석자: ${schedule.participants?.join(', ') || '없음'}`,
        startDateTime: startDateTime,
        endDateTime: endDateTime
      };

      const currentUser = auth.currentUser;
      if (!currentUser) {
        setNotification({
          type: 'error',
          title: '인증 오류',
          message: 'Google 계정 인증이 필요합니다.'
        });
        return;
      }

      // Use eventActions.addEvent instead of direct API call
      await fetch(`${API_BASE_URL}/api/calendar/events/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await currentUser.getIdToken()}`,
        },
        body: JSON.stringify(eventData),
      });

      setDetectedSchedules(prev => prev.filter(s => s !== schedule));
      
      setTimeout(() => {
        setEventAddedKey(prev => prev + 1);
      }, 1000); // 1초 지연
      setNotification({
        type: 'success',
        title: '일정 등록 완료',
        message: 'Google 캘린더에 일정이 성공적으로 등록되었습니다!'
      });

    } catch (error) {
      setNotification({
        type: 'error',
        title: '일정 등록 실패',
        message: error.message
      });
    }
  }, [eventActions, setEventAddedKey]);

  const dismissSchedule = useCallback((schedule) => {
    setDetectedSchedules(prev => prev.filter(s => s !== schedule));
  }, []);

  const clearNotification = useCallback(() => {
    setNotification(null);
  }, []);

  return {
    isBackgroundMonitoring,
    isCallDetected,
    callStartTime,
    detectedSchedules,
    backgroundTranscript,
    toggleBackgroundMonitoring,
    confirmSchedule,
    dismissSchedule,
    processTranscript,
    // 새로운 음성 상태들
    voiceStatus, // 'waiting', 'recording', 'ending', 'analyzing'
    isAnalyzing,
    // 알림 상태
    notification,
    clearNotification
  };
};
