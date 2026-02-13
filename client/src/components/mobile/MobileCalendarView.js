import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Menu, LogOut, User, Calendar, Clipboard, ClipboardX, Phone, Settings, FileText } from 'lucide-react';
import { auth } from '../../config/firebaseConfig';
import { useBackgroundMonitoring } from '../../hooks/useBackgroundMonitoring';
import BottomNavigation from './BottomNavigation';

import MobileScheduleEdit from './MobileScheduleEdit';
import ChatBox from '../chat/ChatBox';
import EventDetailModal, { MapModal } from './EventDetailModal';
import AutoDetectedScheduleModal from '../modals/AutoDetectedScheduleModal';
import CustomAlertModal from '../modals/CustomAlertModal';

// 분할된 모듈
import { renderEventContent } from './calendarView/utils/eventUtils';
import useCalendarData from './calendarView/hooks/useCalendarData';
import { createCalendarHandlers } from './calendarView/hooks/useCalendarHandlers';
import useTouchGesture from './calendarView/hooks/useTouchGesture';
import useCameraOCR from './calendarView/hooks/useCameraOCR';
import BottomSection from './calendarView/components/BottomSection';

import './MobileCalendarView.css';

const MobileCalendarView = ({ user, isClipboardMonitoring, setIsClipboardMonitoring, isVoiceEnabled, setIsVoiceEnabled }) => {
   const navigate = useNavigate();
   const [searchParams, setSearchParams] = useSearchParams();
   const calendarRef = useRef(null);

   const [showScheduleEdit, setShowScheduleEdit] = useState(false);
   const [isChatOpen, setIsChatOpen] = useState(searchParams.get('chat') === 'open');
   const [isEditing, setIsEditing] = useState(false);
   const [initialState, setInitialState] = useState(null);
   const [currentTitle, setCurrentTitle] = useState('');
   const [calendarView, setCalendarView] = useState('dayGridMonth');
   const [selectedDate, setSelectedDate] = useState(new Date());

   const [selectedEvent, setSelectedEvent] = useState(null);
   const [showMapModal, setShowMapModal] = useState(false);
   const [selectedLocation, setSelectedLocation] = useState(null);

   const [toastMessage, setToastMessage] = useState(null);
   const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
   const showToast = useCallback((msg) => { setToastMessage(msg); }, []);

   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
   const backgroundRecognitionRef = useRef(null);

   // --- 데이터 훅 ---
   const {
      defaultSchedule, setDefaultSchedule,
      scheduleExceptions, setScheduleExceptions,
      personalTimes, setPersonalTimes,
      events, setEvents,
      googleCalendarEvents, setGoogleCalendarEvents,
      isLoading,
      globalEvents,
      visibleRangeRef,
      fetchSchedule,
      fetchGlobalEvents,
      convertScheduleToEvents,
      chatEnhanced,
      isLoggedIn,
      eventActions,
      setEventAddedKey,
   } = useCalendarData(user, calendarRef);

   // --- 터치 제스처 훅 ---
   const { translateY, isSwiping, handleTouchStart, handleTouchMove, handleTouchEnd } = useTouchGesture(calendarRef);

   // --- 카메라/OCR 훅 ---
   const { isOcrProcessing, cameraInputRef, handleStartCamera, handleCameraCapture } = useCameraOCR(fetchSchedule, fetchGlobalEvents, showToast);

   // --- 이벤트 핸들러 ---
   const {
      handleStartEdit, handleCancel, handleSave, handleClearAll,
      handleDateClick, handleEventClick, handleDeleteScheduleEvent,
      handleSplitItemClick, handleOpenMap, handleCloseMapModal,
      handleViewChange, handleLogout, handleChatMessage,
      handleStartVoiceRecognition,
   } = createCalendarHandlers({
      defaultSchedule, setDefaultSchedule,
      scheduleExceptions, setScheduleExceptions,
      personalTimes, setPersonalTimes,
      events, setEvents,
      googleCalendarEvents, setGoogleCalendarEvents,
      initialState, setInitialState,
      isEditing, setIsEditing,
      calendarRef, selectedDate, setSelectedDate,
      visibleRangeRef,
      fetchSchedule, fetchGlobalEvents,
      showToast, setConfirmModal, setSelectedEvent,
      navigate,
      convertScheduleToEvents,
      user,
      isChatOpen, setIsChatOpen,
      chatEnhanced, globalEvents,
      setIsVoiceEnabled,
      setShowMapModal, setSelectedLocation,
      setCalendarView, setCurrentTitle,
   });

   // --- 백그라운드 대화 감지 훅 ---
   const {
      isBackgroundMonitoring,
      toggleBackgroundMonitoring,
      processTranscript,
      detectedSchedules,
      confirmSchedule,
      dismissSchedule,
      voiceStatus,
      isAnalyzing: isBackgroundAnalyzing,
      backgroundTranscript
   } = useBackgroundMonitoring(eventActions, setEventAddedKey);

   // --- 쿼리 파라미터 처리 ---
   useEffect(() => {
      if (searchParams.get('chat') === 'open') {
         searchParams.delete('chat');
         setSearchParams(searchParams, { replace: true });
      }
   }, []);

   useEffect(() => {
      if (searchParams.get('voice') === 'start') {
         searchParams.delete('voice');
         setSearchParams(searchParams, { replace: true });
         setTimeout(() => handleStartVoiceRecognition(), 500);
      }
   }, []);

   useEffect(() => {
      if (searchParams.get('camera') === 'open') {
         searchParams.delete('camera');
         setSearchParams(searchParams, { replace: true });
         setTimeout(() => handleStartCamera(), 500);
      }
   }, []);

   // --- 백그라운드 음성 인식 ---
   useEffect(() => {
      if (!isBackgroundMonitoring) {
         if (backgroundRecognitionRef.current) {
            backgroundRecognitionRef.current.stop();
            backgroundRecognitionRef.current = null;
         }
         return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
         showToast('이 브라우저에서는 음성 인식을 지원하지 않습니다.');
         return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'ko-KR';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
         for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            const isFinal = event.results[i].isFinal;
            processTranscript(transcript, isFinal);
         }
      };

      recognition.onerror = (event) => {
         console.warn('백그라운드 음성 인식 오류:', event.error);
         if (event.error === 'not-allowed') {
            showToast('마이크 권한이 필요합니다.');
         }
      };

      recognition.onend = () => {
         if (isBackgroundMonitoring && backgroundRecognitionRef.current) {
            try {
               recognition.start();
            } catch (e) {
               console.warn('음성 인식 재시작 실패:', e);
            }
         }
      };

      try {
         recognition.start();
         backgroundRecognitionRef.current = recognition;
      } catch (e) {
         console.error('음성 인식 시작 실패:', e);
      }

      return () => {
         if (backgroundRecognitionRef.current) {
            backgroundRecognitionRef.current.stop();
            backgroundRecognitionRef.current = null;
         }
      };
   }, [isBackgroundMonitoring, processTranscript]);

   // --- 렌더링 ---
   if (showScheduleEdit) return <MobileScheduleEdit onBack={() => setShowScheduleEdit(false)} />;

   return (
      <div className={`mobile-calendar-view view-${calendarView} ${calendarView === 'timeGridDay' ? 'split-mode' : ''}`}>
         {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}
         <nav className={`mobile-sidebar ${isSidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-header"><h2 className="sidebar-title">메뉴</h2><button className="sidebar-close-btn" onClick={() => setIsSidebarOpen(false)}>✕</button></div>
            <div className="sidebar-menu">
               <button className="sidebar-item" onClick={() => navigate('/')}>🏠 홈으로</button>
               <button className="sidebar-item" onClick={() => navigate('/schedule')}>📅 내 일정</button>
               <button className="sidebar-item" onClick={() => navigate('/groups')}>👥 그룹</button>
               <button className="sidebar-item" onClick={() => navigate('/calendar')}>📆 달력</button>
               <button className="sidebar-item" onClick={() => navigate('/settings')}>⚙️ 설정</button>
            </div>
         </nav>
         <header className="mobile-header">
            <div className="mobile-header-content">
               <div className="mobile-header-left">
                  <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}><Menu size={24} /></button>
                  <div className="mobile-logo-btn" onClick={() => navigate('/')}><div className="mobile-logo-wrapper"><img src="/heyheylogo.png" alt="MeetAgent Logo" className="mobile-logo-img" /><div className={`mobile-login-indicator ${user?.google?.refreshToken ? 'google' : 'local'}`}></div></div><h1 className="mobile-logo-text">MeetAgent</h1></div>
               </div>
               <div className="mobile-header-right">
                  <button className={`mobile-icon-btn ${isClipboardMonitoring ? 'active' : ''}`} onClick={() => setIsClipboardMonitoring(!isClipboardMonitoring)} title="클립보드">{isClipboardMonitoring ? <Clipboard size={18} /> : <ClipboardX size={18} />}</button>
                  <button className={`mobile-icon-btn ${isBackgroundMonitoring ? 'active' : ''}`} onClick={toggleBackgroundMonitoring} title={isBackgroundMonitoring ? `대화감지 ON ${voiceStatus}` : "대화감지 OFF"}><Phone size={18} /></button>
                  <button className="mobile-profile-btn" onClick={() => navigate('/settings')} title="설정">{user && user.firstName ? user.firstName : <User size={18} />}</button>
                  <button className="mobile-logout-btn" onClick={handleLogout} title="로그아웃"><LogOut size={16} /></button>
               </div>
            </div>
         </header>
         <div className="schedule-content">
            {isLoading ? (
               <div className="loading-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                  <img src="/waiting.webp" alt="로딩 중" style={{ width: '150px', height: '150px', borderRadius: '50%', objectFit: 'cover', marginBottom: '16px' }} />
                  <p style={{ color: '#666', fontSize: '14px' }}>로딩 중...</p>
               </div>
            ) :
               <>
                  <div className="schedule-page-title">
                     <span>{currentTitle || '달력'}</span>
                     <div className="top-edit-buttons">
                        {!isEditing ? (
                           <>
                              <button className="edit-button" onClick={handleStartEdit}>편집</button>
                           </>
                        ) : (
                           <>
                              <button className="edit-button cancel-button" onClick={handleCancel}>취소</button>
                              <button className="edit-button clear-button" onClick={handleClearAll}>초기화</button>
                              <button className="edit-button save-button" onClick={handleSave}>저장</button>
                           </>
                        )}
                     </div>
                  </div>
                  {googleCalendarEvents.length > 0 && (
                     <div className="calendar-legend">
                        <span className="legend-item">
                           <span className="legend-dot" style={{ backgroundColor: '#ef4444' }}></span>
                           앱 일정
                        </span>
                        <span className="legend-item">
                           <span className="legend-dot" style={{ backgroundColor: '#3b82f6' }}></span>
                           구글 캘린더
                        </span>
                     </div>
                  )}
                  <div
                     className="calendar-container"
                     onTouchStart={handleTouchStart}
                     onTouchMove={handleTouchMove}
                     onTouchEnd={handleTouchEnd}
                  >
                     <div className="pull-indicator top">{translateY > 0 ? '이전 달' : ''}</div>
                     <div className="pull-indicator bottom">{translateY < 0 ? '다음 달' : ''}</div>
                     <div className="calendar-wrapper" style={{ transform: `translateY(${translateY}px)`, transition: isSwiping ? 'none' : 'transform 0.3s ease-out', padding: '16px' }}>
                        <FullCalendar
                           ref={calendarRef}
                           plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                           initialView="dayGridMonth"
                           timeZone="local"
                           headerToolbar={isEditing ? { left: 'backToMonth prev,next', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' } : false}
                           customButtons={{ backToMonth: { text: '◀ 월', click: () => calendarRef.current?.getApi().changeView('dayGridMonth') } }}
                           events={events}
                           dateClick={handleDateClick}
                           eventClick={handleEventClick}
                           eventContent={renderEventContent}
                           viewDidMount={handleViewChange}
                           datesSet={handleViewChange}
                           height="auto"
                           locale="ko"
                           buttonText={{ month: '월', week: '주', day: '일' }}
                           slotMinTime="06:00:00"
                           slotMaxTime="24:00:00"
                           allDaySlot={false}
                           nowIndicator={true}
                           dayMaxEvents={2}
                           moreLinkText={(num) => `+${num}개`}
                           eventDisplay="block"
                           displayEventTime={false}
                           navLinks={true}
                           navLinkDayClick={(date) => calendarRef.current?.getApi().changeView('timeGridDay', date)}
                        />
                     </div>
                  </div>
                  <BottomSection
                     isEditing={isEditing}
                     calendarView={calendarView}
                     selectedDate={selectedDate}
                     defaultSchedule={defaultSchedule}
                     personalTimes={personalTimes}
                     events={events}
                     onSplitItemClick={handleSplitItemClick}
                  />
               </>
            }
         </div>
         {/* 숨겨진 카메라 입력 */}
         <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={cameraInputRef}
            style={{ display: 'none' }}
            onChange={handleCameraCapture}
         />

         {/* OCR 처리 중 로딩 */}
         {isOcrProcessing && (
            <div style={{
               position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
               backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
               alignItems: 'center', justifyContent: 'center', zIndex: 9999
            }}>
               <div style={{
                  background: 'white', borderRadius: '12px', padding: '24px',
                  textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
               }}>
                  <div style={{ fontSize: '24px', marginBottom: '12px' }}>📸</div>
                  <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>시간표 분석 중...</div>
                  <div style={{ color: '#666', fontSize: '14px' }}>AI가 시간표를 인식하고 있습니다</div>
               </div>
            </div>
         )}

         {/* 하단 네비게이션 바 - 항상 표시 */}
         <BottomNavigation
            onRefresh={fetchSchedule}
            onChat={() => setIsChatOpen(!isChatOpen)}
            onMic={handleStartVoiceRecognition}
            onCamera={handleStartCamera}
         />

         {/* 챗봇 - isChatOpen이 true일 때만 표시 */}
         {isChatOpen && (
            <ChatBox
               onSendMessage={handleChatMessage}
               currentTab="profile"
               onEventUpdate={fetchSchedule}
               forceOpen={true}
            />
         )}
         {selectedEvent && <EventDetailModal event={selectedEvent} user={user} onClose={() => setSelectedEvent(null)} onOpenMap={handleOpenMap} onDelete={handleDeleteScheduleEvent} previousLocation={null} isEditing={isEditing} />}
         {showMapModal && selectedLocation && <MapModal address={selectedLocation.address} lat={selectedLocation.lat} lng={selectedLocation.lng} onClose={handleCloseMapModal} />}
         {detectedSchedules.length > 0 && (
            <AutoDetectedScheduleModal
               schedules={detectedSchedules}
               onConfirm={confirmSchedule}
               onDismiss={dismissSchedule}
               isAnalyzing={isBackgroundAnalyzing}
            />
         )}
         {toastMessage && (
            <div
               style={{
                  position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
                  zIndex: 100000, backgroundColor: 'rgba(0,0,0,0.8)', color: '#fff',
                  padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 500,
                  maxWidth: '85%', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  animation: 'fadeInUp 0.3s ease-out'
               }}
               onClick={() => setToastMessage(null)}
               onAnimationEnd={() => setTimeout(() => setToastMessage(null), 2500)}
            >
               {toastMessage}
            </div>
         )}
         <CustomAlertModal
            isOpen={confirmModal.isOpen}
            onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            onConfirm={confirmModal.onConfirm}
            title={confirmModal.title}
            message={confirmModal.message}
            type="warning"
            showCancel={true}
            confirmText="확인"
            cancelText="취소"
         />
      </div>
   );
};

export default MobileCalendarView;
