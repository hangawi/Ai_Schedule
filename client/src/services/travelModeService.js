/**
 * 이동 수단별 스케줄링 서비스
 * Google Directions API를 사용하여 실제 이동 시간/거리 계산
 */

class TravelModeService {
  constructor() {
    this.directionsService = null;
  }

  /**
   * Google Directions Service 초기화
   */
  initializeDirectionsService() {
    if (!this.directionsService && window.google) {
      this.directionsService = new window.google.maps.DirectionsService();
    }
    return this.directionsService;
  }

  /**
   * 두 지점 간의 이동 정보 계산 (Google Directions API 사용)
   * @param {Object} origin - 출발지 {lat, lng}
   * @param {Object} destination - 목적지 {lat, lng}
   * @param {string} mode - 이동 수단 ('transit', 'driving', 'bicycling', 'walking')
   * @returns {Promise<Object>} - {duration: seconds, distance: meters, durationText, distanceText}
   */
  async calculateTravelTime(origin, destination, mode = 'transit') {
    const service = this.initializeDirectionsService();

    if (!service) {
      throw new Error('Google Maps API가 로드되지 않았습니다.');
    }

    // 'normal' 모드는 이동 시간 계산 안 함
    if (mode === 'normal') {
      return { duration: 0, distance: 0, durationText: '0분', distanceText: '0km' };
    }

    // Google Maps TravelMode 매핑
    const travelModeMap = {
      'transit': window.google.maps.TravelMode.TRANSIT,      // 대중교통
      'driving': window.google.maps.TravelMode.DRIVING,       // 자동차
      'bicycling': window.google.maps.TravelMode.BICYCLING,   // 자전거
      'walking': window.google.maps.TravelMode.WALKING        // 도보
    };

    try {
      const result = await new Promise((resolve, reject) => {
        service.route(
          {
            origin: new window.google.maps.LatLng(parseFloat(origin.lat), parseFloat(origin.lng)),
            destination: new window.google.maps.LatLng(parseFloat(destination.lat), parseFloat(destination.lng)),
            travelMode: travelModeMap[mode] || travelModeMap['transit']
          },
          (result, status) => {
            if (status === 'OK') {
              resolve(result);
            } else {
              // ZERO_RESULTS는 에러가 아니라 경로가 없는 경우이므로, fallback 처리
              resolve({ fallback: true, status: status });
            }
          }
        );
      });

      // API 호출 실패 시 fallback 실행
      if (result.fallback) {
        return this.estimateTravelTime(origin, destination, mode);
      }

      const route = result.routes[0].legs[0];
      return {
        duration: route.duration.value,          // 초 단위
        distance: route.distance.value,          // 미터 단위
        durationText: route.duration.text,       // "30분", "1시간 20분"
        distanceText: route.distance.text,       // "5.2km"
        steps: route.steps,                      // 상세 경로 정보
        fallback: false                          // 성공적으로 API 사용
      };
    } catch (error) {
      // 예외 발생 시에도 대략적인 계산으로 fallback
      return this.estimateTravelTime(origin, destination, mode);
    }
  }

