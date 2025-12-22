/**
 * ============================================================================
 * Schedule Simulator - 조원 시간 교환 시뮬레이션 엔진
 * ============================================================================
 *
 * 목적: 조원이 특정 시간을 선택했을 때 전체 스케줄을 시뮬레이션하여
 *      이동시간 충돌 여부를 확인 (조원에게는 결과만 표시, 이유는 숨김)
 *
 * 핵심 원칙:
 * 1. 조원은 방장의 이동시간을 절대 볼 수 없음
 * 2. 시스템이 내부적으로 시뮬레이션
 * 3. 조원에게는 결과(가능/불가능)만 표시
 */

const Room = require('../models/room');
const User = require('../models/user');

/**
 * 시간을 분 단위로 변환
 */
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * 분을 시간 형식으로 변환
 */
const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

/**
 * 거리 계산 (Haversine formula)
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;

  const R = 6371; // 지구 반지름 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    0.5 - Math.cos(dLat)/2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    (1 - Math.cos(dLon))/2;
  return R * 2 * Math.asin(Math.sqrt(a));
};

/**
 * 이동시간 계산
 */
const calculateTravelTime = async (fromUserId, toUserId, room) => {
  if (!room.travelMode || room.travelMode === 'normal') return 0;

  try {
    const fromUser = await User.findById(fromUserId);
    const toUser = await User.findById(toUserId);

    if (!fromUser || !toUser) return 0;
    if (!fromUser.addressLat || !toUser.addressLat) return 0;

    const distance = calculateDistance(
      fromUser.addressLat,
      fromUser.addressLng,
      toUser.addressLat,
      toUser.addressLng
    );

    // 이동 수단별 속도 (km/h)
    const speeds = {
      driving: 40,
      transit: 30,
      walking: 5,
      bicycling: 15
    };
    const speed = speeds[room.travelMode] || 30;

    // 이동시간 계산 (10분 단위 반올림)
    const travelMinutes = Math.ceil((distance / speed) * 60 / 10) * 10;
    return travelMinutes;
  } catch (error) {
    console.error('이동시간 계산 오류:', error);
    return 0;
  }
};

/**
 * 조원이 특정 시간을 선택했을 때 전체 스케줄 시뮬레이션
 * @param {string} roomId - 방 ID
 * @param {string} userId - 선택하는 조원 ID
 * @param {Date} targetDate - 목표 날짜
 * @param {string} targetTime - 목표 시간 (HH:MM)
 * @param {number} duration - 소요 시간 (분)
 * @returns {Object} { isValid: boolean, reason: string (internal only) }
 */
