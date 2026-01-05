import React, { useMemo } from 'react';
import './SimplifiedScheduleDisplay.css';

const SimplifiedScheduleDisplay = ({ schedule, type = 'preference' }) => {
   const groupedSchedule = useMemo(() => {
      if (!schedule || schedule.length === 0) return {};

      console.log(`📋 [SimplifiedScheduleDisplay - ${type}] 받은 스케줄:`, schedule);

      const groups = {};
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

      schedule.forEach(slot => {
         console.log(`🔍 [${type}] 슬롯 처리 중:`, slot);
         let key;

         if (slot.specificDate) {
            // 특정 날짜
            const date = new Date(slot.specificDate);
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const dayOfWeek = dayNames[date.getDay()];
            key = `${month}월 ${day}일 ${dayOfWeek}`;
         } else if (slot.dayOfWeek !== undefined) {
            // 요일 반복 (선호시간)
            const dayOfWeek = dayNames[slot.dayOfWeek];
            key = `매주 ${dayOfWeek}요일`;
         } else if (slot.daysOfWeek && slot.daysOfWeek.length > 0) {
            // 여러 요일 반복 (개인시간)
            const days = slot.daysOfWeek.map(d => dayNames[d]).join(',');
            key = `매주 ${days}`;
         } else if (slot.days && slot.days.length > 0) {
            // 여러 요일 반복 (개인시간 - days 필드)
            const days = slot.days.map(d => dayNames[d]).join(',');
            key = `매주 ${days}`;
         } else {
            console.warn(`⚠️ [${type}] 처리할 수 없는 슬롯:`, slot);
            return;
         }

         if (!groups[key]) {
            groups[key] = [];
         }

         groups[key].push({
            start: slot.startTime,
            end: slot.endTime,
            name: slot.name || slot.title || ''
         });
      });

      // 시간 정렬 및 병합
      Object.keys(groups).forEach(key => {
         // 먼저 정렬
         groups[key].sort((a, b) => a.start.localeCompare(b.start));

         // 연속된 시간대 병합
         const merged = [];
         let current = null;

         groups[key].forEach(slot => {
            if (!current) {
               current = { ...slot };
            } else {
               // 현재 슬롯의 끝 시간과 다음 슬롯의 시작 시간이 같으면 병합
               if (current.end === slot.start && current.name === slot.name) {
                  current.end = slot.end;
               } else {
                  merged.push(current);
                  current = { ...slot };
               }
            }
         });

         if (current) {
            merged.push(current);
         }

         groups[key] = merged;
      });

      console.log(`✅ [${type}] 그룹화 및 병합 결과:`, groups);
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
               <div className="schedule-blocks">
                  {slots.map((slot, idx) => (
                     <div
                        key={idx}
                        className={`time-block ${type === 'preference' ? 'preference-block' : 'personal-block'}`}
                     >
                        <div className="time-block-time">
                           {formatTimeRange(slot.start, slot.end)}
                        </div>
                        {slot.name && (
                           <div className="time-block-name">
                              {slot.name}
                           </div>
                        )}
                     </div>
                  ))}
               </div>
            </div>
         ))}
      </div>
   );
};

export default SimplifiedScheduleDisplay;