  /**
   * Haversine 공식으로 거리 계산 (백업용)
   */
  getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // 지구 반지름 (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      0.5 - Math.cos(dLat)/2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      (1 - Math.cos(dLon))/2;
    return R * 2 * Math.asin(Math.sqrt(a));
  }

  /**
   * API 실패 시 대략적인 이동 시간 추정
   */
  estimateTravelTime(origin, destination, mode) {
    const distance = this.getDistance(origin.lat, origin.lng, destination.lat, destination.lng);

    // 이동 수단별 평균 속도 (km/h)
    const speedMap = {
      'walking': 5,
      'bicycling': 15,
      'transit': 25,
      'driving': 40
    };

    const speed = speedMap[mode] || 30;
    const durationHours = distance / speed;
    const durationSeconds = durationHours * 3600;

    return {
      duration: Math.round(durationSeconds),
      distance: Math.round(distance * 1000), // km를 m로 변환
      durationText: this.formatDuration(durationSeconds),
      distanceText: `${distance.toFixed(1)}km`
    };
  }

  /**
   * 초를 "X시간 Y분" 형식으로 변환
   */
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
    }
    return `${minutes}분`;
  }

  /**
   * 초를 30분 단위 슬롯으로 변환
   */
  convertToSlots(seconds) {
    const minutes = Math.ceil(seconds / 60);
    return Math.ceil(minutes / 30); // 30분 단위로 올림
  }

  /**
   * 방장 기준 최적 방문 순서 계산 (Nearest Neighbor)
   * @param {Object} owner - 방장 정보 {lat, lng, ...}
   * @param {Array} members - 멤버 배열
   * @param {string} mode - 이동 수단
   * @returns {Promise<Array>} - 정렬된 멤버 배열 with 이동 정보
   */
  async calculateOptimalOrder(owner, members, mode = 'transit') {
    if (members.length === 0) return [];

    const orderedMembers = [];
    const unvisited = [...members];
    let currentLocation = owner;

    while (unvisited.length > 0) {
      let nearestMember = null;
      let shortestTravel = null;
      let shortestIndex = -1;

      // 현재 위치에서 가장 가까운 미방문 멤버 찾기
      for (let i = 0; i < unvisited.length; i++) {
        const member = unvisited[i];
        try {
          const travelInfo = await this.calculateTravelTime(
            { lat: currentLocation.addressLat || currentLocation.lat, lng: currentLocation.addressLng || currentLocation.lng },
            { lat: member.user.addressLat, lng: member.user.addressLng },
            mode
          );

          if (!shortestTravel || travelInfo.duration < shortestTravel.duration) {
            shortestTravel = travelInfo;
            nearestMember = member;
            shortestIndex = i;
          }
        } catch (error) {
        }
      }

      if (nearestMember) {
        orderedMembers.push({
          ...nearestMember,
          travelInfo: shortestTravel,
          travelFrom: `${currentLocation.firstName || ''} ${currentLocation.lastName || ''}`.trim() || '방장'
        });
        unvisited.splice(shortestIndex, 1);
        currentLocation = nearestMember.user;
      } else {
        // 더 이상 계산할 수 없으면 남은 멤버 추가
        orderedMembers.push(...unvisited);
        break;
      }
    }

    return orderedMembers;
  }

  /**
   * 이동 시간을 반영한 스케줄 생성
   * @param {Array} orderedMembers - 정렬된 멤버 배열
   * @param {Date} startTime - 시작 시간
   * @param {number} minHoursPerMember - 멤버당 최소 시간 (시간 단위)
   * @returns {Array} - 스케줄 배열
   */
  generateScheduleWithTravel(orderedMembers, startTime, minHoursPerMember = 1) {
    const schedule = [];
    let currentTime = new Date(startTime);
    const minSlotsPerMember = minHoursPerMember * 2; // 30분 = 1슬롯

    orderedMembers.forEach((member, index) => {
      // 이동 시간 추가
      if (member.travelInfo && member.travelInfo.duration > 0) {
        const travelSlots = this.convertToSlots(member.travelInfo.duration);
        schedule.push({
          type: 'travel',
          from: member.travelFrom,
          to: `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim(),
          startTime: new Date(currentTime),
          duration: travelSlots,
          travelInfo: member.travelInfo
        });
        currentTime = new Date(currentTime.getTime() + travelSlots * 30 * 60 * 1000);
      }

      // 수업/활동 시간 추가
      schedule.push({
        type: 'activity',
        member: member,
        memberId: member.user._id.toString(),
        memberName: `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim(),
        startTime: new Date(currentTime),
        duration: minSlotsPerMember
      });
      currentTime = new Date(currentTime.getTime() + minSlotsPerMember * 30 * 60 * 1000);
    });

    return schedule;
  }
}

export default new TravelModeService();
