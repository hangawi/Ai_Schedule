import { useCallback } from 'react';
import { generateAIPrompt, parseAIResponse, checkScheduleConflict, findAvailableTimeSlots } from '../utils';
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

         console.log('🔍 [useChat] AI 원본 응답:', text);
         console.log('🔍 [useChat] 파싱된 chatResponse:', chatResponse);

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
               console.log('🔁 [반복일정] 처리 시작:', chatResponse);

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

                     console.log(`🔍 [충돌체크] ${date} 날짜의 기존 일정:`, existingEvents.length, '개');
                     if (existingEvents.length > 0) {
                        console.log('   상세:', existingEvents.map(e => `${e.title} ${new Date(e.startTime).toLocaleString('ko-KR')}`));
                     }

                     // 1단계: 정확히 동일한 일정이 이미 있는지 체크 (중복 방지)
                     const exactDuplicate = existingEvents.find(evt => {
                        const evtStart = new Date(evt.startTime);
                        const evtEnd = new Date(evt.endTime);
                        return evtStart.getTime() === startDateTime.getTime() &&
                               evtEnd.getTime() === endDateTime.getTime() &&
                               evt.title === (chatResponse.title || '일정');
                     });

                     if (exactDuplicate) {
                        console.log(`⚠️ [중복 방지] ${date}에 동일한 일정이 이미 존재함:`, exactDuplicate.title);
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
                           id: Date.now() + successCount * 1000, // 충돌 방지를 위해 간격을 크게
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

                  console.log('🔍 기존 personalTimes:', existingPersonalTimes.length);
                  console.log('🔍 새 personalTimes:', newPersonalTimes.length);
                  console.log('🔍 새 personalTimes 샘플:', newPersonalTimes[0]);

                  const allPersonalTimes = [
                     ...existingPersonalTimes,
                     ...newPersonalTimes
                  ];

                  // 모든 항목이 id를 가지고 있는지 확인
                  const itemsWithoutId = allPersonalTimes.filter(pt => !pt.id);
                  if (itemsWithoutId.length > 0) {
                     console.error('❌ ID 없는 항목 발견:', itemsWithoutId);
                  }

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
                     // 프로필 탭 캘린더 업데이트 이벤트 발생
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
                     console.error('❌ 반복일정 추가 실패:', errorData);
                  }

                  // 충돌 메시지 생성
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
                  const conflictDates = []; // 충돌 발생한 날짜들

                  for (const date of chatResponse.dates) {
                     try {
                        // 1️⃣ 기존 일정 가져오기 (context에서 전달받음)
                        const events = context.currentEvents || [];

                        // 2️⃣ 충돌 체크
                        const startDateTime = `${date}T${chatResponse.startTime}:00+09:00`;
                        const endDateTime = `${date}T${chatResponse.endTime}:00+09:00`;

                        const { hasConflict, conflicts } = checkScheduleConflict(startDateTime, endDateTime, events);

                        if (hasConflict) {
                           // 충돌 발생 - 이 날짜는 건너뛰고 기록
                           conflictDates.push({
                              date,
                              conflictWith: conflicts[0]?.summary || conflicts[0]?.title || '기존 일정'
                           });
                           failCount++;
                           continue; // 이 날짜는 추가하지 않음
                        }

                        // 3️⃣ 충돌 없으면 추가
                        let eventData;
                        let apiEndpoint;

                        if (context.tabType === 'google') {
                           // Google 캘린더는 startTime/endTime 형식 사용
                           eventData = {
                              title: chatResponse.title || '일정',
                              description: chatResponse.description || '',
                              startTime: startDateTime,
                              endTime: endDateTime
                           };
                           apiEndpoint = `${API_BASE_URL}/api/calendar/events/google`;
                        } else {
                           // 나의 일정은 date/time/duration 형식 사용
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

                  // 4️⃣ 충돌 발생한 날짜에 대해 대안 시간 찾기
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
                              alternatives: availableSlots.slice(0, 2) // 상위 2개만
                           });
                        }
                     }

                     // 5️⃣ 충돌 정보와 대안 시간을 메시지에 포함
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
                           // 대안 시간이 없는 경우
                           conflictDates.forEach(conflict => {
                              conflictMessage += `\n📅 ${conflict.date} - "${conflict.conflictWith}"과(와) 겹침`;
                           });
                           conflictMessage += `\n빈 시간을 찾을 수 없습니다.`;
                        }

                        // 충돌 정보를 응답에 추가
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

               // 프로필 탭이 아닌 경우에만 추가 이벤트 발생
               if (!(context.context === 'profile' && context.tabType === 'local')) {
                  setEventAddedKey(prevKey => prevKey + 1);
                  window.dispatchEvent(new Event('calendarUpdate'));
               } else {
                  // 프로필 탭은 이미 위에서 이벤트 발생
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
               console.error('🔁 [반복일정] 오류:', error);
               return {
                  success: false,
                  message: `반복 일정 추가 중 오류가 발생했습니다: ${error.message}`,
                  data: chatResponse
               };
            }
         }

         // 🗑️ 범위 삭제 처리
         if (chatResponse.intent === 'delete_range' && chatResponse.startDate && chatResponse.endDate) {
            try {
               const token = localStorage.getItem('token');
               const startDate = new Date(chatResponse.startDate + 'T00:00:00+09:00');
               const endDate = new Date(chatResponse.endDate + 'T23:59:59+09:00');

               console.log('🗑️ [범위삭제] 시작:', { startDate, endDate, context });

               let deleteCount = 0;
               let failCount = 0;

               if (context.context === 'profile' && context.tabType === 'local') {
                  // 프로필 탭 - scheduleExceptions와 personalTimes에서 해당 범위 삭제
                  const currentScheduleResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
                     headers: { 'x-auth-token': token }
                  });
                  const currentSchedule = await currentScheduleResponse.json();

                  // scheduleExceptions: 범위 내 일정만 필터링해서 제거
                  const filteredExceptions = (currentSchedule.scheduleExceptions || []).filter(exception => {
                     const exceptionDate = new Date(exception.startTime);
                     return exceptionDate < startDate || exceptionDate > endDate;
                  });

                  // personalTimes: 범위 내 specificDate를 가진 일정 제거
                  const filteredPersonalTimes = (currentSchedule.personalTimes || []).filter(pt => {
                     if (!pt.specificDate) return true; // 반복 일정은 유지

                     const ptDate = new Date(pt.specificDate + 'T00:00:00+09:00');
                     return ptDate < startDate || ptDate > endDate;
                  });

                  const exceptionsDeleteCount = (currentSchedule.scheduleExceptions || []).length - filteredExceptions.length;
                  const personalTimesDeleteCount = (currentSchedule.personalTimes || []).length - filteredPersonalTimes.length;
                  deleteCount = exceptionsDeleteCount + personalTimesDeleteCount;

                  console.log('🗑️ [범위삭제] scheduleExceptions:', exceptionsDeleteCount, 'personalTimes:', personalTimesDeleteCount);

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
                  // Google 캘린더 또는 나의 일정 - 개별 이벤트 조회 후 삭제
                  const apiEndpoint = context.tabType === 'google'
                     ? `${API_BASE_URL}/api/calendar/events/google`
                     : `${API_BASE_URL}/api/events`;

                  // 해당 기간 이벤트 조회
                  const eventsResponse = await fetch(`${apiEndpoint}?startDate=${chatResponse.startDate}&endDate=${chatResponse.endDate}`, {
                     headers: { 'x-auth-token': token }
                  });

                  if (eventsResponse.ok) {
                     const eventsData = await eventsResponse.json();
                     const events = eventsData.events || eventsData;

                     // 각 이벤트 삭제
                     for (const event of events) {
                        try {
                           const deleteResponse = await fetch(`${apiEndpoint}/${event._id || event.id}`, {
                              method: 'DELETE',
                              headers: { 'x-auth-token': token }
                           });

                           if (deleteResponse.ok) {
                              deleteCount++;
                           } else {
                              failCount++;
                           }
                        } catch (err) {
                           failCount++;
                           console.error('삭제 실패:', err);
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
               console.error('🗑️ [범위삭제] 오류:', error);
               return {
                  success: false,
                  message: `일정 삭제 중 오류가 발생했습니다: ${error.message}`,
                  data: chatResponse
               };
            }
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
                  throw new Error('날짜 형식이 올바르지 않습니다.');
               }
            }

            const token = localStorage.getItem('token');
            if (!token) {
              return { success: false, message: 'Google 계정 인증이 필요합니다.' };
            }

            // 🔍 일정 충돌 확인
            try {
               // 기존 일정 목록 가져오기
               const targetDate = chatResponse.startDateTime.split('T')[0];
               const threeMonthsAgo = new Date();
               threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
               const oneYearLater = new Date();
               oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

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
                  eventsResponse = await fetch(`${API_BASE_URL}/api/calendar/events?timeMin=${threeMonthsAgo.toISOString()}&timeMax=${oneYearLater.toISOString()}`, {
                     headers: { 'x-auth-token': token }
                  });
               }

               if (eventsResponse.ok) {
                  const eventsData = await eventsResponse.json();
                  let events = [];

                  if (context.context === 'profile' && context.tabType === 'local') {
                     // targetDate와 일치하는 일정만 포함
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

                  // 충돌 확인
                  const conflictCheck = checkScheduleConflict(chatResponse.startDateTime, chatResponse.endDateTime, events);

                  if (conflictCheck.hasConflict) {
                     // LLM이 결정한 시간 사용
                     const estimatedDuration = (new Date(chatResponse.endDateTime) - new Date(chatResponse.startDateTime)) / (1000 * 60);

                     // 사용자가 요청한 시간 추출 (근접 시간 추천용)
                     const requestedStart = new Date(chatResponse.startDateTime);
                     const requestedTimeHour = requestedStart.getHours() + requestedStart.getMinutes() / 60;

                     // 해당 날짜에서 먼저 빈 시간 찾기 (요청 시간 근처부터 우선 추천)
                     let availableSlots = findAvailableTimeSlots(targetDate, events, estimatedDuration, requestedTimeHour);

                     // 해당 날짜에 빈 시간이 없으면 향후 7일간 검색
                     if (availableSlots.length === 0) {
                        for (let i = 1; i <= 7; i++) {
                           const nextDate = new Date(targetDate);
                           nextDate.setDate(nextDate.getDate() + i);
                           const nextDateStr = nextDate.toISOString().split('T')[0];

                           const futureSlots = findAvailableTimeSlots(nextDateStr, events, estimatedDuration, requestedTimeHour);
                           if (futureSlots.length > 0) {
                              availableSlots = futureSlots;
                              break;
                           }
                        }
                     }

                     if (availableSlots.length > 0) {
                        const firstSlot = availableSlots[0];
                        const conflictTitle = conflictCheck.conflicts[0].summary || conflictCheck.conflicts[0].title || '다른 일정';
                        const durationText = estimatedDuration >= 60 ? `${Math.round(estimatedDuration/60)}시간` : `${estimatedDuration}분`;

                        return {
                           success: false,
                           message: `주인님, 그 시간에는 이미 "${conflictTitle}"이(가) 있습니다. ${firstSlot.date} ${firstSlot.start}부터 ${firstSlot.end}까지 ${durationText} 어떠세요?`,
                           suggestedTimes: availableSlots.slice(0, 5)
                        };
                     } else {
                        return {
                           success: false,
                           message: `주인님, 그 시간에는 이미 다른 일정이 있고, 향후 일주일간 적절한 빈 시간을 찾을 수 없습니다. 일정을 조정해보시겠어요?`
                        };
                     }
                  }
               }
            } catch (conflictError) {
               console.error('충돌 확인 중 오류:', conflictError);
               // 충돌 확인 실패 시에도 일정 추가는 계속 진행
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
                     // 내 프로필 탭 - 현재 스케줄 가져오기
                     let currentSchedule;
                     
                     // ProfileTab에서 편집 중인 상태를 window에 저장했는지 확인
                     if (window.__profileEditingState) {
                        // 편집 모드의 현재 상태 사용 (초기화 반영됨)

                        currentSchedule = window.__profileEditingState;
                     } else {
                        // 편집 모드가 아니면 서버에서 가져오기

                        const currentScheduleResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
                           headers: { 'x-auth-token': token }
                        });

                        if (!currentScheduleResponse.ok) {
                           throw new Error('현재 스케줄을 가져올 수 없습니다.');
                        }

                        currentSchedule = await currentScheduleResponse.json();
                     }



                     // 개인시간으로 추가 (특정 날짜) - 한국 시간대 기준으로 정확히 처리
                     const startDateTime = new Date(eventData.startDateTime);
                     const endDateTime = new Date(eventData.endDateTime);

                     // ISO 문자열에서 직접 날짜/시간 추출 (더 안전한 방법)
                     // chatResponse.startDateTime이 이미 한국 시간대(+09:00)로 되어 있어야 함
                     const startDateTimeStr = eventData.startDateTime; // 예: "2025-09-30T16:00:00+09:00"
                     const endDateTimeStr = eventData.endDateTime;     // 예: "2025-09-30T17:00:00+09:00"

                     // ISO 문자열에서 날짜 부분만 추출 (YYYY-MM-DD)
                     const specificDate = startDateTimeStr.split('T')[0];

                     // ISO 문자열에서 시간 부분만 추출 (HH:MM)
                     const startTime = startDateTimeStr.split('T')[1].substring(0, 5);
                     const endTime = endDateTimeStr.split('T')[1].substring(0, 5);



                     const newPersonalTime = {
                        id: Date.now().toString() + Math.random().toString().substring(2),
                        title: eventData.title,
                        type: 'event',
                        startTime: startTime,
                        endTime: endTime,
                        days: [], // 특정 날짜이므로 빈 배열
                        isRecurring: false, // 특정 날짜 개인시간
                        specificDate: specificDate,
                        color: 'bg-gray-500'
                     };

                     // 기존 personalTimes 배열을 안전하게 가져와서 새 항목 추가
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



            // 로컬 일정의 경우 eventActions.addEvent도 호출하여 즉시 UI에 반영 (나의 일정 탭만)
            // setEventAddedKey가 fetchEvents를 호출하므로 eventActions.addEvent는 제거

            // 나의 일정 탭에서는 fetchEvents만 호출 (중복 방지)

            // 로컬 일정의 경우 즉시 캘린더 새로고침
            if (context.tabType === 'local') {
              if (context.context === 'profile') {
                // 프로필 탭의 경우 calendarUpdate 이벤트 발생 (추가된 데이터와 함께)
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
            if (context.context === 'profile' && context.tabType === 'local') {
               // 내 프로필 탭 - scheduleExceptions 가져오기
               eventsResponse = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
                  headers: { 'x-auth-token': token }
               });
            } else if (context.tabType === 'local') {
               // 나의 일정 탭 - 로컬 일정 목록 가져오기
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
            if (context.context === 'profile' && context.tabType === 'local') {
               // 내 프로필 탭 - scheduleExceptions와 personalTimes 모두 포함
               const exceptions = eventsData.scheduleExceptions || [];
               const personalTimes = eventsData.personalTimes || [];

               // personalTimes를 scheduleException 형태로 변환하여 합치기
               const convertedPersonalTimes = personalTimes.map(pt => ({
                  ...pt,
                  _id: pt.id,
                  isPersonalTime: true // 개인시간임을 표시
               }));

               events = [...exceptions, ...convertedPersonalTimes];
            } else if (context.tabType === 'local') {
               // 나의 일정 탭 - 로컬 이벤트는 { events: [...] } 형태
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

                  if (context.context === 'profile' && context.tabType === 'local') {
                     // 내 프로필 탭 - scheduleExceptions와 personalTimes 처리
                     if (event.isPersonalTime) {
                        // personalTimes는 범위 삭제에서 매일 적용되므로 범위 내 모든 날짜에 대해 매칭
                        eventTitle = event.title;
                        // 범위 내 모든 날짜에 대해 개인시간이 적용되는지 확인 (임시로 startDate 사용)
                        eventDate = startDate;
                     } else {
                        // scheduleExceptions 구조: { startTime (ISO), endTime (ISO), title, specificDate }
                        if (!event.startTime) return false;
                        eventDate = new Date(event.startTime);
                        eventTitle = event.title;
                     }
                  } else if (context.tabType === 'local') {
                     // 나의 일정 탭 - 로컬 이벤트 구조: { startTime, endTime, title }
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

                  if (context.context === 'profile' && context.tabType === 'local') {
                     // 내 프로필 탭 - scheduleExceptions와 personalTimes 처리
                     if (event.isPersonalTime) {
                        // personalTimes 구조: { startTime: "HH:MM", endTime: "HH:MM", title, days: [1,2,3,...] }
                        // 삭제할 날짜의 요일이 days 배열에 포함되는지 확인
                        const dayOfWeek = targetDate.getDay() === 0 ? 7 : targetDate.getDay(); // 일요일=7, 월요일=1
                        if (!event.days || !event.days.includes(dayOfWeek)) return false;

                        // 개인시간은 매일 반복되므로 targetDate를 기준으로 eventDate 생성
                        eventDate = targetDate;
                        eventTitle = event.title;
                     } else {
                        // scheduleExceptions 구조: { startTime (ISO), endTime (ISO), title, specificDate }
                        if (!event.startTime) return false;
                        eventDate = new Date(event.startTime);
                        eventTitle = event.title;
                     }
                  } else if (context.tabType === 'local') {
                     // 나의 일정 탭 - 로컬 이벤트 구조: { startTime, endTime, title }
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

               if (context.context === 'profile' && context.tabType === 'local') {
                  // 내 프로필 탭 - scheduleExceptions와 personalTimes에서 삭제
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
                  // 나의 일정 탭 또는 구글 캘린더
                  for (const event of matchingEvents) {
                     try {
                        let deleteResponse;
                        if (context.tabType === 'local') {
                           // 나의 일정 탭 - 로컬 이벤트 삭제
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
                        // Silently handle individual deletion errors
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
            
            // 일정 삭제
            const eventToDelete = matchingEvents[0];
            let deleteResponse;

            if (context.context === 'profile' && context.tabType === 'local') {
               // 내 프로필 탭 - scheduleExceptions와 personalTimes에서 삭제
               let remainingExceptions = eventsData.scheduleExceptions;
               let remainingPersonalTimes = eventsData.personalTimes;

               if (eventToDelete.isPersonalTime) {
                  // 개인시간 삭제
                  remainingPersonalTimes = eventsData.personalTimes.filter(pt =>
                     pt.id !== eventToDelete._id
                  );
               } else {
                  // scheduleExceptions 삭제
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
               // 나의 일정 탭 - 로컬 이벤트 삭제
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
            const deletedTitle = (context.context === 'profile' && context.tabType === 'local') || context.tabType === 'local' ? eventToDelete.title : eventToDelete.summary;
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