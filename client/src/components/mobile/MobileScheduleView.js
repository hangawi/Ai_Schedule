import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Menu, LogOut, User, Calendar, Clipboard, ClipboardX, Phone, X, MapPin, Clock, Users } from 'lucide-react';
import { auth } from '../../config/firebaseConfig';
import './MobileScheduleView.css';

/**
 * MapModal - 지도 모달
 */
const MapModal = ({ address, lat, lng, onClose }) => {
   if (!address) return null;

   // Google Maps URL 생성
   const getMapUrl = () => {
      if (lat && lng) {
         return `https://www.google.com/maps?q=${lat},${lng}&output=embed`;
      }
      return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
   };

   return (
      <>
         <div className="modal-overlay" onClick={onClose}></div>
         <div className="map-modal">
            <div className="modal-header">
               <h3 className="modal-title">📍 장소</h3>
               <button className="modal-close-btn" onClick={onClose}>
                  <X size={24} />
               </button>
            </div>
            <div className="map-content">
               <p className="map-address">{address}</p>
               <div className="map-container">
                  <iframe
                     title="location-map"
                     src={getMapUrl()}
                     width="100%"
                     height="400"
                     style={{ border: 0, borderRadius: '12px' }}
                     allowFullScreen=""
                     loading="lazy"
                     referrerPolicy="no-referrer-when-downgrade"
                  ></iframe>
               </div>
            </div>
         </div>
      </>
   );
};

/**
 * EventDetailModal - 일정 상세 모달
 */
const EventDetailModal = ({ event, user, onClose, onOpenMap }) => {
   if (!event) return null;

   // 날짜 포맷팅
   const formatDate = (dateStr) => {
      const date = new Date(dateStr);
      const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const weekday = weekdays[date.getDay()];
      return `${year}년 ${month}월 ${day}일 (${weekday})`;
   };

   // 시간 계산
   const calculateDuration = (startTime, endTime) => {
      if (!startTime || !endTime) return '';
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      const durationMin = (endHour * 60 + endMin) - (startHour * 60 + startMin);
      const hours = Math.floor(durationMin / 60);
      const mins = durationMin % 60;
      if (hours > 0 && mins > 0) return `${hours}시간 ${mins}분`;
      if (hours > 0) return `${hours}시간`;
      return `${mins}분`;
   };

   return (
      <>
         {/* 오버레이 */}
         <div className="modal-overlay" onClick={onClose}></div>

         {/* 모달 */}
         <div className="event-detail-modal">
            {/* 헤더 */}
            <div className="modal-header">
               <h3 className="modal-title">일정 상세</h3>
               <button className="modal-close-btn" onClick={onClose}>
                  <X size={24} />
               </button>
            </div>

            {/* 내용 */}
            <div className="modal-content">
               {/* 모임이름 */}
               <div className="modal-section">
                  <div className="modal-label">모임이름</div>
                  <div className="modal-value modal-value-large">{event.title}</div>
                  {event.isCoordinated && (
                     <span className="coordinated-badge">확정된 일정</span>
                  )}
               </div>

               {/* 날짜 */}
               <div className="modal-section">
                  <div className="modal-label">
                     <Calendar size={16} />
                     날짜
                  </div>
                  <div className="modal-value">{formatDate(event.date)}</div>
               </div>

               {/* 시간 */}
               <div className="modal-section">
                  <div className="modal-label">
                     <Clock size={16} />
                     시간
                  </div>
                  <div className="modal-value">
                     {event.time} ~ {event.endTime}
                     {event.time && event.endTime && (
                        <span className="duration-text"> ({calculateDuration(event.time, event.endTime)})</span>
                     )}
                  </div>
               </div>

               {/* 장소 */}
               <div
                  className="modal-section modal-location-section"
                  onClick={() => {
                     if (user && user.address) {
                        const fullAddress = user.addressDetail
                           ? `${user.address} ${user.addressDetail}`
                           : user.address;
                        onOpenMap(fullAddress, user.addressLat, user.addressLng);
                     }
                  }}
                  style={{ cursor: user && user.address ? 'pointer' : 'default' }}
               >
                  <div className="modal-label">
                     <MapPin size={16} />
                     장소
                  </div>
                  <div className="modal-value modal-location-value">
                     {user && user.address
                        ? (user.addressDetail ? `${user.address} ${user.addressDetail}` : user.address)
                        : '장소 미정'}
                     {user && user.address && <span className="map-hint">📍 지도 보기</span>}
                  </div>
               </div>

               {/* 인원수 */}
               <div className="modal-section">
                  <div className="modal-label">
                     <Users size={16} />
                     인원수
                  </div>
                  <div className="modal-value">👥 {event.participants}명</div>
               </div>

               {/* 조율방 정보 (확정된 일정일 경우) */}
               {event.isCoordinated && event.roomName && (
                  <div className="modal-section modal-coordinated-info">
                     <div className="modal-label">조율방</div>
                     <div className="modal-value">📅 {event.roomName}</div>
                  </div>
               )}
            </div>
         </div>
      </>
   );
};