async function simulateScheduleWithNewSlot(roomId, userId, targetDate, targetTime, duration) {
  console.log(`🔍 [시뮬레이션 시작] 조원: ${userId}, 날짜: ${targetDate}, 시간: ${targetTime}, 길이: ${duration}분`);

  try {
    // ① 해당 날짜의 전체 슬롯 조회
    const room = await Room.findById(roomId)
      .populate('owner', 'addressLat addressLng')
      .populate('members.user', 'addressLat addressLng')
      .populate('timeSlots.user', '_id addressLat addressLng');

    if (!room) {
      console.log(`❌ [시뮬레이션 실패] 방을 찾을 수 없음`);
      return { isValid: false, reason: '방을 찾을 수 없습니다.' };
    }

    console.log(`📋 [시뮬레이션] 방 정보: travelMode=${room.travelMode}, 전체 슬롯=${room.timeSlots.length}개`);

    const targetDateStr = new Date(targetDate).toISOString().split('T')[0];

    // 해당 날짜의 슬롯들만 필터링
    const slotsOnDate = room.timeSlots.filter(slot => {
      const slotDate = new Date(slot.date).toISOString().split('T')[0];
      return slotDate === targetDateStr;
    });

    // ② 새 슬롯을 시간순으로 삽입
    const newSlot = {
      user: userId,
      startTime: targetTime,
      endTime: minutesToTime(timeToMinutes(targetTime) + duration),
      date: targetDate
    };

    console.log(`📝 [시뮬레이션] 해당 날짜 기존 슬롯: ${slotsOnDate.length}개`);
    console.log(`➕ [시뮬레이션] 새 슬롯 추가: ${targetTime} - ${newSlot.endTime}`);

    const allSlots = [...slotsOnDate, newSlot].sort((a, b) => {
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });

    console.log(`📊 [시뮬레이션] 전체 슬롯 (정렬 후): ${allSlots.length}개`);

    // ③ 모든 슬롯의 이동시간 재계산
    const slotsWithTravel = [];

    for (let i = 0; i < allSlots.length; i++) {
      const slot = allSlots[i];
      const prevSlot = i > 0 ? allSlots[i - 1] : null;

      let travelTime = 0;
      if (room.travelMode && room.travelMode !== 'normal') {
        if (prevSlot) {
          // 이전 슬롯의 사용자 → 현재 슬롯의 사용자
          const prevUserId = prevSlot.user._id || prevSlot.user;
          const currUserId = slot.user._id || slot.user;

          if (prevUserId.toString() === room.owner._id.toString()) {
            // 방장 → 학생
            travelTime = await calculateTravelTime(room.owner._id, currUserId, room);
          } else {
            // 학생 → 학생
            travelTime = await calculateTravelTime(prevUserId, currUserId, room);
          }
        } else {
          // 첫 슬롯: 방장 → 학생
          const currUserId = slot.user._id || slot.user;
          travelTime = await calculateTravelTime(room.owner._id, currUserId, room);
        }
      }

      slotsWithTravel.push({
        ...slot,
        travelTime,
        travelStartTime: slot.startTime,
        travelEndTime: minutesToTime(timeToMinutes(slot.startTime) + travelTime),
        classStartTime: minutesToTime(timeToMinutes(slot.startTime) + travelTime),
        classEndTime: slot.endTime
      });
    }

    // ④ 각 슬롯이 다른 슬롯의 이동시간 또는 수업시간과 충돌하는지 확인
    for (let i = 0; i < slotsWithTravel.length; i++) {
      const slot = slotsWithTravel[i];
      const slotTravelStart = timeToMinutes(slot.travelStartTime);
      const slotTravelEnd = timeToMinutes(slot.travelEndTime);
      const slotClassStart = timeToMinutes(slot.classStartTime);
      const slotClassEnd = timeToMinutes(slot.classEndTime);

      // 다른 슬롯들과 충돌 검사
      for (let j = 0; j < slotsWithTravel.length; j++) {
        if (i === j) continue;

        const other = slotsWithTravel[j];
        const otherTravelStart = timeToMinutes(other.travelStartTime);
        const otherTravelEnd = timeToMinutes(other.travelEndTime);
        const otherClassStart = timeToMinutes(other.classStartTime);
        const otherClassEnd = timeToMinutes(other.classEndTime);

        // 슬롯의 이동시간이 다른 슬롯의 이동시간과 충돌
        if (slotTravelStart < otherTravelEnd && slotTravelEnd > otherTravelStart) {
          console.log(`❌ [시뮬레이션 충돌] 이동시간 vs 이동시간: Slot ${i+1}(${slot.travelStartTime}-${slot.travelEndTime}) vs Slot ${j+1}(${other.travelStartTime}-${other.travelEndTime})`);
          return {
            isValid: false,
            reason: `이동시간이 다른 조원의 이동시간과 충돌합니다. (Slot ${i+1} travel vs Slot ${j+1} travel)`
          };
        }

        // 슬롯의 이동시간이 다른 슬롯의 수업시간과 충돌
        if (slotTravelStart < otherClassEnd && slotTravelEnd > otherClassStart) {
          console.log(`❌ [시뮬레이션 충돌] 이동시간 vs 수업시간: Slot ${i+1}(${slot.travelStartTime}-${slot.travelEndTime}) vs Slot ${j+1}(${other.classStartTime}-${other.classEndTime})`);
          return {
            isValid: false,
            reason: `이동시간이 다른 조원의 수업시간과 충돌합니다. (Slot ${i+1} travel vs Slot ${j+1} class)`
          };
        }

        // 슬롯의 수업시간이 다른 슬롯의 이동시간과 충돌
        if (slotClassStart < otherTravelEnd && slotClassEnd > otherTravelStart) {
          console.log(`❌ [시뮬레이션 충돌] 수업시간 vs 이동시간: Slot ${i+1}(${slot.classStartTime}-${slot.classEndTime}) vs Slot ${j+1}(${other.travelStartTime}-${other.travelEndTime})`);
          return {
            isValid: false,
            reason: `수업시간이 다른 조원의 이동시간과 충돌합니다. (Slot ${i+1} class vs Slot ${j+1} travel)`
          };
        }

        // 슬롯의 수업시간이 다른 슬롯의 수업시간과 충돌
        if (slotClassStart < otherClassEnd && slotClassEnd > otherClassStart) {
          console.log(`❌ [시뮬레이션 충돌] 수업시간 vs 수업시간: Slot ${i+1}(${slot.classStartTime}-${slot.classEndTime}) vs Slot ${j+1}(${other.classStartTime}-${other.classEndTime})`);
          return {
            isValid: false,
            reason: `수업시간이 다른 조원의 수업시간과 충돌합니다. (Slot ${i+1} class vs Slot ${j+1} class)`
          };
        }
      }
    }

    // ⑤ 금지시간 침범 확인
    const blockedTimes = room.settings?.blockedTimes || [];
    if (blockedTimes.length > 0) {
      const newSlotWithTravel = slotsWithTravel.find(s =>
        (s.user._id || s.user).toString() === userId.toString() &&
        s.startTime === targetTime
      );

      if (newSlotWithTravel) {
        const slotStart = timeToMinutes(newSlotWithTravel.travelStartTime);
        const slotEnd = timeToMinutes(newSlotWithTravel.classEndTime);

        for (const blocked of blockedTimes) {
          const blockedStart = timeToMinutes(blocked.startTime);
          const blockedEnd = timeToMinutes(blocked.endTime);

          if (slotStart < blockedEnd && slotEnd > blockedStart) {
            return {
              isValid: false,
              reason: `금지시간(${blocked.name || '금지 시간'})과 충돌합니다.`
            };
          }
        }
      }
    }

    // ⑥ 모든 검증 통과
    console.log(`✅ [시뮬레이션 성공] 해당 시간에 배치 가능`);
    return { isValid: true, reason: '가능합니다.' };

  } catch (error) {
    console.error('❌ [시뮬레이션 오류]:', error);
    return { isValid: false, reason: '시뮬레이션 중 오류가 발생했습니다.' };
  }
}

module.exports = {
  simulateScheduleWithNewSlot
};
