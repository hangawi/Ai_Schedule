import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SchedulingSystem from './SchedulingSystem';
import { AuthScreen } from './AuthScreen';
import ChatBox from './ChatBox';
import moment from 'moment';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

// --- 음성 응답 기능 추가 ---
const speak = text => {
   if ('speechSynthesis' in window) {
      // 이전에 진행 중이던 음성 출력이 있다면 취소
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 1.2; // 약간 빠르게
      window.speechSynthesis.speak(utterance);
   } else {
      console.warn('이 브라우저에서는 음성 합성을 지원하지 않습니다.');
   }
};
// --- 음성 응답 기능 끝 ---

// --- AI 프롬프트 공통 함수 ---
const generateAIPrompt = (command) => {
   return [
      `오늘 = ${moment().format('YYYY-MM-DD dddd')} (${moment().format('MM월 DD일')})`,
      `현재 시간 = ${moment().format('YYYY-MM-DD HH:mm:ss')}`,
      `명령어: "${command}"`,
      ``,
      `**정확한 날짜 계산 (오늘 기준):**`,
      `어제 = ${moment().subtract(1, 'days').format('YYYY-MM-DD')}`,
      `오늘 = ${moment().format('YYYY-MM-DD')}`,
      `내일 = ${moment().add(1, 'days').format('YYYY-MM-DD')}`,
      `모레 = ${moment().add(2, 'days').format('YYYY-MM-DD')}`,
      `글피 = ${moment().add(3, 'days').format('YYYY-MM-DD')}`,
      ``,
      `절대 설명하지 마! JSON만 출력!`,
      ``,
      `**정확한 주차 계산 (과거/현재/미래 모두):**`,
      `저저저저번주 (4주 전) = ${moment().subtract(4, 'weeks').startOf('week').format('YYYY-MM-DD')} ~ ${moment().subtract(4, 'weeks').endOf('week').format('YYYY-MM-DD')}`,
      `저저저번주 (3주 전) = ${moment().subtract(3, 'weeks').startOf('week').format('YYYY-MM-DD')} ~ ${moment().subtract(3, 'weeks').endOf('week').format('YYYY-MM-DD')}`,
      `저저번주 (2주 전) = ${moment().subtract(2, 'weeks').startOf('week').format('YYYY-MM-DD')} ~ ${moment().subtract(2, 'weeks').endOf('week').format('YYYY-MM-DD')}`,
      `저번주 (1주 전) = ${moment().subtract(1, 'week').startOf('week').format('YYYY-MM-DD')} ~ ${moment().subtract(1, 'week').endOf('week').format('YYYY-MM-DD')}`,
      `이번주 (0주차) = ${moment().startOf('week').format('YYYY-MM-DD')} ~ ${moment().endOf('week').format('YYYY-MM-DD')}`,
      `다음주 (1주 후) = ${moment().add(1, 'week').startOf('week').format('YYYY-MM-DD')} ~ ${moment().add(1, 'week').endOf('week').format('YYYY-MM-DD')}`,
      `다다음주 (2주 후) = ${moment().add(2, 'weeks').startOf('week').format('YYYY-MM-DD')} ~ ${moment().add(2, 'weeks').endOf('week').format('YYYY-MM-DD')}`,
      `다다다음주 (3주 후) = ${moment().add(3, 'weeks').startOf('week').format('YYYY-MM-DD')} ~ ${moment().add(3, 'weeks').endOf('week').format('YYYY-MM-DD')}`,
      `다다다다음주 (4주 후) = ${moment().add(4, 'weeks').startOf('week').format('YYYY-MM-DD')} ~ ${moment().add(4, 'weeks').endOf('week').format('YYYY-MM-DD')}`,
      ``,
      `⚠️ 혼동 금지: "다다다음주(3주 후)" ≠ "다다음주(2주 후)"`,
      `⚠️ 혼동 금지: "저저저번주(3주 전)" ≠ "저저번주(2주 전)"`,
      ``,
      `**정확한 요일별 날짜 (과거/미래):**`,
      `저저저저번주 월요일 (4주 전) = ${moment().subtract(4, 'weeks').day(1).format('YYYY-MM-DD')}`,
      `저저저번주 화요일 (3주 전) = ${moment().subtract(3, 'weeks').day(2).format('YYYY-MM-DD')}`,
      `저저번주 수요일 (2주 전) = ${moment().subtract(2, 'weeks').day(3).format('YYYY-MM-DD')}`,
      `저번주 목요일 (1주 전) = ${moment().subtract(1, 'week').day(4).format('YYYY-MM-DD')}`,
      `이번주 금요일 = ${moment().day(5).format('YYYY-MM-DD')}`,
      `다음주 월요일 (1주 후) = ${moment().add(1, 'week').day(1).format('YYYY-MM-DD')}`,
      `다다음주 화요일 (2주 후) = ${moment().add(2, 'weeks').day(2).format('YYYY-MM-DD')}`,
      `다다다음주 수요일 (3주 후) = ${moment().add(3, 'weeks').day(3).format('YYYY-MM-DD')}`,
      `다다다다음주 목요일 (4주 후) = ${moment().add(4, 'weeks').day(4).format('YYYY-MM-DD')}`,
      ``,
      `**중요: 일정=약속=미팅=회의=모임 (모두 같은 의미!)**`,
      ``,
      `**필수 JSON 형식 (이 형식 그대로!):**`,
      `일정/약속 추가:`,
      `{"intent": "add_event", "title": "일정", "startDateTime": "2025-09-08T16:00:00+09:00", "endDateTime": "2025-09-08T17:00:00+09:00", "response": "추가!"}`,
      ``,
      `일정/약속 삭제:`, 
      `{"intent": "delete_event", "title": "일정", "startDateTime": "2025-09-08T09:00:00+09:00", "endDateTime": "2025-09-08T10:00:00+09:00", "response": "삭제!"}`,
      ``,
      `범위 삭제:`,
      `{"intent": "delete_range", "title": "일정", "startDateTime": "2025-09-01T00:00:00+09:00", "endDateTime": "2025-09-07T23:59:59+09:00", "response": "삭제!"}`,
      ``,
      `"다음주 일정 삭제" = "다음주 약속 삭제" (완전히 같음)`,
      `"이번주 회의 삭제" = "이번주 미팅 삭제" (완전히 같음)`,
      ``,
      `**삭제 예시 (매우 중요!):**`,
      `"다음주 월요일 약속 삭제" -> {"intent": "delete_event", "title": "약속", "startDateTime": "${moment().add(1, 'week').day(1).format('YYYY-MM-DD')}T00:00:00+09:00", "endDateTime": "${moment().add(1, 'week').day(1).format('YYYY-MM-DD')}T23:59:59+09:00", "response": "삭제!"}`,
      `"다음주 월요일 일정 전부 삭제" -> {"intent": "delete_range", "title": "일정", "startDateTime": "${moment().add(1, 'week').day(1).format('YYYY-MM-DD')}T00:00:00+09:00", "endDateTime": "${moment().add(1, 'week').day(1).format('YYYY-MM-DD')}T23:59:59+09:00", "response": "삭제!"}`,
      `"이번주 일정 전부 삭제" -> {"intent": "delete_range", "title": "일정", "startDateTime": "${moment().startOf('week').format('YYYY-MM-DD')}T00:00:00+09:00", "endDateTime": "${moment().endOf('week').format('YYYY-MM-DD')}T23:59:59+09:00", "response": "삭제!"}`,
      `"다음주 회의 모두 삭제" -> {"intent": "delete_range", "title": "회의", "startDateTime": "${moment().add(1, 'week').startOf('week').format('YYYY-MM-DD')}T00:00:00+09:00", "endDateTime": "${moment().add(1, 'week').endOf('week').format('YYYY-MM-DD')}T23:59:59+09:00", "response": "삭제!"}`,
      ``,
      `**매우 중요:** 사용자의 메시지가 일정 관리(추가, 삭제, 수정, 확인)와 전혀 관련 없는 단순 대화(예: "안녕", "뭐해", "밥 먹었어?")일 경우, 절대 일정을 생성하지 말고, 다음과 같은 JSON을 출력해: {"intent": "clarification", "response": "안녕하세요! 일정 관리를 도와드릴까요?"}`,
   ].join('\n');
};


