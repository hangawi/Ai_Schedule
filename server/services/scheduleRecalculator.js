/**
 * ===================================================================================================
 * scheduleRecalculator.js - 스케줄 재계산 서비스
 * ===================================================================================================
 *
 * 목적: 교환, 삽입, 삭제 등으로 인해 슬롯 순서가 변경되었을 때 이동시간을 재계산
 *
 * 핵심 개념: 이동시간은 순서에 따라 달라지므로, 순서가 바뀌면 재계산이 필요
 *           - A와 B가 교환하면 → 두 슬롯의 이동시간이 바뀜
 *           - 새 슬롯이 삽입되면 → 뒤따르는 슬롯의 이동시간이 바뀔 수 있음
 *
 * ===================================================================================================
 */

const Room = require('../models/room');
const dynamicTravelTimeCalculator = require('./dynamicTravelTimeCalculator');

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
 * 특정 날짜의 전체 스케줄 재계산
 * 교환, 삽입, 삭제 등으로 인해 순서가 바뀌었을 때 호출
 *
 * @param {string} roomId - 방 ID
 * @param {Date} date - 재계산할 날짜
 * @returns {Promise<Object>} 재계산 결과 { recalculatedCount, slots }
 */
async function recalculateScheduleForDate(roomId, date) {
  try {
    const room = await Room.findById(roomId)
      .populate('owner', 'homeLocation');

    if (!room) {
      throw new Error('방을 찾을 수 없습니다.');
    }

    // 1. 해당 날짜의 모든 슬롯 조회 (시간순 정렬)
    const slotsForDate = room.timeSlots
      .filter(slot => isSameDay(new Date(slot.date), new Date(date)))
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    if (slotsForDate.length === 0) {
      console.log(`📅 [재계산] ${date}: 슬롯 없음 (스킵)`);
      return { recalculatedCount: 0, slots: [] };
    }

    // 2. 각 슬롯의 이동시간 재계산
    let previousLocation = room.ownerHomeLocation || {
      type: 'address',
      address: '서울시 강남구',
      coordinates: { lat: 37.4979, lng: 127.0276 } // 기본값: 강남역
    };

    const recalculatedSlots = [];

    for (let i = 0; i < slotsForDate.length; i++) {
      const slot = slotsForDate[i];

      if (!slot.location) {
        // 위치 정보가 없으면 기본 위치 사용
        slot.location = previousLocation;
      }

      // 이전 위치 → 현재 슬롯 위치까지 이동시간 계산
      const travelTime = await dynamicTravelTimeCalculator.calculateTravelTimeBetween(
        previousLocation,
        slot.location,
        room.currentTravelMode || room.confirmedTravelMode || 'transit'
      );

      // 📝 원본 시간 저장 (처음 조정될 때만)
      if (!slot.originalStartTime) {
        slot.originalStartTime = slot.startTime;
        slot.originalEndTime = slot.endTime;
      }

      // ⏰ 이동시간을 고려한 시작/종료 시간 재계산
      const originalStartMinutes = timeToMinutes(slot.originalStartTime);
      const travelStartMinutes = originalStartMinutes - travelTime;

      // 음수 방지 (이동시간이 너무 길면 원본 시간 유지)
      const adjustedStartMinutes = Math.max(0, travelStartMinutes);

      const adjustedStartTime = `${String(Math.floor(adjustedStartMinutes / 60)).padStart(2, '0')}:${String(adjustedStartMinutes % 60).padStart(2, '0')}`;

      // 🔄 시간 업데이트
      slot.startTime = adjustedStartTime;
      slot.adjustedForTravelTime = true;

      recalculatedSlots.push({
        slotId: slot._id,
        originalStartTime: slot.originalStartTime,
        startTime: slot.startTime,
        endTime: slot.endTime,
        travelTimeBefore: travelTime,
        previousLocation: previousLocation.description || previousLocation.address
      });

      previousLocation = slot.location; // 다음 슬롯을 위해 현재 위치 저장
    }

    // 3. 데이터베이스에 저장
    room.markModified('timeSlots');
    await room.save();

    // 4. 재계산 완료 로그
    console.log(`✅ [재계산 완료] ${date.toISOString().split('T')[0]}: ${slotsForDate.length}개 슬롯`);
    recalculatedSlots.forEach((slot, index) => {
      console.log(`  ${index + 1}. ${slot.originalStartTime} → ${slot.startTime}-${slot.endTime}: 이동시간 ${slot.travelTimeBefore}분 (from ${slot.previousLocation})`);
    });

    return {
      recalculatedCount: slotsForDate.length,
      slots: recalculatedSlots
    };

  } catch (error) {
    console.error('❌ 스케줄 재계산 실패:', error);
    throw error;
  }
}

/**
 * 여러 날짜의 스케줄을 한 번에 재계산
 *
 * @param {string} roomId - 방 ID
 * @param {Date[]} dates - 재계산할 날짜 배열
 * @returns {Promise<Object>} 전체 재계산 결과
 */
async function recalculateMultipleDates(roomId, dates) {
  const results = [];

  for (const date of dates) {
    try {
      const result = await recalculateScheduleForDate(roomId, date);
      results.push({
        date,
        success: true,
        ...result
      });
    } catch (error) {
      console.error(`❌ [재계산 실패] ${date}:`, error);
      results.push({
        date,
        success: false,
        error: error.message
      });
    }
  }

  const totalRecalculated = results.reduce((sum, r) => sum + (r.recalculatedCount || 0), 0);
  console.log(`✅ [전체 재계산 완료] ${dates.length}개 날짜, 총 ${totalRecalculated}개 슬롯`);

  return {
    totalDates: dates.length,
    totalRecalculated,
    results
  };
}

module.exports = {
  recalculateScheduleForDate,
  recalculateMultipleDates
};
