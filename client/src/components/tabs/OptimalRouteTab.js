import React, { useState, useEffect } from 'react';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { Users, MapPin, Plus, Trash2, Navigation, Clock, Train, Car, Footprints } from 'lucide-react';
import { userService } from '../../services/userService';

const OptimalRouteTab = () => {
  const [participants, setParticipants] = useState([]);
  const [newParticipant, setNewParticipant] = useState({ name: '', address: '', email: '' });
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 37.5665, lng: 126.9780 }); // 서울 시청
  const [directionsResults, setDirectionsResults] = useState([]);
  const [selectedTransportMode, setSelectedTransportMode] = useState('TRANSIT'); // DRIVING, TRANSIT, WALKING

  // 현재 사용자 정보 가져오기
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const userInfo = await userService.getUserProfile();
        if (userInfo.address && userInfo.addressLat && userInfo.addressLng) {
          setParticipants([{
            id: 'me',
            name: userInfo.name || '나',
            address: userInfo.address,
            addressDetail: userInfo.addressDetail || '',
            lat: userInfo.addressLat,
            lng: userInfo.addressLng,
            isMe: true
          }]);
        }
      } catch (error) {
        console.error('사용자 정보 가져오기 실패:', error);
      }
    };
    fetchCurrentUser();
  }, []);

  // 참가자 추가
  const handleAddParticipant = () => {
    if (!newParticipant.name || !newParticipant.address) {
      alert('이름과 주소를 입력해주세요.');
      return;
    }

    // Google Geocoding API를 사용하여 주소를 좌표로 변환
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: newParticipant.address }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const location = results[0].geometry.location;
        const participant = {
          id: Date.now().toString(),
          name: newParticipant.name,
          address: newParticipant.address,
          email: newParticipant.email,
          lat: location.lat(),
          lng: location.lng(),
          isMe: false
        };
        setParticipants([...participants, participant]);
        setNewParticipant({ name: '', address: '', email: '' });
      } else {
        alert('주소를 찾을 수 없습니다. 다시 입력해주세요.');
      }
    });
  };

  // 참가자 삭제
  const handleRemoveParticipant = (id) => {
    if (id === 'me') {
      alert('본인은 삭제할 수 없습니다.');
      return;
    }
    setParticipants(participants.filter(p => p.id !== id));
  };

  // 최적 경로 계산
  const calculateOptimalRoutes = async () => {
    if (participants.length < 2) {
      alert('최소 2명 이상의 참가자가 필요합니다.');
      return;
    }

    setLoading(true);
    setRoutes([]);
    setDirectionsResults([]);

    try {
      // 중간 지점 계산 (모든 참가자의 평균 좌표)
      const avgLat = participants.reduce((sum, p) => sum + p.lat, 0) / participants.length;
      const avgLng = participants.reduce((sum, p) => sum + p.lng, 0) / participants.length;

      setMapCenter({ lat: avgLat, lng: avgLng });

      // Google Places API를 사용하여 중간 지점 근처의 만남 장소 찾기
      const service = new window.google.maps.places.PlacesService(document.createElement('div'));
      const request = {
        location: new window.google.maps.LatLng(avgLat, avgLng),
        radius: 2000, // 2km 반경
        type: ['cafe', 'restaurant']
      };

      service.nearbySearch(request, async (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results.length > 0) {
          // 상위 5개 장소에 대해 각 참가자의 경로 계산
          const meetingPlaces = results.slice(0, 5);
          const routePromises = [];

          for (const place of meetingPlaces) {
            const placeRoutes = [];
            const directionsService = new window.google.maps.DirectionsService();

            for (const participant of participants) {
              try {
                const result = await new Promise((resolve, reject) => {
                  directionsService.route(
                    {
                      origin: new window.google.maps.LatLng(participant.lat, participant.lng),
                      destination: place.geometry.location,
                      travelMode: window.google.maps.TravelMode[selectedTransportMode]
                    },
                    (result, status) => {
                      if (status === 'OK') {
                        resolve(result);
                      } else {
                        reject(status);
                      }
                    }
                  );
                });

                const route = result.routes[0].legs[0];
                placeRoutes.push({
                  participantName: participant.name,
                  participantAddress: participant.address,
                  duration: route.duration.text,
                  durationValue: route.duration.value,
                  distance: route.distance.text,
                  distanceValue: route.distance.value,
                  steps: route.steps
                });
              } catch (error) {
                console.error('경로 계산 실패:', error);
              }
            }

            // 총 이동 시간 계산
            const totalDuration = placeRoutes.reduce((sum, r) => sum + r.durationValue, 0);
            const maxDuration = Math.max(...placeRoutes.map(r => r.durationValue));

            routePromises.push({
              placeName: place.name,
              placeAddress: place.vicinity,
              placeLocation: {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng()
              },
              routes: placeRoutes,
              totalDuration: totalDuration,
              maxDuration: maxDuration,
              avgDuration: totalDuration / placeRoutes.length,
              rating: place.rating || 0
            });
          }

          // 평균 이동 시간이 짧은 순으로 정렬
          routePromises.sort((a, b) => a.avgDuration - b.avgDuration);
          setRoutes(routePromises);
        } else {
          alert('근처에 만남 장소를 찾을 수 없습니다.');
        }
        setLoading(false);
      });
    } catch (error) {
      console.error('경로 계산 중 오류:', error);
      alert('경로 계산에 실패했습니다.');
      setLoading(false);
    }
  };

  // 교통수단 아이콘
  const getTransportIcon = (mode) => {
    switch (mode) {
      case 'DRIVING': return <Car size={16} />;
      case 'TRANSIT': return <Train size={16} />;
      case 'WALKING': return <Footprints size={16} />;
      default: return <Navigation size={16} />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">최적 만남 장소 찾기</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 왼쪽: 참가자 관리 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            <Users size={20} className="mr-2" />
            참가자 ({participants.length}명)
          </h3>

          {/* 참가자 목록 */}
          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
            {participants.map((participant) => (
              <div key={participant.id} className={`flex items-center justify-between p-3 rounded-lg ${participant.isMe ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
                <div className="flex-1">
                  <div className="font-medium text-gray-800">
                    {participant.name} {participant.isMe && <span className="text-xs text-blue-600">(나)</span>}
                  </div>
                  <div className="text-sm text-gray-600">
                    <MapPin size={12} className="inline mr-1" />
                    {participant.address}
                    {participant.addressDetail && <span className="text-gray-500"> ({participant.addressDetail})</span>}
                  </div>
                  {participant.email && (
                    <div className="text-xs text-gray-500">{participant.email}</div>
                  )}
                </div>
                {!participant.isMe && (
                  <button
                    onClick={() => handleRemoveParticipant(participant.id)}
                    className="ml-2 text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* 참가자 추가 폼 */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3 text-gray-700">참가자 추가</h4>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="이름"
                value={newParticipant.name}
                onChange={(e) => setNewParticipant({ ...newParticipant, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="주소 (예: 서울시청, 강남역)"
                value={newParticipant.address}
                onChange={(e) => setNewParticipant({ ...newParticipant, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="email"
                placeholder="이메일 (선택)"
                value={newParticipant.email}
                onChange={(e) => setNewParticipant({ ...newParticipant, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleAddParticipant}
                className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center justify-center"
              >
                <Plus size={16} className="mr-2" />
                추가
              </button>
            </div>
          </div>

          {/* 교통수단 선택 */}
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-3 text-gray-700">교통수단</h4>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedTransportMode('TRANSIT')}
                className={`flex-1 py-2 px-3 rounded-lg border ${selectedTransportMode === 'TRANSIT' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300'}`}
              >
                <Train size={16} className="inline mr-1" />
                대중교통
              </button>
              <button
                onClick={() => setSelectedTransportMode('DRIVING')}
                className={`flex-1 py-2 px-3 rounded-lg border ${selectedTransportMode === 'DRIVING' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300'}`}
              >
                <Car size={16} className="inline mr-1" />
                자동차
              </button>
              <button
                onClick={() => setSelectedTransportMode('WALKING')}
                className={`flex-1 py-2 px-3 rounded-lg border ${selectedTransportMode === 'WALKING' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300'}`}
              >
                <Footprints size={16} className="inline mr-1" />
                도보
              </button>
            </div>
          </div>

          {/* 경로 계산 버튼 */}
          <button
            onClick={calculateOptimalRoutes}
            disabled={loading || participants.length < 2}
            className="w-full mt-4 bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium flex items-center justify-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                계산 중...
              </>
            ) : (
              <>
                <Navigation size={18} className="mr-2" />
                최적 경로 찾기
              </>
            )}
          </button>
        </div>

        {/* 오른쪽: 지도 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4">지도</h3>
          <div style={{ height: '500px', width: '100%' }} className="rounded-lg overflow-hidden">
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={mapCenter}
              zoom={12}
            >
              {/* 참가자 위치 마커 */}
              {participants.map((participant) => (
                <Marker
                  key={participant.id}
                  position={{ lat: participant.lat, lng: participant.lng }}
                  label={{
                    text: participant.name.charAt(0),
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                  icon={{
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 10,
                    fillColor: participant.isMe ? '#3B82F6' : '#EF4444',
                    fillOpacity: 1,
                    strokeColor: 'white',
                    strokeWeight: 2
                  }}
                />
              ))}

              {/* 추천 장소 마커 */}
              {routes.map((route, index) => (
                <Marker
                  key={`place-${index}`}
                  position={route.placeLocation}
                  label={{
                    text: (index + 1).toString(),
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                  icon={{
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 12,
                    fillColor: '#10B981',
                    fillOpacity: 1,
                    strokeColor: 'white',
                    strokeWeight: 2
                  }}
                />
              ))}
            </GoogleMap>
          </div>
        </div>
      </div>

      {/* 경로 결과 */}
      {routes.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4">추천 만남 장소</h3>
          <div className="space-y-4">
            {routes.map((route, index) => (
              <div key={index} className={`border rounded-lg p-4 ${index === 0 ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${index === 0 ? 'bg-green-500' : 'bg-gray-400'} text-white text-sm font-bold`}>
                        {index + 1}
                      </span>
                      <h4 className="text-lg font-bold text-gray-800">{route.placeName}</h4>
                      {index === 0 && <span className="text-xs bg-green-500 text-white px-2 py-1 rounded">추천</span>}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      <MapPin size={14} className="inline mr-1" />
                      {route.placeAddress}
                    </p>
                    {route.rating > 0 && (
                      <p className="text-sm text-yellow-600 mt-1">
                        ⭐ {route.rating.toFixed(1)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">평균 소요시간</div>
                    <div className="text-2xl font-bold text-blue-600">
                      <Clock size={20} className="inline mr-1" />
                      {Math.round(route.avgDuration / 60)}분
                    </div>
                  </div>
                </div>

                {/* 각 참가자별 경로 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                  {route.routes.map((r, rIndex) => (
                    <div key={rIndex} className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="font-medium text-gray-800 mb-1">{r.participantName}</div>
                      <div className="text-xs text-gray-600 mb-2 truncate">{r.participantAddress}</div>
                      <div className="flex items-center gap-2 text-sm">
                        {getTransportIcon(selectedTransportMode)}
                        <span className="text-gray-700">{r.duration}</span>
                        <span className="text-gray-500">({r.distance})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OptimalRouteTab;
