/**
 * ===================================================================================================
 * Calendar.js - 개인 일정 캘린더 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/calendar/Calendar.js
 *
 * 🎯 주요 기능:
 *    - Google Calendar 일정 표시 및 동기화
 *    - 개인 시간(Personal Times) 반복 일정 표시
 *    - 일정 추가/수정/삭제 (Google Calendar)
 *    - 월간/주간/일간/목록 뷰 전환
 *    - 음성인식 기능 토글
 *    - 모바일 반응형 (자동으로 목록 뷰 전환)
 *
 * 🔗 연결된 파일:
 *    - ../modals/AddEventModal.js - 일정 추가 모달
 *    - ../modals/EventDetailsModal.js - 일정 상세 모달
 *    - ../modals/EditEventModal.js - 일정 수정 모달
 *    - ../modals/CustomAlertModal.js - 커스텀 알림 모달
 *    - ../../services/userService.js - 사용자 서비스
 *    - ../../config/firebaseConfig.js - Firebase 설정
 *    - /api/calendar/events - Google Calendar API
 *    - react-big-calendar - 캘린더 라이브러리
 *
 * 💡 UI 위치:
 *    - 화면: 메인 앱 > 캘린더 탭
 *    - 접근: 로그인 후 캘린더 탭 선택
 *    - 섹션: 음성인식 토글, 일정 추가 버튼, 캘린더 뷰
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 캘린더 전체 UI 및 일정 처리 로직 변경
 *    - 캘린더 뷰 옵션 변경: views 배열 및 defaultView 수정
 *    - 일정 스타일 변경: eventStyleGetter 함수 수정
 *    - 개인 시간 생성 로직 변경: generatePersonalEvents 함수 수정
 *
 * 📝 참고사항:
 *    - Google Calendar 연동은 localStorage의 'googleConnected' 상태로 제어
 *    - 개인 시간(Personal Times)은 보라색으로 표시되며 프로필 탭에서만 수정 가능
 *    - 모바일(768px 미만)에서는 자동으로 목록(agenda) 뷰로 전환
 *    - moment.js 한국어 로케일 사용
 *
 * ===================================================================================================
 */

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
import { auth } from '../../config/firebaseConfig';

moment.locale('ko');
const localizer = momentLocalizer(moment);
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

/**
 * generatePersonalEvents - 개인 시간 반복 일정 생성
 *
 * @description 개인 시간 설정을 기반으로 지정된 기간 동안의 반복 일정 생성
 * @param {Array} personalTimes - 개인 시간 설정 배열 (days, startTime, endTime, title 포함)
 * @param {Date} timeMin - 일정 생성 시작 날짜
 * @param {Date} timeMax - 일정 생성 종료 날짜
 * @returns {Array} 생성된 일정 객체 배열
 */
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
          participants: pt.participants || 1,
          participantNames: pt.participantNames || [],
          totalMembers: pt.totalMembers || 0,
          location: pt.location || null,
        });
      }
    });
  }
  return events;
};

