import React, { useState } from 'react';
import moment from 'moment';
import { X } from 'lucide-react';
import EventFormModal from '../forms/EventFormModal';

const EventsTab = ({ events, onAddEvent, isLoggedIn, onDeleteEvent, onEditEvent }) => {
   const [showAddEventModal, setShowAddEventModal] = useState(false);
   const [currentMonth, setCurrentMonth] = useState(new Date());

   const goToPreviousMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
   const goToNextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

   const handleAddEvent = async newEventData => {
      try {
         await onAddEvent(newEventData);
         setShowAddEventModal(false);
         alert('일정이 성공적으로 추가되었습니다!');
      } catch (error) {
         alert(`일정 추가 실패: ${error.message}`);
      }
   };

   const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
   const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

   const calendarDates = Array.from({ length: getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth()) }, (_, i) => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1));

   if (!isLoggedIn) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">로그인 후 일정을 확인할 수 있습니다.</p></div>;

   const getEventColorClass = (color) => ({ blue: 'border-blue-500', purple: 'border-purple-500', green: 'border-green-500', red: 'border-red-500' }[color] || 'border-gray-500');

   return (
      <div>
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2 sm:mb-0">나의 일정</h2>
            <div className="flex items-center space-x-3">
               <button className="border border-gray-300 rounded-md px-3 py-1.5 text-sm" onClick={() => setCurrentMonth(new Date())}>오늘</button>
               <button className="bg-blue-500 text-white rounded-md px-3 py-1.5 text-sm" onClick={() => setShowAddEventModal(true)}>+ 일정 추가</button>
            </div>
         </div>

         <div className="flex justify-between items-center mb-4">
            <button onClick={goToPreviousMonth} className="px-3 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">이전 달</button>
            <h3 className="text-xl font-semibold text-gray-800">{currentMonth.toLocaleString('ko-KR', { year: 'numeric', month: 'long' })}</h3>
            <button onClick={goToNextMonth} className="px-3 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">다음 달</button>
         </div>

         <div className="md:hidden space-y-4">
            {calendarDates.map(date => {
               const dayEvents = events.filter(event => new Date(event.date).toDateString() === date.toDateString());
               if (dayEvents.length === 0) return null;
               return (
                  <div key={date.toISOString()}>
                     <p className="font-semibold text-blue-600 pl-2 mb-2">{moment(date).format('M월 D일 (ddd)')}</p>
                     <div className="bg-white p-3 rounded-lg shadow-sm space-y-3">
                        {dayEvents.map(event => (
                           <div key={event.id} className={`pl-3 border-l-4 ${getEventColorClass(event.color)}`}>
                              <div className="flex justify-between items-center">
                                 <div>
                                    <p className="font-medium text-gray-800">{event.title}</p>
                                    <p className="text-sm text-gray-500">{event.time}</p>
                                 </div>
                                 <div className="flex items-center space-x-3">
                                    <button onClick={() => onEditEvent(event)} className="text-gray-400 hover:text-blue-600">✏️</button>
                                    <button onClick={() => onDeleteEvent(event.id)} className="text-gray-400 hover:text-red-600"><X size={16} /></button>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               );
            })}
         </div>

         <div className="hidden md:grid grid-cols-7 gap-1">
            {['일', '월', '화', '수', '목', '금', '토'].map(day => <div key={day} className="text-center font-medium text-gray-500 py-2">{day}</div>)}
            {Array.from({ length: getFirstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth()) }).map((_, idx) => <div key={`empty-${idx}`} className="border rounded-lg bg-gray-50"></div>)}
            {calendarDates.map(date => {
               const isToday = date.toDateString() === new Date().toDateString();
               const dayEvents = events.filter(event => new Date(event.date).toDateString() === date.toDateString());
               return (
                  <div key={date.toISOString()} className={`h-36 p-1 border rounded-lg ${isToday ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
                     <div className="text-right text-sm mb-1">{date.getDate()}</div>
                     <div className="overflow-y-auto h-24 space-y-1">
                        {dayEvents.map(event => (
                           <div key={event.id} className={`text-xs p-1 rounded truncate flex justify-between items-center bg-${event.color}-100 text-${event.color}-800`}>
                              <span className="font-medium">{event.title}</span>
                              <div className="flex items-center transition-opacity">
                                 <button onClick={() => onEditEvent(event)} className="text-gray-500 hover:text-blue-600">✏️</button>
                                 <button onClick={() => onDeleteEvent(event.id)} className="text-gray-500 hover:text-red-600"><X size={10} /></button>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               );
            })}
         </div>

         {showAddEventModal && <EventFormModal onClose={() => setShowAddEventModal(false)} onSubmitEvent={handleAddEvent} />}
      </div>
   );
};

export default EventsTab;