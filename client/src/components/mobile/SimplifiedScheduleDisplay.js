import React, { useMemo } from 'react';
import './SimplifiedScheduleDisplay.css';

const SimplifiedScheduleDisplay = ({ schedule, type = 'preference' }) => {
   const groupedSchedule = useMemo(() => {
      if (!schedule || schedule.length === 0) return {};

      const groups = {};
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

      schedule.forEach(slot => {
         let key;
         
         if (slot.specificDate) {
            // 특정 날짜
            const date = new Date(slot.specificDate);
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const dayOfWeek = dayNames[date.getDay()];
            key = `${month}월 ${day}일 ${dayOfWeek}`;
         } else if (slot.dayOfWeek !== undefined) {
            // 요일 반복
            const dayOfWeek = dayNames[slot.dayOfWeek];
            key = `매주 ${dayOfWeek}요일`;
         } else if (slot.daysOfWeek && slot.daysOfWeek.length > 0) {
            // 여러 요일 반복 (개인시간)
            const days = slot.daysOfWeek.map(d => dayNames[d]).join(',');
            key = `매주 ${days}`;
         } else {
            return;
         }

         if (!groups[key]) {
            groups[key] = [];
         }

         groups[key].push({
            start: slot.startTime,
            end: slot.endTime,
            name: slot.name
         });
      });

      // 시간 정렬 및 포맷팅
      Object.keys(groups).forEach(key => {
         groups[key].sort((a, b) => a.start.localeCompare(b.start));
      });

      return groups;
   }, [schedule]);

   const formatTime = (timeStr) => {
      const [hour, minute] = timeStr.split(':');
      return minute === '00' ? hour : `${hour}:${minute}`;
   };

   const formatTimeRange = (start, end) => {
      return `${formatTime(start)}-${formatTime(end)}`;
   };

   if (Object.keys(groupedSchedule).length === 0) {
      return (
         <div className="simplified-schedule-empty">
            {type === 'preference' ? '등록된 선호시간이 없습니다' : '등록된 개인시간이 없습니다'}
         </div>
      );
   }

   return (
      <div className="simplified-schedule">
         {Object.entries(groupedSchedule).map(([dateKey, slots]) => (
            <div key={dateKey} className="schedule-group">
               <div className="schedule-date">{dateKey}</div>
               <div className="schedule-times">
                  {slots.map((slot, idx) => (
                     <span key={idx} className="time-range">
                        {formatTimeRange(slot.start, slot.end)}
                        {slot.name && ` (${slot.name})`}
                     </span>
                  ))}
               </div>
            </div>
         ))}
      </div>
   );
};

export default SimplifiedScheduleDisplay;