/**
 * EventCard - 일정 카드 컴포넌트
 */
const EventCard = ({ event, onClick }) => {
   return (
      <div
         className={`event-card ${event.isCoordinated ? 'coordinated' : ''}`}
         onClick={() => onClick(event)}
      >
         <div className="event-header">
            <h4 className="event-title">{event.title}</h4>
            {event.isCoordinated && (
               <span className="coordinated-badge">확정</span>
            )}
         </div>
         {event.isCoordinated && event.roomName && (
            <p className="event-room">📅 {event.roomName}</p>
         )}
         <div className="event-info">
            <p className="event-date">{event.date}</p>
            <p className="event-time">{event.time} ~ {event.endTime}</p>
            <p className="event-participants">👥 {event.participants}명</p>
         </div>
      </div>
   );
};

const MobileScheduleView = ({ user }) => {
   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
   const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
   const [isClipboardMonitoring, setIsClipboardMonitoring] = useState(false);
   const [isBackgroundMonitoring, setIsBackgroundMonitoring] = useState(false);
   const [activeTab, setActiveTab] = useState('upcoming'); // 'past', 'today', 'upcoming'
   const [selectedEvent, setSelectedEvent] = useState(null); // 선택된 일정
   const [showMapModal, setShowMapModal] = useState(false); // 지도 모달 표시 여부
   const [selectedLocation, setSelectedLocation] = useState(null); // 선택된 장소

   // 데이터 상태
   const [globalEvents, setGlobalEvents] = useState([]);
   const [personalTimes, setPersonalTimes] = useState([]);
   const [dataLoaded, setDataLoaded] = useState(false);

   const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

   // 일정 클릭 핸들러
   const handleEventClick = (event) => {
      setSelectedEvent(event);
   };

   // 모달 닫기
   const handleCloseModal = () => {
      setSelectedEvent(null);
   };

   // 지도 모달 열기
   const handleOpenMap = (address, lat, lng) => {
      setSelectedLocation({ address, lat, lng });
      setShowMapModal(true);
   };

   // 지도 모달 닫기
   const handleCloseMapModal = () => {
      setShowMapModal(false);
      setSelectedLocation(null);
   };

   // 나의 일정 가져오기
   const fetchEvents = useCallback(async () => {
      try {
         const currentUser = auth.currentUser;
         if (!currentUser) return;

         const response = await fetch(`${API_BASE_URL}/api/events`, {
            headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` },
         });
         if (!response.ok) throw new Error('Failed to fetch events');

         const data = await response.json();
         const formattedEvents = data.events.map(event => ({
            id: event._id,
            title: event.title,
            date: new Date(event.date).toISOString().split('T')[0],
            time: event.time,
            endTime: event.endTime,
            participants: event.participants || 1,
            priority: event.priority || 3,
            color: event.color || 'blue'
         }));
         setGlobalEvents(formattedEvents);
      } catch (error) {
         console.error('Fetch events error:', error);
      }
   }, [API_BASE_URL]);

   // 개인시간 (확정된 일정) 가져오기
   const fetchPersonalTimes = useCallback(async () => {
      try {
         const currentUser = auth.currentUser;
         if (!currentUser) return;

         const response = await fetch(`${API_BASE_URL}/api/users/profile/schedule`, {
            headers: { 'Authorization': `Bearer ${await currentUser.getIdToken()}` },
         });
         if (!response.ok) throw new Error('Failed to fetch personal times');

         const data = await response.json();
         const formattedPersonalTimes = (data.personalTimes || [])
            .filter(pt => pt.specificDate)
            .map(pt => ({
               id: `pt-${pt.id}`,
               title: pt.title || '개인 일정',
               date: pt.specificDate,
               time: pt.startTime,
               endTime: pt.endTime,
               participants: 1,
               priority: 3,
               color: pt.color || '#10B981',
               isCoordinated: pt.title && pt.title.includes('-'),
               roomName: pt.title && pt.title.includes('-') ? pt.title.split('-')[0].trim() : undefined
            }));
         setPersonalTimes(formattedPersonalTimes);
      } catch (error) {
         console.error('Fetch personal times error:', error);
      }
   }, [API_BASE_URL]);

   // 데이터 로드
   useEffect(() => {
      const loadData = async () => {
         await Promise.all([fetchEvents(), fetchPersonalTimes()]);
         setDataLoaded(true);
      };
      loadData();
   }, [fetchEvents, fetchPersonalTimes]);

   // 일정 필터링 및 시간순 정렬
   const { pastEvents, todayEvents, upcomingEvents } = useMemo(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);

      const allEvents = [...globalEvents, ...personalTimes];

      // 시간순 정렬 함수
      const sortByDateTime = (a, b) => {
         // 날짜 비교
         const dateCompare = a.date.localeCompare(b.date);
         if (dateCompare !== 0) return dateCompare;

         // 같은 날이면 시간 비교
         const timeA = a.time || '00:00';
         const timeB = b.time || '00:00';
         return timeA.localeCompare(timeB);
      };

      const pastEvents = allEvents
         .filter(event => {
            const eventDate = new Date(event.date);
            eventDate.setHours(0, 0, 0, 0);
            return eventDate >= thirtyDaysAgo && eventDate < today;
         })
         .sort(sortByDateTime);

      const todayEvents = allEvents
         .filter(event => event.date === todayStr)
         .sort(sortByDateTime);

      const upcomingEvents = allEvents
         .filter(event => {
            const eventDate = new Date(event.date);
            eventDate.setHours(0, 0, 0, 0);
            return eventDate > today;
         })
         .sort(sortByDateTime);

      return { pastEvents, todayEvents, upcomingEvents };
   }, [globalEvents, personalTimes]);

   const handleLogout = () => {
      localStorage.removeItem('token');
      window.location.href = '/auth';
   };

   return (
      <div className="mobile-schedule-view">
         {/* 사이드바 오버레이 */}
         {isSidebarOpen && (
            <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
         )}

         {/* 사이드바 */}
         <nav className={`mobile-sidebar ${isSidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
               <h2 className="sidebar-title">메뉴</h2>
               <button className="sidebar-close-btn" onClick={() => setIsSidebarOpen(false)}>✕</button>
            </div>
            <div className="sidebar-menu">
               <button className="sidebar-item" onClick={() => window.location.href = '/'}>
                  🏠 홈으로
               </button>
               <button className="sidebar-item" onClick={() => window.location.href = '/mobile/schedule'}>
                  📅 내 일정
               </button>
               <button className="sidebar-item" onClick={() => window.location.href = '/mobile/groups'}>
                  👥 그룹
               </button>
               <button className="sidebar-item" onClick={() => window.location.href = '/mobile/calendar'}>
                  📆 달력
               </button>
            </div>
         </nav>

         {/* 모바일 헤더 */}
         <header className="mobile-header">
            <div className="mobile-header-content">
               {/* 왼쪽: 햄버거 메뉴 + 로고 */}
               <div className="mobile-header-left">
                  <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}>
                     <Menu size={24} />
                  </button>
                  <div className="mobile-logo-btn" onClick={() => window.location.href = '/'}>
                     <img src="/image.png" alt="MeetAgent Logo" className="mobile-logo-img" />
                     <h1 className="mobile-logo-text">MeetAgent</h1>
                  </div>
               </div>

               {/* 오른쪽: 버튼들 */}
               <div className="mobile-header-right">
                  {/* 캘린더 버튼 */}
                  <button className="mobile-icon-btn" onClick={() => window.location.href = '/'} title="캘린더">
                     <Calendar size={20} />
                  </button>

                  {/* 클립보드 모니터링 */}
                  <button
                     className={`mobile-icon-btn ${isClipboardMonitoring ? 'active' : ''}`}
                     onClick={() => setIsClipboardMonitoring(!isClipboardMonitoring)}
                     title={isClipboardMonitoring ? "클립보드 ON" : "클립보드 OFF"}>
                     {isClipboardMonitoring ? <Clipboard size={18} /> : <ClipboardX size={18} />}
                  </button>

                  {/* 백그라운드 모니터링 */}
                  <button
                     className={`mobile-icon-btn ${isBackgroundMonitoring ? 'active' : ''}`}
                     onClick={() => setIsBackgroundMonitoring(!isBackgroundMonitoring)}
                     title={isBackgroundMonitoring ? "통화감지 ON" : "통화감지 OFF"}>
                     <Phone size={18} />
                  </button>

                  {/* 프로필 버튼 */}
                  <button className="mobile-profile-btn" onClick={() => window.location.href = '/'} title="프로필">
                     {user && user.firstName ? user.firstName : <User size={18} />}
                  </button>

                  {/* 음성 인식 버튼 */}
                  <button
                     className="mobile-voice-btn"
                     onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                     title={isVoiceEnabled ? "음성 인식 ON" : "음성 인식 OFF"}>
                     {isVoiceEnabled ? '🎙️' : '🔇'}
                  </button>

                  {/* 로그아웃 버튼 */}
                  <button
                     className="mobile-logout-btn"
                     onClick={handleLogout}
                     title="로그아웃">
                     <LogOut size={16} />
                  </button>
               </div>
            </div>
         </header>

         {/* 상단 탭 버튼 */}
         <div className="schedule-tabs">
            <button
               className={`tab-btn ${activeTab === 'past' ? 'active' : ''}`}
               onClick={() => setActiveTab('past')}
            >
               지난 일정 ({pastEvents.length})
            </button>
            <button
               className={`tab-btn ${activeTab === 'today' ? 'active' : ''}`}
               onClick={() => setActiveTab('today')}
            >
               오늘 일정 ({todayEvents.length})
            </button>
            <button
               className={`tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
               onClick={() => setActiveTab('upcoming')}
            >
               예정 일정 ({upcomingEvents.length})
            </button>
         </div>

         {/* 컨텐츠 영역 */}
         <div className="schedule-content">
            {!dataLoaded ? (
               <div className="tab-content loading">로딩 중...</div>
            ) : (
               <>
                  {activeTab === 'past' && (
                     <div className="tab-content">
                        {pastEvents.length === 0 ? (
                           <p className="empty-message">지난 30일간 일정이 없습니다.</p>
                        ) : (
                           <div className="event-list">
                              {pastEvents.map(event => (
                                 <EventCard key={event.id} event={event} onClick={handleEventClick} />
                              ))}
                           </div>
                        )}
                     </div>
                  )}
                  {activeTab === 'today' && (
                     <div className="tab-content">
                        {todayEvents.length === 0 ? (
                           <p className="empty-message">오늘 일정이 없습니다.</p>
                        ) : (
                           <div className="event-list">
                              {todayEvents.map(event => (
                                 <EventCard key={event.id} event={event} onClick={handleEventClick} />
                              ))}
                           </div>
                        )}
                     </div>
                  )}
                  {activeTab === 'upcoming' && (
                     <div className="tab-content">
                        {upcomingEvents.length === 0 ? (
                           <p className="empty-message">예정된 일정이 없습니다.</p>
                        ) : (
                           <div className="event-list">
                              {upcomingEvents.map(event => (
                                 <EventCard key={event.id} event={event} onClick={handleEventClick} />
                              ))}
                           </div>
                        )}
                     </div>
                  )}
               </>
            )}
         </div>

         {/* 일정 상세 모달 */}
         {selectedEvent && (
            <EventDetailModal
               event={selectedEvent}
               user={user}
               onClose={handleCloseModal}
               onOpenMap={handleOpenMap}
            />
         )}

         {/* 지도 모달 */}
         {showMapModal && selectedLocation && (
            <MapModal
               address={selectedLocation.address}
               lat={selectedLocation.lat}
               lng={selectedLocation.lng}
               onClose={handleCloseMapModal}
            />
         )}
      </div>
   );
};

export default MobileScheduleView;