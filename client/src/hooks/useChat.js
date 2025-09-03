import { useCallback } from 'react';
import { generateAIPrompt, parseAIResponse } from '../utils';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export const useChat = (isLoggedIn, setEventAddedKey) => {
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
   }, [isLoggedIn, setEventAddedKey]);

   return { handleChatMessage };
};