/**
 * MyCalendar - 개인 일정 캘린더 메인 컴포넌트
 *
 * @param {Object} props - 컴포넌트 props
 * @param {boolean} props.isListening - 음성인식 활성화 상태 (사용되지 않음)
 * @param {Function} props.onEventAdded - 일정 추가 시 호출되는 콜백
 * @param {boolean} props.isVoiceRecognitionEnabled - 음성인식 활성화 여부
 * @param {Function} props.onToggleVoiceRecognition - 음성인식 토글 핸들러
 *
 * @returns {JSX.Element} 캘린더 UI
 */
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

   /**
    * showAlert - 알림 모달 표시 함수
    *
    * @param {string} message - 표시할 메시지
    * @param {string} type - 알림 타입 (info, success, warning, error)
    * @param {string} title - 알림 제목
    * @param {boolean} showCancel - 취소 버튼 표시 여부
    * @param {Function} onConfirm - 확인 버튼 클릭 시 콜백 함수
    */
   const showAlert = useCallback((message, type = 'info', title = '', showCancel = false, onConfirm = null) => {
     setAlertModal({ isOpen: true, title, message, type, showCancel, onConfirm });
   }, []);

   /**
    * closeAlert - 알림 모달 닫기 함수
    */
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

   /**
    * updateIsMobile - 모바일 화면 상태 업데이트
    *
    * @description 창 크기에 따라 모바일 상태 업데이트 (768px 기준)
    */
   const updateIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
   };

   useEffect(() => {
      window.addEventListener('resize', updateIsMobile);
      return () => window.removeEventListener('resize', updateIsMobile);
   }, []);

   /**
    * fetchEvents - 일정 데이터 조회
    *
    * @description Google Calendar와 개인 시간 데이터를 조회하여 캘린더에 표시
    * @param {Date} currentDate - 조회할 날짜 (해당 월의 일정 조회)
    */
   const fetchEvents = useCallback(async currentDate => {
      try {
         const currentUser = auth.currentUser;
         const startOfMonth = moment(currentDate).startOf('month').toISOString();
         const endOfMonth = moment(currentDate).endOf('month').toISOString();

         let googleEvents = [];
         const googleConnected = localStorage.getItem('googleConnected');
         if (currentUser && googleConnected && googleConnected !== 'false') {
            const response = await fetch(
               `${API_BASE_URL}/api/calendar/events?timeMin=${startOfMonth}&timeMax=${endOfMonth}`,
               { headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` } }
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
         if (currentUser) {
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

   /**
    * handleNavigate - 캘린더 날짜 이동 처리
    *
    * @param {Date} newDate - 이동할 날짜
    */
   const handleNavigate = newDate => {
      setDate(newDate);
   };

   /**
    * handleAddEvent - 일정 추가 완료 처리
    *
    * @param {Object} newEvent - 추가된 일정 객체
    */
   const handleAddEvent = newEvent => {
      fetchEvents(date);
      setShowAddEventModal(false);
   };

   /**
    * handleDeleteEvent - 일정 삭제 처리
    *
    * @description Google Calendar 일정 삭제 (개인 시간은 삭제 불가 알림)
    * @param {Object} eventToDelete - 삭제할 일정 객체
    */
   const handleDeleteEvent = async eventToDelete => {
      if (eventToDelete.isPersonal) {
         showAlert('개인 시간은 프로필 탭에서만 삭제할 수 있습니다.', 'info', '알림');
         return;
      }
      try {
         const currentUser = auth.currentUser;
         if (!currentUser) {
            showAlert('로그인이 필요합니다.', 'error', '로그인 필요');
            return;
         }
         const response = await fetch(`${API_BASE_URL}/api/calendar/events/${eventToDelete.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` },
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

   /**
    * handleSelectEvent - 일정 선택 처리
    *
    * @description 캘린더에서 일정 클릭 시 상세 모달 표시
    * @param {Object} event - 선택된 일정 객체
    */
   const handleSelectEvent = event => {
      setSelectedEvent(event);
   };

   /**
    * handleEditEvent - 일정 수정 모달 열기
    *
    * @description Google Calendar 일정 수정 (개인 시간은 수정 불가 알림)
    * @param {Object} eventToEdit - 수정할 일정 객체
    */
   const handleEditEvent = eventToEdit => {
      if (eventToEdit.isPersonal) {
         showAlert('개인 시간은 프로필 탭에서만 수정할 수 있습니다.', 'info', '알림');
         return;
      }
      setSelectedEvent(eventToEdit);
      setShowEditEventModal(true);
   };

   /**
    * handleUpdateEvent - 일정 수정 완료 처리
    *
    * @param {Object} updatedEvent - 수정된 일정 객체
    */
   const handleUpdateEvent = updatedEvent => {
      fetchEvents(date);
      setShowEditEventModal(false);
      setSelectedEvent(null);
   };

   /**
    * eventStyleGetter - 일정 스타일 설정
    *
    * @description 개인 시간은 보라색, 일반 일정은 기본 스타일로 표시
    * @param {Object} event - 일정 객체
    * @param {Date} start - 시작 시간
    * @param {Date} end - 종료 시간
    * @param {boolean} isSelected - 선택 여부
    * @returns {Object} 스타일 객체
    */
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