/**
 * simulationUtils.js - 시간 슬롯 배치 시뮬레이션 및 금지시간 관리
 *
 * 📍 위치: services/travelSchedule/simulationUtils.js
 * 🔗 연결: ../travelScheduleCalculator.js (index.js)
 */

import travelModeService from '../travelModeService';
import { formatTime, parseTime, toLocalDateString } from './timeUtils';

export const simulateTimeSlotPlacement = async (currentRoom, userId, selectedDate, selectedStartMinutes, duration, travelMode = 'normal') => {

  // 1. 기본 검증
  if (!currentRoom || !currentRoom.owner) {
    return { canPlace: false, reason: '방 정보가 없습니다.' };
  }

  const owner = currentRoom.owner;
  if (!owner.addressLat || !owner.addressLng) {
    return { canPlace: false, reason: '방장 주소 정보가 없습니다.' };
  }

  // 2. 조원 위치 정보 가져오기
  const memberLocations = {};
  for (const member of currentRoom.members || []) {
    if (member.user && member.user.addressLat && member.user.addressLng) {
      const memberId = (member.user._id || member.user.id).toString();
      memberLocations[memberId] = {
        lat: member.user.addressLat,
        lng: member.user.addressLng,
        name: `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim()
      };
    }
  }

  const userIdStr = userId.toString();
  const memberLocation = memberLocations[userIdStr];
  if (!memberLocation) {
    return { canPlace: false, reason: '조원 위치 정보가 없습니다.' };
  }

  // 3. 해당 날짜의 기존 배정 확인
  const timeSlots = currentRoom.timeSlots || [];
  const slotsOnDate = timeSlots.filter(slot => {
    const slotDate = toLocalDateString(slot.date);
    return slotDate === selectedDate;
  });

  // 4. 마지막 배정된 학생 찾기 (선택한 시작 시간보다 먼저 끝나는 슬롯 중 가장 늦게 끝나는 것)
  let previousLocation = {
    lat: owner.addressLat,
    lng: owner.addressLng,
    name: '방장'
  };
  let previousEndMinutes = 0;

  for (const slot of slotsOnDate) {
    const slotStartMinutes = parseTime(slot.startTime);
    const slotEndMinutes = parseTime(slot.endTime);

    // 선택한 시작 시간보다 먼저 끝나는 슬롯만
    if (slotEndMinutes <= selectedStartMinutes && slotEndMinutes > previousEndMinutes) {
      let slotUserId = slot.user;
      if (typeof slotUserId === 'object' && slotUserId !== null) {
        slotUserId = slotUserId._id || slotUserId.id;
      }

      if (slotUserId) {
        const slotUserIdStr = slotUserId.toString();

        // 방장이면
        if (slotUserIdStr === owner._id.toString()) {
          previousLocation = {
            lat: owner.addressLat,
            lng: owner.addressLng,
            name: '방장'
          };
        } else if (memberLocations[slotUserIdStr]) {
          previousLocation = memberLocations[slotUserIdStr];
        }

        previousEndMinutes = slotEndMinutes;
      }
    }
  }
  // 5. 이동시간 계산
  let travelDurationMinutes = 0;
  if (travelMode !== 'normal') {
    try {
      const travelInfo = await travelModeService.calculateTravelTime(
        { lat: previousLocation.lat, lng: previousLocation.lng },
        { lat: memberLocation.lat, lng: memberLocation.lng },
        travelMode
      );
      travelDurationMinutes = Math.ceil(travelInfo.duration / 60 / 10) * 10;
    } catch (error) {
      return { canPlace: false, reason: '이동시간 계산 실패' };
    }
  }

  // 6. 시간 계산 (서버 로직과 동일하게!)
  let travelStartMinutes, travelEndMinutes, activityStartMinutes, activityEndMinutes;

  if (previousEndMinutes === 0) {
    // 🔵 첫 번째 슬롯: 원래 시간 유지, 이동시간 역산
    travelStartMinutes = selectedStartMinutes - travelDurationMinutes;
    travelEndMinutes = selectedStartMinutes;
    activityStartMinutes = selectedStartMinutes;
    activityEndMinutes = selectedStartMinutes + duration;
  } else {
    // 🔵 이전 슬롯이 있음: 이전 종료 시간부터 연속 배치
    travelStartMinutes = previousEndMinutes;
    travelEndMinutes = travelStartMinutes + travelDurationMinutes;
    activityStartMinutes = travelEndMinutes;
    activityEndMinutes = activityStartMinutes + duration;
  }

  // 7. 금지시간 체크
  const blockedTimes = currentRoom.settings?.blockedTimes || [];
  const conflicts = [];

  for (const blocked of blockedTimes) {
    const blockedStart = parseTime(blocked.startTime);
    const blockedEnd = parseTime(blocked.endTime);

    const travelOverlap = travelStartMinutes < blockedEnd && travelEndMinutes > blockedStart;
    const activityOverlap = activityStartMinutes < blockedEnd && activityEndMinutes > blockedStart;

    if (travelOverlap || activityOverlap) {
      conflicts.push({
        type: 'blocked',
        name: blocked.name,
        time: `${blocked.startTime}-${blocked.endTime}`
      });
    }
  }

  // 8. 다른 배정과 겹침 체크
  for (const slot of slotsOnDate) {
    const slotStartMinutes = parseTime(slot.startTime);
    const slotEndMinutes = parseTime(slot.endTime);

    const travelOverlap = travelStartMinutes < slotEndMinutes && travelEndMinutes > slotStartMinutes;
    const activityOverlap = activityStartMinutes < slotEndMinutes && activityEndMinutes > slotStartMinutes;

    if (travelOverlap || activityOverlap) {
      let slotUserId = slot.user;
      if (typeof slotUserId === 'object' && slotUserId !== null) {
        slotUserId = slotUserId._id || slotUserId.id;
      }

      conflicts.push({
        type: 'overlap',
        user: slotUserId,
        time: `${slot.startTime}-${slot.endTime}`,
        subject: slot.subject
      });
    }
  }

  const canPlace = conflicts.length === 0;

  return {
    canPlace,
    travelTime: travelDurationMinutes,
    from: previousLocation.name,
    to: memberLocation.name,
    travelStart: formatTime(travelStartMinutes),
    travelEnd: formatTime(travelEndMinutes),
    activityStart: formatTime(activityStartMinutes),
    activityEnd: formatTime(activityEndMinutes),
    conflicts,
    blockedSlots: [
      // 이동시간 구간
      ...(travelDurationMinutes > 0 ? [{
        startTime: formatTime(travelStartMinutes),
        endTime: formatTime(travelEndMinutes),
        type: 'travel',
        hidden: true // 조원에게는 이유를 숨김
      }] : []),
      // 수업시간 구간
      {
        startTime: formatTime(activityStartMinutes),
        endTime: formatTime(activityEndMinutes),
        type: 'activity'
      }
    ]
  };
};

export const getBlockedTimesForMember = async (currentRoom, userId, selectedDate, travelMode = 'normal') => {

  const blockedSlots = [];

  // 1. 방 금지시간 추가
  const blockedTimes = currentRoom.settings?.blockedTimes || [];
  for (const blocked of blockedTimes) {
    blockedSlots.push({
      startTime: blocked.startTime,
      endTime: blocked.endTime,
      type: 'blocked',
      reason: blocked.name
    });
  }

  // 2. 해당 날짜의 기존 배정 추가
  const timeSlots = currentRoom.timeSlots || [];
  const slotsOnDate = timeSlots.filter(slot => {
    const slotDate = toLocalDateString(slot.date);
    return slotDate === selectedDate;
  });

  for (const slot of slotsOnDate) {
    let slotUserId = slot.user;
    if (typeof slotUserId === 'object' && slotUserId !== null) {
      slotUserId = slotUserId._id || slotUserId.id;
    }

    // 자신의 슬롯이 아닌 경우만 추가
    if (slotUserId && slotUserId.toString() !== userId.toString()) {
      blockedSlots.push({
        startTime: slot.startTime,
        endTime: slot.endTime,
        type: 'occupied',
        reason: '다른 학생 배정됨' // 조원에게는 보여지지 않음
      });
    }
  }
  return blockedSlots;
};

export const getAvailableTimesForMember = async (currentRoom, userId, selectedDate, duration, travelMode = 'normal') => {

  const availableSlots = [];
  const blockedSlots = [];

  // 1. 금지 시간대 가져오기
  const baseBlockedTimes = await getBlockedTimesForMember(currentRoom, userId, selectedDate, travelMode);

  // 2. 09:00 ~ 18:00 범위에서 10분 단위로 체크
  const startHour = 9;
  const endHour = 18;

  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 10) {
      const timeMinutes = hour * 60 + minute;

      // 해당 시간에 배치 가능한지 시뮬레이션
      const result = await simulateTimeSlotPlacement(
        currentRoom,
        userId,
        selectedDate,
        timeMinutes,
        duration,
        travelMode
      );

      if (result.canPlace) {
        availableSlots.push({
          startTime: formatTime(timeMinutes),
          endTime: formatTime(timeMinutes + 10),
          actualActivityStart: result.activityStart,
          actualActivityEnd: result.activityEnd,
          travelTime: result.travelTime,
          from: result.from
        });
      } else {
        // 배치 불가능한 시간은 blockedSlots에 추가
        blockedSlots.push({
          startTime: formatTime(timeMinutes),
          endTime: formatTime(timeMinutes + 10),
          hidden: true // 조원에게는 이유를 숨김
        });
      }
    }
  }
  return {
    availableSlots,
    blockedSlots: [...baseBlockedTimes, ...blockedSlots]
  };
};
