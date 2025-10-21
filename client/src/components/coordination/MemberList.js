import React, { useState } from 'react';
import { Users, MapPin, X } from 'lucide-react';
import { getMemberDisplayName, isCurrentUser, isMemberOwner } from '../../utils/coordinationUtils';
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';

const MemberItem = ({
  member,
  currentRoom,
  user,
  isOwner,
  onMemberClick,
  onMemberScheduleClick,
  index
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

  const fetchMemberAddress = async () => {
    try {
      // 조원 주소 가져오기
      const memberResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/users/profile/${memberData._id || memberData.id}`, {
        headers: {
          'x-auth-token': localStorage.getItem('token')
        }
      });
      const memberData2 = await memberResponse.json();
      setMemberAddress(memberData2);

      // 방장 주소 가져오기
      const ownerId = currentRoom.owner._id || currentRoom.owner.id || currentRoom.owner;
      const ownerResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/users/profile/${ownerId}`, {
        headers: {
          'x-auth-token': localStorage.getItem('token')
        }
      });
      const ownerData = await ownerResponse.json();
      setOwnerAddress(ownerData);

      setShowAddressModal(true);

      // 경로 계산
      if (memberData2.addressLat && memberData2.addressLng && ownerData.addressLat && ownerData.addressLng) {
        calculateRoutes(ownerData, memberData2);
        // 지도에 표시할 경로 계산
        calculateMapDirections(ownerData, memberData2);
      }
    } catch (error) {
      console.error('주소 가져오기 오류:', error);
      alert('주소를 가져오는데 실패했습니다.');
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

  const calculateMapDirections = async (owner, member) => {
    try {
      const directionsService = new window.google.maps.DirectionsService();
      const origin = { lat: parseFloat(owner.addressLat), lng: parseFloat(owner.addressLng) };
      const destination = { lat: parseFloat(member.addressLat), lng: parseFloat(member.addressLng) };

      directionsService.route(
        {
          origin: origin,
          destination: destination,
          travelMode: window.google.maps.TravelMode.TRANSIT
        },
        (result, status) => {
          if (status === window.google.maps.DirectionsStatus.OK) {
            setDirectionsResponse(result);
          } else {
            console.error('경로 표시 실패:', status);
          }
        }
      );
    } catch (error) {
      console.error('지도 경로 계산 오류:', error);
    }
  };

  const calculateRoutes = async (owner, member) => {
    setLoadingRoute(true);
    try {
      const origin = { lat: parseFloat(owner.addressLat), lng: parseFloat(owner.addressLng) };
      const destination = { lat: parseFloat(member.addressLat), lng: parseFloat(member.addressLng) };

      const modes = [
        { key: 'TRANSIT', label: '대중교통', icon: '🚇' },
        { key: 'DRIVE', label: '자동차', icon: '🚗' },
        { key: 'WALK', label: '도보', icon: '🚶' }
      ];

      const results = [];

      for (const mode of modes) {
        try {
          const fieldMask = mode.key === 'TRANSIT'
            ? 'routes.duration,routes.distanceMeters,routes.legs.steps'
            : 'routes.duration,routes.distanceMeters';

          const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
              'X-Goog-FieldMask': fieldMask
            },
            body: JSON.stringify({
              origin: {
                location: {
                  latLng: {
                    latitude: origin.lat,
                    longitude: origin.lng
                  }
                }
              },
              destination: {
                location: {
                  latLng: {
                    latitude: destination.lat,
                    longitude: destination.lng
                  }
                }
              },
              travelMode: mode.key,
              languageCode: 'ko'
            })
          });

          if (response.ok) {
            const data = await response.json();
            if (data.routes && data.routes.length > 0) {
              const route = data.routes[0];
              const durationSeconds = parseInt(route.duration.replace('s', ''));
              const distanceKm = (route.distanceMeters / 1000).toFixed(1);

              const routeData = {
                mode: mode.label,
                icon: mode.icon,
                duration: formatDuration(durationSeconds),
                distance: `${distanceKm}km`,
                steps: mode.key === 'TRANSIT' && route.legs && route.legs[0] ? route.legs[0].steps : null
              };

              results.push(routeData);
            }
          } else {
            console.log(`${mode.label} 경로 없음:`, await response.text());
          }
        } catch (err) {
          console.log(`${mode.label} 경로 오류:`, err);
        }
      }

      setRouteInfo(results);
    } catch (error) {
      console.error('경로 계산 오류:', error);
    } finally {
      setLoadingRoute(false);
    }
  };

  return (
    <div
      key={memberData._id || index}
      className={`flex items-center p-3 rounded-lg border ${
        memberIsOwner
          ? 'bg-red-50 border-red-200 ring-2 ring-red-100'
          : isCurrentUserMember
            ? 'bg-blue-50 border-blue-200'
            : 'bg-gray-50 border-gray-200'
      }`}
    >
      <div
        className={`w-5 h-5 rounded-full mr-3 flex-shrink-0 ${
          memberIsOwner ? 'ring-2 ring-red-300' : ''
        }`}
        style={{ backgroundColor: member.color || '#6B7280' }}
      ></div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center">
          <span className={`text-sm font-medium truncate ${
            memberIsOwner
              ? 'text-red-900 font-bold'
              : isCurrentUserMember
                ? 'text-blue-900'
                : 'text-gray-900'
          }`}>
            {memberIsOwner && '👑 '}
            {memberName}
            {isCurrentUserMember && ' (나)'}
          </span>

          {memberIsOwner && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full flex-shrink-0 font-semibold">
              방장
            </span>
          )}

          {!memberIsOwner && member.carryOver > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full flex-shrink-0 font-semibold">
              이월: {member.carryOver}시간
            </span>
          )}

          {!memberIsOwner && member.totalProgressTime > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full flex-shrink-0 font-semibold">
              완료: {member.totalProgressTime}시간
            </span>
          )}
        </div>

        <div className={`text-xs mt-1 ${
          memberIsOwner ? 'text-red-600' : 'text-gray-500'
        }`}>
          {new Date(member.joinedAt || new Date()).toLocaleDateString('ko-KR')} 참여
        </div>
      </div>

      {/* 버튼들 */}
      {isOwner && (
        <div className="flex flex-col gap-1 ml-2">
          <button
            onClick={() => onMemberClick(memberData._id || memberData.id)}
            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            통계
          </button>
          <button
            onClick={() => onMemberScheduleClick(memberData._id || memberData.id)}
            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          >
            시간표
          </button>
          <button
            onClick={fetchMemberAddress}
            className="px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors flex items-center justify-center gap-1"
          >
            <MapPin size={12} />
            주소
          </button>
        </div>
      )}

      {/* 주소 모달 */}
      {showAddressModal && memberAddress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddressModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 flex-shrink-0">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800 flex items-center">
                  <MapPin size={24} className="mr-2 text-purple-600" />
                  {memberName}의 주소
                </h3>
                <button
                  onClick={() => setShowAddressModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-6 pb-6">
              <div className="mb-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm font-semibold text-gray-700 mb-1">주소</p>
                  <p className="text-base text-gray-900">{memberAddress.address || '주소 정보 없음'}</p>
                  {memberAddress.addressDetail && (
                    <>
                      <p className="text-sm font-semibold text-gray-700 mb-1 mt-3">상세 주소</p>
                      <p className="text-base text-gray-900">{memberAddress.addressDetail}</p>
                    </>
                  )}
                </div>
              </div>

              {memberAddress.addressLat && memberAddress.addressLng && (
                <div className="rounded-lg overflow-hidden border border-gray-200">
                  <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '400px' }}
                    center={{
                      lat: parseFloat(memberAddress.addressLat),
                      lng: parseFloat(memberAddress.addressLng)
                    }}
                    zoom={13}
                  >
                    {directionsResponse ? (
                      <DirectionsRenderer
                        directions={directionsResponse}
                        options={{
                          suppressMarkers: false,
                          polylineOptions: {
                            strokeColor: '#4F46E5',
                            strokeWeight: 5
                          }
                        }}
                      />
                    ) : (
                      <>
                        {ownerAddress && (
                          <Marker
                            position={{
                              lat: parseFloat(ownerAddress.addressLat),
                              lng: parseFloat(ownerAddress.addressLng)
                            }}
                            label="방장"
                          />
                        )}
                        <Marker
                          position={{
                            lat: parseFloat(memberAddress.addressLat),
                            lng: parseFloat(memberAddress.addressLng)
                          }}
                          label="조원"
                        />
                      </>
                    )}
                  </GoogleMap>
                </div>
              )}

              {(!memberAddress.addressLat || !memberAddress.addressLng) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-yellow-800">지도 정보가 없습니다.</p>
                </div>
              )}

              {/* 경로 정보 */}
              {ownerAddress && (
                <div className="mt-4">
                  <h4 className="text-lg font-bold text-gray-800 mb-3">방장으로부터의 경로</h4>
                  {loadingRoute ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-600">경로 계산 중...</p>
                    </div>
                  ) : routeInfo && routeInfo.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                      {routeInfo.map((route, idx) => (
                        <div key={idx} className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg overflow-hidden">
                          <div
                            className={`p-3 ${route.steps ? 'cursor-pointer hover:bg-purple-100' : ''}`}
                            onClick={() => route.steps && setExpandedRoute(expandedRoute === idx ? null : idx)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <span className="text-2xl mr-3">{route.icon}</span>
                                <div>
                                  <p className="text-sm font-bold text-gray-800">{route.mode}</p>
                                  <p className="text-xs text-gray-600">거리: {route.distance}</p>
                                </div>
                              </div>
                              <div className="text-right flex items-center">
                                <p className="text-lg font-bold text-purple-600">{route.duration}</p>
                                {route.steps && (
                                  <span className="ml-2 text-gray-500">
                                    {expandedRoute === idx ? '▲' : '▼'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 대중교통 상세 경로 */}
                          {route.steps && expandedRoute === idx && (
                            <div className="bg-white border-t border-purple-200 p-3">
                              <h5 className="text-sm font-bold text-gray-700 mb-2">상세 경로</h5>
                              <div className="space-y-2">
                                {route.steps.map((step, stepIdx) => {
                                  const transitDetails = step.transitDetails;
                                  if (transitDetails) {
                                    const line = transitDetails.transitLine;
                                    const vehicleType = line?.vehicle?.type || 'BUS';
                                    const vehicleIcon = vehicleType.includes('SUBWAY') ? '🚇' :
                                                       vehicleType.includes('BUS') ? '🚌' :
                                                       vehicleType.includes('TRAIN') ? '🚆' : '🚌';
                                    const lineName = line?.name || line?.nameShort || '노선 정보 없음';
                                    const departureStop = transitDetails.stopDetails?.departureStop?.name || '출발지';
                                    const arrivalStop = transitDetails.stopDetails?.arrivalStop?.name || '도착지';
                                    const stopCount = transitDetails.stopCount || 0;

                                    return (
                                      <div key={stepIdx} className="bg-gray-50 p-2 rounded text-xs">
                                        <div className="flex items-center mb-1">
                                          <span className="text-lg mr-2">{vehicleIcon}</span>
                                          <span className="font-bold text-gray-800">{lineName}</span>
                                        </div>
                                        <div className="ml-7 text-gray-600">
                                          <p>🔵 {departureStop}</p>
                                          {stopCount > 0 && <p className="text-xs text-gray-500 ml-3">({stopCount}개 정류장)</p>}
                                          <p>🔴 {arrivalStop}</p>
                                        </div>
                                      </div>
                                    );
                                  } else if (step.travelMode === 'WALK') {
                                    const distance = step.distanceMeters ? `${Math.round(step.distanceMeters)}m` : '';
                                    return (
                                      <div key={stepIdx} className="bg-gray-50 p-2 rounded text-xs">
                                        <div className="flex items-center">
                                          <span className="text-lg mr-2">🚶</span>
                                          <span className="text-gray-700">도보 이동 {distance}</span>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-600">경로 정보를 불러올 수 없습니다.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MemberList = ({
  currentRoom,
  user,
  isOwner,
  onMemberClick,
  onMemberScheduleClick
}) => {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 sm:p-4">
      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
        <Users size={20} className="mr-2 text-blue-600" />
        조원 목록 ({(currentRoom.members || []).length}명)
      </h3>

      <div className="space-y-3">
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
          />
        ))}
      </div>
    </div>
  );
};

export default MemberList;