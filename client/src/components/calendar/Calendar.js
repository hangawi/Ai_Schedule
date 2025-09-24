import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/ko';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './Calendar.css';
import AddEventModal from '../modals/AddEventModal';
import EventDetailsModal from '../modals/EventDetailsModal';
import EditEventModal from '../modals/EditEventModal';
import CustomAlertModal from '../modals/CustomAlertModal';
import { Mic } from 'lucide-react';
import { userService } from '../../services/userService'; // Import userService

moment.locale('ko');
const localizer = momentLocalizer(moment);
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

// Helper function to generate event instances from recurring personal times
const generatePersonalEvents = (personalTimes, timeMin, timeMax) => {
  const events = [];
  const start = moment(timeMin);
  const end = moment(timeMax);

  for (let m = moment(start); m.isBefore(end); m.add(1, 'days')) {
    const dayOfWeek = m.isoWeekday(); // Monday=1, Sunday=7
    personalTimes.forEach(pt => {
      if (pt.days.includes(dayOfWeek)) {
        const [startHour, startMinute] = pt.startTime.split(':').map(Number);
        const [endHour, endMinute] = pt.endTime.split(':').map(Number);

        const startDate = m.clone().hour(startHour).minute(startMinute).second(0).toDate();
        const endDate = m.clone().hour(endHour).minute(endMinute).second(0).toDate();
        
        if (endDate < startDate) {
          endDate.setDate(endDate.getDate() + 1);
        }

        events.push({
          id: `personal-${pt.id}-${m.format('YYYY-MM-DD')}`,
          title: pt.title,
          start: startDate,
          end: endDate,
          allDay: false,
          isPersonal: true, // Flag for styling
        });
      }
    });
  }
  return events;
};


const MyCalendar = ({ isListening, onEventAdded, isVoiceRecognitionEnabled, onToggleVoiceRecognition }) => {
   const [events, setEvents] = useState([]);
   const [date, setDate] = useState(new Date());
   const [showAddEventModal, setShowAddEventModal] = useState(false);
   const [selectedEvent, setSelectedEvent] = useState(null);
   const [showEditEventModal, setShowEditEventModal] = useState(false);
   const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
   
   const [alertModal, setAlertModal] = useState({
     isOpen: false,
     title: '',
     message: '',
     type: 'info',
     showCancel: false,
     onConfirm: null
   });

   const showAlert = useCallback((message, type = 'info', title = '', showCancel = false, onConfirm = null) => {
     setAlertModal({ isOpen: true, title, message, type, showCancel, onConfirm });
   }, []);

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
         const startOfMonth = moment(currentDate).startOf('month').toISOString();
         const endOfMonth = moment(currentDate).endOf('month').toISOString();

         let googleEvents = [];
         const googleConnected = localStorage.getItem('googleConnected');
         if (token && googleConnected && googleConnected !== 'false') {
            const response = await fetch(
               `${API_BASE_URL}/api/calendar/events?timeMin=${startOfMonth}&timeMax=${endOfMonth}`,
               { headers: { 'x-auth-token': token } }
            );

            if (response.ok) {
               const data = await response.json();
               googleEvents = data.map(event => ({
                  id: event.id,
                  title: event.summary,
                  start: new Date(event.start.dateTime || event.start.date),
                  end: new Date(event.end.dateTime || event.end.date),
                  allDay: !event.start.dateTime,
                  description: event.description,
                  etag: event.etag,
               }));
            } else if (response.status === 401) {
               localStorage.setItem('googleConnected', 'false');
            } else {
               // Failed to fetch Google calendar events
            }
         }

         let personalEvents = [];
         if (token) {
            try {
               const scheduleData = await userService.getUserSchedule();
               if (scheduleData && scheduleData.personalTimes) {
                  const timeMin = moment(currentDate).startOf('month').toDate();
                  const timeMax = moment(currentDate).endOf('month').toDate();
                  personalEvents = generatePersonalEvents(scheduleData.personalTimes, timeMin, timeMax);
               }
            } catch (error) {
               // Error fetching personal schedule - silently handle error
               // 개인 일정 로드 실패 시에도 구글 캘린더는 표시되도록 함
            }
         }

         setEvents([...googleEvents, ...personalEvents]);
      } catch (error) {
        // Error fetching calendar events - silently handle error
        showAlert('캘린더 이벤트를 가져오는 중 오류가 발생했습니다.', 'error', '오류');
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
      if (eventToDelete.isPersonal) {
         showAlert('개인 시간은 프로필 탭에서만 삭제할 수 있습니다.', 'info', '알림');
         return;
      }
      try {
         const token = localStorage.getItem('token');
         const response = await fetch(`${API_BASE_URL}/api/calendar/events/${eventToDelete.id}`, {
            method: 'DELETE',
            headers: { 'x-auth-token': token },
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
      if (eventToEdit.isPersonal) {
         showAlert('개인 시간은 프로필 탭에서만 수정할 수 있습니다.', 'info', '알림');
         return;
      }
      setSelectedEvent(eventToEdit);
      setShowEditEventModal(true);
   };

   const handleUpdateEvent = updatedEvent => {
      fetchEvents(date);
      setShowEditEventModal(false);
      setSelectedEvent(null);
   };

   const eventStyleGetter = (event, start, end, isSelected) => {
      if (event.isPersonal) {
         return {
            style: {
               backgroundColor: '#a78bfa', // purple-400
               borderColor: '#8b5cf6', // purple-500
               color: 'white',
               opacity: 0.8,
            }
         };
      }
      return {};
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
               eventPropGetter={eventStyleGetter}
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