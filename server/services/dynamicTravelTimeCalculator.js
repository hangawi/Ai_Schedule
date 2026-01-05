/**
 * ===================================================================================================
 * dynamicTravelTimeCalculator.js - 동적 이동시간 계산 엔진
 * ===================================================================================================
 *
 * 목적: 조원이 시간을 선택할 때, 방장의 이동시간을 고려하여 실제로 가능한지 검증
 *
 * 핵심 개념: 이동시간은 "사람의 속성"이 아니라 "일정 간의 관계"
 *           - 순서에 따라 달라짐 (첫 번째 vs 두 번째)
 *           - 요일에 따라 달라짐 (혼자 vs 다른 일정 뒤)
 *           - 삽입/교환 시 재계산 필요
 *
 * ===================================================================================================
 */

const Room = require('../models/room');
const travelTimeCache = require('./schedulingAlgorithm/utils/travelTimeCache');

/**
 * 시간을 분 단위로 변환
 * @param {string} timeString - "HH:MM" 형식의 시간
 * @returns {number} 분 단위 시간
 */
function timeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * 분을 HH:MM 형식으로 변환
 * @param {number} minutes - 분 단위 시간
 * @returns {string} "HH:MM" 형식
 */
function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * 시간에서 분을 빼기
 * @param {string} timeString - "HH:MM" 형식
 * @param {number} minutesToSubtract - 뺄 분
 * @returns {string} "HH:MM" 형식
 */
function subtractMinutes(timeString, minutesToSubtract) {
  const totalMinutes = timeToMinutes(timeString) - minutesToSubtract;
  return minutesToTime(totalMinutes);
}

/**
 * 같은 날짜인지 확인
 * @param {Date} date1
 * @param {Date} date2
 * @returns {boolean}
 */
function isSameDay(date1, date2) {
  if (!date1 || !date2) return false;
  return date1.toDateString() === date2.toDateString();
}

/**
 * 시간이 특정 범위 안에 있는지 확인
 * @param {string} time - 확인할 시간 "HH:MM"
 * @param {string} rangeStart - 범위 시작 "HH:MM"
 * @param {string} rangeEnd - 범위 종료 "HH:MM"
 * @returns {boolean}
 */
function isTimeInRange(time, rangeStart, rangeEnd) {
  const timeMin = timeToMinutes(time);
  const startMin = timeToMinutes(rangeStart);
  const endMin = timeToMinutes(rangeEnd);
  return timeMin >= startMin && timeMin < endMin;
}

class DynamicTravelTimeCalculator {

