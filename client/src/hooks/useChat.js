/**
 * ============================================================================
 * useChat.js - 채팅 메시지 처리 훅
 * ============================================================================
 * 
 * 🔴 중요: 일정맞추기(Coordination) 탭의 시간 변경 기능이 여기에 구현되어 있음!
 * 
 * [일정맞추기 탭 채팅 기능]
 * - 조건: context.context === 'coordination' && context.roomId
 * - 기능: 조원이 채팅으로 배정 시간 변경 가능
 * - 예시: "수요일로 바꿔줘", "월요일 9시로 바꿔줘"
 * - API: /api/coordination/rooms/:roomId/parse-exchange-request
 *        /api/coordination/rooms/:roomId/smart-exchange
 * 
 * [다른 탭 기능]
 * - profile, events, googleCalendar: 일반 일정 추가/수정/삭제
 * 
 * 관련 파일:
 * - UI: client/src/components/chat/ChatBox.js
 * - 백엔드: server/controllers/coordinationExchangeController.js
 * ============================================================================
 */

import { useCallback } from 'react';
import { generateAIPrompt, parseAIResponse, checkScheduleConflict, findAvailableTimeSlots } from '../utils';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getViewMode, getCurrentWeekStartDate } from '../utils/coordinationModeUtils';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export const useChat = (isLoggedIn, setEventAddedKey, eventActions) => {
   const handleChatMessage = useCallback(async (message, context = {}) => {
      // 🔧 Coordination room time change request
      if (context.context === 'coordination' && context.roomId) {
         const token = localStorage.getItem('token');
         if (!token) return { success: false, message: '인증 토큰이 없습니다.' };

         try {
            // Parse the message using backend Gemini API
            const parseResponse = await fetch(`${API_BASE_URL}/api/coordination/rooms/${context.roomId}/parse-exchange-request`, {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json',
                  'x-auth-token': token
               },
               body: JSON.stringify({
                  message,
                  recentMessages: context.recentMessages || []
               })
            });

            if (!parseResponse.ok) {
               const errorData = await parseResponse.json();
               return { success: false, message: errorData.error || '요청을 이해하지 못했습니다.' };
            }

            const { parsed } = await parseResponse.json();

            console.log('🔍 [useChat] Parsed response:', parsed);
            console.log('🔍 [useChat] Context pendingRequest:', context.pendingRequest);

            // Handle different message types
            if (parsed.type === 'time_change' || parsed.type === 'date_change') {
               // Execute immediately without confirmation
               console.log(`✅ [useChat] ${parsed.type} detected, executing immediately`);
               console.log('🚀 [useChat] Executing request:', parsed);

               // Call smart-exchange API directly with viewMode info
               const viewMode = getViewMode();
               const currentWeekStartDate = getCurrentWeekStartDate();

               const exchangeResponse = await fetch(`${API_BASE_URL}/api/coordination/rooms/${context.roomId}/smart-exchange`, {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                     'x-auth-token': token
                  },
                  body: JSON.stringify({
                     ...parsed,
                     viewMode,
                     currentWeekStartDate: currentWeekStartDate.toISOString()
                  })
               });

               if (!exchangeResponse.ok) {
                  const errorData = await exchangeResponse.json();
                  return { success: false, message: errorData.message || '시간 변경에 실패했습니다.' };
               }

               const result = await exchangeResponse.json();

               // Trigger calendar update if swap was successful
               if (result.success && result.immediateSwap) {
                  window.dispatchEvent(new CustomEvent('coordinationUpdate', {
                     detail: { type: 'timeSwap', roomId: context.roomId }
                  }));
               }

               return {
                  success: true,
                  message: result.message,
                  immediateSwap: result.immediateSwap
               };
            } else if (parsed.type === 'confirm') {
               // Legacy confirm handler (no longer used)
               return { success: true, message: '네, 알겠습니다! 👍' };
            } else if (parsed.type === 'reject') {
               // Legacy reject handler (no longer used)
               return { success: true, message: '알겠습니다.' };
            }

            // Fallback for unknown types
            return { success: true, message: '요청을 처리했습니다.' };

         } catch (error) {
            return { success: false, message: `오류가 발생했습니다: ${error.message}` };
         }
      }

      // Direct deletion intent, bypassing AI
      if (typeof message === 'object' && message.intent === 'delete_specific_event' && message.eventId) {
         const token = localStorage.getItem('token');
         if (!token) return { success: false, message: '인증 토큰이 없습니다.' };

         try {
            // '나의 일정' 탭의 경우 /api/events 엔드포인트를 사용하여 직접 삭제
            if (context.context === 'events') {
                const eventIdToDelete = message.eventId;
                const response = await fetch(`${API_BASE_URL}/api/events/${eventIdToDelete}`, {
                    method: 'DELETE',
                    headers: { 'x-auth-token': token },
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.msg || '일정 삭제에 실패했습니다.');
                }

                // 성공적으로 삭제되었음을 UI에 알림
                window.dispatchEvent(new CustomEvent('calendarUpdate', {
                    detail: { type: 'delete', eventId: eventIdToDelete, context: 'events' }
                }));
                setEventAddedKey(prevKey => prevKey + 1);

                return {
                    success: true,
                    message: `일정을 삭제했어요!`,
                };
            } else { // 기존 '내 프로필' 탭 로직
                const scheduleResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
                   headers: { 'x-auth-token': token }
                });

                if (!scheduleResponse.ok) {
                   throw new Error('스케줄 정보를 가져오지 못했습니다.');
                }

                const scheduleData = await scheduleResponse.json();
                const eventIdToDelete = message.eventId;
                let eventTitle = '일정';
                let foundAndSpliced = false;
                // personalTimes에서 찾기
                if (scheduleData.personalTimes && scheduleData.personalTimes.length > 0) {
                   const findIndex = scheduleData.personalTimes.findIndex(pt =>
                       String(pt.id) === String(eventIdToDelete) || String(pt._id) === String(eventIdToDelete)
                   );

                   if (findIndex !== -1) {
                       eventTitle = scheduleData.personalTimes[findIndex].title;
                       scheduleData.personalTimes.splice(findIndex, 1);
                       foundAndSpliced = true;
                   }
                }

                // scheduleExceptions에서 찾기
                if (!foundAndSpliced && scheduleData.scheduleExceptions && scheduleData.scheduleExceptions.length > 0) {
                   const findIndex = scheduleData.scheduleExceptions.findIndex(ex =>
                       String(ex.id) === String(eventIdToDelete) || String(ex._id) === String(eventIdToDelete)
                   );

                   if (findIndex !== -1) {
                       eventTitle = scheduleData.scheduleExceptions[findIndex].title;
                       scheduleData.scheduleExceptions.splice(findIndex, 1);
                       foundAndSpliced = true;
                   }
                }

                if (!foundAndSpliced) {
                   return { success: false, message: '삭제할 일정을 찾지 못했습니다.' };
                }

                // 유효한 scheduleExceptions만 필터링
                const cleanedExceptions = (scheduleData.scheduleExceptions || [])
                   .filter(exc => exc.startTime && exc.endTime && exc.specificDate)
                   .map(exc => ({
                      specificDate: exc.specificDate,
                      startTime: exc.startTime,
                      endTime: exc.endTime,
                      title: exc.title || '',
                      description: exc.description || ''
                   }));

                const updateResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
                   method: 'PUT',
                   headers: {
                      'Content-Type': 'application/json',
                      'x-auth-token': token,
                   },
                   body: JSON.stringify({
                      scheduleExceptions: cleanedExceptions,
                      personalTimes: scheduleData.personalTimes || []
                   }),
                });

                if (!updateResponse.ok) {
                   const errorData = await updateResponse.json();
                   throw new Error(errorData.msg || '일정 삭제에 실패했습니다.');
                }

                window.dispatchEvent(new CustomEvent('calendarUpdate', {
                   detail: { type: 'delete', eventId: eventIdToDelete, context: 'profile' }
                }));
                setEventAddedKey(prevKey => prevKey + 1);

                return {
                   success: true,
                   message: `${eventTitle} 일정을 삭제했어요!`,
                };
            }
         } catch (error) {
            return { success: false, message: `삭제 중 오류 발생: ${error.message}` };
         }
      }


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
         const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
         
         const prompt = generateAIPrompt(message, context);

         const startTime = performance.now();
         const result = await Promise.race([
            model.generateContent(prompt),
            new Promise((_, reject) =>
               setTimeout(() => reject(new Error('응답 시간이 너무 길어 요청을 취소했습니다. 다시 시도해주세요.')), 5000)
            )
         ]);
         const endTime = performance.now();

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

         // 🔁 반복 일정 처리
         if (chatResponse.intent === 'add_recurring_event' && chatResponse.dates && chatResponse.dates.length > 0) {
            if (!eventActions || !eventActions.addEvent) {
               return { success: false, message: '일정 추가 기능이 아직 준비되지 않았습니다.' };
            }

            const token = localStorage.getItem('token');
            if (!token) {
               return { success: false, message: 'Google 계정 인증이 필요합니다.' };
            }

            try {

               let successCount = 0;
               let failCount = 0;
               const errors = [];

               // 프로필 탭의 경우 한 번에 모든 날짜 추가
               if (context.context === 'profile' && context.tabType === 'local') {
                  const currentScheduleResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
                     headers: { 'x-auth-token': token }
                  });
                  const currentSchedule = await currentScheduleResponse.json();

                  const conflictDates = [];
                  const newPersonalTimes = [];
                  const [startHour, startMin] = chatResponse.startTime.split(':');
                  const [endHour, endMin] = chatResponse.endTime.split(':');
                  const durationMinutes = (parseInt(endHour) * 60 + parseInt(endMin)) - (parseInt(startHour) * 60 + parseInt(startMin));
                  const requestedTimeHour = parseInt(startHour) + parseInt(startMin) / 60;

                  // 각 날짜별로 충돌 체크
                  for (const date of chatResponse.dates) {
                     const startDateTime = new Date(`${date}T${chatResponse.startTime}:00+09:00`);
                     const endDateTime = new Date(`${date}T${chatResponse.endTime}:00+09:00`);

                     // 해당 날짜의 기존 일정만 수집 (scheduleExceptions + personalTimes)
                     const existingEvents = [
                        ...(currentSchedule.scheduleExceptions || [])
                           .filter(exc => exc.specificDate === date)
                           .map(exc => ({
                              startTime: exc.startTime,
                              endTime: exc.endTime,
                              title: exc.title
                           })),
                        ...(currentSchedule.personalTimes || [])
                           .filter(pt => pt.specificDate === date)
                           .map(pt => {
                              const ptStartDateTime = new Date(`${pt.specificDate}T${pt.startTime}:00+09:00`);
                              const ptEndDateTime = new Date(`${pt.specificDate}T${pt.endTime}:00+09:00`);
                              return {
                                 startTime: ptStartDateTime.toISOString(),
                                 endTime: ptEndDateTime.toISOString(),
                                 title: pt.title
                              };
                           })
                     ];

                     // 1단계: 정확히 동일한 일정이 이미 있는지 체크 (중복 방지)
                     const exactDuplicate = existingEvents.find(evt => {
                        const evtStart = new Date(evt.startTime);
                        const evtEnd = new Date(evt.endTime);
                        return evtStart.getTime() === startDateTime.getTime() &&
                               evtEnd.getTime() === endDateTime.getTime() &&
                               evt.title === (chatResponse.title || '일정');
                     });

                     if (exactDuplicate) {
                        conflictDates.push({
                           date,
                           conflictWith: '동일한 일정이 이미 존재합니다',
                           alternatives: []
                        });
                        failCount++;
                        continue;
                     }

                     // 2단계: 시간 충돌 체크
                     const { hasConflict, conflicts } = checkScheduleConflict(
                        startDateTime.toISOString(),
                        endDateTime.toISOString(),
                        existingEvents
                     );

                     if (hasConflict) {
                        // 충돌 발생 - 대안 시간 찾기
                        const availableSlots = findAvailableTimeSlots(date, existingEvents, durationMinutes, requestedTimeHour);

                        conflictDates.push({
                           date,
                           conflictWith: conflicts[0]?.title || '기존 일정',
                           alternatives: availableSlots.slice(0, 2)
                        });
                        failCount++;
                     } else {
                        // 충돌 없으면 personalTimes에 추가 (빨간색)
                        const newEvent = {
                           id: Date.now(), // Number 타입으로 변경
                           title: chatResponse.title || '일정',
                           type: 'event',
                           startTime: chatResponse.startTime,
                           endTime: chatResponse.endTime,
                           days: [],
                           isRecurring: false,
                           specificDate: date,
                           color: '#ef4444' // 빨간색
                        };
                        newPersonalTimes.push(newEvent);

                        // existingEvents에도 추가하여 같은 요청 내에서 중복 방지
                        existingEvents.push({
                           startTime: startDateTime.toISOString(),
                           endTime: endDateTime.toISOString(),
                           title: newEvent.title
                        });

                        successCount++;
                     }
                  }

                  // 기존 personalTimes에 id가 없는 경우 생성
                  const existingPersonalTimes = (currentSchedule.personalTimes || []).map((pt, idx) => {
                     if (!pt.id) {
                        return { ...pt, id: Date.now() + idx }; // Number 타입
                     }
                     return pt;
                  });

                  const allPersonalTimes = [
                     ...existingPersonalTimes,
                     ...newPersonalTimes
                  ];

                  const response = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
                     method: 'PUT',
                     headers: {
                        'Content-Type': 'application/json',
                        'x-auth-token': token
                     },
                     body: JSON.stringify({
                        defaultSchedule: currentSchedule.defaultSchedule || [],
                        scheduleExceptions: currentSchedule.scheduleExceptions || [],
                        personalTimes: allPersonalTimes
                     })
                  });

                  if (response.ok && newPersonalTimes.length > 0) {
                     const responseData = await response.json();
                     window.dispatchEvent(new CustomEvent('calendarUpdate', {
                        detail: {
                           type: 'add',
                           data: responseData,
                           context: 'profile',
                           isRecurring: true,
                           datesCount: newPersonalTimes.length
                        }
                     }));
                  } else if (!response.ok) {
                     const errorData = await response.json().catch(() => ({}));
                     errors.push(`프로필 스케줄 업데이트 실패: ${errorData.msg || response.statusText}`);
                  }

                  if (conflictDates.length > 0) {
                     let conflictMessage = `\n\n⚠️ ${conflictDates.length}일은 ${chatResponse.startTime}에 이미 일정이 있어서 건너뛰었어요:\n`;

                     conflictDates.forEach(conflict => {
                        conflictMessage += `\n📅 ${conflict.date} - "${conflict.conflictWith}"과(와) 겹침`;
                        if (conflict.alternatives && conflict.alternatives.length > 0) {
                           conflictMessage += `\n   추천 시간: `;
                           conflict.alternatives.forEach((slot, idx) => {
                              conflictMessage += `${slot.start}-${slot.end}`;
                              if (idx < conflict.alternatives.length - 1) conflictMessage += ', ';
                           });
                        }
                     });

                     return {
                        success: successCount > 0,
                        message: successCount > 0
                           ? `${chatResponse.title || '일정'}을 ${successCount}일간 추가했어요!${conflictMessage}`
                           : `모든 날짜에서 충돌이 발생했습니다.${conflictMessage}`,
                        data: chatResponse,
                        suggestedTimes: conflictDates.filter(c => c.alternatives && c.alternatives.length > 0).flatMap(alt =>
                           alt.alternatives.map(slot => ({
                              date: alt.date,
                              start: slot.start,
                              end: slot.end
                           }))
                        )
                     };
                  }
               } else {
                  // Google 캘린더와 나의 일정 탭은 각 날짜별로 개별 추가
                  const conflictDates = [];

                  for (const date of chatResponse.dates) {
                     try {
                        const events = context.currentEvents || [];
                        const startDateTime = `${date}T${chatResponse.startTime}:00+09:00`;
                        const endDateTime = `${date}T${chatResponse.endTime}:00+09:00`;
                        const { hasConflict, conflicts } = checkScheduleConflict(startDateTime, endDateTime, events);

                        if (hasConflict) {
                           conflictDates.push({
                              date,
                              conflictWith: conflicts[0]?.summary || conflicts[0]?.title || '기존 일정'
                           });
                           failCount++;
                           continue;
                        }

                        let eventData;
                        let apiEndpoint;

                        if (context.tabType === 'google') {
                           eventData = {
                              title: chatResponse.title || '일정',
                              description: chatResponse.description || '',
                              startTime: startDateTime,
                              endTime: endDateTime
                           };
                           apiEndpoint = `${API_BASE_URL}/api/calendar/events/google`;
                        } else {
                           const [startHour, startMin] = chatResponse.startTime.split(':');
                           const [endHour, endMin] = chatResponse.endTime.split(':');
                           const durationMinutes = (parseInt(endHour) * 60 + parseInt(endMin)) - (parseInt(startHour) * 60 + parseInt(startMin));
                           eventData = {
                              title: chatResponse.title || '일정',
                              description: chatResponse.description || '',
                              date: date,
                              time: chatResponse.startTime,
                              duration: durationMinutes
                           };
                           apiEndpoint = `${API_BASE_URL}/api/events`;
                        }

                        const response = await fetch(apiEndpoint, {
                           method: 'POST',
                           headers: {
                              'Content-Type': 'application/json',
                              'x-auth-token': token
                           },
                           body: JSON.stringify(eventData)
                        });

                        if (response.ok) {
                           successCount++;
                        } else {
                           failCount++;
                           errors.push(`${date}: ${response.statusText}`);
                        }
                     } catch (dateError) {
                        failCount++;
                        errors.push(`${date}: ${dateError.message}`);
                     }
                  }

                  if (conflictDates.length > 0) {
                     const [startHour, startMin] = chatResponse.startTime.split(':');
                     const [endHour, endMin] = chatResponse.endTime.split(':');
                     const durationMinutes = (parseInt(endHour) * 60 + parseInt(endMin)) - (parseInt(startHour) * 60 + parseInt(startMin));
                     const requestedTimeHour = parseInt(startHour) + parseInt(startMin) / 60;
                     const allAlternatives = [];

                     for (const conflictInfo of conflictDates) {
                        const events = context.currentEvents || [];
                        const availableSlots = findAvailableTimeSlots(conflictInfo.date, events, durationMinutes, requestedTimeHour);
                        if (availableSlots.length > 0) {
                           allAlternatives.push({
                              date: conflictInfo.date,
                              conflictWith: conflictInfo.conflictWith,
                              alternatives: availableSlots.slice(0, 2)
                           });
                        }
                     }

                     if (conflictDates.length > 0) {
                        let conflictMessage = `\n\n⚠️ ${conflictDates.length}일은 ${chatResponse.startTime}에 이미 일정이 있어서 건너뛰었어요:\n`;
                        if (allAlternatives.length > 0) {
                           allAlternatives.forEach(alt => {
                              conflictMessage += `\n📅 ${alt.date} - "${alt.conflictWith}"과(와) 겹침\n`;
                              conflictMessage += `   추천 시간: `;
                              alt.alternatives.forEach((slot, idx) => {
                                 conflictMessage += `${slot.start}-${slot.end}`;
                                 if (idx < alt.alternatives.length - 1) conflictMessage += ', ';
                              });
                           });
                        } else {
                           conflictDates.forEach(conflict => {
                              conflictMessage += `\n📅 ${conflict.date} - "${conflict.conflictWith}"과(와) 겹침`;
                           });
                           conflictMessage += `\n빈 시간을 찾을 수 없습니다.`;
                        }

                        return {
                           success: successCount > 0,
                           message: successCount > 0
                              ? `${chatResponse.title || '일정'}을 ${successCount}일간 추가했어요!${conflictMessage}`
                              : `모든 날짜에서 충돌이 발생했습니다.${conflictMessage}`,
                           data: chatResponse,
                           suggestedTimes: allAlternatives.length > 0 ? allAlternatives.flatMap(alt =>
                              alt.alternatives.map(slot => ({
                                 date: alt.date,
                                 start: slot.start,
                                 end: slot.end
                              }))
                           ) : undefined
                        };
                     }
                  }
               }

               if (!(context.context === 'profile' && context.tabType === 'local')) {
                  setEventAddedKey(prevKey => prevKey + 1);
                  window.dispatchEvent(new Event('calendarUpdate'));
               } else {
                  setEventAddedKey(prevKey => prevKey + 1);
               }

               if (successCount > 0 && failCount === 0) {
                  return {
                     success: true,
                     message: `${chatResponse.title || '일정'}을 ${successCount}일간 추가했어요!`, 
                     data: chatResponse
                  };
               } else if (successCount > 0 && failCount > 0) {
                  return {
                     success: true,
                     message: `${successCount}일 추가 성공, ${failCount}일 실패했습니다.`, 
                     data: chatResponse
                  };
               } else {
                  return {
                     success: false,
                     message: `일정 추가에 실패했습니다. ${errors[0] || ''}`, 
                     data: chatResponse
                  };
               }
            } catch (error) {
               return {
                  success: false,
                  message: `반복 일정 추가 중 오류가 발생했습니다: ${error.message}`, 
                  data: chatResponse
               };
            }
         }

         if (chatResponse.intent === 'delete_range' && chatResponse.startDate && chatResponse.endDate) {
            try {
               const token = localStorage.getItem('token');
               const startDate = new Date(chatResponse.startDate + 'T00:00:00+09:00');
               const endDate = new Date(chatResponse.endDate + 'T23:59:59+09:00');

               let deleteCount = 0;

               if (context.context === 'profile' && context.tabType === 'local') {
                  const currentScheduleResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
                     headers: { 'x-auth-token': token }
                  });
                  const currentSchedule = await currentScheduleResponse.json();

                  const filteredExceptions = (currentSchedule.scheduleExceptions || []).filter(exception => {
                     const exceptionDate = new Date(exception.startTime);
                     return exceptionDate < startDate || exceptionDate > endDate;
                  });

                  const filteredPersonalTimes = (currentSchedule.personalTimes || []).filter(pt => {
                     if (!pt.specificDate) return true;
                     const ptDate = new Date(pt.specificDate + 'T00:00:00+09:00');
                     return ptDate < startDate || ptDate > endDate;
                  });

                  const exceptionsDeleteCount = (currentSchedule.scheduleExceptions || []).length - filteredExceptions.length;
                  const personalTimesDeleteCount = (currentSchedule.personalTimes || []).length - filteredPersonalTimes.length;
                  deleteCount = exceptionsDeleteCount + personalTimesDeleteCount;

                  const response = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
                     method: 'PUT',
                     headers: {
                        'Content-Type': 'application/json',
                        'x-auth-token': token
                     },
                     body: JSON.stringify({
                        defaultSchedule: currentSchedule.defaultSchedule || [],
                        scheduleExceptions: filteredExceptions,
                        personalTimes: filteredPersonalTimes
                     })
                  });

                  if (response.ok) {
                     window.dispatchEvent(new CustomEvent('calendarUpdate', {
                        detail: { type: 'delete_range', startDate, endDate }
                     }));
                  }
               } else {
                  const apiEndpoint = context.tabType === 'google'
                     ? `${API_BASE_URL}/api/calendar/events/google`
                     : `${API_BASE_URL}/api/events`;

                  const eventsResponse = await fetch(`${apiEndpoint}?startDate=${chatResponse.startDate}&endDate=${chatResponse.endDate}`, {
                     headers: { 'x-auth-token': token }
                  });

                  if (eventsResponse.ok) {
                     const eventsData = await eventsResponse.json();
                     const events = eventsData.events || eventsData;

                     for (const event of events) {
                        try {
                           const deleteResponse = await fetch(`${apiEndpoint}/${event._id || event.id}`, {
                              method: 'DELETE',
                              headers: { 'x-auth-token': token }
                           });
                           if (deleteResponse.ok) {
                              deleteCount++;
                           } 
                        } catch (err) {
                        }
                     }

                     if (deleteCount > 0) {
                        setEventAddedKey(prevKey => prevKey + 1);
                        window.dispatchEvent(new Event('calendarUpdate'));
                     }
                  }
               }

               return {
                  success: deleteCount > 0,
                  message: deleteCount > 0
                     ? `${deleteCount}개의 일정을 삭제했어요!`
                     : '삭제할 일정이 없습니다.',
                  data: chatResponse
               };
            } catch (error) {
               return {
                  success: false,
                  message: `일정 삭제 중 오류가 발생했습니다: ${error.message}`, 
                  data: chatResponse
               };
            }
         }

         if (chatResponse.intent === 'delete_event' && !chatResponse.startDateTime && chatResponse.date) {
            const time = chatResponse.time || '12:00'; 
            chatResponse.startDateTime = `${chatResponse.date}T${time}:00+09:00`;
         }

         if (chatResponse.intent === 'add_event' && chatResponse.startDateTime) {
            if (!eventActions || !eventActions.addEvent) {
               return { success: false, message: '일정 추가 기능이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.' };
            }

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
                  throw new Error('날짜 형식이 올바르지 않습니다.');
               }
            }

            const token = localStorage.getItem('token');
            if (!token) {
              return { success: false, message: 'Google 계정 인증이 필요합니다.' };
            }

            try {
               const targetDate = chatResponse.startDateTime.split('T')[0];
               let eventsResponse;
               if (context.context === 'profile' && context.tabType === 'local') {
                  eventsResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
                     headers: { 'x-auth-token': token }
                  });
               } else if (context.tabType === 'local') {
                  eventsResponse = await fetch(`${API_BASE_URL}/api/events`, {
                     headers: { 'x-auth-token': token }
                  });
               } else {
                  const threeMonthsAgo = new Date();
                  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                  const oneYearLater = new Date();
                  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
                  eventsResponse = await fetch(`${API_BASE_URL}/api/calendar/events?timeMin=${threeMonthsAgo.toISOString()}&timeMax=${oneYearLater.toISOString()}`, {
                     headers: { 'x-auth-token': token }
                  });
               }

               if (eventsResponse.ok) {
                  const eventsData = await eventsResponse.json();
                  let events = [];

                  if (context.context === 'profile' && context.tabType === 'local') {
                     const exceptions = (eventsData.scheduleExceptions || [])
                        .filter(exc => exc.specificDate === targetDate);

                     const personalTimes = (eventsData.personalTimes || [])
                        .filter(pt => pt.specificDate === targetDate)
                        .map(pt => ({
                           ...pt,
                           startTime: `${targetDate}T${pt.startTime}:00+09:00`,
                           endTime: `${targetDate}T${pt.endTime}:00+09:00`
                        }));

                     events = [...exceptions, ...personalTimes];
                     
                  } else if (context.tabType === 'local') {
                     events = eventsData.events || eventsData;
                  } else {
                     events = eventsData;
                  }

                  const conflictCheck = checkScheduleConflict(chatResponse.startDateTime, chatResponse.endDateTime, events);


                  if (conflictCheck.hasConflict) {
                     const conflictTitle = conflictCheck.conflicts[0]?.summary || conflictCheck.conflicts[0]?.title || '일정';
                     const startTime = new Date(chatResponse.startDateTime);
                     const timeStr = startTime.toLocaleString('ko-KR', {
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                     });

                     return {
                        success: false,
                        hasConflict: true,
                        message: `${timeStr}에 이미 "${conflictTitle}" 일정이 있습니다.\n\n어떻게 하시겠어요?`,
                        conflictingEvents: conflictCheck.conflicts.map(e => ({
                           id: e._id || e.id,
                           title: e.title || e.summary,
                           startTime: e.startTime || e.start?.dateTime,
                           endTime: e.endTime || e.end?.dateTime,
                        })),
                        pendingEvent: {
                           title: chatResponse.title,
                           description: chatResponse.description,
                           startTime: chatResponse.startDateTime,
                           endTime: chatResponse.endDateTime,
                           duration: (new Date(chatResponse.endDateTime) - new Date(chatResponse.startDateTime)) / (60 * 1000),
                           priority: 3,
                           category: 'general',
                           allExistingEvents: events
                        },
                        actions: [
                           { id: 1, label: '다른 시간 추천받기', action: 'recommend_alternative' },
                           { id: 2, label: '기존 약속 변경하기', action: 'reschedule_existing' }
                        ],
                        _nextStep: 'await_user_choice'
                     };
                  }
               }
            } catch (conflictError) {
            }

            const eventData = {
               title: chatResponse.title || '일정',
               description: chatResponse.description || '',
               startDateTime: chatResponse.startDateTime,
               endDateTime: chatResponse.endDateTime
            };

            let apiEndpoint;
            let requestBody = eventData;

            switch (context.tabType) {
               case 'google':
                  apiEndpoint = `${API_BASE_URL}/api/calendar/events/google`;
                  break;
               case 'local':
                  if (context.context === 'profile') {
                     let currentSchedule;
                     
                     if (window.__profileEditingState) {
                        currentSchedule = window.__profileEditingState;
                     } else {
                        const currentScheduleResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
                           headers: { 'x-auth-token': token }
                        });
                        if (!currentScheduleResponse.ok) {
                           throw new Error('현재 스케줄을 가져올 수 없습니다.');
                        }
                        currentSchedule = await currentScheduleResponse.json();
                     }

                     const startDateTimeStr = eventData.startDateTime;
                     const endDateTimeStr = eventData.endDateTime;
                     const specificDate = startDateTimeStr.split('T')[0];
                     const startTime = startDateTimeStr.split('T')[1].substring(0, 5);
                     const endTime = endDateTimeStr.split('T')[1].substring(0, 5);

                     const newPersonalTime = {
                        id: Date.now(),
                        title: eventData.title,
                        type: 'event',
                        startTime: startTime,
                        endTime: endTime,
                        days: [],
                        isRecurring: false,
                        specificDate: specificDate,
                        color: 'bg-gray-500'
                     };

                     const existingPersonalTimes = Array.isArray(currentSchedule.personalTimes)
                        ? [...currentSchedule.personalTimes]
                        : [];

                     apiEndpoint = `${API_BASE_URL}/api/users/profile/schedule`;
                     requestBody = {
                        defaultSchedule: currentSchedule.defaultSchedule,
                        scheduleExceptions: currentSchedule.scheduleExceptions || [],
                        personalTimes: [...existingPersonalTimes, newPersonalTime]
                     };
                  } else {
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
                  apiEndpoint = `${API_BASE_URL}/api/calendar/events/google`;
            }

            const httpMethod = (context.context === 'profile' && context.tabType === 'local') ? 'PUT' : 'POST';

            const response = await fetch(apiEndpoint, {
              method: httpMethod,
              headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token,
              },
              body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
              const errorData = await response.json();
              if (context.tabType === 'google') {
                 throw new Error(errorData.msg || 'Google 캘린더에 일정을 추가하지 못했습니다.');
              } else {
                 throw new Error(errorData.msg || '로컬 일정을 추가하지 못했습니다.');
              }
            }

            const responseData = await response.json();

            if (context.tabType === 'local') {
              if (context.context === 'profile') {
                const updateEvent = new CustomEvent('calendarUpdate', {
                  detail: {
                    type: 'add',
                    data: responseData,
                    chatResponse: chatResponse
                  }
                });
                window.dispatchEvent(updateEvent);
              }
              setEventAddedKey(prevKey => prevKey + 1);
            } else {
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
         
         else if ((chatResponse.intent === 'delete_event' || chatResponse.intent === 'delete_range') && chatResponse.startDateTime) {
            const token = localStorage.getItem('token');
            
            let eventsResponse;
            if (context.context === 'profile' && context.tabType === 'local') {
               eventsResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
                  headers: { 'x-auth-token': token }
               });
            } else if (context.tabType === 'local') {
               eventsResponse = await fetch(`${API_BASE_URL}/api/events`, {
                  headers: { 'x-auth-token': token }
               });
            } else {
               const threeMonthsAgo = new Date();
               threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
               const oneYearLater = new Date();
               oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
               eventsResponse = await fetch(`${API_BASE_URL}/api/calendar/events?timeMin=${threeMonthsAgo.toISOString()}&timeMax=${oneYearLater.toISOString()}`, {
                  headers: { 'x-auth-token': token }
               });
            }
            
            if (!eventsResponse.ok) {
               throw new Error('일정 목록을 가져올 수 없습니다.');
            }
            
            const eventsData = await eventsResponse.json();

            let events;
            if (context.context === 'profile' && context.tabType === 'local') {
               const exceptions = eventsData.scheduleExceptions || [];
               const personalTimes = eventsData.personalTimes || [];
               const convertedPersonalTimes = personalTimes.map(pt => ({
                  ...pt,
                  _id: pt.id,
                  isPersonalTime: true
               }));
               events = [...exceptions, ...convertedPersonalTimes];
            } else if (context.tabType === 'local') {
               events = eventsData.events || eventsData;
            } else {
               events = eventsData;
            }

            if (!events || !Array.isArray(events)) {
               throw new Error('일정 목록 형식이 올바르지 않습니다.');
            }
            
            let matchingEvents;
            
            if (chatResponse.intent === 'delete_range') {
               const startDate = new Date(chatResponse.startDateTime);
               const endDate = new Date(chatResponse.endDateTime);

               matchingEvents = events.filter(event => {
                  if (!event) return false;
                  let eventDate;
                  let eventTitle;
                  if (context.context === 'profile' && context.tabType === 'local') {
                     if (event.isPersonalTime) {
                        eventTitle = event.title;
                        eventDate = startDate;
                     } else {
                        if (!event.startTime) return false;
                        eventDate = new Date(event.startTime);
                        eventTitle = event.title;
                     }
                  } else if (context.tabType === 'local') {
                     if (!event.startTime) return false;
                     eventDate = new Date(event.startTime);
                     eventTitle = event.title;
                  } else {
                     if (!event.start) return false;
                     eventDate = new Date(event.start.dateTime || event.start.date);
                     eventTitle = event.summary;
                  }
                  const inRange = eventDate >= startDate && eventDate <= endDate;
                  const scheduleKeywords = ['일정', '약속', '미팅', '회의', '모임', '전체', '전부', '모든', '모두'];
                  const isGeneralSchedule = !chatResponse.title || scheduleKeywords.includes(chatResponse.title);
                  const titleMatch = isGeneralSchedule ||
                                    eventTitle?.toLowerCase().includes(chatResponse.title.toLowerCase());
                  return inRange && titleMatch;
               });
            } else {
               const targetDate = new Date(chatResponse.startDateTime);
               matchingEvents = events.filter(event => {
                  if (!event) return false;

                  let eventDate;
                  let eventTitle;

                  if (context.context === 'profile' && context.tabType === 'local') {
                     if (event.isPersonalTime) {
                        eventTitle = event.title;
                        if (event.specificDate) {
                           const eventSpecificDate = new Date(event.specificDate + 'T00:00:00+09:00');
                           if (eventSpecificDate.toDateString() === targetDate.toDateString()) {
                              eventDate = targetDate;
                           } else {
                              return false;
                           }
                        } else {
                           const dayOfWeek = targetDate.getDay() === 0 ? 7 : targetDate.getDay();
                           if (!event.days || !event.days.includes(dayOfWeek)) {
                               return false;
                           }
                           eventDate = targetDate;
                        }
                     } else {
                        if (!event.startTime) { return false; }
                        eventDate = new Date(event.startTime);
                        eventTitle = event.title;
                     }
                  } else if (context.tabType === 'local') {
                     if (!event.startTime) { return false; }
                     eventDate = new Date(event.startTime);
                     eventTitle = event.title;
                  } else {
                     if (!event.start) {  return false; }
                     eventDate = new Date(event.start.dateTime || event.start.date);
                     eventTitle = event.summary;
                  }

                  if (!eventDate) {
                     return false;
                  }

                  const isSameDay = eventDate.toDateString() === targetDate.toDateString();
                  const scheduleKeywords = ['일정', '약속', '미팅', '회의', '모임', '전체', '전부', '모든', '모두'];
                  const isGeneralSchedule = !chatResponse.title || scheduleKeywords.includes(chatResponse.title);
                  let titleMatch = false;
                  if (isGeneralSchedule) {
                     titleMatch = true;
                  } else if (eventTitle) {
                     titleMatch = eventTitle.toLowerCase().includes(chatResponse.title.toLowerCase());
                  }

                  const isMatch = isSameDay && titleMatch;
                  return isMatch;
               });
            }

            if (matchingEvents.length === 0) {
               return { success: false, message: '해당 일정을 찾을 수 없어요.' };
            }
            
            const deleteAllKeywords = ['전부', '모든', '모두', '다', '전체'];
            const shouldDeleteAll = deleteAllKeywords.some(keyword => message.includes(keyword));
            
            if (matchingEvents.length > 1 && !shouldDeleteAll) {
               return { success: false, message: `${matchingEvents.length}개의 일정이 있어요. "전부 삭제"라고 하시거나 더 구체적으로 말씀해 주세요.` };
            }
            
            if (matchingEvents.length > 1 && shouldDeleteAll) {
               let deletedCount = 0;

               if (context.context === 'profile' && context.tabType === 'local') {
                  const remainingExceptions = eventsData.scheduleExceptions.filter(ex =>
                     !matchingEvents.some(match => !match.isPersonalTime && match._id === ex._id)
                  );

                  const remainingPersonalTimes = eventsData.personalTimes.filter(pt =>
                     !matchingEvents.some(match => match.isPersonalTime && match._id === pt.id)
                  );

                  const updateResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
                     method: 'PUT',
                     headers: {
                        'Content-Type': 'application/json',
                        'x-auth-token': token,
                     },
                     body: JSON.stringify({
                        defaultSchedule: eventsData.defaultSchedule,
                        scheduleExceptions: remainingExceptions,
                        personalTimes: remainingPersonalTimes
                     }),
                  });

                  if (updateResponse.ok) {
                     deletedCount = matchingEvents.length;
                     window.dispatchEvent(new Event('calendarUpdate'));
                  }
               } else {
                  for (const event of matchingEvents) {
                     try {
                        let deleteResponse;
                        if (context.tabType === 'local') {
                           deleteResponse = await fetch(`${API_BASE_URL}/api/events/${event._id || event.id}`, {
                              method: 'DELETE',
                              headers: { 'x-auth-token': token }
                           });
                        } else {
                           deleteResponse = await fetch(`${API_BASE_URL}/api/calendar/events/${event.id}`, {
                              method: 'DELETE',
                              headers: { 'x-auth-token': token }
                           });
                        }

                        if (deleteResponse.ok) {
                           deletedCount++;
                        }
                     } catch (error) {
                     }
                  }
               }

               setEventAddedKey(prevKey => prevKey + 1);
               return {
                  success: true,
                  message: `${deletedCount}개의 일정을 삭제했어요!`, 
                  data: chatResponse
               };
            }
            
            const eventToDelete = matchingEvents[0];
            let deleteResponse;

            if (context.context === 'profile' && context.tabType === 'local') {
               let remainingExceptions = eventsData.scheduleExceptions;
               let remainingPersonalTimes = eventsData.personalTimes;

               if (eventToDelete.isPersonalTime) {
                  remainingPersonalTimes = eventsData.personalTimes.filter(pt =>
                     String(pt.id) !== String(eventToDelete._id)
                  );
               } else {
                  remainingExceptions = eventsData.scheduleExceptions.filter(ex =>
                     ex._id !== eventToDelete._id
                  );
               }

               deleteResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
                  method: 'PUT',
                  headers: {
                     'Content-Type': 'application/json',
                     'x-auth-token': token,
                  },
                  body: JSON.stringify({
                     defaultSchedule: eventsData.defaultSchedule,
                     scheduleExceptions: remainingExceptions,
                     personalTimes: remainingPersonalTimes
                  }),
               });

               if (deleteResponse.ok) {
                  window.dispatchEvent(new Event('calendarUpdate'));
               }
            } else if (context.tabType === 'local') {
               deleteResponse = await fetch(`${API_BASE_URL}/api/events/${eventToDelete._id || eventToDelete.id}`, {
                  method: 'DELETE',
                  headers: { 'x-auth-token': token }
               });
            } else {
               deleteResponse = await fetch(`${API_BASE_URL}/api/calendar/events/${eventToDelete.id}`, {
                  method: 'DELETE',
                  headers: { 'x-auth-token': token }
               });
            }

            if (!deleteResponse.ok) {
               throw new Error('일정 삭제에 실패했습니다.');
            }

            setEventAddedKey(prevKey => prevKey + 1); // 캘린더 새로고침
            const deletedTitle = (context.context === 'profile' && context.tabType === 'local') || context.tabType === 'local' ? eventToDelete.title : eventToDelete.summary;
            return {
               success: true,
               message: `${deletedTitle || '일정'}을 삭제했어요!`, 
               data: chatResponse
            };
         }
         
         else if (chatResponse.intent === 'edit_event') {
            // 일정 수정 처리
            const token = localStorage.getItem('token');

            if (!chatResponse.originalTitle || !chatResponse.originalDate) {
               return { success: false, message: '수정할 일정의 제목과 날짜가 필요합니다.' };
            }

            try {
               // 1. 기존 일정 찾기
               let eventsResponse;
               if (context.context === 'profile' && context.tabType === 'local') {
                  eventsResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
                     headers: { 'x-auth-token': token }
                  });
               } else if (context.tabType === 'local') {
                  eventsResponse = await fetch(`${API_BASE_URL}/api/events`, {
                     headers: { 'x-auth-token': token }
                  });
               } else {
                  const threeMonthsAgo = new Date();
                  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                  const oneYearLater = new Date();
                  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
                  eventsResponse = await fetch(`${API_BASE_URL}/api/calendar/events?timeMin=${threeMonthsAgo.toISOString()}&timeMax=${oneYearLater.toISOString()}`, {
                     headers: { 'x-auth-token': token }
                  });
               }

               if (!eventsResponse.ok) {
                  throw new Error('일정 목록을 가져올 수 없습니다.');
               }

               const eventsData = await eventsResponse.json();
               let events;

               if (context.context === 'profile' && context.tabType === 'local') {
                  const exceptions = (eventsData.scheduleExceptions || []).filter(exc => exc.specificDate === chatResponse.originalDate);
                  const personalTimes = (eventsData.personalTimes || []).filter(pt => pt.specificDate === chatResponse.originalDate);
                  events = [...exceptions, ...personalTimes.map(pt => ({ ...pt, isPersonalTime: true }))];

               } else if (context.tabType === 'local') {
                  events = eventsData.events || eventsData;
               } else {
                  events = eventsData;
               }

               // 제목으로 일정 찾기
               const targetDate = new Date(chatResponse.originalDate);
               const eventToEdit = events.find(event => {
                  let eventDate, eventTitle;

                  if (context.context === 'profile' && context.tabType === 'local') {
                     if (event.isPersonalTime) {
                        eventTitle = event.title;
                        eventDate = event.specificDate ? new Date(event.specificDate) : null;
                     } else {
                        eventTitle = event.title;
                        eventDate = event.startTime ? new Date(event.startTime) : null;
                     }
                  } else if (context.tabType === 'local') {
                     eventTitle = event.title;
                     eventDate = event.startTime ? new Date(event.startTime) : null;
                  } else {
                     eventTitle = event.summary;
                     eventDate = event.start ? new Date(event.start.dateTime || event.start.date) : null;
                  }

                  if (!eventDate) return false;

                  const isSameDay = eventDate.toDateString() === targetDate.toDateString();
                  const titleMatch = eventTitle && eventTitle.toLowerCase().includes(chatResponse.originalTitle.toLowerCase());

                  return isSameDay && titleMatch;
               });

               if (!eventToEdit) {

                  return { success: false, message: `"${chatResponse.originalTitle}" 일정을 찾을 수 없어요.` };
               }
               // 2. 일정 수정 수행 (각 탭별로 다르게)
               if (context.context === 'profile' && context.tabType === 'local') {
                  // 프로필 탭 - 로컬 일정 수정
                  let updatedPersonalTimes = [...(eventsData.personalTimes || [])];
                  let updatedExceptions = [...(eventsData.scheduleExceptions || [])];

                  if (eventToEdit.isPersonalTime) {
                     const index = updatedPersonalTimes.findIndex(pt =>
                        String(pt.id) === String(eventToEdit.id || eventToEdit._id)
                     );

                     if (index !== -1) {
                        updatedPersonalTimes[index] = {
                           ...updatedPersonalTimes[index],
                           title: chatResponse.newTitle || updatedPersonalTimes[index].title,
                           specificDate: chatResponse.newDate || updatedPersonalTimes[index].specificDate,
                           startTime: chatResponse.newStartTime || updatedPersonalTimes[index].startTime,
                           endTime: chatResponse.newEndTime || updatedPersonalTimes[index].endTime
                        };
                     }
                  } else {
                     const index = updatedExceptions.findIndex(ex =>
                        ex._id === eventToEdit._id
                     );

                     if (index !== -1) {
                        const oldStart = new Date(updatedExceptions[index].startTime);
                        const oldEnd = new Date(updatedExceptions[index].endTime);

                        let newStartTime, newEndTime;

                        if (chatResponse.newDate) {
                           newStartTime = new Date(`${chatResponse.newDate}T${oldStart.toTimeString().substring(0,5)}:00+09:00`);
                           newEndTime = new Date(`${chatResponse.newDate}T${oldEnd.toTimeString().substring(0,5)}:00+09:00`);
                        } else {
                           newStartTime = new Date(oldStart);
                           newEndTime = new Date(oldEnd);
                        }

                        if (chatResponse.newStartTime) {
                           const [hour, min] = chatResponse.newStartTime.split(':');
                           newStartTime.setHours(parseInt(hour), parseInt(min));
                        }

                        if (chatResponse.newEndTime) {
                           const [hour, min] = chatResponse.newEndTime.split(':');
                           newEndTime.setHours(parseInt(hour), parseInt(min));
                        }

                        updatedExceptions[index] = {
                           ...updatedExceptions[index],
                           title: chatResponse.newTitle || updatedExceptions[index].title,
                           specificDate: chatResponse.newDate || updatedExceptions[index].specificDate,
                           startTime: newStartTime.toISOString(),
                           endTime: newEndTime.toISOString()
                        };
                     }
                  }

                  const updateResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
                     method: 'PUT',
                     headers: {
                        'Content-Type': 'application/json',
                        'x-auth-token': token
                     },
                     body: JSON.stringify({
                        defaultSchedule: eventsData.defaultSchedule || [],
                        scheduleExceptions: updatedExceptions,
                        personalTimes: updatedPersonalTimes
                     })
                  });

                  if (!updateResponse.ok) {
                     throw new Error('일정 수정에 실패했습니다.');
                  }

                  const responseData = await updateResponse.json();

                  window.dispatchEvent(new CustomEvent('calendarUpdate', {
                     detail: {
                        type: 'edit',
                        data: responseData,
                        context: 'profile'
                     }
                  }));
                  setEventAddedKey(prevKey => prevKey + 1);

                  return {
                     success: true,
                     message: chatResponse.response || `"${chatResponse.originalTitle}" 일정을 수정했어요!`,
                     data: chatResponse
                  };

               } else if (context.tabType === 'local') {
                  // 나의 일정 탭 - 로컬 일정 수정
                  const oldEvent = eventToEdit;
                  const oldStartTime = new Date(oldEvent.startTime);
                  const oldEndTime = new Date(oldEvent.endTime);

                  let newStartTime = new Date(oldStartTime);
                  let newEndTime = new Date(oldEndTime);

                  if (chatResponse.newDate) {
                     const [year, month, day] = chatResponse.newDate.split('-');
                     newStartTime = new Date(`${chatResponse.newDate}T${oldStartTime.toTimeString().substring(0,5)}:00+09:00`);
                     newEndTime = new Date(`${chatResponse.newDate}T${oldEndTime.toTimeString().substring(0,5)}:00+09:00`);
                  }

                  if (chatResponse.newStartTime) {
                     const [hour, min] = chatResponse.newStartTime.split(':');
                     newStartTime.setHours(parseInt(hour), parseInt(min));
                  }

                  if (chatResponse.newEndTime) {
                     const [hour, min] = chatResponse.newEndTime.split(':');
                     newEndTime.setHours(parseInt(hour), parseInt(min));
                  }

                  const updateResponse = await fetch(`${API_BASE_URL}/api/events/${oldEvent._id || oldEvent.id}`, {
                     method: 'PUT',
                     headers: {
                        'Content-Type': 'application/json',
                        'x-auth-token': token
                     },
                     body: JSON.stringify({
                        title: chatResponse.newTitle || oldEvent.title,
                        date: newStartTime.toISOString().split('T')[0],
                        time: newStartTime.toTimeString().substring(0,5),
                        duration: (newEndTime - newStartTime) / (60 * 1000),
                        description: oldEvent.description
                     })
                  });

                  if (!updateResponse.ok) {
                     throw new Error('일정 수정에 실패했습니다.');
                  }

                  setEventAddedKey(prevKey => prevKey + 1);

                  return {
                     success: true,
                     message: chatResponse.response || `"${chatResponse.originalTitle}" 일정을 수정했어요!`,
                     data: chatResponse
                  };

               } else {
                  // Google 캘린더 탭 - Google 일정 수정
                  const oldEvent = eventToEdit;
                  const oldStart = new Date(oldEvent.start.dateTime || oldEvent.start.date);
                  const oldEnd = new Date(oldEvent.end.dateTime || oldEvent.end.date);

                  let newStart = new Date(oldStart);
                  let newEnd = new Date(oldEnd);

                  if (chatResponse.newDate) {
                     newStart = new Date(`${chatResponse.newDate}T${oldStart.toTimeString().substring(0,5)}:00+09:00`);
                     newEnd = new Date(`${chatResponse.newDate}T${oldEnd.toTimeString().substring(0,5)}:00+09:00`);
                  }

                  if (chatResponse.newStartTime) {
                     const [hour, min] = chatResponse.newStartTime.split(':');
                     newStart.setHours(parseInt(hour), parseInt(min));
                  }

                  if (chatResponse.newEndTime) {
                     const [hour, min] = chatResponse.newEndTime.split(':');
                     newEnd.setHours(parseInt(hour), parseInt(min));
                  }

                  const updateResponse = await fetch(`${API_BASE_URL}/api/calendar/events/${oldEvent.id}`, {
                     method: 'PUT',
                     headers: {
                        'Content-Type': 'application/json',
                        'x-auth-token': token
                     },
                     body: JSON.stringify({
                        title: chatResponse.newTitle || oldEvent.summary,
                        description: oldEvent.description,
                        startDateTime: newStart.toISOString(),
                        endDateTime: newEnd.toISOString(),
                        etag: oldEvent.etag
                     })
                  });

                  if (!updateResponse.ok) {
                     throw new Error('일정 수정에 실패했습니다.');
                  }

                  setEventAddedKey(prevKey => prevKey + 1);

                  return {
                     success: true,
                     message: chatResponse.response || `"${chatResponse.originalTitle}" 일정을 수정했어요!`,
                     data: chatResponse
                  };
               }

            } catch (error) {
               return { success: false, message: `일정 수정 중 오류가 발생했습니다: ${error.message}` };
            }
         }

         else if (chatResponse.intent === 'clarification') {
            return { success: true, message: chatResponse.response };
         }

         return {
            success: true,
            message: chatResponse.response || '처리했어요!',
            data: chatResponse
         };
      } catch (error) {
         if (error.message.includes('API key not valid') || 
             error.message.includes('API_KEY_INVALID') ||
             error.message.includes('invalid API key') ||
             error.message.includes('Unauthorized')) {
            return { 
               success: false, 
               message: 'AI 서비스에 문제가 있습니다. 관리자에게 문의해주세요.' 
            };
         }
         
         if (error instanceof SyntaxError) {
            return { success: false, message: 'AI 응답 형식 오류입니다. 다시 시도해주세요.' };
         }
         
         return { success: false, message: `오류: ${error.message}` };
      }
   }, [isLoggedIn, setEventAddedKey, eventActions]);

   return { handleChatMessage };
};