import { useCallback } from 'react';
import { generateAIPrompt, parseAIResponse } from '../utils';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export const useChat = (isLoggedIn, setEventAddedKey, eventActions) => {
   const handleChatMessage = useCallback(async (message, context = {}) => {
      if (!isLoggedIn) return { success: false, message: '로그인이 필요합니다.' };

      const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
      if (!API_KEY || API_KEY.trim().length === 0) {
         return { success: false, message: 'Gemini API Key가 설정되지 않았습니다.' };
      }

      // API 키 형식 기본 검증
      if (API_KEY.length < 30) {
         return { success: false, message: 'AI 서비스 설정에 문제가 있습니다. 관리자에게 문의해주세요.' };
      }

      try {
         const genAI = new GoogleGenerativeAI(API_KEY);
         const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
         
         const prompt = generateAIPrompt(message, context);

         const startTime = performance.now();
         const result = await Promise.race([
            model.generateContent(prompt),
            new Promise((_, reject) =>
               setTimeout(() => reject(new Error('응답 시간이 너무 길어 요청을 취소했습니다. 다시 시도해주세요.')), 5000)
            )
         ]);
         const endTime = performance.now();
         console.log(`AI 응답 시간: ${(endTime - startTime).toFixed(2)}ms`);

         if (result instanceof Error) {
            throw result;
         }
         const response = await result.response;
         const text = response.text();
         const chatResponse = parseAIResponse(text);
         
         // 잘못된 JSON 형식 감지 및 수정
         if (!chatResponse.intent && (chatResponse.date || chatResponse.deleted)) {
            return { success: false, message: 'AI 응답 형식이 올바르지 않습니다. 다시 시도해주세요.' };
         }
         
         // 실제 일정 처리 로직 추가
         if (chatResponse.intent === 'add_event' && chatResponse.startDateTime) {
            // Check if eventActions are available
            if (!eventActions || !eventActions.addEvent) {
               return { success: false, message: '일정 추가 기능이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.' };
            }

            // 일정 추가 처리 시작

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

            const token = localStorage.getItem('token');
            if (!token) {
              return { success: false, message: 'Google 계정 인증이 필요합니다.' };
            }

            const eventData = {
               title: chatResponse.title || '일정',
               description: chatResponse.description || '',
               startDateTime: chatResponse.startDateTime,
               endDateTime: chatResponse.endDateTime
            };

            // 탭별로 다른 API 엔드포인트 호출
            let apiEndpoint;
            let requestBody = eventData;

            switch (context.tabType) {
               case 'google':
                  // Google 캘린더 탭
                  apiEndpoint = `${API_BASE_URL}/api/calendar/events/google`;
                  break;
               case 'local':
                  if (context.context === 'profile') {
                     // 내 프로필 탭 - 현재 스케줄 가져와서 새 예외 추가
                     const currentScheduleResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
                        headers: { 'x-auth-token': token }
                     });

                     if (!currentScheduleResponse.ok) {
                        throw new Error('현재 스케줄을 가져올 수 없습니다.');
                     }

                     const currentSchedule = await currentScheduleResponse.json();

                     // 새로운 예외 일정 추가
                     const newException = {
                        title: eventData.title,
                        startTime: eventData.startDateTime.split('T')[1].substring(0, 5),
                        endTime: eventData.endDateTime.split('T')[1].substring(0, 5),
                        specificDate: eventData.startDateTime.split('T')[0],
                        isHoliday: false,
                        isAllDay: false,
                        priority: 3
                     };

                     console.log('🔍 [PROFILE] 기존 스케줄:', currentSchedule);
                     console.log('🔍 [PROFILE] 프로필 예외 일정 추가:', newException);

                     apiEndpoint = `${API_BASE_URL}/api/users/profile/schedule`;
                     requestBody = {
                        defaultSchedule: currentSchedule.defaultSchedule,
                        scheduleExceptions: [...(currentSchedule.scheduleExceptions || []), newException],
                        personalTimes: currentSchedule.personalTimes
                     };

                     console.log('🔍 [PROFILE] 최종 요청 데이터:', requestBody);
                  } else {
                     // 나의 일정 탭 - 일반 로컬 DB 저장
                     apiEndpoint = `${API_BASE_URL}/api/events`;
                     requestBody = {
                        title: eventData.title,
                        date: eventData.startDateTime.split('T')[0],
                        time: eventData.startDateTime.split('T')[1].substring(0, 5),
                        participants: [],
                        priority: 3,
                        description: eventData.description
                     };
                  }
                  break;
               default:
                  // 기본값은 Google 캘린더
                  apiEndpoint = `${API_BASE_URL}/api/calendar/events/google`;
            }

            const httpMethod = (context.context === 'profile' && context.tabType === 'local') ? 'PUT' : 'POST';

            console.log('🔍 [PROFILE] API 요청:', {
               endpoint: apiEndpoint,
               method: httpMethod,
               body: requestBody
            });

            const response = await fetch(apiEndpoint, {
              method: httpMethod,
              headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token,
              },
              body: JSON.stringify(requestBody),
            });

            console.log('🔍 [PROFILE] API 응답 상태:', response.status);

            if (!response.ok) {
              const errorData = await response.json();
              console.log('🔍 [PROFILE] API 오류 응답:', errorData);

              if (context.tabType === 'google') {
                 throw new Error(errorData.msg || 'Google 캘린더에 일정을 추가하지 못했습니다.');
              } else {
                 throw new Error(errorData.msg || '로컬 일정을 추가하지 못했습니다.');
              }
            }

            const responseData = await response.json();
            console.log('🔍 [PROFILE] API 성공 응답:', responseData);

            // 로컬 일정의 경우 eventActions.addEvent도 호출하여 즉시 UI에 반영 (나의 일정 탭만)
            // setEventAddedKey가 fetchEvents를 호출하므로 eventActions.addEvent는 제거

            // 나의 일정 탭에서는 fetchEvents만 호출 (중복 방지)

            // 로컬 일정의 경우 즉시 캘린더 새로고침
            if (context.tabType === 'local') {
              if (context.context === 'profile') {
                // 프로필 탭의 경우 calendarUpdate 이벤트 발생
                window.dispatchEvent(new Event('calendarUpdate'));
              }
              setEventAddedKey(prevKey => prevKey + 1);
            } else {
              // Google 캘린더의 경우에만 약간의 지연
              setTimeout(() => {
                setEventAddedKey(prevKey => prevKey + 1);
              }, 1000);
            }

            return {
               success: true,
               message: `${chatResponse.title} 일정을 추가했어요!`,
               data: chatResponse
            };
         }
         
         // 일정 삭제 처리
         else if ((chatResponse.intent === 'delete_event' || chatResponse.intent === 'delete_range') && chatResponse.startDateTime) {
            // 삭제 처리 시작
            const token = localStorage.getItem('token');
            
            // 일정 목록 가져오기 (과거 3개월 ~ 미래 1년)
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            const oneYearLater = new Date();
            oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
            
            // 탭별로 다른 일정 목록 가져오기 API 호출
            let eventsResponse;
            if (context.tabType === 'local') {
               // 로컬 일정 목록 가져오기
               eventsResponse = await fetch(`${API_BASE_URL}/api/events`, {
                  headers: { 'x-auth-token': token }
               });
            } else {
               // 구글 캘린더 일정 목록 가져오기
               eventsResponse = await fetch(`${API_BASE_URL}/api/calendar/events?timeMin=${threeMonthsAgo.toISOString()}&timeMax=${oneYearLater.toISOString()}`, {
                  headers: { 'x-auth-token': token }
               });
            }
            
            if (!eventsResponse.ok) {
               throw new Error('일정 목록을 가져올 수 없습니다.');
            }
            
            const eventsData = await eventsResponse.json();

            // 탭별로 다른 이벤트 구조 처리
            let events;
            if (context.tabType === 'local') {
               // 로컬 이벤트는 { events: [...] } 형태
               events = eventsData.events || eventsData;
            } else {
               // 구글 캘린더 이벤트는 배열 형태
               events = eventsData;
            }

            // events 배열 유효성 검사
            if (!events || !Array.isArray(events)) {
               throw new Error('일정 목록 형식이 올바르지 않습니다.');
            }
            
            let matchingEvents;
            
            if (chatResponse.intent === 'delete_range') {
               // 범위 삭제 (이번주, 다음주 등)
               const startDate = new Date(chatResponse.startDateTime);
               const endDate = new Date(chatResponse.endDateTime);
               // 삭제할 범위 설정 완료
               
               matchingEvents = events.filter(event => {
                  if (!event) return false;

                  let eventDate;
                  let eventTitle;

                  if (context.tabType === 'local') {
                     // 로컬 이벤트 구조: { startTime, endTime, title }
                     if (!event.startTime) return false;
                     eventDate = new Date(event.startTime);
                     eventTitle = event.title;
                  } else {
                     // 구글 이벤트 구조: { start: { dateTime || date }, summary }
                     if (!event.start) return false;
                     eventDate = new Date(event.start.dateTime || event.start.date);
                     eventTitle = event.summary;
                  }

                  const inRange = eventDate >= startDate && eventDate <= endDate;


                  // 제목 매칭 - 모든 일정 관련 키워드 포함
                  const scheduleKeywords = ['일정', '약속', '미팅', '회의', '모임', '전체', '전부', '모든', '모두'];
                  const isGeneralSchedule = !chatResponse.title || scheduleKeywords.includes(chatResponse.title);
                  const titleMatch = isGeneralSchedule ||
                                    eventTitle?.toLowerCase().includes(chatResponse.title.toLowerCase());

                  return inRange && titleMatch;
               });
            } else {
               // 단일 날짜 삭제 - 더 유연하게
               const targetDate = new Date(chatResponse.startDateTime);
               // 삭제 대상 날짜 및 검색 키워드 설정 완료
               
               matchingEvents = events.filter(event => {
                  if (!event) return false;

                  let eventDate;
                  let eventTitle;

                  if (context.tabType === 'local') {
                     // 로컬 이벤트 구조: { startTime, endTime, title }
                     if (!event.startTime) return false;
                     eventDate = new Date(event.startTime);
                     eventTitle = event.title;
                  } else {
                     // 구글 이벤트 구조: { start: { dateTime || date }, summary }
                     if (!event.start) return false;
                     eventDate = new Date(event.start.dateTime || event.start.date);
                     eventTitle = event.summary;
                  }

                  // 날짜 매칭 - 같은 날이면 OK
                  const isSameDay = eventDate.toDateString() === targetDate.toDateString();

                  // 제목 매칭 - 더 유연하게
                  const scheduleKeywords = ['일정', '약속', '미팅', '회의', '모임', '전체', '전부', '모든', '모두'];
                  const isGeneralSchedule = !chatResponse.title || scheduleKeywords.includes(chatResponse.title);

                  let titleMatch = false;
                  if (isGeneralSchedule) {
                     // 일반 키워드면 모든 일정 매칭
                     titleMatch = true;
                  } else if (eventTitle) {
                     // 구체적 제목이면 포함 여부 검사
                     titleMatch = eventTitle.toLowerCase().includes(chatResponse.title.toLowerCase());
                  }

                  const isMatch = isSameDay && titleMatch;

                  return isMatch;
               });
            }


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
                     let deleteResponse;
                     if (context.tabType === 'local') {
                        // 로컬 이벤트 삭제
                        deleteResponse = await fetch(`${API_BASE_URL}/api/events/${event._id || event.id}`, {
                           method: 'DELETE',
                           headers: { 'x-auth-token': token }
                        });
                     } else {
                        // 구글 캘린더 이벤트 삭제
                        deleteResponse = await fetch(`${API_BASE_URL}/api/calendar/events/${event.id}`, {
                           method: 'DELETE',
                           headers: { 'x-auth-token': token }
                        });
                     }
                     
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
            let deleteResponse;
            if (context.tabType === 'local') {
               // 로컬 이벤트 삭제
               deleteResponse = await fetch(`${API_BASE_URL}/api/events/${eventToDelete._id || eventToDelete.id}`, {
                  method: 'DELETE',
                  headers: { 'x-auth-token': token }
               });
            } else {
               // 구글 캘린더 이벤트 삭제
               deleteResponse = await fetch(`${API_BASE_URL}/api/calendar/events/${eventToDelete.id}`, {
                  method: 'DELETE',
                  headers: { 'x-auth-token': token }
               });
            }
            
            if (!deleteResponse.ok) {
               throw new Error('일정 삭제에 실패했습니다.');
            }
            
            setEventAddedKey(prevKey => prevKey + 1); // 캘린더 새로고침
            const deletedTitle = context.tabType === 'local' ? eventToDelete.title : eventToDelete.summary;
            return {
               success: true,
               message: `${deletedTitle || '일정'}을 삭제했어요!`,
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
         
         // API 키 관련 오류 체크
         if (error.message.includes('API key not valid') || 
             error.message.includes('API_KEY_INVALID') ||
             error.message.includes('invalid API key') ||
             error.message.includes('Unauthorized')) {
            return { 
               success: false, 
               message: 'AI 서비스에 문제가 있습니다. 관리자에게 문의해주세요.' 
            };
         }
         
         // JSON 파싱 오류인지 확인
         if (error instanceof SyntaxError) {
            return { success: false, message: 'AI 응답 형식 오류입니다. 다시 시도해주세요.' };
         }
         
         return { success: false, message: `오류: ${error.message}` };
      }
   }, [isLoggedIn, setEventAddedKey, eventActions]);

   return { handleChatMessage };
};