  /**
   * 두 위치 간 이동시간 계산 (Google Maps API 활용, 캐싱 포함)
   * @param {Object} fromLocation - 출발 위치 { type, address, coordinates: {lat, lng} }
   * @param {Object} toLocation - 도착 위치
   * @param {string} travelMode - 이동수단 ('transit', 'driving', 'bicycling', 'walking', 'normal')
   * @returns {Promise<number>} 이동시간 (분 단위)
   */
  async calculateTravelTimeBetween(fromLocation, toLocation, travelMode = 'transit') {
    if (!fromLocation || !toLocation) {
      console.warn('⚠️  위치 정보가 없습니다. 기본값 30분 반환');
      return 30;
    }

    // 'normal' 모드는 이동시간 계산 안 함
    if (travelMode === 'normal') {
      return 0;
    }

    // 위치를 문자열로 변환 (캐시 키용)
    const originParam = fromLocation.coordinates
      ? `${fromLocation.coordinates.lat},${fromLocation.coordinates.lng}`
      : fromLocation.address;

    const destParam = toLocation.coordinates
      ? `${toLocation.coordinates.lat},${toLocation.coordinates.lng}`
      : toLocation.address;

    // Google Maps API mode 변환
    const modeMap = {
      'transit': 'transit',
      'driving': 'driving',
      'bicycling': 'bicycling',
      'walking': 'walking'
    };
    const mode = modeMap[travelMode] || 'transit';

    // 1. 캐시 확인
    const cached = travelTimeCache.get(originParam, destParam, mode);
    if (cached !== null) {
      return cached;
    }

    // 2. Google Maps API 호출
    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.error('❌ Google Maps API Key가 설정되지 않았습니다.');
        return 30; // 기본값 30분
      }

      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(originParam)}&destinations=${encodeURIComponent(destParam)}&mode=${mode}&key=${apiKey}&language=ko`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.rows[0]?.elements[0]?.status === 'OK') {
        const durationSeconds = data.rows[0].elements[0].duration.value;
        const travelTimeMinutes = Math.ceil(durationSeconds / 60);

        // 캐시에 저장
        travelTimeCache.set(originParam, destParam, mode, travelTimeMinutes);

        console.log(`🚗 [이동시간 계산] ${fromLocation.description || '출발'} → ${toLocation.description || '도착'}: ${travelTimeMinutes}분 (${mode})`);

        return travelTimeMinutes;
      } else {
        console.warn(`⚠️  Google Maps API 응답 오류: ${data.status} / ${data.rows[0]?.elements[0]?.status}`);

        // ✅ Fallback 1: 다른 교통수단 캐시 확인
        const fallbackValue = travelTimeCache.getFromAnyMode(originParam, destParam, mode);
        if (fallbackValue !== null) {
          console.log(`🔄 [Fallback 성공] 다른 모드 캐시 사용: ${fallbackValue}분`);
          travelTimeCache.set(originParam, destParam, mode, fallbackValue);
          return fallbackValue;
        }

        // ✅ Fallback 2: 단순 거리 계산 (최종 fallback)
        if (fromLocation.coordinates && toLocation.coordinates) {
          const { lat: lat1, lng: lng1 } = fromLocation.coordinates;
          const { lat: lat2, lng: lng2 } = toLocation.coordinates;

          // Haversine 공식으로 거리 계산
          const R = 6371; // 지구 반지름 (km)
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLng = (lng2 - lng1) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c; // km

          // 교통수단별 속도
          const speeds = {
            driving: 40,
            transit: 30,
            walking: 5,
            bicycling: 15
          };
          const speed = speeds[mode] || 30;
          const travelTimeMinutes = Math.ceil((distance / speed) * 60 / 10) * 10; // 10분 단위

          console.log(`🔄 [Fallback 성공] 단순 거리 계산: ${distance.toFixed(1)}km, ${travelTimeMinutes}분 (${mode})`);

          // 캐시에 저장
          travelTimeCache.set(originParam, destParam, mode, travelTimeMinutes);
          return travelTimeMinutes;
        }

        console.warn(`❌ [Fallback 실패] 모든 방법 실패, 기본값 30분 사용`);
        return 30; // 최종 기본값
      }

    } catch (error) {
      console.error('❌ 이동시간 계산 실패:', error);
      return 30; // 기본값
    }
  }

  /**
   * 새로운 슬롯을 특정 시간에 배치했을 때 전체 스케줄 시뮬레이션
   * @param {string} roomId - 방 ID
   * @param {Date} date - 날짜
   * @param {Object} newSlot - 삽입할 슬롯 정보 { startTime, endTime, location }
   * @returns {Promise<Array>} 시뮬레이션된 스케줄
   */
  async simulateScheduleWithNewSlot(roomId, date, newSlot) {
    const room = await Room.findById(roomId)
      .populate('members.user', 'personalTimes')
      .populate('owner', 'personalTimes homeLocation');

    if (!room) {
      throw new Error('방을 찾을 수 없습니다.');
    }

    // 1. 해당 날짜의 기존 슬롯들 조회 (시간순 정렬)
    const existingSlots = room.timeSlots
      .filter(slot => isSameDay(new Date(slot.date), new Date(date)))
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    // 2. 새 슬롯을 적절한 위치에 삽입
    const allSlots = [...existingSlots, newSlot]
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    // 3. 각 슬롯의 이동시간 계산
    const simulatedSchedule = [];
    let previousLocation = room.ownerHomeLocation || {
      type: 'address',
      address: '서울시 강남구',
      coordinates: { lat: 37.4979, lng: 127.0276 } // 기본값: 강남역
    };

    for (const slot of allSlots) {
      if (!slot.location) {
        // 위치 정보가 없는 슬롯은 기본 위치 사용
        slot.location = previousLocation;
      }

      const travelTime = await this.calculateTravelTimeBetween(
        previousLocation,
        slot.location,
        room.currentTravelMode || room.confirmedTravelMode || 'transit'
      );

      simulatedSchedule.push({
        slot,
        travelTimeBefore: travelTime,
        actualStartTime: subtractMinutes(slot.startTime, travelTime),
        previousLocation
      });

      previousLocation = slot.location; // 다음 슬롯을 위해 현재 위치 저장
    }

    return simulatedSchedule;
  }

  /**
   * 새로운 슬롯이 해당 시간에 배치 가능한지 검증
   * @param {string} roomId - 방 ID
   * @param {Date} date - 날짜
   * @param {string} startTime - 시작 시간 (HH:MM)
   * @param {string} endTime - 종료 시간 (HH:MM)
   * @param {Object} location - 위치 정보
   * @returns {Promise<Object>} { valid: boolean, reason: string, details: {...} }
   */
  async validateNewSlotPlacement(roomId, date, startTime, endTime, location) {
    try {
      // 1. 시뮬레이션 수행
      const newSlot = { startTime, endTime, location, date };
      const simulatedSchedule = await this.simulateScheduleWithNewSlot(
        roomId,
        date,
        newSlot
      );

      // 2. 새 슬롯 찾기
      const newSlotIndex = simulatedSchedule.findIndex(
        item => item.slot.startTime === startTime && item.slot.endTime === endTime
      );

      if (newSlotIndex === -1) {
        return {
          valid: false,
          reason: 'slot_not_found',
          details: {}
        };
      }

      const newSlotInfo = simulatedSchedule[newSlotIndex];
      const actualStart = newSlotInfo.actualStartTime;

      // 3. 검증 항목들

      const room = await Room.findById(roomId);

      // 3-1. 이동시간 때문에 실제 시작 시간이 금지시간과 겹치는가?
      if (room.settings.blockedTimes) {
        for (const blockedTime of room.settings.blockedTimes) {
          if (isTimeInRange(actualStart, blockedTime.startTime, startTime)) {
            return {
              valid: false,
              reason: 'blocked_time_conflict',
              details: {
                actualStartTime: actualStart,
                blockedTime: blockedTime.startTime
              }
            };
          }
        }
      }

      // 3-2. 이전 슬롯과 충돌하는가?
      if (newSlotIndex > 0) {
        const prevSlot = simulatedSchedule[newSlotIndex - 1];
        const prevEndTime = prevSlot.slot.endTime;

        if (timeToMinutes(actualStart) < timeToMinutes(prevEndTime)) {
          return {
            valid: false,
            reason: 'previous_slot_conflict',
            details: {
              previousEndTime: prevEndTime,
              actualStartTime: actualStart
            }
          };
        }
      }

      // 3-3. 다음 슬롯과 충돌하는가?
      if (newSlotIndex < simulatedSchedule.length - 1) {
        const nextSlot = simulatedSchedule[newSlotIndex + 1];
        const nextTravelTime = nextSlot.travelTimeBefore;
        const requiredEndTime = subtractMinutes(
          nextSlot.slot.startTime,
          nextTravelTime
        );

        if (timeToMinutes(endTime) > timeToMinutes(requiredEndTime)) {
          return {
            valid: false,
            reason: 'next_slot_conflict',
            details: {
              requiredEndTime,
              requestedEndTime: endTime
            }
          };
        }
      }

      // 4. 모든 검증 통과
      return {
        valid: true,
        reason: 'all_checks_passed',
        details: {
          travelTimeBefore: newSlotInfo.travelTimeBefore,
          actualStartTime: newSlotInfo.actualStartTime
        }
      };

    } catch (error) {
      console.error('❌ 슬롯 배치 검증 실패:', error);
      return {
        valid: false,
        reason: 'validation_error',
        details: { error: error.message }
      };
    }
  }
}

// 싱글톤 인스턴스
const dynamicTravelTimeCalculator = new DynamicTravelTimeCalculator();

module.exports = dynamicTravelTimeCalculator;
