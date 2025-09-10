import { useState, useCallback, useRef } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export const useBackgroundMonitoring = (eventActions, setEventAddedKey) => {
  const [isBackgroundMonitoring, setIsBackgroundMonitoring] = useState(false);
  const [isCallDetected, setIsCallDetected] = useState(false);
  const [callStartTime, setCallStartTime] = useState(null);
  const [detectedSchedules, setDetectedSchedules] = useState([]);
  const [backgroundTranscript, setBackgroundTranscript] = useState('');
  
  const transcriptBufferRef = useRef('');
  const silenceTimeoutRef = useRef(null);

  const analyzeFullTranscript = useCallback(async () => {
    const transcriptToAnalyze = transcriptBufferRef.current;
    transcriptBufferRef.current = ''; // Clear buffer immediately
    
    if (!transcriptToAnalyze || transcriptToAnalyze.length < 20) { // Shorter threshold
      setBackgroundTranscript('');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

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

  const processTranscript = useCallback((transcript) => {
    if (!isBackgroundMonitoring || !transcript.trim()) return;

    if (!isCallDetected) {
      setIsCallDetected(true);
      setCallStartTime(Date.now());
    }

    transcriptBufferRef.current += transcript + ' ';
    setBackgroundTranscript(transcriptBufferRef.current);

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }

    silenceTimeoutRef.current = setTimeout(() => {
      setIsCallDetected(false);
      setCallStartTime(null);
      analyzeFullTranscript(); 
    }, 3000); // User-requested 3 seconds
    
  }, [isBackgroundMonitoring, isCallDetected, analyzeFullTranscript]);

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
        alert('로그인이 필요합니다.');
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
      alert('Google 캘린더에 일정이 성공적으로 등록되었습니다!');

    } catch (error) {
      alert(`일정 등록 실패: ${error.message}`);
    }
  }, [setEventAddedKey]);

  const dismissSchedule = useCallback((schedule) => {
    setDetectedSchedules(prev => prev.filter(s => s !== schedule));
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
    processTranscript
  };
};
