import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import BottomNavigation from './BottomNavigation';
import './MobileCalendarView.css';

const MobileCalendarView = () => {
   const [events, setEvents] = useState([]);
   const [selectedDate, setSelectedDate] = useState(null);

   useEffect(() => {
      // TODO: 실제 사용자 일정 데이터 가져오기
      // 임시 샘플 데이터
      setEvents([
         {
            title: '회의',
            start: new Date(),
            end: new Date(Date.now() + 3600000),
            backgroundColor: '#3b82f6'
         }
      ]);
   }, []);

   const handleDateClick = (arg) => {
      setSelectedDate(arg.date);
      console.log('날짜 클릭:', arg.dateStr);
   };

   const handleEventClick = (clickInfo) => {
      console.log('일정 클릭:', clickInfo.event.title);
      alert(`일정: ${clickInfo.event.title}`);
   };

   return (
      <div className="mobile-calendar-view">
         <div className="calendar-header">
            <h1 className="calendar-title">달력</h1>
         </div>
         
         <div className="calendar-container">
            <FullCalendar
               plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
               initialView="dayGridMonth"
               headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay'
               }}
               events={events}
               dateClick={handleDateClick}
               eventClick={handleEventClick}
               height="auto"
               locale="ko"
               buttonText={{
                  today: '오늘',
                  month: '월',
                  week: '주',
                  day: '일'
               }}
               editable={true}
               selectable={true}
               selectMirror={true}
               dayMaxEvents={true}
            />
         </div>

         <BottomNavigation />
      </div>
   );
};

export default MobileCalendarView;
