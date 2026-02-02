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
const calculateTravelTime = async (fromUserId, toUserId, room, effectiveTravelMode) => {
  // 🔧 effectiveTravelMode 매개변수 추가 (room.travelMode 대신 사용)
  if (!effectiveTravelMode || effectiveTravelMode === 'normal') return 0;

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
    const speed = speeds[effectiveTravelMode] || 30;

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

  try {
    // ① 해당 날짜의 전체 슬롯 조회
    const room = await Room.findById(roomId)
      .populate('owner', 'addressLat addressLng')
      .populate('members.user', 'addressLat addressLng')
      .populate('timeSlots.user', '_id addressLat addressLng');

    if (!room) {
      return { isValid: false, reason: '방을 찾을 수 없습니다.' };
    }

    // ⚠️ effectiveTravelMode 계산 (smartExchange와 동일)
    const effectiveTravelMode = room.confirmedTravelMode || room.currentTravelMode || room.travelMode;


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


    const allSlots = [...slotsOnDate, newSlot].sort((a, b) => {
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });


    // ③ 모든 슬롯의 이동시간 재계산 (서버 로직과 동일하게!)
    const slotsWithTravel = [];
    let previousEndMinutes = 0;

    for (let i = 0; i < allSlots.length; i++) {
      const slot = allSlots[i];
      const prevSlot = i > 0 ? allSlots[i - 1] : null;

      let travelTime = 0;
      if (effectiveTravelMode && effectiveTravelMode !== 'normal') {
        if (prevSlot) {
          // 이전 슬롯의 사용자 → 현재 슬롯의 사용자
          const prevUserId = prevSlot.user._id || prevSlot.user;
          const currUserId = slot.user._id || slot.user;

          if (prevUserId.toString() === room.owner._id.toString()) {
            // 방장 → 학생
            travelTime = await calculateTravelTime(room.owner._id, currUserId, room, effectiveTravelMode);
          } else {
            // 학생 → 학생
            travelTime = await calculateTravelTime(prevUserId, currUserId, room, effectiveTravelMode);
          }
        } else {
          // 첫 슬롯: 방장 → 학생
          const currUserId = slot.user._id || slot.user;
          travelTime = await calculateTravelTime(room.owner._id, currUserId, room, effectiveTravelMode);
        }
      }

      // 🔧 서버 로직과 동일하게: 이전 슬롯 종료 시간부터 이동 시작
      let travelStartMinutes, travelEndMinutes, classStartMinutes, classEndMinutes;
      const slotStartMinutes = timeToMinutes(slot.startTime);
      const slotEndMinutes = timeToMinutes(slot.endTime);
      const classDuration = slotEndMinutes - slotStartMinutes;

      if (!prevSlot) {
        // 첫 번째 슬롯: 원래 시간 유지, 이동시간 역산
        travelStartMinutes = slotStartMinutes - travelTime;
        travelEndMinutes = slotStartMinutes;
        classStartMinutes = slotStartMinutes;
        classEndMinutes = slotEndMinutes;
      } else {
        // 이전 슬롯이 있음: 이전 종료 시간부터 연속 배치
        travelStartMinutes = previousEndMinutes;
        travelEndMinutes = travelStartMinutes + travelTime;
        classStartMinutes = travelEndMinutes;
        classEndMinutes = classStartMinutes + classDuration;
      }

      previousEndMinutes = classEndMinutes;

      slotsWithTravel.push({
        ...slot,
        travelTime,
        travelStartTime: minutesToTime(travelStartMinutes),
        travelEndTime: minutesToTime(travelEndMinutes),
        classStartTime: minutesToTime(classStartMinutes),
        classEndTime: minutesToTime(classEndMinutes)
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
          return {
            isValid: false,
            reason: `이동시간이 다른 조원의 이동시간과 충돌합니다. (Slot ${i+1} travel vs Slot ${j+1} travel)`
          };
        }

        // 슬롯의 이동시간이 다른 슬롯의 수업시간과 충돌
        if (slotTravelStart < otherClassEnd && slotTravelEnd > otherClassStart) {
          return {
            isValid: false,
            reason: `이동시간이 다른 조원의 수업시간과 충돌합니다. (Slot ${i+1} travel vs Slot ${j+1} class)`
          };
        }

        // 슬롯의 수업시간이 다른 슬롯의 이동시간과 충돌
        if (slotClassStart < otherTravelEnd && slotClassEnd > otherTravelStart) {
          return {
            isValid: false,
            reason: `수업시간이 다른 조원의 이동시간과 충돌합니다. (Slot ${i+1} class vs Slot ${j+1} travel)`
          };
        }

        // 슬롯의 수업시간이 다른 슬롯의 수업시간과 충돌
        if (slotClassStart < otherClassEnd && slotClassEnd > otherClassStart) {
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
      const newSlotWithTravel = slotsWithTravel.find(s => {
        const slotUserId = s.user?._id || s.user;
        return slotUserId?.toString() === userId.toString() && s.startTime === targetTime;
      });

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

    // ⑥ 🆕 Phase 4: 선호시간 범위 검증
    const newSlotWithTravel = slotsWithTravel.find(s => {
      const slotUserId = s.user?._id || s.user;
      return slotUserId?.toString() === userId.toString() && s.startTime === targetTime;
    });

    if (newSlotWithTravel) {
      try {
        const requestingUser = await User.findById(userId);
        if (requestingUser) {
          // 조원의 선호시간 조회
          const targetDayOfWeek = new Date(targetDate).getDay(); // 0: Sunday, 6: Saturday
          const targetDateStr = new Date(targetDate).toISOString().split('T')[0];

          // 해당 요일/날짜의 선호시간 찾기 (defaultSchedule + scheduleExceptions)
          const defaultSchedule = requestingUser.defaultSchedule || [];
          const scheduleExceptions = requestingUser.scheduleExceptions || [];

          const applicableSchedules = [
            ...defaultSchedule.filter(s => !s.specificDate && s.dayOfWeek === targetDayOfWeek),
            ...scheduleExceptions.filter(s => s.specificDate === targetDateStr),
            ...defaultSchedule.filter(s => s.specificDate === targetDateStr)
          ];

          if (applicableSchedules.length > 0) {
            // ⚠️ 선호시간 범위 병합 (10분 단위 쪼개짐 해결)
            const rawRanges = applicableSchedules.map(s => ({
              start: timeToMinutes(s.startTime),
              end: timeToMinutes(s.endTime)
            })).sort((a, b) => a.start - b.start);

            // 연속된 범위 병합
            const preferredRanges = [];
            let current = null;

            for (const range of rawRanges) {
              if (!current) {
                current = { ...range };
              } else if (range.start <= current.end) {
                // 겹치거나 연속됨 → 병합
                current.end = Math.max(current.end, range.end);
              } else {
                // 새로운 범위 시작
                preferredRanges.push(current);
                current = { ...range };
              }
            }
            if (current) preferredRanges.push(current);


            // 새 슬롯의 실제 시작 (이동시간 포함) & 종료 시간
            const actualStart = timeToMinutes(newSlotWithTravel.travelStartTime);
            const actualEnd = timeToMinutes(newSlotWithTravel.classEndTime);

            // 선호시간 범위 내에 있는지 확인
            const isWithinPreferred = preferredRanges.some(range =>
              actualStart >= range.start && actualEnd <= range.end
            );

            if (!isWithinPreferred) {

              // 최소 가능 시간 계산
              const travelTime = newSlotWithTravel.travelTime;
              const minPossibleStart = preferredRanges[0].start + travelTime;
              const minPossibleTime = minutesToTime(minPossibleStart);

              return {
                isValid: false,
                reason: `선호시간 범위를 벗어납니다. 최소 ${minPossibleTime}부터 가능합니다.`,
                minTime: minPossibleTime
              };
            }
          }
        }
      } catch (error) {
        console.error('선호시간 검증 오류:', error);
      }
    }

    // ⑦ 모든 검증 통과
    return { isValid: true, reason: '가능합니다.' };

  } catch (error) {
    console.error('❌ [시뮬레이션 오류]:', error);
    return { isValid: false, reason: '시뮬레이션 중 오류가 발생했습니다.' };
  }
}

module.exports = {
  simulateScheduleWithNewSlot
};
