/**
 * ===================================================================================================
 * MemberList.js - 조율 탭의 조원 목록 및 관련 기능 컴포넌트
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/coordination
 *
 * 🎯 주요 기능:
 *    - 현재 방에 참여한 조원 목록을 표시
 *    - 각 조원의 이름, 참여일, 이월 시간, 완료 시간 등 정보 제공
 *    - 방장에게만 보이는 조원 통계, 시간표 보기, 주소 확인 버튼 기능
 *    - '주소' 버튼 클릭 시, 해당 조원의 주소 및 방장으로부터의 경로 정보를 보여주는 모달 표시
 *    - 주소 모달 내에서 지도(Google/Kakao)를 통해 경로를 시각적으로 표시
 *
 * 🔗 연결된 파일:
 *    - ../../utils/coordinationUtils - 조원 이름 표시, 방장/본인 여부 확인 등 유틸리티
 *    - ../../utils/apiClient - 인증된 API 요청을 보내기 위한 클라이언트
 *    - CoordinationTab/index.js - 이 컴포넌트를 사용하는 상위 컴포넌트
 *
 * 💡 UI 위치:
 *    - 조율 탭 > 우측 사이드바 > 조원 목록
 *
 * ✏️ 수정 가이드:
 *    - 조원 아이템의 UI 변경: `MemberItem` 컴포넌트의 JSX 구조 수정
 *    - 주소 및 경로 확인 로직 변경: `fetchMemberAddress`, `calculateRoutes`, `calculateMapDirections` 함수 수정
 *    - Kakao/Google Maps API 관련 로직 변경: `calculateMapDirections` 함수 내의 API 호출부 수정
 *
 * 📝 참고사항:
 *    - `MemberItem`은 `MemberList`에 의해 렌더링되는 개별 조원 항목입니다.
 *    - 주소 모달은 Google Maps API와 Kakao Navi API를 함께 사용하여 대중교통, 자동차, 도보, 자전거 경로를 모두 제공합니다.
 *    - `authenticatedFetch`를 사용하여 모든 API 요청에 인증 토큰을 포함시킵니다.
 *
 * ===================================================================================================
 */

import React, { useState, useEffect } from 'react';
import { Users, MapPin, X } from 'lucide-react';
import { getMemberDisplayName, isCurrentUser, isMemberOwner } from '../../utils/coordinationUtils';
import { GoogleMap, Marker, DirectionsRenderer, Polyline } from '@react-google-maps/api';
import { authenticatedFetch } from '../../utils/apiClient';

/**
 * MemberItem
 *
 * @description `MemberList`에 표시되는 개별 조원 항목 컴포넌트입니다.
 *              조원의 기본 정보와 방장 전용 관리 버튼(통계, 시간표, 주소)을 포함합니다.
 * @param {Object} props - 컴포넌트 프롭스
 * @param {Object} props.member - 표시할 조원 데이터
 * @param {Object} props.currentRoom - 현재 방 정보
 * @param {Object} props.user - 현재 로그인된 사용자 정보
 * @param {boolean} props.isOwner - 현재 사용자가 방장인지 여부
 * @param {Function} props.onMemberClick - '통계' 버튼 클릭 시 호출될 콜백 함수
 * @param {Function} props.onMemberScheduleClick - '시간표' 버튼 클릭 시 호출될 콜백 함수
 * @param {number} props.index - 배열에서의 인덱스 (key로 사용)
 * @param {Function} props.showAlert - 알림 메시지를 표시하는 함수
 * @returns {JSX.Element} 개별 조원 항목 UI
 */
