import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Menu, LogOut, User, Calendar, Clipboard, ClipboardX, Phone, Settings, FileText } from 'lucide-react';
import { auth } from '../../config/firebaseConfig';
import { userService } from '../../services/userService';
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
   const calendarRef = useRef(null);
   const [events, setEvents] = useState([]);
   const [isLoading, setIsLoading] = useState(true);
   const [selectedDate, setSelectedDate] = useState(null);
   const [calendarView, setCalendarView] = useState('dayGridMonth');
   const [showPersonalInfo, setShowPersonalInfo] = useState(false);
   const [showScheduleEdit, setShowScheduleEdit] = useState(false);
   const [isChatOpen, setIsChatOpen] = useState(false);
   const [isEditing, setIsEditing] = useState(false);
   const [initialState, setInitialState] = useState(null);

   // 상세 모달 상태
   const [selectedEvent, setSelectedEvent] = useState(null);
   const [showMapModal, setShowMapModal] = useState(false);
   const [selectedLocation, setSelectedLocation] = useState(null);

   // 스케줄 데이터
   const [defaultSchedule, setDefaultSchedule] = useState([]);
   const [scheduleExceptions, setScheduleExceptions] = useState([]);
   const [personalTimes, setPersonalTimes] = useState([]);

   // 챗봇 연동을 위한 상태
   const [globalEvents, setGlobalEvents] = useState([]);
   const [eventAddedKey, setEventAddedKey] = useState(0);
   const [eventActions, setEventActions] = useState({
      addEvent: async () => {},
      deleteEvent: async () => {},
      editEvent: async () => {}
   });
   const isLoggedIn = !!user;

   // 헤더 상태
   const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
   const [isClipboardMonitoring, setIsClipboardMonitoring] = useState(false);
   const [isBackgroundMonitoring, setIsBackgroundMonitoring] = useState(false);
   const [isSidebarOpen, setIsSidebarOpen] = useState(false);

   // 로컬 시간대로 날짜 문자열 생성 (UTC 변환 방지)
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
         
         if (currentEnd.getTime() === slotStart.getTime() && 
             current.title === slot.title &&
             current.backgroundColor === slot.backgroundColor) {
            current.end = slot.end;
         } else {
            merged.push(current);
            current = { ...slot };
         }
      }
      merged.push(current);
      return merged;
   };

   const convertScheduleToEvents = useCallback((defaultSchedule, scheduleExceptions, personalTimes) => {
      const tempEvents = [];
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
         const dayOfWeek = d.getDay();
         const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

         if (defaultSchedule && defaultSchedule.length > 0) {
            defaultSchedule
               .filter(slot => slot.specificDate ? slot.specificDate === dateStr : slot.dayOfWeek === dayOfWeek)
               .forEach(slot => {
                  const [sh, sm] = slot.startTime.split(':').map(Number);
                  const [eh, em] = slot.endTime.split(':').map(Number);
                  const start = new Date(d); start.setHours(sh, sm, 0, 0);
                  const end = new Date(d); end.setHours(eh, em, 0, 0);
                  tempEvents.push({
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
            personalTimes.forEach(pt => {
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
                     title: pt.name || pt.title || '개인',
                     start: formatLocalDateTime(start),
                     end: formatLocalDateTime(end),
                     backgroundColor: '#ef4444',
                     borderColor: '#dc2626',
                     textColor: '#ffffff',
                     display: 'block',
                     dateKey: dateStr
                  });
               }
            });
         }
      }

      if (scheduleExceptions && scheduleExceptions.length > 0) {
         scheduleExceptions.forEach(exception => {
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
               title: exception.title || '예외',
               start: formatLocalDateTime(startTime),
               end: formatLocalDateTime(endTime),
               backgroundColor: '#a78bfa',
               borderColor: '#8b5cf6',
               textColor: '#ffffff',
               display: 'block',
               dateKey: exception.specificDate
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
         const calendarEvents = convertScheduleToEvents(data.defaultSchedule || [], data.scheduleExceptions || [], data.personalTimes || []);
         setEvents(calendarEvents);
      } catch (err) {
         console.error('일정 로딩 실패:', err);
      } finally {
         setIsLoading(false);
      }
   }, [convertScheduleToEvents]);

   useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

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
         participants: event.participants ? event.participants.length : 0,
         priority: event.priority || 3,
         color: color || event.color || 'blue',
      };
   };

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
   }, [isLoggedIn]);

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
         const result = await chatEnhanced.handleChatMessage(message, { context: 'profile', tabType: 'local', currentEvents: globalEvents, ...additionalContext });
         await fetchSchedule();
         await fetchGlobalEvents();
         return result;
      } catch (error) { return { success: false, message: '메시지 처리 중 오류 발생' }; }
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
      if (calendarView === 'dayGridMonth') {
         calendarRef.current?.getApi().changeView('timeGridDay', arg.date);
      }
   };

   const handleEventClick = (clickInfo) => {
      const eventObj = clickInfo.event;
      if (calendarView === 'dayGridMonth') {
         calendarRef.current?.getApi().changeView('timeGridDay', eventObj.start);
         return;
      }
      if (eventObj.title === '가능' || eventObj.title === '선호시간') return;
      const originalEvent = events.find(e => e.title === eventObj.title && new Date(e.start).getTime() === eventObj.start.getTime());
      if (originalEvent) {
         setSelectedEvent({
            ...originalEvent,
            date: new Date(originalEvent.start).toLocaleDateString('en-CA'),
            time: new Date(originalEvent.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
            endTime: new Date(originalEvent.end).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
         });
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

   const renderBottomSection = () => {
      // 1. 일간 뷰 (timeGridDay): 하단에 텍스트 리스트 표시 (Split View)
      if (calendarView === 'timeGridDay') {
         const targetDate = selectedDate || new Date();
         
         const dayEvents = getEventsForDate(targetDate)
            .filter(e => e.title !== '가능' && e.title !== '선호시간')
            .sort((a, b) => new Date(a.start) - new Date(b.start));

         return (
            <div className="split-view-list">
               <div className="split-list-header">
                  {targetDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
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
                              {new Date(event.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                              <br />~ {new Date(event.end).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
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
      }

      // 2. 월간 뷰 (Month View): 날짜 선택 시 하단 시트(Timeline) 표시
      if (calendarView === 'dayGridMonth' && selectedDate) {
         const dayEvents = getEventsForDate(selectedDate);
         const startHour = 6, endHour = 24, totalHours = endHour - startHour;
         const getPos = (dStr) => {
            const d = new Date(dStr);
            if (d.getHours() < startHour) return 0;
            return ((d.getHours() - startHour) * 60 + d.getMinutes()) / (totalHours * 60) * 100;
         };
         return (
            <div className="date-detail-sheet">
               <div className="detail-header">
                  <h3>{selectedDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</h3>
                  <button className="close-btn" onClick={() => setSelectedDate(null)}>✕</button>
               </div>
               <div className="timeline-container">
                  <div className="time-axis">
                     {Array.from({ length: totalHours + 1 }, (_, i) => startHour + i).map((h, i) => (
                        <div key={h} className="time-slot" style={{ top: `${(i / totalHours) * 100}%` }}><span>{h}:00</span></div>
                     ))}
                  </div>
                  <div className="events-area">
                     {Array.from({ length: totalHours + 1 }, (_, i) => <div key={i} className="grid-line" style={{ top: `${(i / totalHours) * 100}%` }}></div>)}
                     {dayEvents.map((event, idx) => {
                        const top = getPos(event.start), bottom = getPos(event.end), height = Math.max(bottom - top, 2);
                        return (
                           <div key={idx} className="timeline-event-block" style={{ top: `${top}%`, height: `${height}%`, backgroundColor: event.backgroundColor || '#3b82f6', borderColor: event.borderColor || '#2563eb', opacity: 0.9, zIndex: 10 }}>
                              <div className="event-info">
                                 <span className="event-title">{event.title}</span>
                                 {height > 5 && <span className="event-time">{new Date(event.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} - {new Date(event.end).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>}
                              </div>
                           </div>
                        );
                     })}
                     {dayEvents.length === 0 && <div className="no-events-message">일정이 없습니다</div>}
                  </div>
               </div>
            </div>
         );
      }

      // 3. 기타 (관리 탭 - 월간 뷰에서 날짜 선택 안 했을 때)
      if (calendarView === 'dayGridMonth') {
         return (
            <div className="management-section">
               <div className="section-tabs"><h3 className="section-title">일정 관리</h3></div>
               <div className="sections-container">
                  <div className="preference-section"><h4 className="subsection-title">선호시간</h4><p className="section-description">클릭 또는 챗봇으로 추가한 가능한 시간들</p><SimplifiedScheduleDisplay schedule={defaultSchedule} type="preference" /></div>
                  <div className="personal-section"><h4 className="subsection-title">개인시간</h4><p className="section-description">자동 스케줄링 시 이 시간들은 제외됩니다</p><SimplifiedScheduleDisplay schedule={personalTimes} type="personal" /></div>
               </div>
            </div>
         );
      }
      return null;
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
                     <span>달력</span>
                     <div className="top-edit-buttons">
                        {!isEditing ? (
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
                        )}
                     </div>
                  </div>
                  <div className="calendar-container">
                     <FullCalendar ref={calendarRef} plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} initialView="dayGridMonth" timeZone="local" headerToolbar={{ left: 'backToMonth prev,next', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }} customButtons={{ backToMonth: { text: '◀ 월', click: () => calendarRef.current?.getApi().changeView('dayGridMonth') } }} events={events} dateClick={handleDateClick} eventClick={handleEventClick} eventContent={renderEventContent} viewDidMount={handleViewChange} datesSet={handleViewChange} height="auto" locale="ko" buttonText={{ month: '월', week: '주', day: '일' }} slotMinTime="06:00:00" slotMaxTime="24:00:00" allDaySlot={false} nowIndicator={true} dayMaxEvents={2} moreLinkText={(num) => `+${num}개`} eventDisplay="block" displayEventTime={false} navLinks={true} navLinkDayClick={(date) => calendarRef.current?.getApi().changeView('timeGridDay', date)} />
                  </div>
                  {renderBottomSection()}
               </>
            }
         </div>
         {isEditing && <BottomNavigation onRefresh={fetchSchedule} onCamera={() => { if (!isChatOpen) setIsChatOpen(true); alert('이미지 업로드 버튼을 눌러주세요.'); }} onChat={() => setIsChatOpen(!isChatOpen)} onMic={handleStartVoiceRecognition} />}
         {isEditing && isChatOpen && <ChatBox onSendMessage={handleChatMessage} currentTab="profile" onEventUpdate={fetchSchedule} forceOpen={true} />}
         {selectedEvent && <EventDetailModal event={selectedEvent} user={user} onClose={() => setSelectedEvent(null)} onOpenMap={handleOpenMap} previousLocation={null} />}
         {showMapModal && selectedLocation && <MapModal address={selectedLocation.address} lat={selectedLocation.lat} lng={selectedLocation.lng} onClose={handleCloseMapModal} />}
      </div>
   );
};

export default MobileCalendarView;