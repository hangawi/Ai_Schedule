/**
 * ===================================================================================================
 * [파일명] EventsTab.js - '나의 일정' 관리 탭 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > [client/src/components/tabs/EventsTab.js]
 *
 * 🎯 주요 기능:
 *    - 사용자의 개인 일정을 월별 캘린더 형태로 표시
 *    - 일정 추가, 수정, 삭제 기능 제공
 *    - 월 단위 네비게이션 (이전/다음 달)
 *    - 반응형 UI: 데스크탑에서는 그리드 뷰, 모바일에서는 리스트 뷰로 표시
 *
 * 🔗 연결된 파일:
 *    - ../forms/EventFormModal.js: 일정 추가/수정을 위한 모달
 *    - ../modals/CustomAlertModal.js: 작업 결과(성공, 실패)를 알리기 위한 모달
 *    - SchedulingSystem.js (상위 컴포넌트로 추정): 일정 데이터(events) 및 CRUD 핸들러 함수를 props로 전달
 *
 * 💡 UI 위치:
 *    - [내 일정] 탭 (가칭)
 *    - 사용자의 개인적인 이벤트를 등록하고 관리하는 화면
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: '내 일정' 탭의 캘린더 UI와 이벤트 관련 인터랙션이 변경됩니다.
 *    - 이벤트 표시 방식 변경: `getEventColorClass` 함수 또는 이벤트 렌더링 부분을 수정합니다.
 *    - 모바일/데스크탑 뷰 레이아웃 변경: `md:hidden` 및 `hidden md:grid` 클래스가 적용된 JSX 부분을 수정합니다.
 *    - 이벤트 추가/수정/삭제 로직 변경: `onAddEvent`, `onEditEvent`, `onDeleteEvent` prop을 통해 전달되는 상위 컴포넌트의 핸들러를 수정해야 합니다.
 *
 * 📝 참고사항:
 *    - 로그인 상태(`isLoggedIn`)가 아닐 경우, "로그인 후 일정을 확인할 수 있습니다." 메시지를 표시합니다.
 *    - `moment.js` 라이브러리를 사용하여 날짜 포맷팅을 처리합니다 (모바일 뷰).
 *    - 컴포넌트 자체적으로는 현재 보고 있는 월(`currentMonth`) 상태만 관리하며, 실제 이벤트 데이터는 상위에서 받아옵니다.
 *
 * ===================================================================================================
 */
import React, { useState } from 'react';
import moment from 'moment';
import { X } from 'lucide-react';
import EventFormModal from '../forms/EventFormModal';
import CustomAlertModal from '../modals/CustomAlertModal';

/**
 * [EventsTab]
 *
 * @description 사용자의 개인 일정을 월별 캘린더 뷰로 보여주고 관리(추가/수정/삭제)할 수 있게 하는 탭 컴포넌트입니다.
 *              반응형으로 구현되어 모바일에서는 리스트 형태로, 데스크탑에서는 그리드 형태의 캘린더로 보입니다.
 * @param {Array<object>} events - 표시할 이벤트 객체의 배열
 * @param {function} onAddEvent - 새 이벤트를 추가하는 핸들러 함수
 * @param {boolean} isLoggedIn - 사용자 로그인 상태
 * @param {function} onDeleteEvent - 이벤트를 삭제하는 핸들러 함수
 * @param {function} onEditEvent - 이벤트를 수정 모드로 여는 핸들러 함수
 * @returns {JSX.Element} '나의 일정' 탭 컴포넌트
 */
const EventsTab = ({ events, onAddEvent, isLoggedIn, onDeleteEvent, onEditEvent }) => {
   const [showAddEventModal, setShowAddEventModal] = useState(false);
   const [currentMonth, setCurrentMonth] = useState(new Date());

   // CustomAlert 상태
   const [customAlert, setCustomAlert] = useState({ show: false, message: '' });
   const showAlert = (message) => setCustomAlert({ show: true, message });
   const closeAlert = () => setCustomAlert({ show: false, message: '' });

   const goToPreviousMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
   const goToNextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

   /**
    * [handleAddEvent]
    * @description '일정 추가' 모달에서 받은 데이터로 새 이벤트를 생성하는 비동기 함수.
    *              `onAddEvent` prop을 호출하여 상위 컴포넌트에 이벤트 생성을 위임하고,
    *              성공 또는 실패 시 `CustomAlertModal`을 통해 사용자에게 피드백을 제공합니다.
    * @param {object} newEventData - `EventFormModal`에서 전달된 새 이벤트 데이터
    */
   const handleAddEvent = async newEventData => {
      try {
         await onAddEvent(newEventData);
         setShowAddEventModal(false);
         showAlert('일정이 성공적으로 추가되었습니다!');
      } catch (error) {
         showAlert(`일정 추가 실패: ${error.message}`);
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

         {/* Mobile View */}
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

         {/* Desktop View */}
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

         {/* CustomAlert Modal */}
         <CustomAlertModal
           show={customAlert.show}
           onClose={closeAlert}
           message={customAlert.message}
         />
      </div>
   );
};

export default EventsTab;
