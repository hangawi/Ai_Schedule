/**
 * ScheduleDetailModal.js - 일정 상세 모달 (지도 + 대중교통)
 *
 * 기능:
 * - 일정 상세 정보 표시
 * - Google Maps로 위치 표시
 * - 사용자 집 → 약속 장소 대중교통 경로 표시
 */

import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Users, Navigation } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const ScheduleDetailModal = ({ isOpen, onClose, suggestion, userAddress }) => {
  const [directions, setDirections] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Google Maps 스크립트 로드
  useEffect(() => {
    if (!window.google && GOOGLE_MAPS_API_KEY) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&language=ko&region=KR`;
      script.async = true;
      script.onload = () => setMapLoaded(true);
      document.head.appendChild(script);
    } else if (window.google) {
      setMapLoaded(true);
    }
  }, []);

  // 지도 초기화
  useEffect(() => {
    if (!isOpen || !mapLoaded || !suggestion?.location) return;

    const initMap = async () => {
      const showMap = (location, title) => {
        const map = new window.google.maps.Map(document.getElementById('detail-map'), {
          center: location,
          zoom: 15,
          language: 'ko',
          region: 'KR'
        });

        new window.google.maps.Marker({
          position: location,
          map: map,
          title: title,
          animation: window.google.maps.Animation.DROP
        });

        if (userAddress) {
          fetchDirections(userAddress, title, map);
        }
      };

      const geocoder = new window.google.maps.Geocoder();

      // 장소 주소를 좌표로 변환
      geocoder.geocode({ address: suggestion.location, region: 'KR' }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const location = results[0].geometry.location;
          showMap(location, suggestion.location);
        } else {
          // Geocoding 실패 시 Places API로 폴백 (장소명 검색)
          const service = new window.google.maps.places.PlacesService(document.createElement('div'));
          service.findPlaceFromQuery({
            query: suggestion.location,
            fields: ['geometry', 'name'],
            locationBias: { lat: 37.5665, lng: 126.978 } // 서울 중심
          }, (placeResults, placeStatus) => {
            if (placeStatus === 'OK' && placeResults[0]) {
              const location = placeResults[0].geometry.location;
              showMap(location, suggestion.location);
            } else {
              console.error('Geocoding and Places search both failed:', status, placeStatus);
            }
          });
        }
      });
    };

    initMap();
  }, [isOpen, mapLoaded, suggestion, userAddress]);

  // 대중교통 경로 조회
  const fetchDirections = (origin, destination, map) => {
    setLoading(true);

    const directionsService = new window.google.maps.DirectionsService();
    const directionsRenderer = new window.google.maps.DirectionsRenderer({
      map: map,
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: '#4285F4',
        strokeWeight: 5
      }
    });

    const request = {
      origin: origin,
      destination: destination,
      travelMode: window.google.maps.TravelMode.TRANSIT, // 대중교통
      transitOptions: {
        modes: ['BUS', 'SUBWAY', 'TRAIN'],
        routingPreference: 'FEWER_TRANSFERS' // 환승 최소화
      },
      region: 'KR',
      language: 'ko'
    };

    directionsService.route(request, (result, status) => {
      setLoading(false);

      if (status === 'OK') {
        directionsRenderer.setDirections(result);
        setDirections(result);
      } else {
        console.error('Directions request failed:', status);
        // 대중교통 경로를 찾을 수 없으면 자동차 경로 시도
        if (status === 'ZERO_RESULTS') {
          request.travelMode = window.google.maps.TravelMode.DRIVING;
          directionsService.route(request, (result2, status2) => {
            if (status2 === 'OK') {
              directionsRenderer.setDirections(result2);
              setDirections(result2);
            }
          });
        }
      }
    });
  };

  // 경로 정보 포맷팅
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
  };

  const formatDistance = (meters) => {
    const km = (meters / 1000).toFixed(1);
    return `${km}km`;
  };

  if (!isOpen) return null;

  const route = directions?.routes?.[0];
  const leg = route?.legs?.[0];

  // 🆕 배경 클릭 시 모달 닫기
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">일정 상세</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* 일정 기본 정보 */}
          <div className="space-y-2 sm:space-y-3">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900">{suggestion?.summary}</h3>

            <div className="space-y-2 text-sm sm:text-base text-gray-700">
              <div className="flex items-center gap-2 sm:gap-3">
                <Calendar size={16} className="text-blue-500 sm:w-[18px] sm:h-[18px]" />
                <span className="font-medium">{suggestion?.date}</span>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <Clock size={16} className="text-green-500 sm:w-[18px] sm:h-[18px]" />
                <span className="font-medium">{suggestion?.startTime} ~ {suggestion?.endTime}</span>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <MapPin size={16} className="text-red-500 sm:w-[18px] sm:h-[18px]" />
                <span className="font-medium">{suggestion?.location || '미정'}</span>
              </div>

              {suggestion?.memberResponses && (
                <div className="flex items-center gap-2 sm:gap-3">
                  <Users size={16} className="text-purple-500 sm:w-[18px] sm:h-[18px]" />
                  <span className="font-medium">
                    참석자 {suggestion.memberResponses.filter(r => r.status === 'accepted').length}명
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 지도 */}
          {suggestion?.location && suggestion.location !== '미정' && (
            <div className="space-y-2 sm:space-y-3">
              <h4 className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
                <MapPin size={16} className="sm:w-[18px] sm:h-[18px]" />
                위치
              </h4>
              <div
                id="detail-map"
                className="w-full h-48 sm:h-64 rounded-lg border border-gray-300"
                style={{ minHeight: '192px' }}
              />
            </div>
          )}

          {/* 대중교통 경로 */}
          {loading && (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-sm text-gray-600">경로 검색 중...</p>
            </div>
          )}

          {!loading && directions && leg && (
            <div className="space-y-2 sm:space-y-3">
              <h4 className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
                <Navigation size={16} className="sm:w-[18px] sm:h-[18px]" />
                대중교통 경로
              </h4>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">소요 시간</p>
                    <p className="text-lg font-bold text-blue-700">
                      {formatDuration(leg.duration.value)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">거리</p>
                    <p className="text-lg font-bold text-blue-700">
                      {formatDistance(leg.distance.value)}
                    </p>
                  </div>
                </div>

                {/* 경로 단계별 안내 */}
                <div className="space-y-2">
                  {leg.steps.map((step, index) => (
                    <div key={index} className="flex items-start gap-3 text-sm">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div
                          dangerouslySetInnerHTML={{ __html: step.instructions }}
                          className="text-gray-700"
                        />
                        {step.transit && (
                          <div className="mt-1 flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded font-medium">
                              {step.transit.line.vehicle.name}
                            </span>
                            <span className="text-xs text-gray-600">
                              {step.transit.line.short_name || step.transit.line.name}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({step.transit.num_stops}정거장)
                            </span>
                          </div>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDuration(step.duration.value)} · {formatDistance(step.distance.value)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-xs text-gray-500 text-center">
                * 실제 교통 상황에 따라 소요 시간이 달라질 수 있습니다.
              </div>
            </div>
          )}

          {!loading && !directions && userAddress && suggestion?.location && suggestion.location !== '미정' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                경로를 찾을 수 없습니다. 주소를 확인해주세요.
              </p>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 sm:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium text-sm sm:text-base"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleDetailModal;
