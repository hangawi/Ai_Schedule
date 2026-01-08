import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Menu, LogOut, User, Calendar, Clipboard, ClipboardX, Phone } from 'lucide-react';
import { auth } from '../../config/firebaseConfig';
import { userService } from '../../services/userService';
import { useChatEnhanced } from '../../hooks/useChat/enhanced';
import SimplifiedScheduleDisplay from './SimplifiedScheduleDisplay';
import BottomNavigation from './BottomNavigation';
import MobilePersonalInfoEdit from './MobilePersonalInfoEdit';
import MobileScheduleEdit from './MobileScheduleEdit';
import ChatBox from '../chat/ChatBox';
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
      
      // 시간순 정렬
      const sorted = [...slots].sort((a, b) => {
         const aStart = new Date(a.start);
         const bStart = new Date(b.start);
         return aStart - bStart;
      });
      
      const merged = [];
      let current = { ...sorted[0] };
      
      for (let i = 1; i < sorted.length; i++) {
         const slot = sorted[i];
         const currentEnd = new Date(current.end);
         const slotStart = new Date(slot.start);
         
         // 연속되고 같은 타입이면 병합
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
      
      // 현재 월부터 다음 달까지
      const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);

      // 날짜 범위 내의 모든 날짜에 대해 처리
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
         const dayOfWeek = d.getDay();
         // 로컬 시간대로 날짜 문자열 생성 (UTC 변환 방지!)
         const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

         // 1. 기본 스케줄 (요일별)
         if (defaultSchedule && defaultSchedule.length > 0) {
            defaultSchedule
               .filter(slot => {
                  // specificDate가 있으면 날짜로 비교
                  if (slot.specificDate) {
                     return slot.specificDate === dateStr;
                  }
                  // 없으면 요일로 비교
                  return slot.dayOfWeek === dayOfWeek;
               })
               .forEach(slot => {
                  const [startHour, startMin] = slot.startTime.split(':').map(Number);
                  const [endHour, endMin] = slot.endTime.split(':').map(Number);
                  
                  const start = new Date(d);
                  start.setHours(startHour, startMin, 0, 0);
                  
                  const end = new Date(d);
                  end.setHours(endHour, endMin, 0, 0);
                  
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

         // 2. 개인시간 (반복)
         if (personalTimes && personalTimes.length > 0) {
            personalTimes.forEach(pt => {
               // 반복 개인시간 - PC 버전과 동일하게 처리
               const adjustedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
               const hasRecurringTime = (pt.isRecurring !== false) &&
                  ((pt.days && pt.days.includes(adjustedDayOfWeek)) ||
                   (pt.daysOfWeek && pt.daysOfWeek.includes(dayOfWeek)));

               if (hasRecurringTime) {
                  const [startHour, startMin] = pt.startTime.split(':').map(Number);
                  const [endHour, endMin] = pt.endTime.split(':').map(Number);

                  const start = new Date(d);
                  start.setHours(startHour, startMin, 0, 0);

                  const end = new Date(d);
                  end.setHours(endHour, endMin, 0, 0);

                  tempEvents.push({
                     title: pt.name || '개인',
                     start: formatLocalDateTime(start),
                     end: formatLocalDateTime(end),
                     backgroundColor: '#ef4444',
                     borderColor: '#dc2626',
                     textColor: '#ffffff',
                     display: 'block',
                     dateKey: dateStr
                  });
               }
               
               // 특정 날짜 개인시간
               if (pt.isRecurring === false && pt.specificDate === dateStr) {
                  const [startHour, startMin] = pt.startTime.split(':').map(Number);
                  const [endHour, endMin] = pt.endTime.split(':').map(Number);

                  const start = new Date(d);
                  start.setHours(startHour, startMin, 0, 0);

                  const end = new Date(d);
                  end.setHours(endHour, endMin, 0, 0);

                  tempEvents.push({
                     title: pt.name || '개인',
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

      // 3. 예외 스케줄
      if (scheduleExceptions && scheduleExceptions.length > 0) {
         scheduleExceptions.forEach(exception => {
            // CalendarView처럼 처리: title !== '휴무일' && !isHoliday
            if (exception.title === '휴무일' || exception.isHoliday) return;
            if (!exception.specificDate) return;
            
            // 예외는 직접 startTime/endTime을 가짐 (slots가 아님)
            if (exception.startTime && exception.endTime) {
               const eventDate = new Date(exception.specificDate);
               const startTime = exception.startTime.includes('T') ? 
                  new Date(exception.startTime) : 
                  (() => {
                     const [h, m] = exception.startTime.split(':').map(Number);
                     const d = new Date(eventDate);
                     d.setHours(h, m, 0, 0);
                     return d;
                  })();
               
               const endTime = exception.endTime.includes('T') ? 
                  new Date(exception.endTime) : 
                  (() => {
                     const [h, m] = exception.endTime.split(':').map(Number);
                     const d = new Date(eventDate);
                     d.setHours(h, m, 0, 0);
                     return d;
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
            }
         });
      }

      // 날짜별로 그룹화하고 병합
      const eventsByDate = {};
      tempEvents.forEach(event => {
         if (!eventsByDate[event.dateKey]) {
            eventsByDate[event.dateKey] = [];
         }
         eventsByDate[event.dateKey].push(event);
      });

      const mergedEvents = [];
      Object.keys(eventsByDate).forEach(dateKey => {
         const dateEvents = mergeSlots(eventsByDate[dateKey]);
         dateEvents.forEach(event => {
            delete event.dateKey; // 병합 후 dateKey 제거
            mergedEvents.push(event);
         });
      });

      console.log('원본 이벤트:', tempEvents.length, '→ 병합 후:', mergedEvents.length);
      return mergedEvents;
   }, []);

   const fetchSchedule = useCallback(async () => {
      try {
         setIsLoading(true);
         const data = await userService.getUserSchedule();
         
         console.log('📅 받은 데이터:', {
            defaultSchedule: data.defaultSchedule,
            scheduleExceptions: data.scheduleExceptions,
            personalTimes: data.personalTimes
         });
         
         setDefaultSchedule(data.defaultSchedule || []);
         setScheduleExceptions(data.scheduleExceptions || []);
         setPersonalTimes(data.personalTimes || []);
         
         const calendarEvents = convertScheduleToEvents(
            data.defaultSchedule || [],
            data.scheduleExceptions || [],
            data.personalTimes || []
         );
         
         console.log('🎯 변환된 이벤트:', calendarEvents);
         setEvents(calendarEvents);
      } catch (err) {
         console.error('일정 로딩 실패:', err);
      } finally {
         setIsLoading(false);
      }
   }, [convertScheduleToEvents]);

   useEffect(() => {
      fetchSchedule();
   }, [fetchSchedule]);

   const handleDateClick = (arg) => {
      console.log('날짜 클릭:', arg.dateStr);
      
      // 월 뷰에서만 일 뷰로 전환
      if (calendarView === 'dayGridMonth') {
         const calendarApi = calendarRef.current?.getApi();
         if (calendarApi) {
            calendarApi.changeView('timeGridDay', arg.date);
         }
      }
   };

   const handleEventClick = (clickInfo) => {
      console.log('일정 클릭:', clickInfo.event.title);
      
      // 월 뷰에서 이벤트 클릭 시에도 일 뷰로 전환
      if (calendarView === 'dayGridMonth') {
         const calendarApi = calendarRef.current?.getApi();
         if (calendarApi) {
            const eventDate = clickInfo.event.start;
            calendarApi.changeView('timeGridDay', eventDate);
         }
      }
   };

   const handleViewChange = (viewInfo) => {
      setCalendarView(viewInfo.view.type);
      if (viewInfo.view.type !== 'dayGridMonth') {
         setSelectedDate(null);
      }
   };

   const handleAutoSave = async () => {
      await fetchSchedule();
   };

   // 이벤트 포맷 함수
   const formatEventForClient = (event, color) => {
      if (!event || !event.startTime) {
         return { ...event, date: '', time: '' };
      }
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

   // 글로벌 이벤트 가져오기
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

   // 글로벌 이벤트 추가
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
            date = eventData.date;
            time = eventData.time;
            duration = eventData.duration || 60;
         }

         const payload = {
            title: eventData.title,
            date,
            time,
            duration,
            priority: eventData.priority || 3,
            participants: eventData.participants || [],
            color: eventData.color || 'blue',
         };

         const currentUser = auth.currentUser;
         if (!currentUser) throw new Error('로그인이 필요합니다.');

         const response = await fetch(`${API_BASE_URL}/api/events`, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${await currentUser.getIdToken()}`
            },
            body: JSON.stringify(payload),
         });

         if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Failed to add event');
         }
         const savedEvent = await response.json();
         const newEvent = formatEventForClient(savedEvent, eventData.color);
         setGlobalEvents(prevEvents => [...prevEvents, newEvent]);
         return newEvent;
      } catch (error) {
         throw error;
      }
   }, []);

   // 글로벌 이벤트 삭제
   const handleDeleteEvent = useCallback(async eventId => {
      try {
         const currentUser = auth.currentUser;
         if (!currentUser) throw new Error('로그인이 필요합니다.');

         const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` },
         });
         if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Failed to delete event');
         }
         setGlobalEvents(prevEvents => prevEvents.filter(e => e.id !== eventId));
      } catch (error) {
         console.error('이벤트 삭제 실패:', error);
         throw error;
      }
   }, []);

   // 글로벌 이벤트 수정 (간단한 버전)
   const handleEditEvent = useCallback(async (eventId, eventData) => {
      try {
         const currentUser = auth.currentUser;
         if (!currentUser) throw new Error('로그인이 필요합니다.');

         const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`, {
            method: 'PUT',
            headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${await currentUser.getIdToken()}`
            },
            body: JSON.stringify(eventData),
         });

         if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Failed to update event');
         }
         const updatedEvent = await response.json();
         const formattedEvent = formatEventForClient(updatedEvent);
         setGlobalEvents(prevEvents => prevEvents.map(e => e.id === eventId ? formattedEvent : e));
         return formattedEvent;
      } catch (error) {
         console.error('이벤트 수정 실패:', error);
         throw error;
      }
   }, []);

   // eventActions 설정
   useEffect(() => {
      if (isLoggedIn) {
         setEventActions({
            addEvent: handleAddGlobalEvent,
            deleteEvent: handleDeleteEvent,
            editEvent: handleEditEvent
         });
      }
   }, [isLoggedIn, handleAddGlobalEvent, handleDeleteEvent, handleEditEvent]);

   // 글로벌 이벤트 가져오기
   useEffect(() => {
      if (isLoggedIn && eventAddedKey > 0) {
         fetchGlobalEvents();
      }
   }, [eventAddedKey, isLoggedIn, fetchGlobalEvents]);

   // useChatEnhanced 훅 사용
   const chatEnhanced = useChatEnhanced(isLoggedIn, setEventAddedKey, eventActions);

   // 채팅 메시지 처리 함수 (AI 연동)
   const handleChatMessage = async (message, additionalContext = {}) => {
      try {
         // chatEnhanced가 준비되지 않았으면 에러 반환
         if (!chatEnhanced || !chatEnhanced.handleChatMessage) {
            console.error('챗봇이 아직 준비되지 않았습니다.');
            return { success: false, message: '챗봇이 준비 중입니다. 잠시 후 다시 시도해주세요.' };
         }

         // PC 버전의 profile 탭과 동일한 방식으로 처리
         const result = await chatEnhanced.handleChatMessage(message, {
            context: 'profile',
            tabType: 'local',
            currentEvents: globalEvents,
            ...additionalContext
         });
         // 메시지 처리 후 일정 새로고침
         await fetchSchedule();
         await fetchGlobalEvents();
         return result;
      } catch (error) {
         console.error('채팅 메시지 처리 실패:', error);
         return { success: false, message: '메시지 처리 중 오류가 발생했습니다.' };
      }
   };

   // 음성인식 시작
   const handleStartVoiceRecognition = () => {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
         alert('이 브라우저는 음성 인식을 지원하지 않습니다.');
         return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.lang = 'ko-KR';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
         console.log('음성 인식 시작');
         setIsVoiceEnabled(true);
      };

      recognition.onresult = async (event) => {
         const transcript = event.results[0][0].transcript;
         console.log('인식된 음성:', transcript);

         // 채팅창 열기 (아직 안 열려있으면)
         if (!isChatOpen) {
            setIsChatOpen(true);
         }

         // 인식된 텍스트를 챗봇으로 전송
         await handleChatMessage(transcript);
      };

      recognition.onerror = (event) => {
         console.error('음성 인식 오류:', event.error);
         setIsVoiceEnabled(false);
         if (event.error === 'no-speech') {
            alert('음성이 감지되지 않았습니다.');
         } else if (event.error === 'not-allowed') {
            alert('마이크 권한이 거부되었습니다.');
         }
      };

      recognition.onend = () => {
         console.log('음성 인식 종료');
         setIsVoiceEnabled(false);
      };

      recognition.start();
   };

   // 편집 모드 시작
   const handleStartEdit = () => {
      // 초기 상태 저장 (취소 시 복원용)
      setInitialState({
         defaultSchedule: [...defaultSchedule],
         scheduleExceptions: [...scheduleExceptions],
         personalTimes: [...personalTimes]
      });
      setIsEditing(true);
      setIsChatOpen(false); // 기본은 닫힌 상태, 채팅 버튼으로 열기
   };

   // 취소 (초기 상태로 복원)
   const handleCancel = () => {
      if (initialState) {
         setDefaultSchedule([...initialState.defaultSchedule]);
         setScheduleExceptions([...initialState.scheduleExceptions]);
         setPersonalTimes([...initialState.personalTimes]);
      }
      setIsEditing(false);
      setIsChatOpen(false);
      fetchSchedule(); // 서버 데이터로 새로고침
   };

   // 일정 저장
   const handleSave = async () => {
      try {
         await userService.updateUserSchedule({
            defaultSchedule,
            scheduleExceptions,
            personalTimes
         });
         alert('일정이 저장되었습니다!');
         setIsEditing(false);
         setIsChatOpen(false);
         await fetchSchedule();
      } catch (error) {
         console.error('일정 저장 실패:', error);
         alert('일정 저장에 실패했습니다.');
      }
   };

   // 초기화 (현재 입력한 시간표 삭제)
   const handleClearAll = async () => {
      if (window.confirm('현재 시간표를 모두 삭제하시겠습니까?')) {
         try {
            await userService.updateUserSchedule({
               defaultSchedule: [],
               scheduleExceptions: [],
               personalTimes: []
            });
            // 로컬 상태 업데이트
            setDefaultSchedule([]);
            setScheduleExceptions([]);
            setPersonalTimes([]);
            setEvents([]);
            alert('시간표가 초기화되었습니다.');
            await fetchSchedule();
         } catch (error) {
            console.error('초기화 실패:', error);
            alert('초기화에 실패했습니다.');
         }
      }
   };

   const renderEventContent = (eventInfo) => {
      // 이벤트의 배경색을 가져옴 (없으면 기본 파란색)
      const color = eventInfo.event.backgroundColor || '#3b82f6';
      
      return (
         <div className="event-line-marker" style={{
            backgroundColor: color,
            height: '5px',
            width: '100%',
            borderRadius: '2px',
            marginTop: '2px'
         }}>
         </div>
      );
   };

   const getEventsForDate = (date) => {
      if (!date) return [];
      const dateStr = date.toISOString().split('T')[0];
      return events.filter(event => {
         const eventDateStr = event.start.toISOString().split('T')[0];
         return eventDateStr === dateStr;
      });
   };

   const renderBottomSection = () => {
      if (selectedDate && calendarView === 'dayGridMonth') {
         const dayEvents = getEventsForDate(selectedDate);
         return (
            <div className="date-detail-section">
               <div className="detail-header">
                  <h3>{selectedDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</h3>
                  <button className="close-btn" onClick={() => setSelectedDate(null)}>✕</button>
               </div>
               <div className="detail-events">
                  {dayEvents.length === 0 ? (
                     <p className="no-events">등록된 일정이 없습니다</p>
                  ) : (
                     dayEvents.map((event, idx) => (
                        <div key={idx} className="event-item" style={{ borderLeftColor: event.borderColor }}>
                           <div className="event-time">
                              {event.start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} - 
                              {event.end.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                           </div>
                           <div className="event-title">{event.title}</div>
                        </div>
                     ))
                  )}
               </div>
            </div>
         );
      }

      if (calendarView === 'dayGridMonth') {
         return (
            <div className="management-section">
               <div className="section-tabs">
                  <h3 className="section-title">일정 관리</h3>
               </div>

               <div className="sections-container">
                  <div className="preference-section">
                     <h4 className="subsection-title">선호시간</h4>
                     <p className="section-description">
                        클릭 또는 챗봇으로 추가한 가능한 시간들 (자동배정 시 사용됨)
                     </p>
                     <SimplifiedScheduleDisplay
                        schedule={defaultSchedule}
                        type="preference"
                     />
                  </div>

                  <div className="personal-section">
                     <h4 className="subsection-title">개인시간</h4>
                     <p className="section-description">
                        자동 스케줄링 시 이 시간들은 제외됩니다
                     </p>
                     <SimplifiedScheduleDisplay
                        schedule={personalTimes}
                        type="personal"
                     />
                  </div>
               </div>
            </div>
         );
      }

      return null;
   };

   const handleLogout = async () => {
      try {
         await auth.signOut();
         localStorage.removeItem('loginMethod');
         navigate('/auth');
      } catch (error) {
         console.error('Logout error:', error);
      }
   };

   // 개인정보 수정 화면 표시
   if (showPersonalInfo) {
      return <MobilePersonalInfoEdit onBack={() => setShowPersonalInfo(false)} />;
   }

   // 일정 편집 화면 표시
   if (showScheduleEdit) {
      return <MobileScheduleEdit onBack={() => setShowScheduleEdit(false)} />;
   }

   return (
      <div className={`mobile-calendar-view view-${calendarView}`}>
         {/* 사이드바 오버레이 */}
         {isSidebarOpen && (
            <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
         )}

         {/* 사이드바 */}
         <nav className={`mobile-sidebar ${isSidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
               <h2 className="sidebar-title">메뉴</h2>
               <button className="sidebar-close-btn" onClick={() => setIsSidebarOpen(false)}>✕</button>
            </div>
            <div className="sidebar-menu">
               <button className="sidebar-item" onClick={() => navigate('/')}>
                  🏠 홈으로
               </button>
               <button className="sidebar-item" onClick={() => navigate('/mobile/schedule')}>
                  📅 내 일정
               </button>
               <button className="sidebar-item" onClick={() => navigate('/mobile/groups')}>
                  👥 그룹
               </button>
               <button className="sidebar-item" onClick={() => navigate('/mobile/calendar')}>
                  📆 달력
               </button>
            </div>
         </nav>

         {/* 모바일 헤더 */}
         <header className="mobile-header">
            <div className="mobile-header-content">
               {/* 왼쪽: 햄버거 메뉴 + 로고 */}
               <div className="mobile-header-left">
                  <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}>
                     <Menu size={24} />
                  </button>
                  <div className="mobile-logo-btn" onClick={() => navigate('/')}>
                     <img src="/image.png" alt="MeetAgent Logo" className="mobile-logo-img" />
                     <h1 className="mobile-logo-text">MeetAgent</h1>
                  </div>
               </div>

               {/* 오른쪽: 버튼들 */}
               <div className="mobile-header-right">
                  {/* 캘린더 버튼 */}
                  <button className="mobile-icon-btn" onClick={() => navigate('/')} title="캘린더">
                     <Calendar size={20} />
                  </button>

                  {/* 클립보드 모니터링 */}
                  <button
                     className={`mobile-icon-btn ${isClipboardMonitoring ? 'active' : ''}`}
                     onClick={() => setIsClipboardMonitoring(!isClipboardMonitoring)}
                     title={isClipboardMonitoring ? "클립보드 ON" : "클립보드 OFF"}>
                     {isClipboardMonitoring ? <Clipboard size={18} /> : <ClipboardX size={18} />}
                  </button>

                  {/* 백그라운드 모니터링 */}
                  <button
                     className={`mobile-icon-btn ${isBackgroundMonitoring ? 'active' : ''}`}
                     onClick={() => setIsBackgroundMonitoring(!isBackgroundMonitoring)}
                     title={isBackgroundMonitoring ? "통화감지 ON" : "통화감지 OFF"}>
                     <Phone size={18} />
                  </button>

                  {/* 프로필 버튼 */}
                  <button className="mobile-profile-btn" onClick={() => navigate('/')} title="프로필">
                     {user && user.firstName ? user.firstName : <User size={18} />}
                  </button>

                  {/* 음성 인식 버튼 */}
                  <button
                     className="mobile-voice-btn"
                     onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                     title={isVoiceEnabled ? "음성 인식 ON" : "음성 인식 OFF"}>
                     {isVoiceEnabled ? '🎙️' : '🔇'}
                  </button>

                  {/* 로그아웃 버튼 */}
                  <button
                     className="mobile-logout-btn"
                     onClick={handleLogout}
                     title="로그아웃">
                     <LogOut size={16} />
                  </button>
               </div>
            </div>
         </header>

         <div className="schedule-content">
            {isLoading ? (
               <div className="loading-state">로딩 중...</div>
            ) : (
               <>
                  <div className="schedule-page-title">
                     <span>달력</span>
                     <div className="top-edit-buttons">
                        {!isEditing ? (
                           <>
                              <button
                                 className="edit-button"
                                 onClick={handleStartEdit}
                              >
                                 편집
                              </button>
                              <button
                                 className="edit-button"
                                 onClick={() => setShowPersonalInfo(true)}
                              >
                                 개인정보 수정
                              </button>
                           </>
                        ) : (
                           <>
                              <button
                                 className="edit-button cancel-button"
                                 onClick={handleCancel}
                              >
                                 취소
                              </button>
                              <button
                                 className="edit-button clear-button"
                                 onClick={handleClearAll}
                              >
                                 초기화
                              </button>
                              <button
                                 className="edit-button save-button"
                                 onClick={handleSave}
                              >
                                 저장
                              </button>
                           </>
                        )}
                     </div>
                  </div>
                  <div className="calendar-container">
                     <FullCalendar
                        ref={calendarRef}
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                        initialView="dayGridMonth"
                        timeZone="local"
                        headerToolbar={{
                           left: 'backToMonth prev,next',
                           center: 'title',
                           right: 'dayGridMonth,timeGridWeek,timeGridDay'
                        }}
                        customButtons={{
                           backToMonth: {
                              text: '◀ 월',
                              click: function() {
                                 const calendarApi = calendarRef.current?.getApi();
                                 if (calendarApi) {
                                    calendarApi.changeView('dayGridMonth');
                                 }
                              }
                           }
                        }}
                        events={events}
                        dateClick={handleDateClick}
                        eventClick={handleEventClick}
                        eventContent={renderEventContent}
                        viewDidMount={handleViewChange}
                        datesSet={handleViewChange}
                        height="auto"
                        locale="ko"
                        buttonText={{
                           today: '오늘',
                           month: '월',
                           week: '주',
                           day: '일'
                        }}
                        slotMinTime="06:00:00"
                        slotMaxTime="24:00:00"
                        allDaySlot={false}
                        nowIndicator={true}
                        dayMaxEvents={3}
                        moreLinkText="개"
                        eventDisplay="block"
                        displayEventTime={false}
                        displayEventEnd={false}
                        navLinks={true}
                        navLinkDayClick={(date) => {
                           const calendarApi = calendarRef.current?.getApi();
                           if (calendarApi) {
                              calendarApi.changeView('timeGridDay', date);
                           }
                        }}
                     />
                  </div>
                  
                  {renderBottomSection()}
               </>
            )}
         </div>

         {/* 편집 모드일 때만 하단 네비게이션 표시 */}
         {isEditing && (
            <BottomNavigation 
               onRefresh={fetchSchedule}
               onCamera={() => {
                  // 채팅창 열기
                  if (!isChatOpen) {
                     setIsChatOpen(true);
                  }
                  // 사용자에게 안내
                  alert('채팅창에서 이미지 업로드 버튼(회색 버튼)을 눌러주세요.');
               }}
               onChat={() => {
                  setIsChatOpen(!isChatOpen);
               }}
               onMic={handleStartVoiceRecognition}
            />
         )}

         {/* 채팅봇 - 편집 모드 */}
         {isEditing && isChatOpen && (
            <ChatBox
               onSendMessage={handleChatMessage}
               currentTab="profile"
               onEventUpdate={fetchSchedule}
               forceOpen={true}
            />
         )}
      </div>
   );
};

export default MobileCalendarView;