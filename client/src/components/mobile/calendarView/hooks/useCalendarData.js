/**
 * useCalendarData.js - 캘린더 데이터 페칭/상태 관리 커스텀 훅
 *
 * 📍 위치: calendarView/hooks/useCalendarData.js
 * 🔗 연결: ../../MobileCalendarView.js
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { auth } from '../../../../config/firebaseConfig';
import { userService } from '../../../../services/userService';
import * as googleCalendarService from '../../../../services/googleCalendarService';
import { useChatEnhanced } from '../../../../hooks/useChat/enhanced';
import { formatLocalDateTime, mergeSlots, formatEventForClient } from '../utils/eventUtils';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const useCalendarData = (user, calendarRef) => {
   const [defaultSchedule, setDefaultSchedule] = useState([]);
   const [scheduleExceptions, setScheduleExceptions] = useState([]);
   const [personalTimes, setPersonalTimes] = useState([]);
   const [events, setEvents] = useState([]);
   const [googleCalendarEvents, setGoogleCalendarEvents] = useState([]);
   const [isLoading, setIsLoading] = useState(true);
   const [globalEvents, setGlobalEvents] = useState([]);
   const [eventAddedKey, setEventAddedKey] = useState(0);
   const [eventActions, setEventActions] = useState({
      addEvent: async () => {},
      deleteEvent: async () => {},
      editEvent: async () => {}
   });
   const visibleRangeRef = useRef(null);
   const syncLockRef = useRef(false);
   const isLoggedIn = !!user;

   const convertScheduleToEvents = useCallback((defaultSchedule, scheduleExceptions, personalTimes) => {

      const tempEvents = [];
      const today = new Date();
      const vr = visibleRangeRef.current;
      const startDate = vr ? new Date(vr.start) : new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endDate = vr ? new Date(vr.end) : new Date(today.getFullYear(), today.getMonth() + 2, 0);

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
         const dayOfWeek = d.getDay();
         const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

         if (defaultSchedule && defaultSchedule.length > 0) {
            defaultSchedule
               .filter(slot => slot.specificDate ? slot.specificDate === dateStr : slot.dayOfWeek === dayOfWeek)
               .forEach((slot, slotIdx) => {
                  const [sh, sm] = slot.startTime.split(':').map(Number);
                  const [eh, em] = slot.endTime.split(':').map(Number);
                  const start = new Date(d); start.setHours(sh, sm, 0, 0);
                  const end = new Date(d); end.setHours(eh, em, 0, 0);
                  tempEvents.push({
                     id: `default-${slotIdx}-${dateStr}`,
                     title: '가능',
                     start: formatLocalDateTime(start),
                     end: formatLocalDateTime(end),
                     backgroundColor: '#60a5fa',
                     borderColor: '#3b82f6',
                     textColor: '#ffffff',
                     display: 'block',
                     dateKey: dateStr
                  });
               });
         }

         if (personalTimes && personalTimes.length > 0) {
            personalTimes.forEach((pt, ptIdx) => {
               const adjustedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
               const hasRecurringTime = (pt.isRecurring !== false) &&
                  ((pt.days && pt.days.includes(adjustedDayOfWeek)) ||
                   (pt.daysOfWeek && pt.daysOfWeek.includes(dayOfWeek)));


               if (hasRecurringTime || (pt.specificDate === dateStr)) {
                  const [sh, sm] = pt.startTime.split(':').map(Number);
                  const [eh, em] = pt.endTime.split(':').map(Number);
                  const start = new Date(d); start.setHours(sh, sm, 0, 0);
                  const end = new Date(d); end.setHours(eh, em, 0, 0);
                  let bgColor = pt.isGoogleEvent ? '#3b82f6' : '#ef4444';
                  let borderClr = pt.isGoogleEvent ? '#2563eb' : '#dc2626';
                  tempEvents.push({
                     id: `pt-${pt._id || pt.id || ptIdx + '-' + dateStr}`,
                     title: pt.name || pt.title || '개인',
                     start: formatLocalDateTime(start),
                     end: formatLocalDateTime(end),
                     backgroundColor: bgColor,
                     borderColor: borderClr,
                     textColor: '#ffffff',
                     display: 'block',
                     dateKey: dateStr,
                     location: pt.location,
                     locationLat: pt.locationLat,
                     locationLng: pt.locationLng,
                     participants: pt.participants || 1,
                     participantNames: pt.participantNames || [],
                     externalParticipants: pt.externalParticipants || [],
                     totalMembers: pt.totalMembers || 0,
                     isCoordinated: pt.isCoordinationConfirmed || !!(pt.suggestionId || (pt.title && pt.title.includes('-'))),
                     isGoogleEvent: pt.isGoogleEvent || false,
                     isCoordinationConfirmed: pt.isCoordinationConfirmed || false,
                     googleEventId: pt.googleEventId || null,
                     suggestionId: pt.suggestionId || null,
                     roomId: pt.roomId || null,
                     originalData: pt
                  });
               }
            });
         }
      }

      if (scheduleExceptions && scheduleExceptions.length > 0) {
         scheduleExceptions.forEach((exception, exIdx) => {
            if (exception.title === '휴무일' || exception.isHoliday || !exception.specificDate) return;
            const eventDate = new Date(exception.specificDate);
            const startTime = exception.startTime.includes('T') ? new Date(exception.startTime) : (() => {
               const [h, m] = exception.startTime.split(':').map(Number);
               const d = new Date(eventDate); d.setHours(h, m, 0, 0); return d;
            })();
            const endTime = exception.endTime.includes('T') ? new Date(exception.endTime) : (() => {
               const [h, m] = exception.endTime.split(':').map(Number);
               const d = new Date(eventDate); d.setHours(h, m, 0, 0); return d;
            })();
            tempEvents.push({
               id: exception.id || `ex-${exIdx}-${exception.specificDate}`,
               title: exception.title || '예외',
               start: formatLocalDateTime(startTime),
               end: formatLocalDateTime(endTime),
               backgroundColor: '#a78bfa',
               borderColor: '#8b5cf6',
               textColor: '#ffffff',
               display: 'block',
               dateKey: exception.specificDate,
               location: exception.location,
               locationLat: exception.locationLat,
               locationLng: exception.locationLng,
               originalData: exception
            });
         });
      }

      const eventsByDate = {};
      tempEvents.forEach(event => {
         if (!eventsByDate[event.dateKey]) eventsByDate[event.dateKey] = [];
         eventsByDate[event.dateKey].push(event);
      });

      const mergedEvents = [];
      Object.keys(eventsByDate).forEach(dateKey => {
         const dateEvents = mergeSlots(eventsByDate[dateKey]);
         dateEvents.forEach(event => { delete event.dateKey; mergedEvents.push(event); });
      });
      return mergedEvents;
   }, []);

   const fetchSchedule = useCallback(async () => {
      try {
         setIsLoading(true);
         const data = await userService.getUserSchedule();
         setDefaultSchedule(data.defaultSchedule || []);
         setScheduleExceptions(data.scheduleExceptions || []);
         setPersonalTimes(data.personalTimes || []);

         const hasGoogleCalendar = !!user?.google?.refreshToken;
         if (hasGoogleCalendar) {
            try {
               const threeMonthsAgo = new Date();
               threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
               const oneYearLater = new Date();
               oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
               const gEvents = await googleCalendarService.getEvents(
                  threeMonthsAgo.toISOString(),
                  oneYearLater.toISOString()
               );
               const formattedGoogleEvents = gEvents.map(e => {
                  const participants = e.participants || 1;
                  const externalParticipants = e.externalParticipants || [];
                  let participantNames = [];

                  if (e.description) {
                     const namesMatch = e.description.match(/참석:\s*(.+?)(?:\n|$)/);
                     if (namesMatch) participantNames = namesMatch[1].split(',').map(n => n.trim());
                  }

                  const isCoordinated =
                     e.extendedProperties?.private?.isCoordinationConfirmed === 'true' ||
                     (e.summary && e.summary.includes('[약속]'));
                  const suggestionId = e.extendedProperties?.private?.suggestionId || null;
                  const roomId = e.extendedProperties?.private?.roomId || null;
                  return {
                     ...e,
                     participants: participants || 1,
                     participantNames: participantNames,
                     externalParticipants: externalParticipants,
                     isCoordinated: isCoordinated,
                     suggestionId: suggestionId,
                     roomId: roomId,
                     isGoogleEvent: true,
                     googleEventId: e.googleEventId || e.id,
                     backgroundColor: '#3b82f6',
                     borderColor: '#2563eb',
                  };
               });
               setGoogleCalendarEvents(formattedGoogleEvents);

               if (!syncLockRef.current) {
                  syncLockRef.current = true;
                  try {
                     const syncToken = await auth.currentUser?.getIdToken();
                     const syncRes = await fetch(`${API_BASE_URL}/api/calendar/sync-from-google`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${syncToken}` }
                     });
                     if (syncRes.ok) {
                        const syncData = await syncRes.json();
                        if (syncData.removed > 0) {
                           console.log(`[syncFromGoogle] ${syncData.removed}개 일정 DB에서 제거됨, 재로딩`);
                           const refreshed = await userService.getUserSchedule();
                           setPersonalTimes(refreshed.personalTimes || []);
                        }
                     } else {
                        console.warn('역동기화 응답 에러:', syncRes.status);
                     }
                  } catch (syncErr) {
                     console.warn('역동기화 실패:', syncErr);
                  } finally {
                     syncLockRef.current = false;
                  }
               }
            } catch (gErr) {
               console.warn('구글 캘린더 이벤트 로딩 실패:', gErr);
               setGoogleCalendarEvents([]);
            }
         } else {
            setGoogleCalendarEvents([]);
         }
      } catch (err) {
         console.error('일정 로딩 실패:', err);
      } finally {
         setIsLoading(false);
      }
   }, [convertScheduleToEvents, user]);

   useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

   // 챗봇 등 외부에서 calendarUpdate 이벤트를 발생시킬 때 스케줄을 다시 불러옴
   useEffect(() => {
       const handleCalendarUpdate = (event) => {
           fetchSchedule();
       };
       window.addEventListener('calendarUpdate', handleCalendarUpdate);
       return () => {
           window.removeEventListener('calendarUpdate', handleCalendarUpdate);
       };
   }, [fetchSchedule]);

   // 구글 캘린더 역동기화 폴링 (30초 간격 + 탭 포커스 시)
   const syncFromGoogleLight = useCallback(async () => {
      const hasGoogleCalendar = !!user?.google?.refreshToken;
      if (!hasGoogleCalendar) return;
      if (syncLockRef.current) return;
      syncLockRef.current = true;
      try {
         const token = await auth.currentUser?.getIdToken();
         if (!token) return;
         const res = await fetch(`${API_BASE_URL}/api/calendar/sync-from-google`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
         });
         if (res.ok) {
            const data = await res.json();
            if (data.removed > 0) {
               console.log(`[syncFromGoogle polling] ${data.removed}개 삭제 감지, 새로고침`);
               const refreshed = await userService.getUserSchedule();
               setPersonalTimes(refreshed.personalTimes || []);
               const threeMonthsAgo = new Date();
               threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
               const oneYearLater = new Date();
               oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
               const gEvents = await googleCalendarService.getEvents(
                  threeMonthsAgo.toISOString(), oneYearLater.toISOString()
               );
               setGoogleCalendarEvents(gEvents.map(e => ({
                  ...e, isGoogleEvent: true, googleEventId: e.googleEventId || e.id,
                  backgroundColor: '#3b82f6', borderColor: '#2563eb',
               })));
            }
         }
      } catch (err) {
         // 폴링 실패는 무시
      } finally {
         syncLockRef.current = false;
      }
   }, [user]);

   useEffect(() => {
      const hasGoogleCalendar = !!user?.google?.refreshToken;
      if (!hasGoogleCalendar) return;

      const interval = setInterval(syncFromGoogleLight, 30000);

      const handleVisibility = () => {
         if (document.visibilityState === 'visible') {
            syncFromGoogleLight();
         }
      };
      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
         clearInterval(interval);
         document.removeEventListener('visibilitychange', handleVisibility);
      };
   }, [syncFromGoogleLight]);

   // personalTimes/defaultSchedule/scheduleExceptions 변경 시 events 재계산
   useEffect(() => {
      if (!isLoading && calendarRef.current) {
          const calendarApi = calendarRef.current.getApi();
          const calendarEvents = convertScheduleToEvents(defaultSchedule, scheduleExceptions, personalTimes);
          const dbGoogleEventIds = new Set(
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
          const filteredGoogleEvents = googleCalendarEvents.filter(ge => {
             if (ge.extendedProperties?.private?.source === 'meetagent') return false;
             if (ge.googleEventId && dbGoogleEventIds.has(ge.googleEventId)) return false;
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
          const allEvents = [...calendarEvents, ...filteredGoogleEvents];
          setEvents(allEvents);

          Promise.resolve().then(() => {
              calendarApi.removeAllEvents();
              calendarApi.addEventSource(allEvents);
          });
      }
  }, [defaultSchedule, scheduleExceptions, personalTimes, googleCalendarEvents, isLoading, convertScheduleToEvents, calendarRef]);

   const fetchGlobalEvents = useCallback(async () => {
      if (!isLoggedIn) return;
      try {
         const currentUser = auth.currentUser;
         if (!currentUser) return;

         const response = await fetch(`${API_BASE_URL}/api/events`, {
            headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
         });
         if (!response.ok) throw new Error('Failed to fetch events');
         const data = await response.json();
         const formattedEvents = data.events.map(event => formatEventForClient(event));
         setGlobalEvents(formattedEvents);
      } catch (error) {
         console.error('이벤트 가져오기 실패:', error);
      }
   }, [isLoggedIn, user]);

   const handleAddGlobalEvent = useCallback(async eventData => {
      try {
         let date, time, duration;
         if (eventData.startDateTime) {
            const startDate = new Date(eventData.startDateTime);
            const endDate = eventData.endDateTime ? new Date(eventData.endDateTime) : new Date(startDate.getTime() + 60 * 60 * 1000);
            date = startDate.toISOString().split('T')[0];
            time = startDate.toTimeString().substring(0, 5);
            duration = Math.round((endDate - startDate) / (60 * 1000));
         } else {
            date = eventData.date; time = eventData.time; duration = eventData.duration || 60;
         }
         const payload = { title: eventData.title, date, time, duration, priority: eventData.priority || 3, participants: eventData.participants || [], color: eventData.color || 'blue' };
         const currentUser = auth.currentUser;
         if (!currentUser) throw new Error('로그인이 필요합니다.');
         const response = await fetch(`${API_BASE_URL}/api/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await currentUser.getIdToken()}` },
            body: JSON.stringify(payload),
         });
         if (!response.ok) throw new Error('Failed to add event');
         const savedEvent = await response.json();
         const newEvent = formatEventForClient(savedEvent, eventData.color);
         setGlobalEvents(prevEvents => [...prevEvents, newEvent]);
         return newEvent;
      } catch (error) { throw error; }
   }, []);

   const handleDeleteEvent = useCallback(async eventId => {
      try {
         const currentUser = auth.currentUser;
         if (!currentUser) throw new Error('로그인이 필요합니다.');
         await fetch(`${API_BASE_URL}/api/events/${eventId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` },
         });
         setGlobalEvents(prevEvents => prevEvents.filter(e => e.id !== eventId));
      } catch (error) { throw error; }
   }, []);

   const handleEditEvent = useCallback(async (eventId, eventData) => {
      try {
         const currentUser = auth.currentUser;
         if (!currentUser) throw new Error('로그인이 필요합니다.');
         const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await currentUser.getIdToken()}` },
            body: JSON.stringify(eventData),
         });
         const updatedEvent = await response.json();
         const formattedEvent = formatEventForClient(updatedEvent);
         setGlobalEvents(prevEvents => prevEvents.map(e => e.id === eventId ? formattedEvent : e));
         return formattedEvent;
      } catch (error) { throw error; }
   }, []);

   useEffect(() => {
      if (isLoggedIn) {
         setEventActions({ addEvent: handleAddGlobalEvent, deleteEvent: handleDeleteEvent, editEvent: handleEditEvent });
      }
   }, [isLoggedIn, handleAddGlobalEvent, handleDeleteEvent, handleEditEvent]);

   useEffect(() => {
      if (isLoggedIn && eventAddedKey > 0) fetchGlobalEvents();
   }, [eventAddedKey, isLoggedIn, fetchGlobalEvents]);

   const chatEnhanced = useChatEnhanced(isLoggedIn, setEventAddedKey, eventActions);

   return {
      defaultSchedule, setDefaultSchedule,
      scheduleExceptions, setScheduleExceptions,
      personalTimes, setPersonalTimes,
      events, setEvents,
      googleCalendarEvents, setGoogleCalendarEvents,
      isLoading,
      globalEvents,
      visibleRangeRef,
      fetchSchedule,
      fetchGlobalEvents,
      convertScheduleToEvents,
      chatEnhanced,
      isLoggedIn,
      eventActions,
      setEventAddedKey,
   };
};

export default useCalendarData;
