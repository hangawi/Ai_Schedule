import { useState, useCallback, useRef } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export const useBackgroundMonitoring = (eventActions, setEventAddedKey) => {
  const [isBackgroundMonitoring, setIsBackgroundMonitoring] = useState(false);
  const [isCallDetected, setIsCallDetected] = useState(false);
  const [callStartTime, setCallStartTime] = useState(null);
  const [detectedSchedules, setDetectedSchedules] = useState([]);
  const [backgroundTranscript, setBackgroundTranscript] = useState('');
  
  const transcriptBufferRef = useRef('');
  const volumeHistoryRef = useRef([]);
  const silenceTimeoutRef = useRef(null);

  const toggleBackgroundMonitoring = useCallback(async () => {
    if (isBackgroundMonitoring) {
      setIsBackgroundMonitoring(false);
      setIsCallDetected(false);
      setCallStartTime(null);
      
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      
      if (transcriptBufferRef.current.length > 100) {
        await analyzeFullTranscript();
      }
      
      transcriptBufferRef.current = '';
      setBackgroundTranscript('');
    } else {
      setIsBackgroundMonitoring(true);
    }
  }, [isBackgroundMonitoring]);

  const detectCallActivity = useCallback((currentVolume) => {
    const VOLUME_THRESHOLD = 0.08;
    const CONVERSATION_DURATION_THRESHOLD = 5000; // 대화 감지 기준 시간을 늘림
    const MIN_ACTIVITY_COUNT = 10; // 최소 활동량 증가
    const SILENCE_TIMEOUT = 15000; // 침묵 타임아웃을 늘려서 대화 끝을 정확히 감지
    
    volumeHistoryRef.current.push({
      volume: currentVolume,
      timestamp: Date.now()
    });

    const thirtySecondsAgo = Date.now() - 30000;
    volumeHistoryRef.current = volumeHistoryRef.current.filter(
      item => item.timestamp > thirtySecondsAgo
    );

    const recentActivity = volumeHistoryRef.current.filter(
      item => item.volume > VOLUME_THRESHOLD && 
              item.timestamp > Date.now() - CONVERSATION_DURATION_THRESHOLD
    );

    const isCurrentlyActive = currentVolume > VOLUME_THRESHOLD;
    const hasRecentActivity = recentActivity.length > MIN_ACTIVITY_COUNT;
    
    const recentVolumes = volumeHistoryRef.current
      .filter(item => item.timestamp > Date.now() - CONVERSATION_DURATION_THRESHOLD)
      .map(item => item.volume);
    
    const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    const isConsistentActivity = avgVolume > VOLUME_THRESHOLD * 0.7;

    // 대화 시작 감지 (기존 통화 감지 로직과 동일하지만 더 엄격한 기준)
    if (!isCallDetected && hasRecentActivity && isCurrentlyActive && isConsistentActivity) {
      setIsCallDetected(true);
      setCallStartTime(Date.now());
      
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    }

    // 대화 종료 감지 (침묵이 일정 시간 지속되면 대화 종료로 간주)
    if (isCallDetected) {
      if (isCurrentlyActive) {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }
        
        silenceTimeoutRef.current = setTimeout(() => {
          if (isCallDetected) {
            setIsCallDetected(false);
            setCallStartTime(null);
            
            // 대화가 끝나면 전체 대화 내용을 요약하여 일정 확인
            if (transcriptBufferRef.current.length > 100) {
              analyzeFullTranscript();
            }
          }
        }, SILENCE_TIMEOUT);
      }
    }
  }, [isCallDetected]);

  const detectScheduleKeywords = useCallback(async (text) => {
    if (!text || text.length < 10) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/call-analysis/detect-keywords`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
        },
        body: JSON.stringify({ text, threshold: 0.6 }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.isScheduleRelated) {
          if (transcriptBufferRef.current.length > 200) {
            analyzeFullTranscript();
          }
        }
      }
    } catch (error) {
      // 키워드 감지 실패 시 조용히 처리
    }
  }, []);

  const analyzeFullTranscript = useCallback(async () => {
    if (!transcriptBufferRef.current || transcriptBufferRef.current.length < 100) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/call-analysis/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
        },
        body: JSON.stringify({ transcript: transcriptBufferRef.current }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.schedules.length > 0) {
          const newSchedules = data.data.schedules.filter(schedule => 
            !detectedSchedules.some(existing => 
              existing.originalText === schedule.originalText
            )
          );
          
          if (newSchedules.length > 0) {
            setDetectedSchedules(prev => [...prev, ...newSchedules]);
          }
        }
      }
    } catch (error) {
      // 전체 분석 실패 시 조용히 처리
    }
  }, [detectedSchedules]);

  const confirmSchedule = useCallback(async (schedule) => {
    if (!eventActions?.addEvent) {
      alert('일정 추가 기능을 사용할 수 없습니다.');
      return;
    }

    try {
      const eventData = {
        title: schedule.title || '감지된 약속',
        date: schedule.date || new Date().toISOString().split('T')[0],
        time: schedule.time || '09:00',
        description: `AI가 자동 감지한 일정\n\n원본 내용: ${schedule.originalText}\n\n참석자: ${schedule.participants?.join(', ') || '없음'}`,
        color: 'purple',
        category: 'auto-detected'
      };

      await eventActions.addEvent(eventData);
      setDetectedSchedules(prev => prev.filter(s => s !== schedule));
      setEventAddedKey(prev => prev + 1);
      alert('자동 감지된 일정이 성공적으로 등록되었습니다!');
    } catch (error) {
      alert(`일정 등록 실패: ${error.message}`);
    }
  }, [eventActions, setEventAddedKey]);

  const dismissSchedule = useCallback((schedule) => {
    setDetectedSchedules(prev => prev.filter(s => s !== schedule));
  }, []);

  const processTranscript = useCallback((transcript) => {
    if (isBackgroundMonitoring && transcript.trim()) {
      transcriptBufferRef.current += transcript + ' ';
      setBackgroundTranscript(transcriptBufferRef.current);
      detectScheduleKeywords(transcript);
    }
  }, [isBackgroundMonitoring, detectScheduleKeywords]);

  return {
    isBackgroundMonitoring,
    isCallDetected,
    callStartTime,
    detectedSchedules,
    backgroundTranscript,
    toggleBackgroundMonitoring,
    detectCallActivity,
    confirmSchedule,
    dismissSchedule,
    processTranscript
  };
};