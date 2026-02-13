/**
 * validationUtils.js - 도보 모드 유효성 검증
 *
 * 📍 위치: services/travelSchedule/validationUtils.js
 * 🔗 연결: ../travelScheduleCalculator.js (index.js)
 */

import travelModeService from '../travelModeService';
import { mergeConsecutiveTimeSlots } from '../../utils/timetableHelpers';
import { toLocalDateString } from './timeUtils';

export const validateWalkingMode = async (currentRoom) => {
  if (!currentRoom || !currentRoom.timeSlots || currentRoom.timeSlots.length === 0) {
    return { isValid: false, message: '시간표 데이터가 없습니다.' };
  }

  const owner = currentRoom.owner;
  if (!owner || !owner.addressLat || !owner.addressLng) {
    return { isValid: false, message: '방장의 주소 정보가 필요합니다.' };
  }

  const memberLocations = {};
  for (const member of currentRoom.members || []) {
    if (member.user && member.user.addressLat && member.user.addressLng) {
      const userId = member.user._id || member.user.id;
      if (userId) {
        memberLocations[userId.toString()] = {
          lat: member.user.addressLat,
          lng: member.user.addressLng,
          name: `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim() || '사용자'
        };
      }
    }
  }

  const mergedSlots = mergeConsecutiveTimeSlots(currentRoom.timeSlots);
  const sortedMergedSlots = mergedSlots.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    if (dateA.getTime() !== dateB.getTime()) {
      return dateA.getTime() - dateB.getTime();
    }
    return a.startTime.localeCompare(b.startTime);
  });

  let previousLocation = {
    lat: owner.addressLat,
    lng: owner.addressLng,
    name: '방장'
  };

  let currentDate = null;

  // 모든 경로 검증
  for (const mergedSlot of sortedMergedSlots) {
    const slotDate = toLocalDateString(mergedSlot.date);
    if (slotDate !== currentDate) {
      currentDate = slotDate;
      previousLocation = {
        lat: owner.addressLat,
        lng: owner.addressLng,
        name: '방장'
      };
    }

    let userId = mergedSlot.user;
    if (typeof userId === 'object' && userId !== null) {
      userId = userId._id || userId.id;
    }
    if (!userId) continue;

    const userIdStr = userId.toString();
    const memberLocation = memberLocations[userIdStr];
    if (!memberLocation) continue;

    try {
      const travelInfo = await travelModeService.calculateTravelTime(
        { lat: previousLocation.lat, lng: previousLocation.lng },
        { lat: memberLocation.lat, lng: memberLocation.lng },
        'walking'
      );

      const travelDurationSeconds = travelInfo.duration || 0;
      const travelDurationMinutes = Math.ceil(travelDurationSeconds / 60);

      if (travelDurationMinutes > 60) {
        return {
          isValid: false,
          message: `도보 이동 시간이 1시간을 초과하여 차단되었습니다.
${previousLocation.name} → ${memberLocation.name}: ${travelDurationMinutes}분`
        };
      }

      previousLocation = memberLocation;
    } catch (error) {
      // 검증 중 오류는 통과시킴 (실제 계산에서 처리)
    }
  }

  return { isValid: true, message: '도보 모드 사용 가능' };
};
