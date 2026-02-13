/**
 * distanceSorting.js - 거리 기반 슬롯 정렬 유틸리티
 *
 * 📍 위치: services/travelSchedule/distanceSorting.js
 * 🔗 연결: ../travelScheduleCalculator.js (index.js)
 */

import { toLocalDateString } from './timeUtils';

export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // 지구 반지름 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const sortSlotsByDistance = (slots, owner, memberLocations) => {
  // 🔧 수정: 날짜별로 그룹화 후, 각 날짜 내에서 거리 순서로 정렬

  // 1️⃣ 날짜별로 슬롯 그룹화
  const slotsByDate = {};

  slots.forEach(slot => {
    const dateStr = toLocalDateString(slot.date);
    if (!slotsByDate[dateStr]) {
      slotsByDate[dateStr] = [];
    }
    slotsByDate[dateStr].push(slot);
  });

  // 2️⃣ 각 날짜별로 거리 순서 정렬
  const allSlots = [];

  // 날짜 순서대로 처리
  const sortedDates = Object.keys(slotsByDate).sort((a, b) => {
    return new Date(a).getTime() - new Date(b).getTime();
  });

  for (const dateStr of sortedDates) {
    const dateSlots = slotsByDate[dateStr];

    // 방장 슬롯과 조원 슬롯 분리
    const ownerSlots = [];
    const memberSlots = [];

    dateSlots.forEach(slot => {
      let userId = slot.user;
      if (typeof userId === 'object' && userId !== null) {
        userId = userId._id || userId.id;
      }

      if (userId && userId.toString() === owner._id.toString()) {
        ownerSlots.push(slot);
      } else {
        memberSlots.push(slot);
      }
    });

    // 방장 슬롯은 시간 순서대로 정렬
    ownerSlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // 조원 슬롯을 거리 순서대로 정렬 (Greedy 알고리즘)
    const orderedMembers = [];
    if (memberSlots.length > 0) {
      const remaining = [...memberSlots];

      // 시작 위치: 방장 집
      let currentLat = owner.addressLat;
      let currentLng = owner.addressLng;

      while (remaining.length > 0) {
        let closestIndex = 0;
        let closestDistance = Infinity;

        // 현재 위치에서 가장 가까운 슬롯 찾기
        for (let i = 0; i < remaining.length; i++) {
          const slot = remaining[i];
          let userId = slot.user;
          if (typeof userId === 'object' && userId !== null) {
            userId = userId._id || userId.id;
          }

          const userLocation = memberLocations[userId?.toString()];
          if (!userLocation) {
            continue;
          }

          const distance = calculateDistance(
            currentLat, currentLng,
            userLocation.lat, userLocation.lng
          );

          if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = i;
          }
        }

        const closestSlot = remaining.splice(closestIndex, 1)[0];
        orderedMembers.push(closestSlot);

        // 현재 위치 업데이트
        let userId = closestSlot.user;
        if (typeof userId === 'object' && userId !== null) {
          userId = userId._id || userId.id;
        }

        const userLocation = memberLocations[userId?.toString()];
        if (userLocation) {
          currentLat = userLocation.lat;
          currentLng = userLocation.lng;
        }
      }
    }

    // 방장 슬롯 + 거리 순서로 정렬된 조원 슬롯을 날짜별로 추가
    allSlots.push(...ownerSlots, ...orderedMembers);
  }

  return allSlots;
};
