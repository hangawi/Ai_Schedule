import { useState, useEffect, useCallback, useRef } from 'react';
import { generateAIPrompt, parseAIResponse, speak } from '../utils';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export const useVoiceRecognition = (
   isLoggedIn,
   isVoiceRecognitionEnabled,
   eventActions,
   areEventActionsReady,
   setEventAddedKey,
) => {
   const [isListening, setIsListening] = useState(false);
   const [modalText, setModalText] = useState('');
   const recognitionRef = useRef(null);
   const [listeningMode, setListeningMode] = useState('hotword'); // 'hotword' or 'command'
   const listeningModeRef = useRef('hotword'); // ref로 현재 모드 추적
   
   // listeningMode를 설정하는 헬퍼 함수
   const updateListeningMode = useCallback((mode) => {
      setListeningMode(mode);
      listeningModeRef.current = mode;
   }, []);
   const lastTranscriptRef = useRef('');
   const [micVolume, setMicVolume] = useState(0); // VU meter
   const audioContextRef = useRef(null);
   const analyserRef = useRef(null);
   const sourceRef = useRef(null);
   const animationFrameId = useRef(null);
   const restartingRef = useRef(false);

   /** 🎤 오디오 리소스 정리 */
   const cleanupAudioResources = useCallback(() => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if (sourceRef.current) sourceRef.current.disconnect();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
         audioContextRef.current.close();
         audioContextRef.current = null;
      }
   }, []);

   /** 🎤 음성 명령 처리 */
   const processVoiceCommand = useCallback(
      async command => {
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
               alert('Gemini API Key가 설정되지 않았습니다. .env 파일에 REACT_APP_GEMINI_API_KEY를 설정해주세요.');
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

            /** 📅 일정 추가 */
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
            } else if (eventData.intent === 'delete_event' || eventData.intent === 'delete_range') {
               /** 🗑️ 일정 삭제 */
               const token = localStorage.getItem('token');
               const controller = new AbortController();
               const timeoutId = setTimeout(() => controller.abort(), 15000);

               try {
                  const threeMonthsAgo = new Date();
                  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                  const oneYearLater = new Date();
                  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

                  const eventsResponse = await fetch(
                     `${API_BASE_URL}/api/calendar/events?timeMin=${threeMonthsAgo.toISOString()}&timeMax=${oneYearLater.toISOString()}`,
                     {
                        headers: { 'x-auth-token': token },
                        signal: controller.signal,
                     },
                  );

                  if (!eventsResponse.ok) throw new Error('일정 목록을 가져올 수 없습니다.');
                  const events = await eventsResponse.json();

                  let matchingEvents;
                  if (eventData.intent === 'delete_range') {
                     const startDate = new Date(eventData.startDateTime);
                     const endDate = new Date(eventData.endDateTime);
                     matchingEvents = events.filter(event => {
                        const eventDate = new Date(event.start.dateTime || event.start.date);
                        const inRange = eventDate >= startDate && eventDate <= endDate;
                        const scheduleKeywords = [
                           '일정',
                           '약속',
                           '미팅',
                           '회의',
                           '모임',
                           '전체',
                           '전부',
                           '모든',
                           '모두',
                        ];
                        const isGeneralSchedule = !eventData.title || scheduleKeywords.includes(eventData.title);
                        const titleMatch =
                           isGeneralSchedule || event.summary?.toLowerCase().includes(eventData.title.toLowerCase());
                        return inRange && titleMatch;
                     });
                  } else {
                     const targetDate = new Date(eventData.startDateTime).toDateString();
                     matchingEvents = events.filter(event => {
                        const eventDate = new Date(event.start.dateTime || event.start.date).toDateString();
                        const dateMatch = eventDate === targetDate;
                        const scheduleKeywords = [
                           '일정',
                           '약속',
                           '미팅',
                           '회의',
                           '모임',
                           '전체',
                           '전부',
                           '모든',
                           '모두',
                        ];
                        const isGeneralSchedule = !eventData.title || scheduleKeywords.includes(eventData.title);
                        const titleMatch =
                           isGeneralSchedule || event.summary?.toLowerCase().includes(eventData.title.toLowerCase());
                        return dateMatch && titleMatch;
                     });
                  }

                  if (matchingEvents.length === 0) {
                     speak('해당 일정을 찾을 수 없어요.');
                     return;
                  }

                  const deleteAllKeywords = ['전부', '모든', '모두', '다', '전체'];
                  const shouldDeleteAll = deleteAllKeywords.some(keyword => command.includes(keyword));

                  if (matchingEvents.length > 1 && !shouldDeleteAll) {
                     speak(
                        `${matchingEvents.length}개의 일정이 있어요. "전부 삭제"라고 하시거나 더 구체적으로 말씀해 주세요.`,
                     );
                     return;
                  }

                  if (matchingEvents.length > 1 && shouldDeleteAll) {
                     let deletedCount = 0;
                     for (const event of matchingEvents) {
                        try {
                           const deleteResponse = await fetch(`${API_BASE_URL}/api/calendar/events/${event.id}`, {
                              method: 'DELETE',
                              headers: { 'x-auth-token': token },
                              signal: controller.signal,
                           });
                           if (deleteResponse.ok) deletedCount++;
                        } catch (error) {
                           // 개별 일정 삭제 실패는 무시하고 계속 진행
                        }
                     }
                     clearTimeout(timeoutId);
                     speak(`${deletedCount}개의 일정을 삭제했어요!`);
                     setEventAddedKey(prevKey => prevKey + 1);
                     setModalText('');
                     return;
                  }

                  const eventToDelete = matchingEvents[0];
                  const deleteResponse = await fetch(`${API_BASE_URL}/api/calendar/events/${eventToDelete.id}`, {
                     method: 'DELETE',
                     headers: { 'x-auth-token': token },
                     signal: controller.signal,
                  });

                  clearTimeout(timeoutId);

                  if (!deleteResponse.ok) throw new Error('일정 삭제에 실패했습니다.');

                  if (!eventData.response) speak(`${eventToDelete.summary || '일정'}을 삭제했어요!`);
                  setEventAddedKey(prevKey => prevKey + 1);
                  setModalText('');
               } catch (error) {
                  clearTimeout(timeoutId);
                  speak(`일정 삭제에 실패했어요. ${error.message}`);
               }
            } else if (eventData.intent === 'update_event') {
               /** 🛠 일정 수정 (미지원) */
               speak('일정 업데이트 기능은 아직 지원하지 않습니다.');
            } else {
               speak('알 수 없는 명령입니다.');
            }

            setModalText('');
         } catch (error) {
            if (error.name === 'AbortError') {
               // AbortError는 조용히 처리 (사용자가 의도적으로 중단하거나 타임아웃)
               setModalText('');
            } else {
               speak(`음성 일정 추가에 실패했습니다. ${error.message}`);
               setModalText('');
            }
         }
      },
      [isLoggedIn, eventActions, isVoiceRecognitionEnabled, setEventAddedKey],
   );

   /** 🎤 음성 인식 useEffect */
   useEffect(() => {
      if (!isLoggedIn || !areEventActionsReady || !isVoiceRecognitionEnabled) {
         if (recognitionRef.current) {
            try {
               recognitionRef.current.stop();
            } catch (e) {
               // stop 호출 시 에러 무시
            }
         }
         if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
         cleanupAudioResources();
         return;
      }

      /** 🔊 마이크 분석 */
      const setupAudioAnalysis = async () => {
         try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
               setMicVolume(average / 128);
            };
            draw();
         } catch (err) {
            // 마이크 접근 실패 시 조용히 처리
         }
      };

      if (!recognitionRef.current) {
         // Browser compatibility check
         const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
         if (!SpeechRecognition) {
            console.error('Speech recognition not supported in this browser');
            return;
         }
         
         recognitionRef.current = new SpeechRecognition();
         recognitionRef.current.continuous = true;
         recognitionRef.current.interimResults = true;
         recognitionRef.current.lang = 'ko-KR';
         recognitionRef.current.maxAlternatives = 3;
         // 음성인식 민감도 향상
         if (recognitionRef.current.serviceURI) {
            recognitionRef.current.serviceURI = 'wss://www.google.com/speech-api/v2/recognize';
         }
      }

      const recognition = recognitionRef.current;

      recognition.onstart = () => {
         setIsListening(true);
         // 재시작 시 현재 모드 유지 (ref 값 사용)
         if (listeningModeRef.current !== 'command') {
            updateListeningMode('hotword');
         }
         // command 모드에서는 onstart 시 텍스트 변경하지 않음
      };

      recognition.onresult = event => {
         let currentTranscript = '';
         let isFinal = false;
         
         // 새로운 결과만 가져오기 (이전 결과 누적 방지)
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

         // command 모드에서만 실시간 텍스트 표시
         if (listeningModeRef.current === 'command') {
            const displayText = currentTranscript.trim();
            if (displayText) {
               setModalText(displayText);
            }
            // 텍스트가 없으면 아무것도 표시하지 않음 (기본 메시지도 표시 안 함)
         }

         // 최종 결과가 나왔을 때만 처리
         if (isFinal) {
            const command = currentTranscript.trim();
            
            if (listeningModeRef.current === 'hotword') {
               const HOTWORDS = ['큐브야', '비서야', '자비스', '큐브', '비서'];
               if (HOTWORDS.some(h => command.toLowerCase().includes(h.toLowerCase()))) {
                  speak('네, 말씀하세요.');
                  // hotword 감지 시에는 텍스트를 즉시 초기화
                  setModalText('');
                  updateListeningMode('command');
                  
                  // command 모드로 전환 후 음성인식 재시작
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
               updateListeningMode('hotword');
            }
         }
      };

      recognition.onerror = event => {
         if (event.error === 'no-speech') {
            if (listeningModeRef.current === 'command') {
               setModalText('음성이 들리지 않습니다');
               setTimeout(() => {
                  setModalText('');
                  updateListeningMode('hotword');
               }, 2000);
            } else {
               updateListeningMode('hotword');
            }
         } else if (event.error === 'aborted') {
            // aborted 에러는 조용히 처리 (정상적인 중단)
            setModalText('');
            updateListeningMode('hotword');
         } else {
            // 다른 에러만 표시
            setModalText(`음성인식 오류: ${event.error}`);
            setTimeout(() => {
               setModalText('');
               updateListeningMode('hotword');
            }, 2000);
         }
      };

      /** 자동 재시작 - 모든 모드에서 재시작 */
      recognition.onend = () => {
         setIsListening(false);
         
         // 컴포넌트가 언마운트되었거나 음성인식이 비활성화되면 재시작하지 않음
         if (!isVoiceRecognitionEnabled || !isLoggedIn || !areEventActionsReady || restartingRef.current) {
            return;
         }
         
         restartingRef.current = true;
         
         // command 모드는 빠르게, hotword 모드는 조금 더 빠르게 재시작
         const restartDelay = listeningModeRef.current === 'command' ? 300 : 800;
         
         setTimeout(() => {
            try {
               // 모든 조건이 맞을 때 재시작
               if (isVoiceRecognitionEnabled && isLoggedIn && areEventActionsReady && recognitionRef.current) {
                  recognition.start();
                  setupAudioAnalysis();
               }
            } catch (e) {
               // 재시작 실패 시 조용히 처리
            }
            restartingRef.current = false;
         }, restartDelay);
      };

      try {
         // 처음 시작할 때만 음성인식 시작 (hotword 감지용)
         recognition.start();
         setupAudioAnalysis();
      } catch (e) {
         // 음성 인식이 이미 시작된 경우 무시
      }

      return () => {
         try {
            if (recognitionRef.current) {
               recognitionRef.current.stop();
               recognitionRef.current = null;
            }
         } catch (e) {
            // cleanup 중 에러 무시
         }
         cleanupAudioResources();
      };
   }, [
      isLoggedIn,
      areEventActionsReady,
      isVoiceRecognitionEnabled,
      processVoiceCommand,
      updateListeningMode,
      cleanupAudioResources,
   ]);

   return { isListening, modalText, setModalText, micVolume };
};