const MemberItem = ({
  member,
  currentRoom,
  user,
  isOwner,
  onMemberClick,
  onMemberScheduleClick,
  index,
  showAlert
}) => {
  const memberData = member.user || member;
  const memberName = getMemberDisplayName(memberData);
  const isCurrentUserMember = isCurrentUser(memberData, user);
  const memberIsOwner = isMemberOwner(memberData, currentRoom);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [memberAddress, setMemberAddress] = useState(null);
  const [ownerAddress, setOwnerAddress] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [expandedRoute, setExpandedRoute] = useState(null);
  const [directionsResponse, setDirectionsResponse] = useState(null);
  const [polylinePath, setPolylinePath] = useState(null);
  const [selectedMapMode, setSelectedMapMode] = useState('TRANSIT');
  const [selectedRouteFilter, setSelectedRouteFilter] = useState('대중교통');
  const [mapKey, setMapKey] = useState(0);

  const fetchMemberAddress = async () => {
    try {
      // 조원 주소 가져오기
      const memberResponse = await authenticatedFetch(`${process.env.REACT_APP_API_URL}/api/users/profile/${memberData._id || memberData.id}`);
      const memberData2 = await memberResponse.json();
      setMemberAddress(memberData2);

      // 방장 주소 가져오기
      const ownerId = currentRoom.owner._id || currentRoom.owner.id || currentRoom.owner;
      const ownerResponse = await authenticatedFetch(`${process.env.REACT_APP_API_URL}/api/users/profile/${ownerId}`);
      const ownerData = await ownerResponse.json();
      setOwnerAddress(ownerData);

      setShowAddressModal(true);

      // 경로 계산
      if (memberData2.addressLat && memberData2.addressLng && ownerData.addressLat && ownerData.addressLng) {
        calculateRoutes(ownerData, memberData2);
        calculateMapDirections(ownerData, memberData2);
      }
    } catch (error) {
      showAlert('주소를 가져오는데 실패했습니다.', 'error');
    }
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    if (hours > 0) {
      return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
    }
    return `${minutes}분`;
  };

  /**
   * 지도 경로 계산 (Google/Kakao API)
   * @description 선택된 이동 수단(mode)에 따라 Google 또는 Kakao API를 사용하여 지도에 표시할 경로를 계산합니다.
   * @param {Object} owner - 방장 정보 (주소 및 위경도 포함)
   * @param {Object} member - 조원 정보 (주소 및 위경도 포함)
   * @param {string} [mode='TRANSIT'] - 이동 수단 (TRANSIT, DRIVING, WALKING, BICYCLING)
   */
  const calculateMapDirections = async (owner, member, mode = 'TRANSIT') => {
    const KAKAO_API_KEY = process.env.REACT_APP_KAKAO_REST_API_KEY;

    const ownerLat = parseFloat(owner.addressLat);
    const ownerLng = parseFloat(owner.addressLng);
    const memberLat = parseFloat(member.addressLat);
    const memberLng = parseFloat(member.addressLng);

    if (isNaN(ownerLat) || isNaN(ownerLng) || isNaN(memberLat) || isNaN(memberLng)) {
      setPolylinePath(null);
      setDirectionsResponse(null);
      return;
    }

    const origin = { lat: ownerLat, lng: ownerLng };
    const destination = { lat: memberLat, lng: memberLng };

    setDirectionsResponse(null);
    setPolylinePath(null);

    try {
      if (mode === 'TRANSIT') {
        // Use Google Maps for Transit
        const directionsService = new window.google.maps.DirectionsService();
        directionsService.route(
          {
            origin: origin,
            destination: destination,
            travelMode: window.google.maps.TravelMode.TRANSIT,
          },
          (result, status) => {
            if (status === window.google.maps.DirectionsStatus.OK) {
              setDirectionsResponse(result);
            } else {
              setPolylinePath([origin, destination]); // Fallback to straight line
            }
          }
        );
      } else {
        // Use Kakao Navi API for Driving, Walking, Bicycling
        let url;
        const params = new URLSearchParams({
          origin: `${origin.lng},${origin.lat}`,
          destination: `${destination.lng},${destination.lat}`
        }).toString();

        if (mode === 'DRIVING') {
          url = `https://apis-navi.kakaomobility.com/v1/directions?${params}`;
        } else if (mode === 'WALKING') {
          url = `https://apis-navi.kakaomobility.com/v1/directions/walk?${params}`;
        } else if (mode === 'BICYCLING') {
          url = `https://apis-navi.kakaomobility.com/v1/directions/bicycle?${params}`;
        }

        if (!url) return;

        const response = await fetch(url, { headers: { 'Authorization': `KakaoAK ${KAKAO_API_KEY}` } });
        const data = await response.json();

        if (!response.ok) {
          if (data.code === -404) showAlert(`${mode === 'WALKING' ? '도보' : '자전거'} 경로를 찾을 수 없습니다.`, 'error');
          else setPolylinePath([origin, destination]);
          return;
        }

        if (data.routes && data.routes.length > 0) {
          const path = data.routes[0].sections.flatMap(section => 
            section.roads.flatMap(road => {
              const pathSegment = [];
              for (let i = 0; i < road.vertexes.length; i += 2) {
                pathSegment.push({ lng: road.vertexes[i], lat: road.vertexes[i + 1] });
              }
              return pathSegment;
            })
          );
          setPolylinePath(path.length > 0 ? path : [origin, destination]);
        } else {
          setPolylinePath([origin, destination]);
        }
      }
    } catch (error) {
      setPolylinePath([origin, destination]);
    }
  };
  
  const handleMapModeChange = (mode) => {
    setMapKey(prevKey => prevKey + 1);
    setSelectedMapMode(mode);
    if (ownerAddress && memberAddress) {
      calculateMapDirections(ownerAddress, memberAddress, mode);
    }
    const modeMap = { 'TRANSIT': '대중교통', 'DRIVING': '자동차', 'WALKING': '도보', 'BICYCLING': '자전거' };
    setSelectedRouteFilter(modeMap[mode] || 'ALL');
  };

  /**
   * 경로 정보 계산 (Google/Kakao API)
   * @description 다양한 이동 수단에 대한 경로 정보(소요 시간, 거리 등)를 요약하여 계산합니다.
   * @param {Object} owner - 방장 정보
   * @param {Object} member - 조원 정보
   */
  const calculateRoutes = async (owner, member) => {
    setLoadingRoute(true);
    try {
      const ownerLat = parseFloat(owner.addressLat);
      const ownerLng = parseFloat(owner.addressLng);
      const memberLat = parseFloat(member.addressLat);
      const memberLng = parseFloat(member.addressLng);

      if (isNaN(ownerLat) || isNaN(ownerLng) || isNaN(memberLat) || isNaN(memberLng)) return;

      const origin = { lat: ownerLat, lng: ownerLng };
      const destination = { lat: memberLat, lng: memberLng };
      const results = [];

      const directionsService = new window.google.maps.DirectionsService();
      try {
        const transitResult = await new Promise((resolve, reject) => {
          directionsService.route({ origin, destination, travelMode: 'TRANSIT' }, (res, status) => status === 'OK' ? resolve(res) : reject(status));
        });
        const route = transitResult.routes[0].legs[0];
        results.push({ mode: '대중교통', icon: '🚇', duration: route.duration.text, distance: route.distance.text, steps: route.steps });
      } catch (err) {}

      const kakaoModes = [{ key: 'car', label: '자동차', icon: '🚗' }, { key: 'walk', label: '도보', icon: '🚶' }, { key: 'bike', label: '자전거', icon: '🚴' }];
      for (const mode of kakaoModes) {
        try {
          const distance = calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng);
          let duration = 0;
          if (mode.key === 'car') duration = (distance / 40) * 60;
          else if (mode.key === 'walk') duration = (distance / 4) * 60;
          else if (mode.key === 'bike') duration = (distance / 15) * 60;
          results.push({ mode: mode.label, icon: mode.icon, duration: formatDuration(duration * 60), distance: `${distance.toFixed(1)}km`, steps: null });
        } catch (err) {}
      }
      setRouteInfo(results);
    } finally {
      setLoadingRoute(false);
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  return (
    <div key={memberData._id || index} className={`flex items-center p-3 rounded-lg border ${memberIsOwner ? 'bg-red-50 border-red-200' : isCurrentUserMember ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
      <div className="w-5 h-5 rounded-full mr-3 flex-shrink-0" style={{ backgroundColor: member.color || '#6B7280' }}></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center">
          <span className={`text-sm font-medium truncate ${memberIsOwner ? 'text-red-900 font-bold' : isCurrentUserMember ? 'text-blue-900' : 'text-gray-900'}`}>
            {memberIsOwner && '👑 '} {memberName} {isCurrentUserMember && ' (나)'}
          </span>
          {memberIsOwner && <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full font-semibold">방장</span>}
          {!memberIsOwner && member.carryOver > 0 && <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full font-semibold">이월: {member.carryOver}시간</span>}
          {!memberIsOwner && member.totalProgressTime > 0 && <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full font-semibold">완료: {member.totalProgressTime}시간</span>}
        </div>
        <div className={`text-xs mt-1 ${memberIsOwner ? 'text-red-600' : 'text-gray-500'}`}>
          {new Date(member.joinedAt || new Date()).toLocaleDateString('ko-KR')} 참여
        </div>
      </div>
      {isOwner && (
        <div className="flex flex-col gap-1 ml-2">
          <button onClick={() => onMemberClick(memberData._id || memberData.id)} className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">통계</button>
          <button onClick={() => onMemberScheduleClick(memberData._id || memberData.id)} className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">시간표</button>
          <button onClick={fetchMemberAddress} className="px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center justify-center gap-1"><MapPin size={12} />주소</button>
        </div>
      )}
      {showAddressModal && memberAddress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddressModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 flex-shrink-0">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800 flex items-center"><MapPin size={24} className="mr-2 text-purple-600" />{memberName}의 주소</h3>
                <button onClick={() => setShowAddressModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-6 pb-6">
              <div className="mb-4 bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700 mb-1">주소</p>
                <p className="text-base text-gray-900">{memberAddress.address || '주소 정보 없음'}</p>
                {memberAddress.addressDetail && <><p className="text-sm font-semibold text-gray-700 mb-1 mt-3">상세 주소</p><p className="text-base text-gray-900">{memberAddress.addressDetail}</p></>}
              </div>
              {memberAddress.addressLat && memberAddress.addressLng && (
                <div>
                  {ownerAddress && (
                    <div className="flex gap-2 mb-2">
                      {['TRANSIT', 'DRIVING', 'WALKING', 'BICYCLING'].map(mode => (
                        <button key={mode} onClick={() => handleMapModeChange(mode)} className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedMapMode === mode ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                          { {TRANSIT: '🚇', DRIVING: '🚗', WALKING: '🚶', BICYCLING: '🚴'}[mode] } { {TRANSIT: '대중교통', DRIVING: '자동차', WALKING: '도보', BICYCLING: '자전거'}[mode] }
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="rounded-lg overflow-hidden border border-gray-200">
                    <GoogleMap
                      key={mapKey}
                      mapContainerStyle={{ width: '100%', height: '400px' }}
                      center={{ lat: parseFloat(memberAddress.addressLat), lng: parseFloat(memberAddress.addressLng) }}
                      zoom={13}
                    >
                      {directionsResponse ? <DirectionsRenderer directions={directionsResponse} options={{ suppressMarkers: false, polylineOptions: { strokeColor: '#4F46E5', strokeWeight: 5 } }} />
                      : <>
                          {ownerAddress && <Marker position={{ lat: parseFloat(ownerAddress.addressLat), lng: parseFloat(ownerAddress.addressLng) }} label="방장" />}
                          <Marker position={{ lat: parseFloat(memberAddress.addressLat), lng: parseFloat(memberAddress.addressLng) }} label="조원" />
                          {polylinePath && <Polyline path={polylinePath} options={{ strokeColor: '#4F46E5', strokeWeight: 2, strokeOpacity: 0.8 }} />}
                        </>
                      }
                    </GoogleMap>
                  </div>
                </div>
              )}
              {!memberAddress.addressLat && !memberAddress.addressLng && <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center"><p className="text-sm text-yellow-800">지도 정보가 없습니다.</p></div>}
              {ownerAddress && (
                <div className="mt-4">
                  <h4 className="text-lg font-bold text-gray-800 mb-3">방장으로부터의 경로</h4>
                  {loadingRoute ? <div className="bg-gray-50 p-4 text-center"><p className="text-sm">경로 계산 중...</p></div>
                  : routeInfo && routeInfo.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                      {routeInfo.filter(route => selectedRouteFilter === 'ALL' || route.mode === selectedRouteFilter).map((route, idx) => (
                        <div key={idx} className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg overflow-hidden">
                          <div className={`p-3 ${route.steps ? 'cursor-pointer hover:bg-purple-100' : ''}`} onClick={() => route.steps && setExpandedRoute(expandedRoute === idx ? null : idx)}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <span className="text-2xl mr-3">{route.icon}</span>
                                <div>
                                  <p className="text-sm font-bold">{route.mode}</p>
                                  <p className="text-xs text-gray-600">거리: {route.distance}</p>
                                </div>
                              </div>
                              <div className="text-right flex items-center">
                                <p className="text-lg font-bold text-purple-600">{route.duration}</p>
                                {route.steps && <span className="ml-2 text-gray-500">{expandedRoute === idx ? '▲' : '▼'}</span>}
                              </div>
                            </div>
                          </div>
                          {route.steps && expandedRoute === idx && (
                            <div className="bg-white border-t p-3">
                              <h5 className="text-sm font-bold mb-2">상세 경로</h5>
                              <div className="space-y-2">
                                {route.steps.map((step, stepIdx) => (
                                  <div key={stepIdx} className="bg-gray-50 p-2 rounded text-xs">
                                    {step.transit ? <>
                                      <div className="flex items-center mb-1"><span className="text-lg mr-2">{step.transit.line?.vehicle?.type.includes('SUBWAY') ? '🚇' : '🚌'}</span><span className="font-bold">{step.transit.line?.name}</span></div>
                                      <div className="ml-7 text-gray-600"><p>🔵 {step.transit.departure_stop?.name}</p>{step.transit.num_stops > 0 && <p className="text-xs ml-3">({step.transit.num_stops}개 정류장)</p>}<p>🔴 {step.transit.arrival_stop?.name}</p></div>
                                    </> : step.travel_mode === 'WALKING' ? <div className="flex items-center"><span className="text-lg mr-2">🚶</span><span>도보 이동 {step.distance?.value && `${Math.round(step.distance.value)}m`}</span></div> : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : <div className="bg-gray-50 p-4 text-center"><p className="text-sm">경로 정보를 불러올 수 없습니다.</p></div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * MemberList
 *
 * @description 현재 방의 조원 목록을 표시하는 컨테이너 컴포넌트입니다.
 * @param {Object} props - 컴포넌트 프롭스
 * @param {Object} props.currentRoom - 현재 방 정보 (멤버 목록 포함)
 * @param {Object} props.user - 현재 로그인된 사용자 정보
 * @param {boolean} props.isOwner - 현재 사용자가 방장인지 여부
 * @param {Function} props.onMemberClick - 조원의 '통계' 버튼 클릭 시 호출될 콜백 함수
 * @param {Function} props.onMemberScheduleClick - 조원의 '시간표' 버튼 클릭 시 호출될 콜백 함수
 * @param {Function} props.showAlert - 알림 메시지를 표시하는 함수
 * @returns {JSX.Element} 조원 목록 UI
 */
const MemberList = ({
  currentRoom,
  user,
  isOwner,
  onMemberClick,
  onMemberScheduleClick,
  showAlert
}) => {
  return (
    <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 w-full flex-1 flex flex-col min-h-0">
      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center flex-shrink-0">
        <Users size={20} className="mr-2 text-blue-600" />
        조원 목록 ({(currentRoom.members || []).length}명)
      </h3>

      <div className="space-y-3 flex-1 overflow-y-auto pr-2 min-h-0">
        {(currentRoom.members || []).map((member, index) => (
          <MemberItem
            key={member.user?._id || member._id || index}
            member={member}
            currentRoom={currentRoom}
            user={user}
            isOwner={isOwner}
            onMemberClick={onMemberClick}
            onMemberScheduleClick={onMemberScheduleClick}
            index={index}
            showAlert={showAlert}
          />
        ))}
      </div>
    </div>
  );
};

export default MemberList;
