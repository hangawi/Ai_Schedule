import React, { useState } from 'react';
import { Calendar, Clock, MapPin, Users, X, Trash2 } from 'lucide-react';
import './MobileScheduleView.css'; // 스타일 재사용

/**
 * MapModal - 지도 모달
 */
export const MapModal = ({ address, lat, lng, onClose }) => {
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
const EventDetailModal = ({ event, user, onClose, onOpenMap, onDelete, previousLocation }) => {
   const [isDeleting, setIsDeleting] = useState(false);
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

   // 시간 표시 포맷 (이동시간 분리)
   const renderTimeSection = () => {
      if (event.hasTravelTime && event.travelStartTime && event.travelEndTime) {
         return (
            <div className="time-split-display">
               <div className="time-total">
                  {event.travelStartTime} ~ {event.endTime} 
                  <span className="duration-text"> ({calculateDuration(event.travelStartTime, event.endTime)})</span>
               </div>
               <div className="time-segments">
                  <div className="time-segment travel">
                     <span className="segment-label">이동</span> 
                     {event.travelStartTime}~{event.travelEndTime}
                  </div>
                  <div className="segment-divider">|</div>
                  <div className="time-segment activity">
                     <span className="segment-label">수업</span>
                     {event.time}~{event.endTime}
                  </div>
               </div>
            </div>
         );
      }
      
      return (
         <div className="modal-value">
            {event.time} ~ {event.endTime}
            {event.time && event.endTime && (
               <span className="duration-text"> ({calculateDuration(event.time, event.endTime)})</span>
            )}
         </div>
      );
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
                  {renderTimeSection()}
               </div>

               {/* 장소 및 교통정보 통합 */}
               <div className="modal-section modal-location-transport-section">
                  {/* 장소 */}
                  <div
                     className="modal-location-section"
                     onClick={() => {
                        // 우선순위: 1. 일정의 목적지 주소, 2. 사용자 주소
                        const eventLocation = event.location;
                        const userLocation = user && user.address
                           ? (user.addressDetail ? `${user.address} ${user.addressDetail}` : user.address)
                           : null;

                        const displayLocation = eventLocation || userLocation;

                        if (displayLocation) {
                           // 일정 목적지 주소를 사용하는 경우 좌표는 null
                           onOpenMap(displayLocation, event.locationLat || user?.addressLat, event.locationLng || user?.addressLng);
                        }
                     }}
                     style={{ cursor: (event.location || (user && user.address)) ? 'pointer' : 'default' }}
                  >
                     <div className="modal-label">
                        <MapPin size={16} />
                        장소
                     </div>
                     <div className="modal-value modal-location-value">
                        {event.location || (user && user.address
                           ? (user.addressDetail ? `${user.address} ${user.addressDetail}` : user.address)
                           : '장소 미정')}
                        {(event.location || (user && user.address)) && <span className="map-hint">📍 지도 보기</span>}
                     </div>
                  </div>

                  {/* 교통정보 (이동시간 포함 일정만) */}
                  {event.hasTravelTime && (
                     <div className="modal-transport-section">
                        <div className="modal-label">
                           <MapPin size={16} />
                           교통정보
                        </div>
                        <div className="modal-transport-info">
                           {/* 교통수단 */}
                           <div className="transport-row">
                              <span className="transport-icon">
                                 {event.transportMode === 'driving' && '🚗'}
                                 {event.transportMode === 'transit' && '🚇'}
                                 {event.transportMode === 'walking' && '🚶'}
                                 {!event.transportMode && '🚗'}
                              </span>
                              <span className="transport-text">
                                 {event.transportMode === 'driving' && '자동차'}
                                 {event.transportMode === 'transit' && '대중교통'}
                                 {event.transportMode === 'walking' && '도보'}
                                 {!event.transportMode && '자동차'}
                              </span>
                           </div>

                           {/* 경로 보기 버튼 */}
                           {user && user.address && event.location && (
                              <button
                                 className="route-button"
                                 onClick={(e) => {
                                    e.stopPropagation();

                                    // 🚀 출발지 결정 로직 개선
                                    // 1. 이전 일정이 있으면 그곳을 출발지로 설정 (previousLocation)
                                    // 2. 없으면 내 집을 출발지로 설정 (user.address)
                                    let startAddr, startLat, startLng;

                                    if (previousLocation) {
                                       startAddr = previousLocation.address;
                                       startLat = previousLocation.lat;
                                       startLng = previousLocation.lng;

                                    } else {
                                       startAddr = user.addressDetail ? `${user.address} ${user.addressDetail}` : user.address;
                                       startLat = user.addressLat;
                                       startLng = user.addressLng;
                                    }

                                    // 도착지 정보
                                    const endAddr = event.location;
                                    const endLat = event.locationLat;
                                    const endLng = event.locationLng;

                                    // 좌표가 있으면 좌표 사용, 없으면 주소 사용
                                    if (startLat && startLng && endLat && endLng) {
                                       // 좌표 기반 카카오맵 길찾기
                                       const kakaoMapUrl = `https://map.kakao.com/link/to/${encodeURIComponent(endAddr)},${endLat},${endLng}/from/${encodeURIComponent(startAddr)},${startLat},${startLng}`;
                                       window.open(kakaoMapUrl, '_blank');
                                    } else {
                                       // 주소 기반 카카오맵 검색 (폴백)
                                       // 출발지도 쿼리에 포함하면 좋지만, 카카오맵 웹 URL 스키마 한계로 도착지 검색만 우선 수행
                                       // (길찾기 파라미터가 복잡함)
                                       const kakaoMapUrl = `https://map.kakao.com/link/search/${encodeURIComponent(endAddr)}`;
                                       window.open(kakaoMapUrl, '_blank');
                                       alert('정확한 경로를 보려면 주소 등록이 필요합니다.');
                                    }
                                 }}
                              >
                                 🗺️ 경로 보기
                              </button>
                           )}
                        </div>
                     </div>
                  )}
               </div>

               {/* 인원수 */}
               <div className="modal-section">
                  <div className="modal-label">
                     <Users size={16} />
                     인원수
                  </div>
                  <div className="modal-value">👥 {event.participants || 1}명</div>
               </div>

               {/* 조율방 정보 (확정된 일정일 경우) */}
               {event.isCoordinated && event.roomName && (
                  <div className="modal-section modal-coordinated-info">
                     <div className="modal-label">조율방</div>
                     <div className="modal-value">📅 {event.roomName}</div>
                  </div>
               )}
                           {/* 삭제 버튼 (지난 일정만) */}
               {onDelete && (() => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  return event.date < todayStr;
               })() && (
                  <div className="modal-delete-section">
                     <button
                        className="event-delete-btn"
                        onClick={() => {
                           if (isDeleting) return;
                           if (window.confirm('이 일정을 삭제하시겠습니까?')) {
                              setIsDeleting(true);
                              onDelete(event).finally(() => setIsDeleting(false));
                           }
                        }}
                        disabled={isDeleting}
                     >
                        <Trash2 size={16} />
                        {isDeleting ? '삭제 중...' : '이 일정 삭제'}
                     </button>
                  </div>
               )}
            </div>
         </div>
      </>
   );
};

export default EventDetailModal;
