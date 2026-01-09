import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, User, Calendar, Clipboard, ClipboardX, Phone, X, MapPin, Clock, Users } from 'lucide-react';
import { auth } from '../../config/firebaseConfig';
import EventDetailModal, { MapModal } from './EventDetailModal';
import BottomNavigation from './BottomNavigation';
import './MobileScheduleView.css';

/**
 * EventCard - 일정 카드 컴포넌트
 */
const EventCard = ({ event, onClick, isToday, isHighlighted, cardRef }) => {
   return (
      <div
         ref={cardRef}
         className={`event-card ${event.isCoordinated ? 'coordinated' : ''} ${isToday ? 'today' : ''} ${isHighlighted ? 'highlight' : ''}`}
         onClick={() => onClick(event)}
      >
         <div className="event-header">
            <h4 className="event-title">{event.title}</h4>
            <div className="event-badges">
               {isToday && <span className="today-badge">오늘</span>}
               {event.isCoordinated && (
                  <span className="coordinated-badge">확정</span>
               )}
            </div>
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
   const navigate = useNavigate();
   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
   const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
   const [isClipboardMonitoring, setIsClipboardMonitoring] = useState(false);
   const [isBackgroundMonitoring, setIsBackgroundMonitoring] = useState(false);
   const [selectedEvent, setSelectedEvent] = useState(null); // 선택된 일정
   const [showMapModal, setShowMapModal] = useState(false); // 지도 모달 표시 여부
   const [selectedLocation, setSelectedLocation] = useState(null); // 선택된 장소
   const [highlightToday, setHighlightToday] = useState(false); // 오늘 일정 하이라이트

   // 데이터 상태
   const [globalEvents, setGlobalEvents] = useState([]);
   const [personalTimes, setPersonalTimes] = useState([]);
   const [dataLoaded, setDataLoaded] = useState(false);

   // 오늘 일정으로 스크롤하기 위한 ref
   const todayRef = useRef(null);

   const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

   // 1. API 호출 함수 정의
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
            color: event.color || 'blue',
            location: event.location || null // 일정의 목적지 주소
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

         // 이동시간과 수업시간 병합 로직
         const personalTimesArray = data.personalTimes || [];
         const mergedPersonalTimes = [];
         const processedIds = new Set();

         // 날짜별로 그룹화
         const byDate = {};
         personalTimesArray.forEach(pt => {
            if (!pt.specificDate) return;
            if (!byDate[pt.specificDate]) byDate[pt.specificDate] = [];
            byDate[pt.specificDate].push(pt);
         });

         // 각 날짜별로 병합 처리
         Object.keys(byDate).forEach(date => {
            const dayEvents = byDate[date].sort((a, b) => a.startTime.localeCompare(b.startTime));

            dayEvents.forEach((pt, idx) => {
               if (processedIds.has(pt.id)) return;

               // 이동시간이면 다음 일정과 병합 시도
               if (pt.title && pt.title.includes('이동시간')) {
                  console.log('📱 [클라이언트] 이동시간 감지:', {
                     title: pt.title,
                     ptLocation: pt.location,
                     ptLocationLat: pt.locationLat,
                     ptLocationLng: pt.locationLng,
                     startTime: pt.startTime,
                     endTime: pt.endTime
                  });

                  const nextEvent = dayEvents[idx + 1];
                  // 다음 일정이 있고, 시간이 연속되고, 같은 방이면 병합
                  if (nextEvent &&
                      nextEvent.startTime === pt.endTime &&
                      pt.title.split('-')[0].trim() === nextEvent.title.split('-')[0].trim()) {

                     console.log('📱 [클라이언트] 병합 시작:', {
                        ptLocation: pt.location,
                        nextEventLocation: nextEvent.location,
                        finalLocation: pt.location || nextEvent.location || null
                     });

                     // 병합된 일정 생성
                     // 🔧 이동시간의 목적지(pt.location)를 우선 사용 (조원 주소)
                     mergedPersonalTimes.push({
                        id: `pt-${nextEvent.id}`,
                        title: nextEvent.title,
                        date: nextEvent.specificDate,
                        time: pt.startTime, // 이동시간의 시작
                        endTime: nextEvent.endTime, // 수업시간의 종료
                        participants: 1,
                        priority: 3,
                        color: nextEvent.color || '#3B82F6',
                        isCoordinated: true,
                        roomName: nextEvent.title.split('-')[0].trim(),
                        location: pt.location || nextEvent.location || null, // 이동시간 목적지 우선
                        locationLat: pt.locationLat || nextEvent.locationLat || null,
                        locationLng: pt.locationLng || nextEvent.locationLng || null,
                        transportMode: nextEvent.transportMode || pt.transportMode || null,
                        hasTravelTime: true, // 이동시간 포함 플래그
                        travelStartTime: pt.startTime,
                        travelEndTime: pt.endTime
                     });

                     processedIds.add(pt.id);
                     processedIds.add(nextEvent.id);
                  } else {
                     // 병합 실패 - 이동시간만 단독으로 표시
                     mergedPersonalTimes.push({
                        id: `pt-${pt.id}`,
                        title: pt.title,
                        date: pt.specificDate,
                        time: pt.startTime,
                        endTime: pt.endTime,
                        participants: 1,
                        priority: 3,
                        color: pt.color || '#FFA500',
                        isCoordinated: pt.title && pt.title.includes('-'),
                        roomName: pt.title && pt.title.includes('-') ? pt.title.split('-')[0].trim() : undefined,
                        location: pt.location || null,
                        locationLat: pt.locationLat || null,
                        locationLng: pt.locationLng || null,
                        transportMode: pt.transportMode || null
                     });
                     processedIds.add(pt.id);
                  }
               } else {
                  // 일반 일정 (이동시간 아님)
                  mergedPersonalTimes.push({
                     id: `pt-${pt.id}`,
                     title: pt.title || '개인 일정',
                     date: pt.specificDate,
                     time: pt.startTime,
                     endTime: pt.endTime,
                     participants: 1,
                     priority: 3,
                     color: pt.color || '#10B981',
                     isCoordinated: pt.title && pt.title.includes('-'),
                     roomName: pt.title && pt.title.includes('-') ? pt.title.split('-')[0].trim() : undefined,
                     location: pt.location || null,
                     locationLat: pt.locationLat || null,
                     locationLng: pt.locationLng || null,
                     transportMode: pt.transportMode || null,
                     hasTravelTime: pt.hasTravelTime || false
                  });
                  processedIds.add(pt.id);
               }
            });
         });

         setPersonalTimes(mergedPersonalTimes);
      } catch (error) {
         console.error('Fetch personal times error:', error);
      }
   }, [API_BASE_URL]);

   // 2. 데이터 로드 Effect
   useEffect(() => {
      const loadData = async () => {
         await Promise.all([fetchEvents(), fetchPersonalTimes()]);
         setDataLoaded(true);
      };
      loadData();
   }, [fetchEvents, fetchPersonalTimes]);

   // 3. useMemo (전체 일정 시간순 정렬)
   const { allEvents, todayStr } = useMemo(() => {
      const today = new Date();
      const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

      const allEvents = [...globalEvents, ...personalTimes];

      // 시간순 정렬 함수
      const sortByDateTime = (a, b) => {
         const dateCompare = a.date.localeCompare(b.date);
         if (dateCompare !== 0) return dateCompare;
         const timeA = a.time || '00:00';
         const timeB = b.time || '00:00';
         return timeA.localeCompare(timeB);
      };

      return {
         allEvents: allEvents.sort(sortByDateTime),
         todayStr
      };
   }, [globalEvents, personalTimes]);

   // 4. 핸들러 함수들
   // 일정 클릭 핸들러
   const handleEventClick = (event) => {
      setSelectedEvent(event);
   };

   // 이전 일정의 위치 찾기
   const getPreviousEventLocation = useCallback((currentEvent) => {
      if (!currentEvent) return null;

      // 현재 이벤트의 인덱스 찾기
      const currentIndex = allEvents.findIndex(e => e.id === currentEvent.id);

      // 이전 이벤트가 있으면 그 위치 반환
      if (currentIndex > 0) {
         const prevEvent = allEvents[currentIndex - 1];
         // 같은 날짜인지 확인
         if (prevEvent.date === currentEvent.date) {
             // 이전 일정의 목적지 (location) 확인
             if (prevEvent.location && prevEvent.locationLat && prevEvent.locationLng) {
                 return {
                     address: prevEvent.location,
                     lat: prevEvent.locationLat,
                     lng: prevEvent.locationLng,
                     name: prevEvent.location // 장소 이름
                 };
             }
         }
      }
      return null;
   }, [allEvents]);

   // 오늘 버튼 클릭 핸들러
   const handleScrollToToday = () => {
      if (todayRef.current) {
         todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
         setHighlightToday(true);
         // 3초 후 하이라이트 제거
         setTimeout(() => setHighlightToday(false), 3000);
      }
   };

   // 날짜 라벨 생성 (카톡 스타일)
   const getDateLabel = (dateStr) => {
      const today = new Date();
      const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = new Date(yesterday.getTime() - (yesterday.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

      if (dateStr === todayStr) {
         return '오늘';
      } else if (dateStr === yesterdayStr) {
         return '어제';
      } else {
         const [year, month, day] = dateStr.split('-');
         const date = new Date(dateStr);
         const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
         const weekday = weekdays[date.getDay()];
         return `${year}년 ${parseInt(month)}월 ${parseInt(day)}일 ${weekday}요일`;
      }
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

   const handleLogout = async () => {
      try {
         await auth.signOut();
         localStorage.removeItem('loginMethod');
         navigate('/auth');
      } catch (error) {
         console.error('Logout error:', error);
      }
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
               <button className="sidebar-item" onClick={() => navigate('/')}>
                  🏠 홈으로
               </button>
               <button className="sidebar-item" onClick={() => navigate('/mobile/schedule')}>
                  📅 내 일정
               </button>
               <button className="sidebar-item" onClick={() => navigate('/mobile/groups')}>
                  👥 그룹
               </button>
               <button className="sidebar-item" onClick={() => navigate('/mobile/calendar')}>
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
                  <div className="mobile-logo-btn" onClick={() => navigate('/')}>
                     <img src="/image.png" alt="MeetAgent Logo" className="mobile-logo-img" />
                     <h1 className="mobile-logo-text">MeetAgent</h1>
                  </div>
               </div>

               {/* 오른쪽: 버튼들 */}
               <div className="mobile-header-right">
                  {/* 캘린더 버튼 */}
                  <button className="mobile-icon-btn" onClick={() => navigate('/')} title="캘린더">
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
                  <button className="mobile-profile-btn" onClick={() => navigate('/')} title="프로필">
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

         {/* 상단 헤더: 전체 일정 + 오늘 버튼 */}
         <div className="schedule-header">
            <h2 className="schedule-title">전체 일정</h2>
            <button className="today-btn" onClick={handleScrollToToday}>
               <Calendar size={16} />
               오늘
            </button>
         </div>

         {/* 컨텐츠 영역 */}
         <div className="schedule-content">
            {!dataLoaded ? (
               <div className="tab-content loading">로딩 중...</div>
            ) : allEvents.length === 0 ? (
               <p className="empty-message">일정이 없습니다.</p>
            ) : (
               <div className="event-list">
                  {allEvents.map((event, index) => {
                     const isToday = event.date === todayStr;
                     const isFirstToday = isToday && allEvents.find(e => e.date === todayStr)?.id === event.id;

                     // 이전 이벤트와 날짜가 다르면 날짜 구분선 표시
                     const prevEvent = index > 0 ? allEvents[index - 1] : null;
                     const showDateDivider = !prevEvent || prevEvent.date !== event.date;

                     return (
                        <React.Fragment key={event.id}>
                           {showDateDivider && (
                              <div className="date-divider">
                                 <div className="date-divider-line"></div>
                                 <span className="date-divider-label">{getDateLabel(event.date)}</span>
                                 <div className="date-divider-line"></div>
                              </div>
                           )}
                           <EventCard
                              event={event}
                              onClick={handleEventClick}
                              isToday={isToday}
                              isHighlighted={isToday && highlightToday}
                              cardRef={isFirstToday ? todayRef : null}
                           />
                        </React.Fragment>
                     );
                  })}
               </div>
            )}
         </div>

         {/* 일정 상세 모달 */}
         {selectedEvent && (
            <EventDetailModal
               event={selectedEvent}
               user={user}
               onClose={handleCloseModal}
               onOpenMap={handleOpenMap}
               previousLocation={getPreviousEventLocation(selectedEvent)}
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

         {/* 하단 네비게이션 바 */}
         <BottomNavigation
            onRefresh={() => window.location.reload()}
            onChat={() => alert('챗봇 기능은 달력 페이지에서 사용 가능합니다.')}
         />
      </div>
   );
};

export default MobileScheduleView;
