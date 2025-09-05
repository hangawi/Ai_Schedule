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
   const listeningModeRef = useRef('hotword'); // ref로 현재 모드 추적
   
   // listeningMode를 설정하는 헬퍼 함수
   const updateListeningMode = useCallback((mode) => {
      listeningModeRef.current = mode;
   }, []);
   const [micVolume, setMicVolume] = useState(0); // VU meter
   const audioContextRef = useRef(null);
   const analyserRef = useRef(null);
   const sourceRef = useRef(null);
   const animationFrameId = useRef(null);
   const restartingRef = useRef(false); // 재시작 상태 추적
   

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
            
            // 처리 완료 후 즉시 음성인식 재시작
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
            if (error.name === 'AbortError') {
               // AbortError는 조용히 처리 (사용자가 의도적으로 중단하거나 타임아웃)
               setModalText('');
            } else {
               speak(`음성 일정 추가에 실패했습니다. ${error.message}`);
               setModalText('');
            }
            
            // 에러 발생 시에도 음성인식 재시작
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

      // 중복 초기화 방지
      if (recognitionRef.current) {
         console.log('이미 음성인식이 초기화되어 있음, 건너뜀');
         return;
      }

      // PWA 환경에서 visibility change 이벤트 처리
      const handleVisibilityChange = () => {
         if (document.visibilityState === 'visible') {
            // PWA가 다시 보일 때 권한 상태 재확인
            const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                         window.navigator.standalone || 
                         document.referrer.includes('android-app://') ||
                         window.location.href.includes('homescreen=1');
            
            const isMobile = /Mobi|Android/i.test(navigator.userAgent);
            const domain = window.location.hostname;
            
            // 다양한 권한 상태 확인
            const hasPermission = localStorage.getItem('isPWAWithMicPermission') === 'true' ||
                                 localStorage.getItem('micPermissionGranted') === 'true' ||
                                 localStorage.getItem(`micPermission_${domain}`) === 'true';
            
            const permissionTimestamp = localStorage.getItem('pwaPermissionTimestamp');
            const isRecentPermission = permissionTimestamp && 
                                     (Date.now() - parseInt(permissionTimestamp)) < 24 * 60 * 60 * 1000;
            
            if ((isPWA || isMobile) && hasPermission && isRecentPermission) {
               console.log('PWA/모바일에서 포그라운드 전환 시 권한 재사용');
               setTimeout(() => {
                  if (isVoiceRecognitionEnabled && recognitionRef.current) {
                     try {
                        recognitionRef.current.start();
                     } catch (e) {
                        console.log('포그라운드 전환 시 음성인식 재시작 실패:', e);
                     }
                  }
               }, 300); // 더 빠른 재시작
            }
         }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      /** 🔊 마이크 분석 */
      const setupAudioAnalysis = async () => {
         try {
            // 중복 실행 방지
            if (audioContextRef.current || sourceRef.current) {
               console.log('기존 음성 인식 오디오 분석이 이미 실행 중');
               return;
            }

            // 모바일 환경에서 권한 상태를 더 정확하게 체크
            const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                         window.navigator.standalone || 
                         document.referrer.includes('android-app://') ||
                         window.location.href.includes('homescreen=1');
            
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            
            // 이미 허용된 상태인지 확인
            const previouslyGranted = localStorage.getItem('micPermissionGranted') === 'true' ||
                                    sessionStorage.getItem('micPermissionGranted') === 'true';
            
            // iOS에서는 세션별 권한 체크
            if (isIOS) {
               const currentSession = sessionStorage.getItem('ios_mic_session');
               if (!currentSession && !previouslyGranted) {
                  console.log('iOS 새 세션에서 권한 요청 필요');
               }
            }
            
            // PWA 환경에서 권한 API로 현재 상태 확인
            if (navigator.permissions) {
               try {
                  const permissionResult = await navigator.permissions.query({name: 'microphone'});
                  if (permissionResult.state === 'granted') {
                     // 권한이 이미 허용됨
                  } else if (permissionResult.state === 'denied') {
                     // 명시적으로 거부된 경우
                     localStorage.removeItem('micPermissionGranted');
                     sessionStorage.removeItem('micPermissionGranted');
                     localStorage.removeItem('isPWAWithMicPermission');
                     console.warn('마이크 권한이 명시적으로 거부되었습니다.');
                     return;
                  }
               } catch (permError) {
                  // permissions API가 지원되지 않는 경우
                  console.log('Permissions API not supported');
               }
            }

            const stream = await navigator.mediaDevices.getUserMedia({ 
               audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                  // 모바일에서 더 나은 호환성을 위한 설정
                  sampleRate: 16000,
                  channelCount: 1
               } 
            });
            
            // 성공적으로 마이크 접근이 되면 다중 저장 + 타임스탬프
            const timestamp = Date.now();
            const permissionData = JSON.stringify({ granted: true, timestamp, isPWA });
            
            localStorage.setItem('micPermissionGranted', 'true');
            localStorage.setItem('micPermissionData', permissionData);
            sessionStorage.setItem('micPermissionGranted', 'true');
            
            if (isPWA) {
               localStorage.setItem('isPWAWithMicPermission', 'true');
               // PWA용 추가 식별자
               localStorage.setItem('pwaPermissionTimestamp', timestamp.toString());
            }
            
            // 도메인별로도 저장 (모바일 브라우저 호환성)
            try {
               const domain = window.location.hostname;
               localStorage.setItem(`micPermission_${domain}`, 'true');
            } catch (e) {
               console.log('도메인별 저장 실패:', e);
            }
            
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
            // 마이크 접근 실패 시 모든 관련 저장소에서 제거
            localStorage.removeItem('micPermissionGranted');
            localStorage.removeItem('micPermissionData');
            sessionStorage.removeItem('micPermissionGranted');
            localStorage.removeItem('isPWAWithMicPermission');
            localStorage.removeItem('pwaPermissionTimestamp');
            
            // 도메인별 저장소도 정리
            try {
               const domain = window.location.hostname;
               localStorage.removeItem(`micPermission_${domain}`);
            } catch (e) {
               console.log('도메인별 정리 실패:', e);
            }
            
            console.warn('마이크 접근 실패:', err);
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
         recognitionRef.current.maxAlternatives = 5; // 더 많은 대안 고려
         
         // 음성인식 정확도 향상 설정
         if (recognitionRef.current.serviceURI) {
            recognitionRef.current.serviceURI = 'wss://www.google.com/speech-api/v2/recognize';
         }
         
         // 추가 정확도 향상 설정들
         if (recognitionRef.current.grammars) {
            const grammar = '#JSGF V1.0; grammar commands; public <commands> = 비서야 | 큐브야 | 자비스 | 약속 | 일정 | 추가 | 삭제 | 오늘 | 내일 | 모레 | 시간 | 분;';
            const speechRecognitionList = new (window.SpeechGrammarList || window.webkitSpeechGrammarList)();
            speechRecognitionList.addFromString(grammar, 1);
            recognitionRef.current.grammars = speechRecognitionList;
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

      /** 자동 재시작 - 더 빠른 재시작 */
      recognition.onend = () => {
         setIsListening(false);
         
         // 컴포넌트가 언마운트되었거나 음성인식이 비활성화되면 재시작하지 않음
         if (!isVoiceRecognitionEnabled || !isLoggedIn || !areEventActionsReady || restartingRef.current) {
            return;
         }
         
         restartingRef.current = true;
         
         // 모든 모드에서 빠른 재시작 (200ms로 대폭 단축)
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
         }, 200);
      };

      // PWA 및 모바일 환경에서 권한 확인 후 초기화
      const checkPermissionAndStart = async () => {
         const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                      window.navigator.standalone || 
                      document.referrer.includes('android-app://') ||
                      window.location.href.includes('homescreen=1');
         
         const isMobile = /Mobi|Android/i.test(navigator.userAgent);
         const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
         const domain = window.location.hostname;
         
         // iOS에서는 더 엄격한 권한 체크
         if (isIOS) {
            console.log('iOS 환경 감지됨');
            
            // iOS에서는 세션별로 권한 관리 (새로고침/재방문 시 초기화)
            const sessionKey = `ios_mic_session_${Date.now().toString().slice(-8)}`;
            const currentSession = sessionStorage.getItem('ios_mic_session');
            
            if (!currentSession) {
               // 새 세션 - 권한 재요청 필요
               console.log('iOS 새 세션, 권한 재요청');
               localStorage.removeItem('micPermissionGranted');
               localStorage.removeItem('isPWAWithMicPermission');
            } else {
               console.log('iOS 기존 세션 유지');
            }
            
            sessionStorage.setItem('ios_mic_session', sessionKey);
         }
         
         // 다양한 저장소에서 권한 상태 확인
         const hasPermission = localStorage.getItem('isPWAWithMicPermission') === 'true' ||
                              localStorage.getItem('micPermissionGranted') === 'true' ||
                              localStorage.getItem(`micPermission_${domain}`) === 'true' ||
                              sessionStorage.getItem('micPermissionGranted') === 'true';
         
         // 타임스탬프 확인 (iOS는 1시간, 다른 기기는 24시간)
         const permissionTimestamp = localStorage.getItem('pwaPermissionTimestamp');
         const maxAge = isIOS ? 1 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // iOS는 1시간
         const isRecentPermission = permissionTimestamp && 
                                  (Date.now() - parseInt(permissionTimestamp)) < maxAge;
         
         console.log('권한 체크:', { isPWA, isMobile, isIOS, hasPermission, isRecentPermission });
         
         // iOS에서는 더 보수적으로 접근
         if (isIOS && !isRecentPermission) {
            console.log('iOS에서 권한 만료 또는 없음, 새로 요청');
            try {
               recognition.start();
               setupAudioAnalysis();
            } catch (e) {
               console.log('iOS 권한 요청 실패:', e);
            }
         } else if ((isPWA || isMobile) && hasPermission && isRecentPermission) {
            console.log('이전 권한 사용하여 조용히 시작');
            try {
               recognition.start();
               // iOS가 아닌 경우에만 지연 시작
               if (!isIOS) {
                  setTimeout(() => setupAudioAnalysis(), 100);
               } else {
                  setupAudioAnalysis(); // iOS는 즉시 시작
               }
            } catch (e) {
               console.log('조용한 시작 실패, 일반 프로세스로 진행');
               setupAudioAnalysis();
            }
         } else {
            // 일반적인 경우 또는 권한이 없는 경우
            try {
               recognition.start();
               setupAudioAnalysis();
            } catch (e) {
               console.log('일반 시작 실패:', e);
            }
         }
      };

      checkPermissionAndStart();

      return () => {
         document.removeEventListener('visibilitychange', handleVisibilityChange);
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
