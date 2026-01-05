import React, { useState, useEffect, useCallback, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { userService } from '../../services/userService';
import SimplifiedScheduleDisplay from './SimplifiedScheduleDisplay';
import BottomNavigation from './BottomNavigation';
import './MobileScheduleView.css';

const MobileScheduleView = ({ user }) => {
   const calendarRef = useRef(null);
   const [events, setEvents] = useState([]);
   const [isLoading, setIsLoading] = useState(true);
   const [selectedDate, setSelectedDate] = useState(null);
   const [calendarView, setCalendarView] = useState('dayGridMonth');
   
   // 스케줄 데이터
   const [defaultSchedule, setDefaultSchedule] = useState([]);
   const [scheduleExceptions, setScheduleExceptions] = useState([]);
   const [personalTimes, setPersonalTimes] = useState([]);

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
               // 반복 개인시간
               if (pt.daysOfWeek && pt.daysOfWeek.includes(dayOfWeek)) {
                  const [startHour, startMin] = pt.startTime.split(':').map(Number);
                  const [endHour, endMin] = pt.endTime.split(':').map(Number);
                  
                  const start = new Date(d);
                  start.setHours(startHour, startMin, 0, 0);
                  
                  const end = new Date(d);
                  end.setHours(endHour, endMin, 0, 0);
                  
                  tempEvents.push({
                     title: pt.name || '개인',
                     start: start.toISOString(),
                     end: end.toISOString(),
                     backgroundColor: '#f472b6',
                     borderColor: '#ec4899',
                     textColor: '#ffffff',
                     display: 'block',
                     dateKey: dateStr
                  });
               }
               
               // 특정 날짜 개인시간
               if (pt.specificDate === dateStr) {
                  const [startHour, startMin] = pt.startTime.split(':').map(Number);
                  const [endHour, endMin] = pt.endTime.split(':').map(Number);
                  
                  const start = new Date(d);
                  start.setHours(startHour, startMin, 0, 0);
                  
                  const end = new Date(d);
                  end.setHours(endHour, endMin, 0, 0);
                  
                  tempEvents.push({
                     title: pt.name || '개인',
                     start: start.toISOString(),
                     end: end.toISOString(),
                     backgroundColor: '#f472b6',
                     borderColor: '#ec4899',
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

   const renderEventContent = (eventInfo) => {
      return (
         <div style={{
            padding: '2px 4px',
            fontSize: '10px',
            fontWeight: '600',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: '#ffffff'
         }}>
            {eventInfo.timeText && (
               <div style={{ fontSize: '9px', opacity: 0.9 }}>
                  {eventInfo.timeText}
               </div>
            )}
            <div>{eventInfo.event.title}</div>
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
                     <SimplifiedScheduleDisplay 
                        schedule={defaultSchedule} 
                        type="preference"
                     />
                  </div>

                  <div className="personal-section">
                     <h4 className="subsection-title">개인시간</h4>
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

   return (
      <div className="mobile-schedule-view">
         <div className="schedule-header">
            <h1 className="schedule-title">내 일정</h1>
         </div>
         
         <div className="schedule-content">
            {isLoading ? (
               <div className="loading-state">로딩 중...</div>
            ) : (
               <>
                  <div className="calendar-container">
                     <FullCalendar
                        ref={calendarRef}
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                        initialView="dayGridMonth"
                        timeZone="local"
                        headerToolbar={{
                           left: 'prev,next today',
                           center: 'title',
                           right: 'dayGridMonth,timeGridWeek,timeGridDay'
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

         <BottomNavigation />
      </div>
   );
};

export default MobileScheduleView;
