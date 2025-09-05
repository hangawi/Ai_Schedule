import { useState, useEffect, useCallback, useRef } from 'react';
import { generateAIPrompt, parseAIResponse, speak } from '../utils';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export const useIntegratedVoiceSystem = (
   isLoggedIn,
   isVoiceRecognitionEnabled,
   eventActions,
   areEventActionsReady,
   setEventAddedKey,
) => {
   // 기존 음성 명령 상태
   const [isListening, setIsListening] = useState(false);
   const [modalText, setModalText] = useState('');
   const recognitionRef = useRef(null);
   const listeningModeRef = useRef('hotword');
   
   // 백그라운드 감지 상태
   const [isBackgroundMonitoring, setIsBackgroundMonitoring] = useState(false);
   const [isCallDetected, setIsCallDetected] = useState(false);
   const [callStartTime, setCallStartTime] = useState(null);
   const [detectedSchedules, setDetectedSchedules] = useState([]);
   const [backgroundTranscript, setBackgroundTranscript] = useState('');
   
   // 공통 상태
   const [micVolume, setMicVolume] = useState(0);
   const audioContextRef = useRef(null);
   const analyserRef = useRef(null);
   const sourceRef = useRef(null);
   const animationFrameId = useRef(null);
   // 간단한 상태 관리만 유지
   
   // 백그라운드 전용 refs
   const transcriptBufferRef = useRef('');
   const lastProcessedRef = useRef('');
   const volumeHistoryRef = useRef([]);
   const silenceTimeoutRef = useRef(null);

   // 리소스 정리
   const cleanupAudioResources = useCallback(() => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if (sourceRef.current) sourceRef.current.disconnect();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
         audioContextRef.current.close();
         audioContextRef.current = null;
      }
   }, []);

   // 백그라운드 모니터링 토글
   const toggleBackgroundMonitoring = useCallback(async () => {
      if (isBackgroundMonitoring) {
         // 백그라운드 모니터링 중지
         setIsBackgroundMonitoring(false);
         setIsCallDetected(false);
         setCallStartTime(null);
         
         if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
         }
         
         // 최종 분석
         if (transcriptBufferRef.current.length > 100) {
            await analyzeFullTranscript();
         }
         
         transcriptBufferRef.current = '';
         setBackgroundTranscript('');
         console.log('백그라운드 모니터링 중지됨');
      } else {
         // 백그라운드 모니터링 시작
         setIsBackgroundMonitoring(true);
         console.log('백그라운드 모니터링 시작됨');
      }
   }, [isBackgroundMonitoring]);

   // 통화 감지 로직
   const detectCallActivity = useCallback((currentVolume) => {
      const VOLUME_THRESHOLD = 0.1;
      const CALL_DURATION_THRESHOLD = 5000;
      
      const recentActivity = volumeHistoryRef.current.filter(
         item => item.volume > VOLUME_THRESHOLD && 
                 item.timestamp > Date.now() - CALL_DURATION_THRESHOLD
      );

      const isCurrentlyActive = currentVolume > VOLUME_THRESHOLD;
      const hasRecentActivity = recentActivity.length > 10;

      if (!isCallDetected && hasRecentActivity && isCurrentlyActive) {
         setIsCallDetected(true);
         setCallStartTime(Date.now());
         console.log('통화 감지됨 - 자동 분석 시작');
         
         if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
         }
      }

      if (isCallDetected && isCurrentlyActive) {
         if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
         }
         
         silenceTimeoutRef.current = setTimeout(() => {
            if (isCallDetected) {
               setIsCallDetected(false);
               setCallStartTime(null);
               console.log('침묵 감지 - 통화 종료');
               
               if (transcriptBufferRef.current.length > 100) {
                  analyzeFullTranscript();
               }
            }
         }, 10000);
      }
   }, [isCallDetected]);

   // 키워드 감지
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
               console.log(`일정 키워드 감지: ${text.substring(0, 50)}...`);
               
               if (transcriptBufferRef.current.length > 200) {
                  analyzeFullTranscript();
               }
            }
         }
      } catch (error) {
         console.error('키워드 감지 실패:', error);
      }
   }, []);

   // 전체 분석
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
                  console.log(`${newSchedules.length}개의 새로운 일정 감지됨`);
               }
            }
         }
      } catch (error) {
         console.error('전체 분석 실패:', error);
      }
   }, [detectedSchedules]);

   // 음성 명령 처리 (기존 기능)
   const processVoiceCommand = useCallback(async (command) => {
      if (!isLoggedIn || !isVoiceRecognitionEnabled) {
         setModalText('로그인이 필요하거나 음성인식이 비활성화되어 있습니다.');
         setTimeout(() => setModalText(''), 2000);
         return;
      }

      if (!command) {
         speak('네, 무엇을 도와드릴까요?');
         return;
      }

      setModalText(command);

      try {
         const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
         if (!API_KEY) {
            alert('Gemini API Key가 설정되지 않았습니다.');
            return;
         }

         const genAI = new GoogleGenerativeAI(API_KEY);
         const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

         const prompt = generateAIPrompt(command);
         const result = await model.generateContent(prompt);
         const response = await result.response;
         const text = response.text();
         const eventData = parseAIResponse(text);

         if (!eventData.startDateTime) {
            speak('언제 일정을 잡을까요?');
            return;
         }

         if (!eventActions) {
            speak('아직 일정 기능을 사용할 수 없습니다. 잠시 후 다시 시도해주세요.');
            return;
         }

         if (eventData.intent === 'add_event') {
            const token = localStorage.getItem('token');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const apiResponse = await fetch(`${API_BASE_URL}/api/calendar/events/google`, {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json',
                  'x-auth-token': token,
               },
               body: JSON.stringify(eventData),
               signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!apiResponse.ok) {
               const errorData = await apiResponse.json();
               throw new Error(errorData.msg || 'Failed to add event to Google Calendar');
            }

            speak('일정을 성공적으로 추가했습니다.');
            setEventAddedKey(prevKey => prevKey + 1);
            setModalText('');
         } else {
            speak('해당 기능은 현재 지원하지 않습니다.');
         }

         setModalText('');
         
         setTimeout(() => {
            if (isVoiceRecognitionEnabled && recognitionRef.current) {
               try {
                  recognitionRef.current.start();
               } catch (e) {
                  // 재시작 실패 시 조용히 처리
               }
            }
         }, 100);
      } catch (error) {
         if (error.name !== 'AbortError') {
            speak(`음성 명령 처리에 실패했습니다. ${error.message}`);
         }
         setModalText('');
         
         setTimeout(() => {
            if (isVoiceRecognitionEnabled && recognitionRef.current) {
               try {
                  recognitionRef.current.start();
               } catch (e) {
                  // 재시작 실패 시 조용히 처리
               }
            }
         }, 100);
      }
   }, [isLoggedIn, eventActions, isVoiceRecognitionEnabled, setEventAddedKey]);

   // 일정 확인
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
         console.error('일정 등록 실패:', error);
         alert(`일정 등록 실패: ${error.message}`);
      }
   }, [eventActions, setEventAddedKey]);

   // 일정 무시
   const dismissSchedule = useCallback((schedule) => {
      setDetectedSchedules(prev => prev.filter(s => s !== schedule));
   }, []);

   // 통합 음성 인식 시스템 - 단순화
   useEffect(() => {
      // 조건 확인
      if (!isLoggedIn || !areEventActionsReady || (!isVoiceRecognitionEnabled && !isBackgroundMonitoring)) {
         // 조건 미충족 시 정리
         if (recognitionRef.current) {
            try {
               recognitionRef.current.abort();
               recognitionRef.current = null;
            } catch (e) {}
         }
         cleanupAudioResources();
         setIsListening(false);
         return;
      }

      // 이미 실행 중이면 건너뛰기
      if (recognitionRef.current) {
         return;
      }

      // 새 인스턴스 시작
      console.log('음성 인식 시작');
      initializeRecognition();
   }, [
      isLoggedIn,
      areEventActionsReady,
      isVoiceRecognitionEnabled,
      isBackgroundMonitoring
      // 함수들은 의존성에서 제거 (useCallback으로 안정화됨)
   ]);

   const initializeRecognition = useCallback(() => {
      if (recognitionRef.current) {
         console.log('이미 음성 인식이 실행 중입니다.');
         return;
      }
      
      console.log('새 음성 인식 시작');
      
      const setupAudioAnalysis = async () => {
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

                  // 백그라운드 모니터링 시 볼륨 히스토리 관리
                  if (isBackgroundMonitoring) {
                     volumeHistoryRef.current.push({
                        volume: normalizedVolume,
                        timestamp: Date.now()
                     });

                     const thirtySecondsAgo = Date.now() - 30000;
                     volumeHistoryRef.current = volumeHistoryRef.current.filter(
                        item => item.timestamp > thirtySecondsAgo
                     );

                     detectCallActivity(normalizedVolume);
                  }
               };
               draw();
            }
         } catch (err) {
            console.warn('마이크 접근 실패:', err);
         }
      };

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
         console.error('음성 인식이 지원되지 않는 브라우저입니다.');
         return;
      }
      
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'ko-KR';
      recognitionRef.current.maxAlternatives = 3;

      const recognition = recognitionRef.current;

      recognition.onstart = () => {
         console.log('음성 인식 시작됨');
         setIsListening(true);
         if (listeningModeRef.current !== 'command') {
            listeningModeRef.current = 'hotword';
         }
      };

      recognition.onresult = event => {
         let currentTranscript = '';
         let isFinal = false;
         
         for (let i = event.resultIndex; i < event.results.length; ++i) {
            let bestAlternative = event.results[i][0];
            for (let j = 1; j < event.results[i].length; j++) {
               if (event.results[i][j].confidence > bestAlternative.confidence) {
                  bestAlternative = event.results[i][j];
               }
            }
            const transcript = bestAlternative.transcript;
            currentTranscript += transcript;

            if (event.results[i].isFinal) {
               isFinal = true;
            }
         }

         // 백그라운드 모니터링 시 대화 내용 축적
         if (isBackgroundMonitoring && isFinal && currentTranscript.trim()) {
            transcriptBufferRef.current += currentTranscript + ' ';
            setBackgroundTranscript(transcriptBufferRef.current);
            detectScheduleKeywords(currentTranscript);
         }

         // 음성 명령 모드 처리
         if (isVoiceRecognitionEnabled) {
            if (listeningModeRef.current === 'command') {
               const displayText = currentTranscript.trim();
               if (displayText) {
                  setModalText(displayText);
               }
            }

            if (isFinal) {
               const command = currentTranscript.trim();
               
               if (listeningModeRef.current === 'hotword') {
                  const HOTWORDS = ['큐브야', '비서야', '자비스', '큐브', '비서'];
                  if (HOTWORDS.some(h => command.toLowerCase().includes(h.toLowerCase()))) {
                     speak('네, 말씀하세요.');
                     setModalText('');
                     listeningModeRef.current = 'command';
                     
                     setTimeout(() => {
                        try {
                           if (recognitionRef.current && listeningModeRef.current === 'command') {
                              setModalText('말씀하세요...');
                              recognition.start();
                              setupAudioAnalysis();
                           }
                        } catch (e) {
                           // 재시작 실패 시 조용히 처리
                        }
                     }, 500);
                  }
               } else if (listeningModeRef.current === 'command' && command) {
                  setModalText('명령 처리 중...');
                  processVoiceCommand(command);
                  listeningModeRef.current = 'hotword';
               }
            }
         }
      };

      recognition.onerror = event => {
         console.log('음성 인식 오류:', event.error);
         setIsListening(false);
         
         if (event.error === 'aborted') {
            // aborted는 정상적인 중단으로 처리
            console.log('음성 인식이 중단되었습니다.');
            return;
         }
         if (event.error === 'no-speech') {
            if (listeningModeRef.current === 'command') {
               setModalText('음성이 들리지 않습니다');
               setTimeout(() => {
                  setModalText('');
                  listeningModeRef.current = 'hotword';
               }, 2000);
            } else {
               listeningModeRef.current = 'hotword';
            }
         } else {
            console.error('음성 인식 오류:', event.error);
            setModalText(`음성인식 오류: ${event.error}`);
            setTimeout(() => {
               setModalText('');
               listeningModeRef.current = 'hotword';
            }, 2000);
         }
      };

      recognition.onend = () => {
         console.log('음성 인식 종료됨');
         setIsListening(false);
         // 자동 재시작 완전 제거 - 사용자가 원할 때만 다시 시작
      };

      try {
         recognition.start();
         setupAudioAnalysis();
         console.log('음성 인식 초기화 완료');
      } catch (error) {
         console.error('음성 인식 시작 실패:', error.message);
         if (recognitionRef.current) {
            recognitionRef.current = null;
         }
         cleanupAudioResources();
      }
   }, []); // 의존성 없음 - 모든 필요한 값은 ref로 관리
   
   // Cleanup effect
   useEffect(() => {
      return () => {
         console.log('음성 시스템 정리 시작');
         try {
            if (recognitionRef.current) {
               recognitionRef.current.abort();
               recognitionRef.current = null;
            }
         } catch (e) {
            console.log('Recognition cleanup 실패:', e);
         }
         cleanupAudioResources();
         if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
         }
      };
   }, [cleanupAudioResources]);

   return { 
      // 기존 음성 명령 관련
      isListening, 
      modalText, 
      setModalText, 
      micVolume,
      // 백그라운드 감지 관련
      isBackgroundMonitoring,
      isCallDetected,
      callStartTime,
      detectedSchedules,
      backgroundTranscript,
      toggleBackgroundMonitoring,
      confirmSchedule,
      dismissSchedule
   };
};