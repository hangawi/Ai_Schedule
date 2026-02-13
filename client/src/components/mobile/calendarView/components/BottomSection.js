/**
 * BottomSection.js - 캘린더 하단 섹션 컴포넌트
 *
 * 📍 위치: calendarView/components/BottomSection.js
 * 🔗 연결: ../../MobileCalendarView.js
 */

import React from 'react';
import SimplifiedScheduleDisplay from '../../SimplifiedScheduleDisplay';
import { getEventsForDate } from '../utils/eventUtils';

const BottomSection = ({ isEditing, calendarView, selectedDate, defaultSchedule, personalTimes, events, onSplitItemClick }) => {
   // 1. 편집 모드일 때: '일정 관리' 섹션 표시
   if (isEditing) {
      if (calendarView === 'dayGridMonth') {
         return (
            <div className="management-section">

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

   const dayEvents = getEventsForDate(targetDate, events)
      .sort((a, b) => new Date(a.start) - new Date(b.start));

   return (
      <div className="split-view-list" style={calendarView === 'dayGridMonth' ? { height: '40%', borderTop: '1px solid #e5e7eb' } : {}}>
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
                     onClick={() => onSplitItemClick(event)}
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
                        {event.title === '가능' ? '선호시간' : event.title}
                     </div>
                  </div>
               ))}
            </div>
         )}
      </div>
   );
};

export default BottomSection;