// --- AI JSON 파싱 공통 함수 ---
const parseAIResponse = (text) => {
   let jsonString = text.replace(/```json\n|\n```/g, '').trim();
   
   // JSON 블록 찾기
   const jsonStart = jsonString.indexOf('{');
   const jsonEnd = jsonString.lastIndexOf('}');
   if (jsonStart !== -1 && jsonEnd !== -1) {
      jsonString = jsonString.substring(jsonStart, jsonEnd + 1);
   }
   
   // 주석 제거
   jsonString = jsonString.replace(/\/\/.*$/gm, '').trim();
   
   const eventData = JSON.parse(jsonString);
   
   // 기본값 설정
   if (!eventData.title) eventData.title = '약속';
   if (!eventData.endDateTime && eventData.startDateTime) {
      const start = new Date(eventData.startDateTime);
      start.setHours(start.getHours() + 1);
      eventData.endDateTime = start.toISOString();
   }
   
   return eventData;
};
// --- 공통 함수 끝 ---

function App() {
   const [isLoggedIn, setIsLoggedIn] = useState(false);
   const [user, setUser] = useState(null);
   const [loginMethod, setLoginMethod] = useState(null);
   const [isListening, setIsListening] = useState(false);
   const [eventAddedKey, setEventAddedKey] = useState(0); // Event added trigger
   const [isVoiceRecognitionEnabled, setIsVoiceRecognitionEnabled] = useState(true); // Default to true
   const [eventActions, setEventActions] = useState(null);
   const [areEventActionsReady, setAreEventActionsReady] = useState(false);
   const recognitionRef = useRef(null);

   const fetchUser = useCallback(async () => {
      const token = localStorage.getItem('token');
      if (token) {
         try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(`${API_BASE_URL}/api/auth`, {
               headers: { 'x-auth-token': token },
               signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
               const userData = await response.json();
               setIsLoggedIn(true);
               setUser(userData);
            } else {
               localStorage.removeItem('token');
               setIsLoggedIn(false);
               setUser(null);
            }
         } catch (error) {
            if (error.name !== 'AbortError') {
               console.error('Error fetching user data:', error);
            }
            localStorage.removeItem('token');
            setIsLoggedIn(false);
            setUser(null);
         }
      }
   }, []);

   useEffect(() => {
      fetchUser();
   }, [fetchUser]);

   const parseAndAddVoiceEvent = useCallback(
      async transcript => {
         if (!isLoggedIn) {
            return;
         }
         if (!isVoiceRecognitionEnabled) {
            // NEW: If voice recognition is disabled, do not process command
            return;
         }

         const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
         const HOTWORDS = ['큐브야', '비서야', '자비스', '큐브', '비서'];

         if (!API_KEY) {
            alert('Gemini API Key가 설정되지 않았습니다. .env 파일에 REACT_APP_GEMINI_API_KEY를 설정해주세요.');
            return;
         }

         // 더 유연한 호출어 감지
         const hotword = HOTWORDS.find(h => 
            transcript.trim().toLowerCase().includes(h) || 
            transcript.trim().toLowerCase().startsWith(h)
         );
         
         let command;
         if (hotword) {
            const hotwordIndex = transcript.toLowerCase().indexOf(hotword);
            command = transcript.substring(hotwordIndex + hotword.length).trim();
         } else {
            // 호출어 없이도 일정 관련 키워드가 있으면 처리
            const scheduleKeywords = ['일정', '약속', '회의', '미팅', '예약', '스케줄', '캘린더'];
            const hasScheduleKeyword = scheduleKeywords.some(keyword => 
               transcript.includes(keyword)
            );
            
            if (hasScheduleKeyword) {
               command = transcript.trim();
            } else {
               return;
            }
         }

         if (!command) {
            speak('네, 무엇을 도와드릴까요?');
            return;
         }

         try {
            const genAI = new GoogleGenerativeAI(API_KEY);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            
            const prompt = generateAIPrompt(command);
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            const eventData = parseAIResponse(text);

            // 최소한의 검증만
            if (!eventData.startDateTime) {
               speak('언제 일정을 잡을까요?');
               return;
            }

            // --- NEW LOGIC FOR INTENT HANDLING ---
            if (!eventActions) {
               console.error('Event actions not available yet.');
               speak('아직 일정 기능을 사용할 수 없습니다. 잠시 후 다시 시도해주세요.');
               return;
            }

            if (eventData.intent === 'add_event') {
               // Existing add event logic
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
                  signal: controller.signal
               });
               
               clearTimeout(timeoutId);

               if (!apiResponse.ok) {
                  const errorData = await apiResponse.json();
                  throw new Error(errorData.msg || 'Failed to add event to Google Calendar');
               }

               speak('일정을 성공적으로 추가했습니다.');
               setEventAddedKey(prevKey => prevKey + 1); // Trigger refresh
            } else if (eventData.intent === 'delete_event' || eventData.intent === 'delete_range') {
               // 실제 일정 삭제 로직
               const token = localStorage.getItem('token');
               const controller = new AbortController();
               const timeoutId = setTimeout(() => controller.abort(), 15000);
               
               try {
                  // 일정 목록 가져오기 (과거 3개월 ~ 미래 1년)
                  const threeMonthsAgo = new Date();
                  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                  const oneYearLater = new Date();
                  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
                  
                  const eventsResponse = await fetch(`${API_BASE_URL}/api/calendar/events?timeMin=${threeMonthsAgo.toISOString()}&timeMax=${oneYearLater.toISOString()}`, {
                     headers: { 'x-auth-token': token },
                     signal: controller.signal
                  });
                  
                  if (!eventsResponse.ok) {
                     throw new Error('일정 목록을 가져올 수 없습니다.');
                  }
                  
                  const events = await eventsResponse.json();
                  
                  let matchingEvents;
                  
                  if (eventData.intent === 'delete_range') {
                     // 범위 삭제 (이번주, 다음주 등)
                     const startDate = new Date(eventData.startDateTime);
                     const endDate = new Date(eventData.endDateTime);
                     
                     matchingEvents = events.filter(event => {
                        const eventDate = new Date(event.start.dateTime || event.start.date);
                        const inRange = eventDate >= startDate && eventDate <= endDate;
                        
                        // 제목 매칭 - 모든 일정 관련 키워드 포함
                        const scheduleKeywords = ['일정', '약속', '미팅', '회의', '모임', '전체', '전부', '모든', '모두'];
                        const isGeneralSchedule = !eventData.title || scheduleKeywords.includes(eventData.title);
                        const titleMatch = isGeneralSchedule || 
                                          event.summary?.toLowerCase().includes(eventData.title.toLowerCase());
                        
                        if (inRange && titleMatch) {
                        }
                        
                        return inRange && titleMatch;
                     });
                  } else {
                     // 단일 날짜 삭제
                     const targetDate = new Date(eventData.startDateTime).toDateString();
                     
                     matchingEvents = events.filter(event => {
                        const eventDate = new Date(event.start.dateTime || event.start.date).toDateString();
                        const dateMatch = eventDate === targetDate;
                        const scheduleKeywords = ['일정', '약속', '미팅', '회의', '모임', '전체', '전부', '모든', '모두'];
                        const isGeneralSchedule = !eventData.title || scheduleKeywords.includes(eventData.title);
                        const titleMatch = isGeneralSchedule || 
                                          event.summary?.toLowerCase().includes(eventData.title.toLowerCase());
                        
                        if (dateMatch && titleMatch) {
                        }
                        
                        return dateMatch && titleMatch;
                     });
                  }
                  
                  
                  if (matchingEvents.length === 0) {
                     speak('해당 일정을 찾을 수 없어요.');
                     return;
                  }
                  
                  // "전부", "모든", "모두" 키워드 체크
                  const deleteAllKeywords = ['전부', '모든', '모두', '다', '전체'];
                  const shouldDeleteAll = deleteAllKeywords.some(keyword => command.includes(keyword));
                  
                  if (matchingEvents.length > 1 && !shouldDeleteAll) {
                     speak(`${matchingEvents.length}개의 일정이 있어요. "전부 삭제"라고 하시거나 더 구체적으로 말씀해 주세요.`);
                     return;
                  }
                  
                  // 여러 개 삭제 처리
                  if (matchingEvents.length > 1 && shouldDeleteAll) {
                     let deletedCount = 0;
                     for (const event of matchingEvents) {
                        try {
                           const deleteResponse = await fetch(`${API_BASE_URL}/api/calendar/events/${event.id}`, {
                              method: 'DELETE',
                              headers: { 'x-auth-token': token },
                              signal: controller.signal
                           });
                           
                           if (deleteResponse.ok) {
                              deletedCount++;
                           }
                        } catch (error) {
                           console.error('개별 일정 삭제 오류:', error);
                        }
                     }
                     
                     clearTimeout(timeoutId);
                     speak(`${deletedCount}개의 일정을 삭제했어요!`);
                     setEventAddedKey(prevKey => prevKey + 1);
                     return;
                  }
                  
                  // 일정 삭제
                  const eventToDelete = matchingEvents[0];
                  const deleteResponse = await fetch(`${API_BASE_URL}/api/calendar/events/${eventToDelete.id}`, {
                     method: 'DELETE',
                     headers: { 'x-auth-token': token },
                     signal: controller.signal
                  });
                  
                  clearTimeout(timeoutId);
                  
                  if (!deleteResponse.ok) {
                     throw new Error('일정 삭제에 실패했습니다.');
                  }
                  
                  if (!eventData.response) {
                     speak(`${eventToDelete.summary || '일정'}을 삭제했어요!`);
                  }
                  setEventAddedKey(prevKey => prevKey + 1); // 캘린더 새로고침
                  
               } catch (error) {
                  clearTimeout(timeoutId);
                  console.error('일정 삭제 오류:', error);
                  speak(`일정 삭제에 실패했어요. ${error.message}`);
               }
            } else if (eventData.intent === 'update_event') {
               // Handle update_event if needed in the future
               speak('일정 업데이트 기능은 아직 지원하지 않습니다.');
            } else {
               speak('알 수 없는 명령입니다.');
            }
         } catch (error) {
            if (error.name === 'AbortError') {
               speak('요청 시간이 초과되었습니다. 다시 시도해주세요.');
            } else {
               console.error('Error adding event via voice:', error.message);
               speak(`음성 일정 추가에 실패했습니다. ${error.message}`);
            }
         }
      },
      [isLoggedIn, eventActions, isVoiceRecognitionEnabled],
   );

   const handleChatMessage = useCallback(async (message) => {
      if (!isLoggedIn) return { success: false, message: '로그인이 필요합니다.' };

      const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
      if (!API_KEY) {
         return { success: false, message: 'Gemini API Key가 설정되지 않았습니다.' };
      }

      try {
         const genAI = new GoogleGenerativeAI(API_KEY);
         const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
         
         const prompt = generateAIPrompt(message);

         const result = await model.generateContent(prompt);
         const response = await result.response;
         const text = response.text();
         console.log('채팅 응답 텍스트:', text);
         const chatResponse = parseAIResponse(text);
         console.log('파싱된 데이터:', chatResponse);
         
         // 잘못된 JSON 형식 감지 및 수정
         if (!chatResponse.intent && (chatResponse.date || chatResponse.deleted)) {
            console.log('잘못된 JSON 형식 감지, 수정 시도');
            return { success: false, message: 'AI 응답 형식이 올바르지 않습니다. 다시 시도해주세요.' };
         }
         
         // 실제 일정 처리 로직 추가
         if (chatResponse.intent === 'add_event' && chatResponse.startDateTime) {
            console.log('[채팅] 일정 추가 처리:', chatResponse);
            
            // 기본값 설정
            if (!chatResponse.title) chatResponse.title = '약속';
            if (!chatResponse.endDateTime && chatResponse.startDateTime) {
               try {
                  const start = new Date(chatResponse.startDateTime);
                  if (isNaN(start.getTime())) {
                     throw new Error('유효하지 않은 시작 시간입니다.');
                  }
                  start.setHours(start.getHours() + 1);
                  chatResponse.endDateTime = start.toISOString();
               } catch (timeError) {
                  console.error('시간 변환 오류:', timeError);
                  throw new Error('날짜 형식이 올바르지 않습니다.');
               }
            }
            
            console.log('[채팅] 처리된 데이터:', chatResponse);
            
            // Google Calendar에 일정 추가
            const token = localStorage.getItem('token');
            const eventData = {
               title: chatResponse.title || '일정',
               description: chatResponse.description || '',
               startDateTime: chatResponse.startDateTime,
               endDateTime: chatResponse.endDateTime
            };
            const addResponse = await fetch(`${API_BASE_URL}/api/calendar/events/google`, {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json',
                  'x-auth-token': token,
               },
               body: JSON.stringify(eventData)
            });
            
            if (!addResponse.ok) {
               throw new Error('일정 추가에 실패했습니다.');
            }
            
            setEventAddedKey(prevKey => prevKey + 1); // 캘린더 새로고침
            return { 
               success: true, 
               message: `${chatResponse.title} 일정을 추가했어요!`,
               data: chatResponse 
            };
         }
         
         // 일정 삭제 처리
         else if ((chatResponse.intent === 'delete_event' || chatResponse.intent === 'delete_range') && chatResponse.startDateTime) {
            console.log('[채팅] 삭제 처리 시작:', chatResponse);
            const token = localStorage.getItem('token');
            
            // 일정 목록 가져오기 (과거 3개월 ~ 미래 1년)
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            const oneYearLater = new Date();
            oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
            
            console.log('[채팅] API 호출 시작...');
            const eventsResponse = await fetch(`${API_BASE_URL}/api/calendar/events?timeMin=${threeMonthsAgo.toISOString()}&timeMax=${oneYearLater.toISOString()}`, {
               headers: { 'x-auth-token': token }
            });
            
            console.log('[채팅] API 응답 상태:', eventsResponse.status);
            
            if (!eventsResponse.ok) {
               throw new Error('일정 목록을 가져올 수 없습니다.');
            }
            
            const events = await eventsResponse.json();
            
            let matchingEvents;
            
            if (chatResponse.intent === 'delete_range') {
               // 범위 삭제 (이번주, 다음주 등)
               const startDate = new Date(chatResponse.startDateTime);
               const endDate = new Date(chatResponse.endDateTime);
               console.log('[채팅] 삭제할 범위:', startDate.toDateString(), '~', endDate.toDateString());
               
               matchingEvents = events.filter(event => {
                  const eventDate = new Date(event.start.dateTime || event.start.date);
                  const inRange = eventDate >= startDate && eventDate <= endDate;
                  
                  // 제목 매칭 - 모든 일정 관련 키워드 포함
                  const scheduleKeywords = ['일정', '약속', '미팅', '회의', '모임', '전체', '전부', '모든', '모두'];
                  const isGeneralSchedule = !chatResponse.title || scheduleKeywords.includes(chatResponse.title);
                  const titleMatch = isGeneralSchedule || 
                                    event.summary?.toLowerCase().includes(chatResponse.title.toLowerCase());
                  
                  
                  return inRange && titleMatch;
               });
            } else {
               // 단일 날짜 삭제 - 더 유연하게
               const targetDate = new Date(chatResponse.startDateTime);
               console.log('[채팅] 삭제 대상 날짜:', targetDate.toDateString(), '검색 키워드:', chatResponse.title);
               
               matchingEvents = events.filter(event => {
                  const eventDate = new Date(event.start.dateTime || event.start.date);
                  
                  // 날짜 매칭 - 같은 날이면 OK
                  const isSameDay = eventDate.toDateString() === targetDate.toDateString();
                  
                  // 제목 매칭 - 더 유연하게
                  const scheduleKeywords = ['일정', '약속', '미팅', '회의', '모임', '전체', '전부', '모든', '모두'];
                  const isGeneralSchedule = !chatResponse.title || scheduleKeywords.includes(chatResponse.title);
                  
                  let titleMatch = false;
                  if (isGeneralSchedule) {
                     // 일반 키워드면 모든 일정 매칭
                     titleMatch = true;
                  } else if (event.summary) {
                     // 구체적 제목이면 포함 여부 검사
                     titleMatch = event.summary.toLowerCase().includes(chatResponse.title.toLowerCase());
                  }
                  
                  const isMatch = isSameDay && titleMatch;
                  
                  if (isMatch) {
                     console.log('[채팅] ✅ 매칭 성공:', {
                        날짜: eventDate.toDateString(),
                        제목: event.summary,
                        이벤트ID: event.id
                     });
                  }
                  
                  return isMatch;
               });
            }
            
            console.log(`[채팅] 총 ${matchingEvents.length}개 일정 매칭됨`);
            
            if (matchingEvents.length === 0) {
               return { success: false, message: '해당 일정을 찾을 수 없어요.' };
            }
            
            // "전부", "모든", "모두" 키워드 체크
            const deleteAllKeywords = ['전부', '모든', '모두', '다', '전체'];
            const shouldDeleteAll = deleteAllKeywords.some(keyword => message.includes(keyword));
            
            if (matchingEvents.length > 1 && !shouldDeleteAll) {
               return { success: false, message: `${matchingEvents.length}개의 일정이 있어요. "전부 삭제"라고 하시거나 더 구체적으로 말씀해 주세요.` };
            }
            
            // 여러 개 삭제 처리
            if (matchingEvents.length > 1 && shouldDeleteAll) {
               let deletedCount = 0;
               for (const event of matchingEvents) {
                  try {
                     const deleteResponse = await fetch(`${API_BASE_URL}/api/calendar/events/${event.id}`, {
                        method: 'DELETE',
                        headers: { 'x-auth-token': token }
                     });
                     
                     if (deleteResponse.ok) {
                        deletedCount++;
                     }
                  } catch (error) {
                     console.error('[채팅] 개별 일정 삭제 오류:', error);
                  }
               }
               
               setEventAddedKey(prevKey => prevKey + 1);
               return { 
                  success: true, 
                  message: `${deletedCount}개의 일정을 삭제했어요!`,
                  data: chatResponse 
               };
            }
            
            // 일정 삭제
            const eventToDelete = matchingEvents[0];
            const deleteResponse = await fetch(`${API_BASE_URL}/api/calendar/events/${eventToDelete.id}`, {
               method: 'DELETE',
               headers: { 'x-auth-token': token }
            });
            
            if (!deleteResponse.ok) {
               throw new Error('일정 삭제에 실패했습니다.');
            }
            
            setEventAddedKey(prevKey => prevKey + 1); // 캘린더 새로고침
            return { 
               success: true, 
               message: `${eventToDelete.summary || '일정'}을 삭제했어요!`,
               data: chatResponse 
            };
         }
         
         // AI가 이해하지 못한 경우
         else if (chatResponse.intent === 'clarification') {
            return { success: true, message: chatResponse.response };
         }
         
         return { 
            success: true, 
            message: chatResponse.response || '처리했어요!',
            data: chatResponse 
         };
      } catch (error) {
         console.error('Chat error:', error);
         console.error('Error details:', error.message, error.stack);
         
         // JSON 파싱 오류인지 확인
         if (error instanceof SyntaxError) {
            return { success: false, message: 'AI 응답 형식 오류입니다. 다시 시도해주세요.' };
         }
         
         return { success: false, message: `오류: ${error.message}` };
      }
   }, [isLoggedIn]);

   useEffect(() => {
      if (!isLoggedIn || !areEventActionsReady || !isVoiceRecognitionEnabled) {
         if (recognitionRef.current) {
            recognitionRef.current.stop();
         }
         return;
      }

      // Initialize recognitionRef.current only once
      if (!recognitionRef.current) {
         recognitionRef.current = new window.webkitSpeechRecognition();
         recognitionRef.current.continuous = true;
         recognitionRef.current.interimResults = false;
         recognitionRef.current.lang = 'ko-KR';

         recognitionRef.current.onstart = () => {
            setIsListening(true);
            console.log('Global voice recognition started.');
         };

         recognitionRef.current.onresult = event => {
            const transcript = event.results[event.results.length - 1][0].transcript;
            console.log('Voice transcript:', transcript);
            parseAndAddVoiceEvent(transcript);
         };
      }
      
      // We need a flag to prevent restart on manual stop
      let manualStop = false;

      const recognition = recognitionRef.current;

      recognition.onend = () => {
         setIsListening(false);
         console.log('Global voice recognition ended.');
         if (!manualStop) {
            console.log('Restarting recognition...');
            try {
               recognition.start();
            } catch(e) {
               console.error("Recognition restart failed", e);
            }
         }
      };

      recognition.onerror = event => {
         console.error('음성 인식 오류:', event.error);
         if (event.error === 'no-speech') {
            // This is not a fatal error, onend will be called and we can restart.
         } else {
            // For other errors, we might want to stop completely.
            manualStop = true;
         }
      };

      try {
         recognition.start();
      } catch(e) {
         console.log("Recognition already started.");
      }

      return () => {
         manualStop = true;
         recognition.stop();
      };
   }, [isLoggedIn, areEventActionsReady, isVoiceRecognitionEnabled, parseAndAddVoiceEvent]);

   const handleLoginSuccess = useCallback((userData, loginType) => {
      setIsLoggedIn(true);
      setUser(userData);
      setLoginMethod(loginType); // Store the login type
   }, []);

   const handleLogout = useCallback(() => {
      localStorage.removeItem('token');
      setIsLoggedIn(false);
      setUser(null);
   }, []);

   const schedulingSystemProps = useMemo(() => ({
      isLoggedIn,
      user,
      handleLogout,
      isListening,
      eventAddedKey,
      speak,
      setEventActions,
      setAreEventActionsReady,
      isVoiceRecognitionEnabled,
      setIsVoiceRecognitionEnabled,
      loginMethod // Pass loginMethod
   }), [isLoggedIn, user, handleLogout, isListening, eventAddedKey, isVoiceRecognitionEnabled, loginMethod]);

   return (
      <Router>
         <Routes>
            <Route
               path="/auth"
               element={isLoggedIn ? <Navigate to="/" /> : <AuthScreen onLoginSuccess={handleLoginSuccess} />}
            />
            <Route
               path="/"
               element={
                  isLoggedIn ? (
                     <SchedulingSystem {...schedulingSystemProps} />
                  ) : (
                     <Navigate to="/auth" />
                  )
               }
            />
         </Routes>
         {isLoggedIn && <ChatBox onSendMessage={handleChatMessage} speak={speak} />}
      </Router>
   );
}

export default App;
