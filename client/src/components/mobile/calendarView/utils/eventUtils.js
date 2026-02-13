/**
 * eventUtils.js - 캘린더 이벤트 관련 순수 유틸리티 함수
 *
 * 📍 위치: calendarView/utils/eventUtils.js
 * 🔗 연결: ../../MobileCalendarView.js
 */

export const formatLocalDateTime = (date) => {
   const year = date.getFullYear();
   const month = String(date.getMonth() + 1).padStart(2, '0');
   const day = String(date.getDate()).padStart(2, '0');
   const hours = String(date.getHours()).padStart(2, '0');
   const minutes = String(date.getMinutes()).padStart(2, '0');
   const seconds = String(date.getSeconds()).padStart(2, '0');
   return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

export const mergeSlots = (slots) => {
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

export const formatEventForClient = (event, color) => {
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

export const getEventsForDate = (date, events) => {
   if (!date) return [];
   const targetDateStr = date.toLocaleDateString('en-CA');
   return events.filter(event => {
      const eventStart = new Date(event.start);
      if (isNaN(eventStart.getTime())) return false;
      return eventStart.toLocaleDateString('en-CA') === targetDateStr;
   });
};

export const renderEventContent = (eventInfo) => {
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
