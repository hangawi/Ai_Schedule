import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/ko'; // 한국어 로케일 임포트
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './Calendar.css';
import AddEventModal from '../modals/AddEventModal';
import EventDetailsModal from '../modals/EventDetailsModal';
import EditEventModal from '../modals/EditEventModal';
import CustomAlertModal from '../modals/CustomAlertModal';
import { Mic } from 'lucide-react';

moment.locale('ko'); // moment 전역 로케일 설정
const localizer = momentLocalizer(moment);
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const MyCalendar = ({ isListening, onEventAdded, isVoiceRecognitionEnabled, onToggleVoiceRecognition }) => {
   const [events, setEvents] = useState([]);
   const [date, setDate] = useState(new Date());
   const [showAddEventModal, setShowAddEventModal] = useState(false);
   const [selectedEvent, setSelectedEvent] = useState(null);
   const [showEditEventModal, setShowEditEventModal] = useState(false);
   const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
   
   // CustomAlert 상태
   const [alertModal, setAlertModal] = useState({
     isOpen: false,
     title: '',
     message: '',
     type: 'info',
     showCancel: false,
     onConfirm: null
   });

   // Alert 표시 유틸리티 함수
   const showAlert = useCallback((message, type = 'info', title = '', showCancel = false, onConfirm = null) => {
     setAlertModal({
       isOpen: true,
       title,
       message,
       type,
       showCancel,
       onConfirm
     });
   }, []);

   // Alert 닫기 함수
   const closeAlert = useCallback(() => {
     setAlertModal(prev => ({ ...prev, isOpen: false }));
   }, []);

   const formats = {
      agendaDateFormat: 'M월 D일 dddd',
      agendaHeaderFormat: ({ start, end }, culture, local) =>
         local.format(start, 'M월 D일') + ' ~ ' + local.format(end, 'M월 D일'),
   };

   const messages = {
      today: '오늘',
      previous: '이전',
      next: '다음',
      month: '월',
      week: '주',
      day: '일',
      agenda: '목록',
      date: '날짜',
      time: '시간',
      event: '일정',
      noEventsInRange: '해당 기간에 일정이 없습니다.',
      showMore: total => `+${total}개 더 보기`,
   };

   const updateIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
   };

   useEffect(() => {
      window.addEventListener('resize', updateIsMobile);
      return () => window.removeEventListener('resize', updateIsMobile);
   }, []);

   const fetchEvents = useCallback(async currentDate => {
      try {
         const token = localStorage.getItem('token');

         // 구글 인증 상태 확인 - 토큰이 없거나 구글 연결이 안된 경우 요청하지 않음
         const googleConnected = localStorage.getItem('googleConnected');
         if (!token || !googleConnected || googleConnected === 'false') {
            setEvents([]);
            return;
         }

         const startOfMonth = moment(currentDate).startOf('month').toISOString();
         const endOfMonth = moment(currentDate).endOf('month').toISOString();

         const response = await fetch(
            `${API_BASE_URL}/api/calendar/events?timeMin=${startOfMonth}&timeMax=${endOfMonth}`,
            {
               headers: {
                  'x-auth-token': token,
               },
            },
         );

         if (!response.ok) {
            if (response.status === 401) {
               // 구글 인증이 안된 경우 조용히 처리
               localStorage.setItem('googleConnected', 'false');
               setEvents([]);
               return;
            }
            throw new Error('캘린더 이벤트를 가져오는 데 실패했습니다.');
         }

         const data = await response.json();
         const formattedEvents = data.map(event => ({
            id: event.id,
            title: event.summary,
            start: new Date(event.start.dateTime || event.start.date),
            end: new Date(event.end.dateTime || event.end.date),
            allDay: !event.start.dateTime,
            description: event.description,
            etag: event.etag,
         }));
         setEvents(formattedEvents);
      } catch (error) {
        console.error("Error fetching Google Calendar events:", error);
        showAlert('Google 캘린더 이벤트를 가져오는 중 오류가 발생했습니다.', 'error', '오류');
        setEvents([]);
      }
   }, [showAlert]);

   useEffect(() => {
      fetchEvents(date);
   }, [date, fetchEvents, onEventAdded]);

   const handleNavigate = newDate => {
      setDate(newDate);
   };

   const handleAddEvent = newEvent => {
      fetchEvents(date);
      setShowAddEventModal(false);
   };

   const handleDeleteEvent = async eventToDelete => {
      try {
         const token = localStorage.getItem('token');
         const response = await fetch(`${API_BASE_URL}/api/calendar/events/${eventToDelete.id}`, {
            method: 'DELETE',
            headers: {
               'x-auth-token': token,
            },
         });

         if (!response.ok) {
            throw new Error('일정 삭제에 실패했습니다.');
         }

         showAlert('일정이 성공적으로 삭제되었습니다.', 'success', '삭제 완료');
         setSelectedEvent(null);
         fetchEvents(date);
      } catch (error) {
         showAlert('일정 삭제 중 오류가 발생했습니다.', 'error', '삭제 실패');
      }
   };

   const handleSelectEvent = event => {
      setSelectedEvent(event);
   };

   const handleEditEvent = eventToEdit => {
      setSelectedEvent(eventToEdit);
      setShowEditEventModal(true);
   };

   const handleUpdateEvent = updatedEvent => {
      fetchEvents(date);
      setShowEditEventModal(false);
      setSelectedEvent(null);
   };

   return (
      <div className="calendar-container">
         <div className="flex justify-end items-center mb-4">
            <button
               className={`px-4 py-2 rounded-md flex items-center text-white ${
                  isVoiceRecognitionEnabled ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400 hover:bg-gray-500'
               } mr-2 cursor-pointer`}
               onClick={onToggleVoiceRecognition}
               title={isVoiceRecognitionEnabled ? "음성인식 비활성화" : "음성인식 활성화"}
            >
               <Mic size={20} className="mr-2" />
               {isVoiceRecognitionEnabled ? '음성인식 활성화' : '음성인식 비활성화'}
            </button>
            <button
               onClick={() => setShowAddEventModal(true)}
               className="px-4 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50">
               + 일정 추가
            </button>
         </div>
         <div style={{ height: '70vh' }}>
            <Calendar
               localizer={localizer}
               events={events}
               startAccessor="start"
               endAccessor="end"
               onNavigate={handleNavigate}
               date={date}
               onSelectEvent={handleSelectEvent}
               views={['month', 'week', 'day', 'agenda']}
               view={isMobile ? 'agenda' : 'month'}
               defaultView={isMobile ? 'agenda' : 'month'}
               formats={formats}
               messages={messages}
            />
         </div>
         {showAddEventModal && (
            <AddEventModal onClose={() => setShowAddEventModal(false)} onAddEvent={handleAddEvent} />
         )}
         {selectedEvent && !showEditEventModal && (
            <EventDetailsModal
               event={selectedEvent}
               onClose={() => setSelectedEvent(null)}
               onDelete={handleDeleteEvent}
               onEdit={handleEditEvent}
            />
         )}
         {showEditEventModal && (
            <EditEventModal
               event={selectedEvent}
               onClose={() => setShowEditEventModal(false)}
               onUpdateEvent={handleUpdateEvent}
            />
         )}
         
         <CustomAlertModal
            isOpen={alertModal.isOpen}
            onClose={closeAlert}
            onConfirm={alertModal.onConfirm}
            title={alertModal.title}
            message={alertModal.message}
            type={alertModal.type}
            showCancel={alertModal.showCancel}
         />
      </div>
   );
};

export default MyCalendar;