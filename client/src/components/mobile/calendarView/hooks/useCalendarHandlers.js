/**
 * useCalendarHandlers.js - 캘린더 이벤트 핸들러 생성 함수
 *
 * 📍 위치: calendarView/hooks/useCalendarHandlers.js
 * 🔗 연결: ../../MobileCalendarView.js
 */

import { auth } from '../../../../config/firebaseConfig';
import { userService } from '../../../../services/userService';
import * as googleCalendarService from '../../../../services/googleCalendarService';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export const createCalendarHandlers = (ctx) => {
   const {
      defaultSchedule, setDefaultSchedule,
      scheduleExceptions, setScheduleExceptions,
      personalTimes, setPersonalTimes,
      events, setEvents,
      googleCalendarEvents, setGoogleCalendarEvents,
      initialState, setInitialState,
      isEditing, setIsEditing,
      calendarRef, selectedDate, setSelectedDate,
      visibleRangeRef,
      fetchSchedule, fetchGlobalEvents,
      showToast, setConfirmModal, setSelectedEvent,
      navigate,
      convertScheduleToEvents,
      user,
      isChatOpen, setIsChatOpen,
      chatEnhanced, globalEvents,
      setIsVoiceEnabled,
      setShowMapModal, setSelectedLocation,
      setCalendarView, setCurrentTitle,
   } = ctx;

   const handleStartEdit = () => {
      setInitialState({
         defaultSchedule: [...defaultSchedule],
         scheduleExceptions: [...scheduleExceptions],
         personalTimes: [...personalTimes],
         googleCalendarEvents: [...googleCalendarEvents]
      });
      setIsEditing(true);
   };

   const handleCancel = () => {
      if (initialState) {
         setDefaultSchedule([...initialState.defaultSchedule]);
         setScheduleExceptions([...initialState.scheduleExceptions]);
         setPersonalTimes([...initialState.personalTimes]);
         setGoogleCalendarEvents([...initialState.googleCalendarEvents]);
      }
      setIsEditing(false);
      setInitialState(null);
      fetchSchedule();
   };

   const handleSave = async () => {
      try {
         const token = await auth.currentUser?.getIdToken();

         // 편집 중 삭제된 구글 캘린더 이벤트 실제 삭제
         if (initialState && token) {
            const currentGoogleIds = new Set(googleCalendarEvents.map(e => e.googleEventId));
            const deletedGoogleEvents = initialState.googleCalendarEvents.filter(
               e => e.googleEventId && !currentGoogleIds.has(e.googleEventId)
            );

            let rejectedCount = 0;
            let deletedCount = 0;

            for (const event of deletedGoogleEvents) {
               if (event.isBirthdayEvent || event.title?.includes('생일')) continue;
               try {
                  let deleted = false;
                  const suggestionId = event.suggestionId || event.extendedProperties?.private?.suggestionId;
                  const ptId = event.originalData?._id || event.originalData?.id;
                  if (ptId && suggestionId) {
                     const resp = await fetch(`${API_BASE_URL}/api/users/profile/schedule/${ptId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                     });
                     if (resp.ok) {
                        const result = await resp.json();
                        if (result.action === 'rejected') rejectedCount++;
                        else if (result.action === 'deleted') deletedCount++;
                        deleted = true;
                     }
                  }
                  if (!deleted && event.googleEventId) {
                     await googleCalendarService.deleteEvent(event.googleEventId);
                     deletedCount++;
                  }
               } catch (err) {
                  console.warn('구글 일정 삭제 실패:', event.googleEventId, err);
               }
            }

            if (rejectedCount > 0 || deletedCount > 0) {
               const msgs = [];
               if (rejectedCount > 0) msgs.push(`${rejectedCount}건 불참 처리`);
               if (deletedCount > 0) msgs.push(`${deletedCount}건 삭제`);
               showToast(`${msgs.join(', ')}되었습니다.`);
            }
         }

         // 편집 중 삭제된 suggestion 일정 → 서버에서 불참/삭제 처리 (일반 사용자만)
         if (initialState && token) {
            const currentPtIds = new Set(personalTimes.map(pt => (pt._id || pt.id)?.toString()));
            const deletedSuggestionPts = initialState.personalTimes.filter(
               pt => pt.suggestionId && !pt.isGoogleEvent && !(currentPtIds.has((pt._id || pt.id)?.toString()))
            );

            let sugRejected = 0;
            let sugDeleted = 0;
            for (const pt of deletedSuggestionPts) {
               try {
                  const ptId = pt._id || pt.id;
                  const response = await fetch(`${API_BASE_URL}/api/users/profile/schedule/${ptId}`, {
                     method: 'DELETE',
                     headers: { 'Authorization': `Bearer ${token}` }
                  });
                  if (response.ok) {
                     const result = await response.json();
                     if (result.action === 'rejected') sugRejected++;
                     else if (result.action === 'deleted') sugDeleted++;
                  }
               } catch (err) {
                  console.warn('제안 일정 삭제 처리 실패:', pt.suggestionId, err);
               }
            }

            if (sugRejected > 0 || sugDeleted > 0) {
               const msgs = [];
               if (sugRejected > 0) msgs.push(`${sugRejected}건 불참 처리`);
               if (sugDeleted > 0) msgs.push(`${sugDeleted}건 삭제`);
               showToast(`${msgs.join(', ')}되었습니다.`);
            }
         }

         const dbPersonalTimes = personalTimes.filter(pt => !pt.isGoogleEvent);
         await userService.updateUserSchedule({ defaultSchedule, scheduleExceptions, personalTimes: dbPersonalTimes });
         showToast('저장되었습니다.');
         setIsEditing(false);
         setInitialState(null);
         await fetchSchedule();
      } catch (error) { showToast('저장 실패'); }
   };

   const handleClearAll = () => {
      setConfirmModal({
         isOpen: true,
         title: '전체 삭제',
         message: '모두 삭제하시겠습니까?',
         onConfirm: async () => {
            if (isEditing) {
               setDefaultSchedule([]);
               setScheduleExceptions([]);
               setPersonalTimes([]);
               setGoogleCalendarEvents(prev => prev.filter(e => e.isBirthdayEvent || e.title?.includes('생일')));
               setEvents([]);
               return;
            }

            try {
               const loginMethod = localStorage.getItem('loginMethod') || '';
               const token = await auth.currentUser?.getIdToken();

               if (loginMethod === 'google' && googleCalendarEvents.length > 0) {
                  let deletedCount = 0;
                  for (const event of googleCalendarEvents) {
                     try {
                        if (event.isBirthdayEvent || event.title?.includes('생일')) {
                           console.log('생일 이벤트 스킵:', event.title);
                           continue;
                        }

                        const suggestionId = event.suggestionId || event.extendedProperties?.private?.suggestionId;
                        if (suggestionId) {
                           const res = await fetch(`${API_BASE_URL}/api/users/profile/schedule/google/${suggestionId}`, {
                              method: 'DELETE',
                              headers: { Authorization: `Bearer ${token}` }
                           });
                           if (res.ok) deletedCount++;
                        } else {
                           const res = await fetch(`${API_BASE_URL}/api/calendar/events/${event.id}`, {
                              method: 'DELETE',
                              headers: { Authorization: `Bearer ${token}` }
                           });
                           if (res.ok || res.status === 204) deletedCount++;
                        }
                     } catch (err) {
                        console.warn('구글 일정 삭제 실패:', event.id, err);
                     }
                  }
                  console.log(`✅ 구글 캘린더 ${deletedCount}개 일정 삭제 완료`);
                  setGoogleCalendarEvents([]);
               }

               await userService.updateUserSchedule({ defaultSchedule: [], scheduleExceptions: [], personalTimes: [] });
               setDefaultSchedule([]); setScheduleExceptions([]); setPersonalTimes([]); setEvents([]);
               await fetchSchedule();
            } catch (error) { showToast('초기화 실패'); }
         }
      });
   };

   const handleDateClick = (arg) => {
      setSelectedDate(arg.date);
   };

   const handleEventClick = (clickInfo) => {
      const eventObj = clickInfo.event;

      if (eventObj.title === '가능' || eventObj.title === '선호시간') {
         setSelectedDate(eventObj.start);
         return;
      }

      setSelectedDate(eventObj.start);

      let originalEvent = events.find(e => e.id === eventObj.id);
      if (!originalEvent) {
         const eventStart = eventObj.start?.toISOString();
         originalEvent = events.find(e => {
            const eStart = new Date(e.start).toISOString();
            return eStart === eventStart && e.title === eventObj.title;
         });
      }
      if (originalEvent) {
         setSelectedEvent({
            ...originalEvent,
            date: new Date(originalEvent.start).toLocaleDateString('en-CA'),
            time: new Date(originalEvent.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
            endTime: new Date(originalEvent.end).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
            location: originalEvent.location || null,
            participants: originalEvent.participants ?? 0,
            participantNames: originalEvent.participantNames || [],
            externalParticipants: originalEvent.externalParticipants || [],
            isCoordinated: originalEvent.isCoordinated || false,
            hasTravelTime: originalEvent.hasTravelTime || false
         });
      } else {
         setSelectedEvent({
            title: eventObj.title,
            date: eventObj.start.toLocaleDateString('en-CA'),
            time: eventObj.start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
            endTime: eventObj.end ? eventObj.end.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
            backgroundColor: eventObj.backgroundColor
         });
      }
   };

   const handleDeleteScheduleEvent = async (event) => {
      try {
         const currentUser = auth.currentUser;
         if (!currentUser) return;

         if (isEditing) {
            const originalId = event.originalData?.id || event.originalData?._id;
            const eventTitle = event.title;
            const eventDate = event.date;
            const eventTime = event.time;
            const eventId = event.id;

            const newPersonalTimes = personalTimes.filter(pt => {
               const ptId = pt.id || pt._id;
               if (originalId && ptId === originalId) return false;
               if (pt.title === eventTitle && pt.specificDate === eventDate && pt.startTime === eventTime) return false;
               return true;
            });
            setPersonalTimes(newPersonalTimes);

            let newGoogleEvents = googleCalendarEvents;
            if (event.isGoogleEvent && event.googleEventId) {
               newGoogleEvents = googleCalendarEvents.filter(ge => ge.googleEventId !== event.googleEventId);
               setGoogleCalendarEvents(newGoogleEvents);
            }

            const newEvents = events.filter(e => e.id !== eventId);
            setEvents(newEvents);

            if (calendarRef.current) {
               const calendarApi = calendarRef.current.getApi();
               calendarApi.removeAllEvents();
               calendarApi.addEventSource(newEvents);
            }

            setSelectedEvent(null);
            return;
         }

         const token = await currentUser.getIdToken();

         const roomId = event.originalData?.roomId || event.extendedProperties?.private?.roomId;
         const eventTitle = event.title || event.summary || '일정';
         const suggestionId = event.suggestionId || event.originalData?.suggestionId || event.extendedProperties?.private?.suggestionId;

         let deleteAction = null;

         if (event.id && event.id.startsWith('pt-')) {
            const personalTimeId = event.id.replace('pt-', '');
            const response = await fetch(`${API_BASE_URL}/api/users/profile/schedule/${personalTimeId}`, {
               method: 'DELETE',
               headers: { 'Authorization': `Bearer ${token}` },
            });
            if (response.ok) {
               const result = await response.json();
               deleteAction = result.action;
               if (result.action === 'rejected') {
                  showToast('불참 처리되었습니다.');
               } else if (result.action === 'deleted') {
                  showToast('일정이 삭제되었습니다.');
               }
            } else if (event.isGoogleEvent && event.googleEventId) {
               await googleCalendarService.deleteEvent(event.googleEventId);
               showToast('구글 캘린더에서 삭제되었습니다.');
            } else {
               throw new Error('Failed to delete personal time');
            }
         } else if (event.isGoogleEvent && event.googleEventId) {
            if (event.isBirthdayEvent) {
               showToast('생일 이벤트는 Google 연락처에서 관리되어 삭제할 수 없습니다.');
               setSelectedEvent(null);
               return;
            }
            if (suggestionId) {
               const response = await fetch(`${API_BASE_URL}/api/users/profile/schedule/google/${suggestionId}`, {
                  method: 'DELETE',
                  headers: { 'Authorization': `Bearer ${token}` },
               });
               if (response.ok) {
                  const result = await response.json();
                  deleteAction = result.action;
               } else {
                  await googleCalendarService.deleteEvent(event.googleEventId);
               }
            } else {
               await googleCalendarService.deleteEvent(event.googleEventId);
            }
         } else {
            const response = await fetch(`${API_BASE_URL}/api/events/${event.id}`, {
               method: 'DELETE',
               headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) throw new Error('Failed to delete event');
         }

         if (roomId && !deleteAction && !suggestionId) {
            try {
               await fetch(`${API_BASE_URL}/api/chat/${roomId}/member-decline`, {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                     'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({ eventTitle })
               });
               console.log(`✅ 조율방(${roomId})에 불참 알림 전송 완료`);
            } catch (notifyErr) {
               console.warn('조율방 불참 알림 실패:', notifyErr);
            }
         }

         setSelectedEvent(null);
         await fetchSchedule();
      } catch (error) {
         console.error('Delete event error:', error);
         showToast('일정 삭제에 실패했습니다.');
      }
   };

   const handleSplitItemClick = (event) => {
      setSelectedEvent({
         ...event,
         date: new Date(event.start).toLocaleDateString('en-CA'),
         time: new Date(event.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
         endTime: new Date(event.end).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
      });
   };

   const handleOpenMap = (address, lat, lng) => { setSelectedLocation({ address, lat, lng }); setShowMapModal(true); };
   const handleCloseMapModal = () => { setShowMapModal(false); setSelectedLocation(null); };

   const handleViewChange = (viewInfo) => {
      setCalendarView(viewInfo.view.type);
      setCurrentTitle(viewInfo.view.title);
      const newRange = { start: viewInfo.view.activeStart, end: viewInfo.view.activeEnd };
      const prev = visibleRangeRef.current;
      if (!prev || prev.start?.getTime() !== newRange.start.getTime() || prev.end?.getTime() !== newRange.end.getTime()) {
         visibleRangeRef.current = newRange;
         const calendarEvents = convertScheduleToEvents(defaultSchedule, scheduleExceptions, personalTimes);
         const dbGoogleIds = new Set(
            personalTimes.filter(pt => pt.googleEventId).map(pt => pt.googleEventId)
         );
         const dbSuggestionIds = new Set(
            personalTimes.filter(pt => pt.suggestionId).map(pt => pt.suggestionId)
         );
         const dbEventKeys = new Set(
            personalTimes.filter(pt => pt.specificDate && pt.startTime).map(pt =>
               `${pt.title}|${pt.specificDate}|${pt.startTime}`
            )
         );
         const filteredGEvts = googleCalendarEvents.filter(ge => {
            if (ge.extendedProperties?.private?.source === 'meetagent') return false;
            if (ge.googleEventId && dbGoogleIds.has(ge.googleEventId)) return false;
            const geSuggestionId = ge.extendedProperties?.private?.suggestionId;
            if (geSuggestionId && dbSuggestionIds.has(geSuggestionId)) return false;
            if (ge.start?.dateTime && ge.summary) {
               const geDate = ge.start.dateTime.substring(0, 10);
               const geTime = ge.start.dateTime.substring(11, 16);
               const geKey = `${ge.summary}|${geDate}|${geTime}`;
               if (dbEventKeys.has(geKey)) return false;
            }
            return true;
         });
         const allEvts = [...calendarEvents, ...filteredGEvts];
         setEvents(allEvts);
         if (calendarRef.current) {
            const calendarApi = calendarRef.current.getApi();
            Promise.resolve().then(() => {
               calendarApi.removeAllEvents();
               calendarApi.addEventSource(allEvts);
            });
         }
      }
      if (viewInfo.view.type !== 'dayGridMonth') {
         const today = new Date();
         const vs = viewInfo.view.currentStart;
         const ve = viewInfo.view.currentEnd;
         setSelectedDate(today >= vs && today < ve ? today : vs);
      } else {
         setSelectedDate(null);
      }
   };

   const handleLogout = async () => {
      try { await auth.signOut(); localStorage.removeItem('loginMethod'); navigate('/auth'); }
      catch (error) { console.error('Logout error:', error); }
   };

   const handleChatMessage = async (message, additionalContext = {}) => {
      try {
         if (!chatEnhanced || !chatEnhanced.handleChatMessage) return { success: false, message: '챗봇이 준비 중입니다.' };
         const loginMethod = localStorage.getItem('loginMethod') || '';
         const hasGoogleCalendar = !!user?.google?.refreshToken;
         const tabType = 'local';
         const context = 'profile';
         const result = await chatEnhanced.handleChatMessage(message, { context, tabType, loginMethod, hasGoogleCalendar, currentEvents: globalEvents, ...additionalContext });
         console.log('[handleChatMessage] 결과:', result);
         await fetchSchedule();
         await fetchGlobalEvents();
         return result;
      } catch (error) {
         console.error('[handleChatMessage] 에러:', error);
         return { success: false, message: '메시지 처리 중 오류 발생' };
      }
   };

   const handleStartVoiceRecognition = async () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) { showToast('음성 인식을 지원하지 않습니다.'); return; }

      try {
         const permResult = await navigator.permissions.query({ name: 'microphone' });
         if (permResult.state === 'denied') {
            showToast('마이크 권한이 차단되어 있습니다. 브라우저 설정에서 허용해주세요.');
            return;
         }
      } catch (e) {
         // permissions API 미지원 브라우저 → 그냥 진행
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'ko-KR';
      recognition.onstart = () => setIsVoiceEnabled(true);
      recognition.onresult = async (event) => {
         const transcript = event.results[0][0].transcript;
         if (!isChatOpen) setIsChatOpen(true);
         await handleChatMessage(transcript);
      };
      recognition.onerror = (e) => {
         setIsVoiceEnabled(false);
         if (e.error === 'not-allowed') {
            showToast('마이크 권한이 차단되어 있습니다. 브라우저 설정에서 허용해주세요.');
         }
      };
      recognition.onend = () => setIsVoiceEnabled(false);
      recognition.start();
   };

   return {
      handleStartEdit, handleCancel, handleSave, handleClearAll,
      handleDateClick, handleEventClick, handleDeleteScheduleEvent,
      handleSplitItemClick, handleOpenMap, handleCloseMapModal,
      handleViewChange, handleLogout, handleChatMessage,
      handleStartVoiceRecognition,
   };
};
