import { useState, useCallback, useRef, useEffect } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

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
      const token = localStorage.getItem('token');
      if (!token) {
        setVoiceStatus('waiting');
        setIsAnalyzing(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/call-analysis/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({ transcript: transcriptToAnalyze }),
      });

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
      console.error("Error analyzing full transcript:", error);
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

      const token = localStorage.getItem('token');
      if (!token) {
        setNotification({
          type: 'error',
          title: '로그인 필요',
          message: '일정을 등록하려면 로그인이 필요합니다.'
        });
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/calendar/events/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.msg || 'Google Calendar에 일정 추가를 실패했습니다.');
      }

      setDetectedSchedules(prev => prev.filter(s => s !== schedule));
      setEventAddedKey(prev => prev + 1);
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
  }, [setEventAddedKey]);

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
