import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Menu, LogOut, User, Calendar, Clipboard, ClipboardX, Phone, Settings, FileText } from 'lucide-react';
import { auth } from '../../config/firebaseConfig';
import { userService } from '../../services/userService';
import * as googleCalendarService from '../../services/googleCalendarService';
import { useChatEnhanced } from '../../hooks/useChat/enhanced';
import SimplifiedScheduleDisplay from './SimplifiedScheduleDisplay';
import BottomNavigation from './BottomNavigation';
import MobilePersonalInfoEdit from './MobilePersonalInfoEdit';
import MobileScheduleEdit from './MobileScheduleEdit';
import ChatBox from '../chat/ChatBox';
import EventDetailModal, { MapModal } from './EventDetailModal';
import './MobileCalendarView.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const MobileCalendarView = ({ user }) => {
   const navigate = useNavigate();
   const [searchParams, setSearchParams] = useSearchParams();
   const calendarRef = useRef(null);
   const [events, setEvents] = useState([]);
   const [isLoading, setIsLoading] = useState(true);
   const [selectedDate, setSelectedDate] = useState(new Date());
   const [calendarView, setCalendarView] = useState('dayGridMonth');
   const [showPersonalInfo, setShowPersonalInfo] = useState(false);
   const [showScheduleEdit, setShowScheduleEdit] = useState(false);
   const [isChatOpen, setIsChatOpen] = useState(searchParams.get('chat') === 'open');
   const [isEditing, setIsEditing] = useState(false);
   const [initialState, setInitialState] = useState(null);
   const [currentTitle, setCurrentTitle] = useState('');

   const [touchStart, setTouchStart] = useState(null);
   const [translateY, setTranslateY] = useState(0);
   const [isSwiping, setIsSwiping] = useState(false);

   const [selectedEvent, setSelectedEvent] = useState(null);
   const [showMapModal, setShowMapModal] = useState(false);
   const [selectedLocation, setSelectedLocation] = useState(null);

   const [defaultSchedule, setDefaultSchedule] = useState([]);
   const [scheduleExceptions, setScheduleExceptions] = useState([]);
   const [personalTimes, setPersonalTimes] = useState([]);

   const [globalEvents, setGlobalEvents] = useState([]);
   const [googleCalendarEvents, setGoogleCalendarEvents] = useState([]);
   const [eventAddedKey, setEventAddedKey] = useState(0);
   const [eventActions, setEventActions] = useState({
      addEvent: async () => {},
      deleteEvent: async () => {},
      editEvent: async () => {}
   });
   const isLoggedIn = !!user;

   // chat=open 쿼리 파라미터 정리
   useEffect(() => {
      if (searchParams.get('chat') === 'open') {
         searchParams.delete('chat');
         setSearchParams(searchParams, { replace: true });
      }
   }, []);

   const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
   const [isClipboardMonitoring, setIsClipboardMonitoring] = useState(false);
   const [isBackgroundMonitoring, setIsBackgroundMonitoring] = useState(false);
   const [isSidebarOpen, setIsSidebarOpen] = useState(false);

   const formatLocalDateTime = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
   };

   const mergeSlots = (slots) => {
      if (slots.length === 0) return [];
      const sorted = [...slots].sort((a, b) => new Date(a.start) - new Date(b.start));
      const merged = [];
      let current = { ...sorted[0] };
      for (let i = 1; i < sorted.length; i++) {
         const slot = sorted[i];
         const currentEnd = new Date(current.end);
         const slotStart = new Date(slot.start);
         if (currentEnd.getTime() === slotStart.getTime() && current.title === slot.title && current.backgroundColor === slot.backgroundColor) {
            current.end = slot.end;
         } else {
            merged.push(current);
            current = { ...slot };
         }
      }
      merged.push(current);
      return merged;
   };

   const visibleRangeRef = useRef(null);

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


               if (hasRecurringTime || (pt.isRecurring === false && pt.specificDate === dateStr)) {
                  const [sh, sm] = pt.startTime.split(':').map(Number);
                  const [eh, em] = pt.endTime.split(':').map(Number);
                  const start = new Date(d); start.setHours(sh, sm, 0, 0);
                  const end = new Date(d); end.setHours(eh, em, 0, 0);
                  tempEvents.push({
                     id: pt.id || `pt-${ptIdx}-${dateStr}`,
                     title: pt.name || pt.title || '개인',
                     start: formatLocalDateTime(start),
                     end: formatLocalDateTime(end),
                     backgroundColor: '#ef4444',
                     borderColor: '#dc2626',
                     textColor: '#ffffff',
                     display: 'block',
                     dateKey: dateStr,
                     location: pt.location,
                     locationLat: pt.locationLat,
                     locationLng: pt.locationLng,
                     participants: pt.participants || 1,
                     participantNames: pt.participantNames || [],
                     totalMembers: pt.totalMembers || 0,
                     isCoordinated: !!(pt.suggestionId || (pt.title && pt.title.includes('-'))),
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
         const loginMethod = localStorage.getItem('loginMethod') || (user?.google?.refreshToken ? 'google' : '');
         const isGoogleUser = loginMethod === 'google' && user?.google?.refreshToken;

         if (isGoogleUser) {
            // 구글 로그인 사용자: 구글 캘린더만 사용 (DB 스케줄 X)
            setDefaultSchedule([]);
            setScheduleExceptions([]);
            setPersonalTimes([]);
            try {
               const threeMonthsAgo = new Date();
               threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
               const oneYearLater = new Date();
               oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
               const gEvents = await googleCalendarService.getEvents(
                  threeMonthsAgo.toISOString(),
                  oneYearLater.toISOString()
               );
               // 구글 캘린더 이벤트에서 참석자 정보 파싱
               const formattedGoogleEvents = gEvents.map(e => {
                  let participants = 0;
                  let participantNames = [];
                  if (e.description) {
                     const countMatch = e.description.match(/참석자:\s*(\d+)명/);
                     if (countMatch) participants = parseInt(countMatch[1], 10);
                     const namesMatch = e.description.match(/참석:\s*(.+?)(?:\n|$)/);
                     if (namesMatch) participantNames = namesMatch[1].split(',').map(n => n.trim());
                  }
                  const isCoordinated = e.title && e.title.includes('[약속]');
                  return {
                     ...e,
                     participants: participants,
                     participantNames: participantNames,
                     isCoordinated: isCoordinated,
                     backgroundColor: isCoordinated ? '#3b82f6' : '#22c55e',
                     borderColor: isCoordinated ? '#2563eb' : '#16a34a',
                  };
               });
               setGoogleCalendarEvents(formattedGoogleEvents);
            } catch (gErr) {
               console.warn('구글 캘린더 이벤트 로딩 실패:', gErr);
               setGoogleCalendarEvents([]);
            }
         } else {
            // 일반 로그인 사용자: 기존 DB 캘린더 사용
            const data = await userService.getUserSchedule();
            setDefaultSchedule(data.defaultSchedule || []);
            setScheduleExceptions(data.scheduleExceptions || []);
            setPersonalTimes(data.personalTimes || []);
            setGoogleCalendarEvents([]);
         }
      } catch (err) {
         console.error('일정 로딩 실패:', err);
      } finally {
         setIsLoading(false);
      }
   }, [convertScheduleToEvents, user]);;

   useEffect(() => { fetchSchedule(); }, [fetchSchedule]);
   
   // 챗봇 등 외부에서 calendarUpdate 이벤트를 발생시킬 때 스케줄을 다시 불러옴
   useEffect(() => {
       const handleCalendarUpdate = (event) => {
           fetchSchedule(); // Re-fetch data when a calendar update event is received
       };
   
       window.addEventListener('calendarUpdate', handleCalendarUpdate);
   
       return () => {
           window.removeEventListener('calendarUpdate', handleCalendarUpdate);
       };
   }, [fetchSchedule]);

   // personalTimes/defaultSchedule/scheduleExceptions 변경 시 events 재계산
   useEffect(() => {
      // isLoading이 false일 때 (즉, 데이터 로딩이 완료되었을 때) 실행
      if (!isLoading && calendarRef.current) {
          const calendarApi = calendarRef.current.getApi();
          const calendarEvents = convertScheduleToEvents(defaultSchedule, scheduleExceptions, personalTimes);
          const allEvents = [...calendarEvents, ...googleCalendarEvents];

          // React 상태 업데이트 (하단 리스트 등 다른 UI 요소에 필요)
          setEvents(allEvents);
  
          // FullCalendar API 호출을 마이크로태스크로 연기하여 React 렌더링 사이클 완료 후 실행
          Promise.resolve().then(() => {
              calendarApi.removeAllEvents();
              calendarApi.addEventSource(allEvents);
          });
      }
  }, [defaultSchedule, scheduleExceptions, personalTimes, googleCalendarEvents, isLoading, convertScheduleToEvents, calendarRef]);

   const formatEventForClient = (event, color) => {
      if (!event || !event.startTime) return { ...event, date: '', time: '' };
      const localStartTime = new Date(event.startTime);
      const year = localStartTime.getFullYear();
      const month = String(localStartTime.getMonth() + 1).padStart(2, '0');
      const day = String(localStartTime.getDate()).padStart(2, '0');
      const hours = String(localStartTime.getHours()).padStart(2, '0');
      const minutes = String(localStartTime.getMinutes()).padStart(2, '0');
      return {
         id: event.id || event._id,
         title: event.title,
         date: `${year}-${month}-${day}`,
         time: `${hours}:${minutes}`,
         participants: Array.isArray(event.participants) ? event.participants.length : (event.participants || 0),
         priority: event.priority || 3,
         color: color || event.color || 'blue',
         location: event.location,
         locationLat: event.locationLat,
         locationLng: event.locationLng
      };
   };

   const fetchGlobalEvents = useCallback(async () => {
      if (!isLoggedIn) return;
      try {
         const currentUser = auth.currentUser;
         if (!currentUser) return;

         const loginMethod = localStorage.getItem('loginMethod') || (user?.google?.refreshToken ? 'google' : '');
         const isGoogleUser = loginMethod === 'google' && user?.google?.refreshToken;

         if (isGoogleUser) {
            // 구글 사용자: globalEvents도 구글 캘린더에서 가져옴
            try {
               const threeMonthsAgo = new Date();
               threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
               const oneYearLater = new Date();
               oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
               const gEvents = await googleCalendarService.getEvents(
                  threeMonthsAgo.toISOString(),
                  oneYearLater.toISOString()
               );
               const formattedEvents = gEvents.map(e => {
                  // description에서 참석자 수와 이름 파싱
                  let participants = 0;
                  let participantNames = [];
                  if (e.description) {
                     const countMatch = e.description.match(/참석자:\s*(\d+)명/);
                     if (countMatch) participants = parseInt(countMatch[1], 10);
                     const namesMatch = e.description.match(/참석:\s*(.+?)(?:\n|$)/);
                     if (namesMatch) participantNames = namesMatch[1].split(',').map(n => n.trim());
                  }
                  // [약속] 태그가 있으면 조율 일정으로 표시
                  const isCoordinated = e.title && e.title.includes('[약속]');
                  // 생일 이벤트 감지 (Google Calendar 특수 이벤트 - 삭제 불가)
                  const isBirthdayEvent = e.googleEventId?.includes('_') &&
                     (e.title?.includes('생일') || e.title?.toLowerCase().includes('birthday'));
                  return {
                     id: e.id,
                     googleEventId: e.googleEventId,
                     title: e.title,
                     date: e.start ? e.start.split('T')[0] : '',
                     time: e.start ? new Date(e.start).toTimeString().substring(0, 5) : '',
                     participants: participants,
                     participantNames: participantNames,
                     color: isCoordinated ? '#3b82f6' : '#22c55e',
                     isGoogleEvent: true,
                     isCoordinated: isCoordinated,
                     isBirthdayEvent: isBirthdayEvent,
                     location: e.location || null,
                     description: e.description || '',
                  };
               });
               setGlobalEvents(formattedEvents);
            } catch (gErr) {
               console.warn('구글 캘린더 globalEvents 로딩 실패:', gErr);
               setGlobalEvents([]);
            }
         } else {
            const response = await fetch(`${API_BASE_URL}/api/events`, {
               headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` }
            });
            if (!response.ok) throw new Error('Failed to fetch events');
            const data = await response.json();
            const formattedEvents = data.events.map(event => formatEventForClient(event));
            setGlobalEvents(formattedEvents);
         }
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

   const handleChatMessage = async (message, additionalContext = {}) => {
      try {
         if (!chatEnhanced || !chatEnhanced.handleChatMessage) return { success: false, message: '챗봇이 준비 중입니다.' };
         // 구글 로그인 사용자는 구글 캘린더에 일정 추가, 일반 사용자는 로컬 DB
         const loginMethod = localStorage.getItem('loginMethod');
         const hasRefreshToken = !!user?.google?.refreshToken;
         const isGoogleUser = loginMethod === 'google' && hasRefreshToken;
         const tabType = isGoogleUser ? 'google' : 'local';
         const context = isGoogleUser ? 'googleCalendar' : 'profile';
         console.log('[handleChatMessage] 구글유저:', isGoogleUser, '| loginMethod:', loginMethod, '| refreshToken:', hasRefreshToken, '| tabType:', tabType, '| context:', context);
         const result = await chatEnhanced.handleChatMessage(message, { context, tabType, currentEvents: globalEvents, ...additionalContext });
         console.log('[handleChatMessage] 결과:', result);
         await fetchSchedule();
         await fetchGlobalEvents();
         return result;
      } catch (error) {
         console.error('[handleChatMessage] 에러:', error);
         return { success: false, message: '메시지 처리 중 오류 발생' };
      }
   };

   const handleStartVoiceRecognition = () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) { alert('음성 인식을 지원하지 않습니다.'); return; }
      const recognition = new SpeechRecognition();
      recognition.lang = 'ko-KR';
      recognition.onstart = () => setIsVoiceEnabled(true);
      recognition.onresult = async (event) => {
         const transcript = event.results[0][0].transcript;
         if (!isChatOpen) setIsChatOpen(true);
         await handleChatMessage(transcript);
      };
      recognition.onerror = () => setIsVoiceEnabled(false);
      recognition.onend = () => setIsVoiceEnabled(false);
      recognition.start();
   };

   const handleStartEdit = () => {
      setInitialState({ defaultSchedule: [...defaultSchedule], scheduleExceptions: [...scheduleExceptions], personalTimes: [...personalTimes] });
      setIsEditing(true);
   };

   const handleCancel = () => {
      if (initialState) {
         setDefaultSchedule([...initialState.defaultSchedule]);
         setScheduleExceptions([...initialState.scheduleExceptions]);
         setPersonalTimes([...initialState.personalTimes]);
      }
      setIsEditing(false);
      fetchSchedule();
   };

   const handleSave = async () => {
      try {
         await userService.updateUserSchedule({ defaultSchedule, scheduleExceptions, personalTimes });
         alert('저장되었습니다.');
         setIsEditing(false);
         await fetchSchedule();
      } catch (error) { alert('저장 실패'); }
   };

   const handleClearAll = async () => {
      if (window.confirm('모두 삭제하시겠습니까?')) {
         try {
            await userService.updateUserSchedule({ defaultSchedule: [], scheduleExceptions: [], personalTimes: [] });
            setDefaultSchedule([]); setScheduleExceptions([]); setPersonalTimes([]); setEvents([]);
            await fetchSchedule();
         } catch (error) { alert('초기화 실패'); }
      }
   };

   const renderEventContent = (eventInfo) => {
      if (eventInfo.view.type !== 'dayGridMonth') {
         return (
            <div style={{ padding: '2px' }}>
               <div style={{ fontWeight: 'bold' }}>{eventInfo.event.title}</div>
               <div style={{ fontSize: '0.85em' }}>{eventInfo.timeText}</div>
            </div>
         );
      }
      const color = eventInfo.event.backgroundColor || '#3b82f6';
      return (
         <div className="event-line-marker" style={{ backgroundColor: color, height: '5px', width: '100%', borderRadius: '2px', marginTop: '2px' }}></div>
      );
   };

   const getEventsForDate = (date) => {
      if (!date) return [];
      const targetDateStr = date.toLocaleDateString('en-CA');
      return events.filter(event => {
         const eventStart = new Date(event.start);
         if (isNaN(eventStart.getTime())) return false;
         return eventStart.toLocaleDateString('en-CA') === targetDateStr;
      });
   };

   const handleDateClick = (arg) => {
      // 뷰 전환 없이 선택 날짜만 업데이트 -> 하단 리스트 갱신
      setSelectedDate(arg.date);
   };

   const handleEventClick = (clickInfo) => {
      const eventObj = clickInfo.event;
      
      // '가능'이나 '선호시간' 클릭 시에는 해당 날짜 선택 효과만 줌
      if (eventObj.title === '가능' || eventObj.title === '선호시간') {
         setSelectedDate(eventObj.start);
         return;
      }

      // 실제 일정 클릭 시: 날짜 선택 + 상세 모달 표시
      setSelectedDate(eventObj.start);

      let originalEvent = events.find(e => e.id === eventObj.id);
      // ID 매칭 실패 시 시간+제목으로 fallback 매칭
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
            isCoordinated: originalEvent.isCoordinated || false,
            hasTravelTime: originalEvent.hasTravelTime || false
         });
      } else {
         // id로 못 찾으면 최소 정보로 구성 (fallback)
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
         const token = await currentUser.getIdToken();

         // 구글 캘린더 이벤트 삭제
         if (event.isGoogleEvent && event.googleEventId) {
            // 생일 이벤트는 삭제 불가
            if (event.isBirthdayEvent) {
               alert('생일 이벤트는 Google 연락처에서 관리되어 삭제할 수 없습니다.');
               return;
            }
            await googleCalendarService.deleteEvent(event.googleEventId);
            setSelectedEvent(null);
            await fetchSchedule();
            return;
         }

         if (event.id && event.id.startsWith('pt-')) {
            const personalTimeId = event.id.replace('pt-', '');
            const response = await fetch(`${API_BASE_URL}/api/users/profile/schedule/${personalTimeId}`, {
               method: 'DELETE',
               headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) throw new Error('Failed to delete personal time');
         } else {
            const response = await fetch(`${API_BASE_URL}/api/events/${event.id}`, {
               method: 'DELETE',
               headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) throw new Error('Failed to delete event');
         }

         setSelectedEvent(null);
         await fetchSchedule();
      } catch (error) {
         console.error('Delete event error:', error);
         alert('일정 삭제에 실패했습니다.');
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
         const allEvts = [...calendarEvents, ...googleCalendarEvents];
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

   const handleTouchStart = (e) => {
      setTouchStart(e.targetTouches[0].clientY);
      setIsSwiping(true);
   };

   const handleTouchMove = (e) => {
      if (touchStart === null) return;
      const currentY = e.targetTouches[0].clientY;
      const diff = currentY - touchStart;
      setTranslateY(diff * 0.5); 
   };

   const handleTouchEnd = () => {
      if (touchStart === null) return;
      const minSwipeDistance = 80;
      const calendarApi = calendarRef.current?.getApi();
      if (calendarApi) {
         if (translateY < -minSwipeDistance) calendarApi.next(); 
         else if (translateY > minSwipeDistance) calendarApi.prev();
      }
      setIsSwiping(false);
      setTranslateY(0);
      setTouchStart(null);
   };

   const renderBottomSection = () => {
      // 1. 편집 모드일 때: '일정 관리' 섹션 표시
      if (isEditing) {
         if (calendarView === 'dayGridMonth') {
            return (
               <div className="management-section">
                  <div className="section-tabs"><h3 className="section-title">일정 관리</h3></div>
                  <div className="sections-container">
                     <div className="preference-section"><h4 className="subsection-title">선호시간</h4><p className="section-description">클릭 또는 챗봇으로 추가한 가능한 시간들 (자동배정 시 사용됨)</p><SimplifiedScheduleDisplay schedule={defaultSchedule} type="preference" /></div>
                     <div className="personal-section"><h4 className="subsection-title">개인시간</h4><p className="section-description">자동 스케줄링 시 이 시간들은 제외됩니다</p><SimplifiedScheduleDisplay schedule={personalTimes} type="personal" /></div>
                  </div>
               </div>
            );
         }
         return null;
      }

      // 2. 기본 상태 (모든 뷰): 하단에 선택된 날짜(또는 오늘)의 일정 리스트 표시
      const targetDate = selectedDate || new Date();
      
      // 필터링: 선호시간('가능') 제외하고 실제 일정(개인시간, 확정일정)만 표시
      const dayEvents = getEventsForDate(targetDate)
         .filter(e => e.title !== '가능' && e.title !== '선호시간')
         .sort((a, b) => new Date(a.start) - new Date(b.start));

      // 컨테이너 스타일 결정 (월간 뷰는 하단 시트, 나머지는 고정 영역)
      // 사용자가 월간 뷰에서도 하단에 항상 보이길 원하므로 split-view-list 스타일로 통일하는 것이 안전함
      // 하지만 월간 뷰에서 달력을 가리면 안되므로 높이를 조절하거나 overlay 방식 유지 필요
      // 요청: "들어가자마자 밑에 오늘의 일정이 보여야 된다" -> 고정된 영역이 더 적합해 보임.
      
      const containerClass = calendarView === 'dayGridMonth' ? 'date-detail-sheet' : 'split-view-list';
      
      // 월간 뷰일 때 하단 시트가 초기 진입 시 안 보이는 문제를 해결하기 위해
      // date-detail-sheet 클래스를 사용하더라도 animation을 제거하거나 초기 상태를 visible로 해야 함.
      // 여기서는 그냥 split-view-list 스타일을 사용하여 달력 아래에 붙입니다. (높이 제한 필요)

      return (
         <div className="split-view-list" style={calendarView === 'dayGridMonth' ? { height: '40%', borderTop: '1px solid #e5e7eb' } : {}}>
            <div className="split-list-header">
               {targetDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
               {/* 닫기 버튼 제거 (항상 표시하므로) */}
            </div>
            
            {dayEvents.length === 0 ? (
               <div className="split-no-events">일정이 없습니다</div>
            ) : (
               <div className="split-list-scroll-area">
                  {dayEvents.map((event, idx) => (
                     <div 
                        key={idx} 
                        className="split-list-item" 
                        onClick={() => handleSplitItemClick(event)}
                        style={{ cursor: 'pointer' }}
                     >
                        <div className="split-item-time">
                           {new Date(event.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                           <br />~ {new Date(event.end).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </div>
                        <div 
                           className="split-item-content"
                           style={{ backgroundColor: event.backgroundColor || '#3b82f6' }}
                        >
                           {event.title}
                        </div>
                     </div>
                  ))}
               </div>
            )}
         </div>
      );
   };

   if (showPersonalInfo) return <MobilePersonalInfoEdit onBack={() => setShowPersonalInfo(false)} />;
   if (showScheduleEdit) return <MobileScheduleEdit onBack={() => setShowScheduleEdit(false)} />;

   return (
      <div className={`mobile-calendar-view view-${calendarView} ${calendarView === 'timeGridDay' ? 'split-mode' : ''}`}>
         {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}
         <nav className={`mobile-sidebar ${isSidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-header"><h2 className="sidebar-title">메뉴</h2><button className="sidebar-close-btn" onClick={() => setIsSidebarOpen(false)}>✕</button></div>
            <div className="sidebar-menu">
               <button className="sidebar-item" onClick={() => navigate('/')}>🏠 홈으로</button>
               <button className="sidebar-item" onClick={() => navigate('/mobile/schedule')}>📅 내 일정</button>
               <button className="sidebar-item" onClick={() => navigate('/mobile/groups')}>👥 그룹</button>
               <button className="sidebar-item" onClick={() => navigate('/mobile/calendar')}>📆 달력</button>
            </div>
         </nav>
         <header className="mobile-header">
            <div className="mobile-header-content">
               <div className="mobile-header-left">
                  <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}><Menu size={24} /></button>
                  <div className="mobile-logo-btn" onClick={() => navigate('/')}><img src="/image.png" alt="MeetAgent Logo" className="mobile-logo-img" /><h1 className="mobile-logo-text">MeetAgent</h1></div>
               </div>
               <div className="mobile-header-right">
                  <button className="mobile-icon-btn" onClick={() => navigate('/')} title="캘린더"><Calendar size={20} /></button>
                  <button className={`mobile-icon-btn ${isClipboardMonitoring ? 'active' : ''}`} onClick={() => setIsClipboardMonitoring(!isClipboardMonitoring)} title="클립보드">{isClipboardMonitoring ? <Clipboard size={18} /> : <ClipboardX size={18} />}</button>
                  <button className={`mobile-icon-btn ${isBackgroundMonitoring ? 'active' : ''}`} onClick={() => setIsBackgroundMonitoring(!isBackgroundMonitoring)} title="통화감지"><Phone size={18} /></button>
                  <button className="mobile-profile-btn" onClick={() => navigate('/')} title="프로필">{user && user.firstName ? user.firstName : <User size={18} />}</button>
                  <button className="mobile-voice-btn" onClick={handleStartVoiceRecognition} title="음성인식">{isVoiceEnabled ? '🎙️' : '🔇'}</button>
                  <button className="mobile-logout-btn" onClick={handleLogout} title="로그아웃"><LogOut size={16} /></button>
               </div>
            </div>
         </header>
         <div className="schedule-content">
            {isLoading ? <div className="loading-state">로딩 중...</div> :
               <>
                  <div className="schedule-page-title">
                     <span>{currentTitle || '달력'}</span>
                     <div className="top-edit-buttons">
                        {(() => {
                           const isGoogleUser = localStorage.getItem('loginMethod') === 'google' && user?.google?.refreshToken;
                           if (isGoogleUser) {
                              return <button className="edit-button" onClick={() => setShowPersonalInfo(true)}>개인정보 수정</button>;
                           }
                           return !isEditing ? (
                           <>
                              <button className="edit-button" onClick={handleStartEdit}>편집</button>
                              <button className="edit-button" onClick={() => setShowPersonalInfo(true)}>개인정보 수정</button>
                           </>
                        ) : (
                           <>
                              <button className="edit-button cancel-button" onClick={handleCancel}>취소</button>
                              <button className="edit-button clear-button" onClick={handleClearAll}>초기화</button>
                              <button className="edit-button save-button" onClick={handleSave}>저장</button>
                           </>
                        );
                        })()}
                     </div>
                  </div>
                  <div 
                     className="calendar-container"
                     onTouchStart={handleTouchStart}
                     onTouchMove={handleTouchMove}
                     onTouchEnd={handleTouchEnd}
                  >
                     <div className="pull-indicator top">{translateY > 0 ? '이전 달' : ''}</div>
                     <div className="pull-indicator bottom">{translateY < 0 ? '다음 달' : ''}</div>
                     <div className="calendar-wrapper" style={{ transform: `translateY(${translateY}px)`, transition: isSwiping ? 'none' : 'transform 0.3s ease-out', padding: '16px' }}>
                        <FullCalendar
                           ref={calendarRef}
                           plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                           initialView="dayGridMonth"
                           timeZone="local"
                           headerToolbar={isEditing ? { left: 'backToMonth prev,next', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' } : false}
                           customButtons={{ backToMonth: { text: '◀ 월', click: () => calendarRef.current?.getApi().changeView('dayGridMonth') } }}
                           events={events}
                           dateClick={handleDateClick}
                           eventClick={handleEventClick}
                           eventContent={renderEventContent}
                           viewDidMount={handleViewChange}
                           datesSet={handleViewChange}
                           height="auto"
                           locale="ko"
                           buttonText={{ month: '월', week: '주', day: '일' }}
                           slotMinTime="06:00:00"
                           slotMaxTime="24:00:00"
                           allDaySlot={false}
                           nowIndicator={true}
                           dayMaxEvents={2}
                           moreLinkText={(num) => `+${num}개`}
                           eventDisplay="block"
                           displayEventTime={false}
                           navLinks={true}
                           navLinkDayClick={(date) => calendarRef.current?.getApi().changeView('timeGridDay', date)}
                        />
                     </div>
                  </div>
                  {renderBottomSection()}
               </>
            }
         </div>
         {/* 하단 네비게이션 바 - 항상 표시 */}
         <BottomNavigation 
            onRefresh={fetchSchedule} 
            onChat={() => setIsChatOpen(!isChatOpen)} 
            onMic={handleStartVoiceRecognition} 
         />
         
         {/* 챗봇 - isChatOpen이 true일 때만 표시 */}
         {isChatOpen && (
            <ChatBox 
               onSendMessage={handleChatMessage} 
               currentTab="profile" 
               onEventUpdate={fetchSchedule} 
               forceOpen={true} 
            />
         )}
         {selectedEvent && <EventDetailModal event={selectedEvent} user={user} onClose={() => setSelectedEvent(null)} onOpenMap={handleOpenMap} onDelete={handleDeleteScheduleEvent} previousLocation={null} />}
         {showMapModal && selectedLocation && <MapModal address={selectedLocation.address} lat={selectedLocation.lat} lng={selectedLocation.lng} onClose={handleCloseMapModal} />}
      </div>
   );
};

export default MobileCalendarView;