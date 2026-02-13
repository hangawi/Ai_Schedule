/**
 * slotPlacement.js - 슬롯 배치 알고리즘
 *
 * 📍 위치: services/travelSchedule/slotPlacement.js
 * 🔗 연결: ../travelScheduleCalculator.js (index.js)
 */

import { checkOverlap, checkBlockedTimeConflict } from './conflictUtils';

export const findAvailableSlot = async (mergedSlot, userId, memberPreferences, travelDurationMinutes, activityDurationMinutes, blockedTimes, assignedSlotsByDate, startFromLocation, lastLocationByDate, memberLocation, travelMode, travelModeService, minStartMinutes = 0) => {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const userIdStr = userId.toString();
  const originalDate = new Date(mergedSlot.date);

  // 월-금 순회 (5일간)
  for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
    const targetDate = new Date(originalDate);
    targetDate.setDate(targetDate.getDate() + dayOffset);
    const dateStr = targetDate.toISOString().split('T')[0];
    const dayOfWeek = targetDate.getDay();
    const dayName = dayNames[dayOfWeek];

    // 주말이면 건너뛰기
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const userPrefs = memberPreferences[userIdStr];
    if (!userPrefs) continue;

    // 🔧 수정: 특정 날짜 선호시간 우선, 없으면 요일별 선호시간 사용
    let preferredSlots = [];
    if (userPrefs.byDate && userPrefs.byDate[dateStr] && userPrefs.byDate[dateStr].length > 0) {
      preferredSlots = userPrefs.byDate[dateStr];
    } else if (userPrefs.byDay && userPrefs.byDay[dayName]) {
      preferredSlots = userPrefs.byDay[dayName];
    } else if (userPrefs[dayName]) {
      // 하위 호환성: 구 구조 지원
      preferredSlots = userPrefs[dayName];
    }

    if (preferredSlots.length === 0) continue;

    // 🆕 선호시간 슬롯을 시간 순으로 정렬 (빠른 시간부터 배치)
    preferredSlots.sort((a, b) => a.startMinutes - b.startMinutes);

    // 🆕 해당 날짜의 마지막 위치 확인하여 이동시간 재계산
    let actualTravelMinutes = travelDurationMinutes; // 기본값: 방장 기준

    if (lastLocationByDate && lastLocationByDate[dateStr] && travelModeService) {
      const lastLoc = lastLocationByDate[dateStr];
      try {
        const travelInfo = await travelModeService.calculateTravelTime(
          { lat: lastLoc.location.lat, lng: lastLoc.location.lng },
          { lat: memberLocation.lat, lng: memberLocation.lng },
          travelMode
        );
        actualTravelMinutes = Math.ceil(travelInfo.duration / 60 / 10) * 10;
      } catch (err) {
      }
    }

    // 🆕 같은 날짜에서 최소 시작 시간 확인
    let effectiveMinStart = dayOffset === 0 ? minStartMinutes : 0;

    // 선호시간 슬롯들에 배치 시도
    for (const prefSlot of preferredSlots) {
      // 이동시간 + 수업시간 계산 (재계산된 이동시간 사용)
      const travelStart = Math.max(prefSlot.startMinutes, effectiveMinStart);
      const travelEnd = travelStart + actualTravelMinutes;
      const activityStart = travelEnd;
      const activityEnd = activityStart + activityDurationMinutes;

      // 선호시간 내에 완전히 들어가는지 체크
      if (activityEnd > prefSlot.endMinutes) {
        continue;
      }

      // 금지시간과 겹치는지 체크
      const travelBlockedCheck = checkBlockedTimeConflict(travelStart, travelEnd, blockedTimes);
      const activityBlockedCheck = checkBlockedTimeConflict(activityStart, activityEnd, blockedTimes);

      if (travelBlockedCheck.conflict || activityBlockedCheck.conflict) {
        continue;
      }

      // 이미 배정된 슬롯과 겹치는지 체크
      const travelOverlap = checkOverlap(dateStr, travelStart, travelEnd, assignedSlotsByDate);
      const activityOverlap = checkOverlap(dateStr, activityStart, activityEnd, assignedSlotsByDate);

      if (travelOverlap || activityOverlap) {
        continue;
      }

      // 배치 가능!
      return {
        success: true,
        date: targetDate,
        dateStr: dateStr,
        dayOfWeek: dayOfWeek,
        travelStartMinutes: travelStart,
        travelEndMinutes: travelEnd,
        activityStartMinutes: activityStart,
        activityEndMinutes: activityEnd,
        actualTravelMinutes: actualTravelMinutes,  // 🆕 실제 사용된 이동시간
        isPreferred: true
      };
    }
  }

  // 모든 요일에 배치 불가능
  return { success: false };
};

export const findAvailableSlotsWithSplit = async (mergedSlot, userId, memberPreferences, travelDurationMinutes, totalActivityDurationMinutes, blockedTimes, assignedSlotsByDate, startFromLocation, lastLocationByDate, currentMemberLocation, travelMode, travelModeService, ownerToMemberTravelInfo, minStartMinutes = 0) => {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const userIdStr = userId.toString();
  const originalDate = new Date(mergedSlot.date);

  const blocks = []; // 배치된 블록들
  let remainingActivityMinutes = totalActivityDurationMinutes;
  let lastBlockDate = null; // 마지막 블록의 날짜 추적

  // 월-금 순회
  for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
    if (remainingActivityMinutes <= 0) break;

    const targetDate = new Date(originalDate);
    targetDate.setDate(targetDate.getDate() + dayOffset);
    const dateStr = targetDate.toISOString().split('T')[0];
    const dayOfWeek = targetDate.getDay();
    const dayName = dayNames[dayOfWeek];

    // 주말이면 건너뛰기
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const userPrefs = memberPreferences[userIdStr];
    if (!userPrefs) continue;

    // 🔧 수정: 특정 날짜 선호시간 우선, 없으면 요일별 선호시간 사용
    let preferredSlots = [];
    if (userPrefs.byDate && userPrefs.byDate[dateStr] && userPrefs.byDate[dateStr].length > 0) {
      preferredSlots = userPrefs.byDate[dateStr];
    } else if (userPrefs.byDay && userPrefs.byDay[dayName]) {
      preferredSlots = userPrefs.byDay[dayName];
    } else if (userPrefs[dayName]) {
      // 하위 호환성: 구 구조 지원
      preferredSlots = userPrefs[dayName];
    }

    if (preferredSlots.length === 0) continue;

    // 🆕 선호시간 슬롯을 시간 순으로 정렬 (빠른 시간부터 배치)
    preferredSlots.sort((a, b) => a.startMinutes - b.startMinutes);

    // 선호시간 슬롯들에 배치 시도
    for (const prefSlot of preferredSlots) {
      if (remainingActivityMinutes <= 0) break;

      // 🆕 해당 날짜의 마지막 위치 확인
      const lastLocOnDate = lastLocationByDate[dateStr];
      let actualTravelDuration;
      let fromLocation;
      let fromLocationName;

      // 같은 날짜 내에서는 첫 블록만 이동시간 필요
      const isNewDay = lastBlockDate === null || lastBlockDate !== dateStr;

      if (isNewDay) {
        // 새로운 날짜: 해당 날짜에 이미 배치된 학생이 있으면 그 위치에서 출발
        if (lastLocOnDate && lastLocOnDate.location && lastLocOnDate.endMinutes <= prefSlot.startMinutes) {
          // 🆕 마지막 학생 → 현재 학생 이동시간 실제 계산
          try {
            const lastToCurrentTravel = await travelModeService.calculateTravelTime(
              { lat: lastLocOnDate.location.lat, lng: lastLocOnDate.location.lng },
              { lat: currentMemberLocation.lat, lng: currentMemberLocation.lng },
              travelMode
            );
            actualTravelDuration = Math.ceil(lastToCurrentTravel.duration / 60 / 10) * 10;
            fromLocation = lastLocOnDate.location;
            fromLocationName = lastLocOnDate.location.name || '이전 학생';
          } catch (err) {
            fromLocation = startFromLocation;
            fromLocationName = startFromLocation.name || '방장';
            actualTravelDuration = travelDurationMinutes;
          }
        } else {
          // 해당 날짜 첫 학생: 방장에서 출발
          fromLocation = startFromLocation;
          fromLocationName = startFromLocation.name || '방장';
          actualTravelDuration = travelDurationMinutes;
        }
      } else {
        // 같은 날짜의 다음 블록: 이미 해당 위치에 있음
        actualTravelDuration = 0;
        fromLocation = null;
        fromLocationName = null;
      }

      // 🆕 첫 번째 블록일 때 최소 시작 시간 적용
      const effectiveMinStart = (dayOffset === 0 && blocks.length === 0) ? minStartMinutes : 0;
      const travelStart = Math.max(prefSlot.startMinutes, effectiveMinStart);
      const travelEnd = travelStart + actualTravelDuration;
      const activityStart = travelEnd;

      // 이 슬롯에 배치 가능한 최대 수업시간 계산
      const availableMinutes = prefSlot.endMinutes - activityStart;

      if (availableMinutes <= 0) {
        continue;
      }

      // 실제 배치할 수업시간 (남은 시간과 가능한 시간 중 작은 값)
      const activityDuration = Math.min(remainingActivityMinutes, availableMinutes);
      const activityEnd = activityStart + activityDuration;

      // 금지시간 체크
      const travelBlockedCheck = checkBlockedTimeConflict(travelStart, travelEnd, blockedTimes);
      const activityBlockedCheck = checkBlockedTimeConflict(activityStart, activityEnd, blockedTimes);

      if (travelBlockedCheck.conflict || activityBlockedCheck.conflict) {
        continue;
      }

      // 겹침 체크
      const travelOverlap = checkOverlap(dateStr, travelStart, travelEnd, assignedSlotsByDate);
      const activityOverlap = checkOverlap(dateStr, activityStart, activityEnd, assignedSlotsByDate);

      if (travelOverlap || activityOverlap) {
        continue;
      }
      blocks.push({
        date: targetDate,
        dateStr: dateStr,
        dayOfWeek: dayOfWeek,
        travelStartMinutes: travelStart,
        travelEndMinutes: travelEnd,
        activityStartMinutes: activityStart,
        activityEndMinutes: activityEnd,
        activityDuration: activityDuration,
        travelDuration: actualTravelDuration,
        needsTravel: isNewDay && actualTravelDuration > 0, // 🆕 새 날짜이고 이동시간이 있을 때만
        fromLocation: fromLocation,
        fromLocationName: fromLocationName
      });

      // assignedSlotsByDate에 기록
      if (!assignedSlotsByDate[dateStr]) {
        assignedSlotsByDate[dateStr] = [];
      }
      assignedSlotsByDate[dateStr].push({
        startMinutes: travelStart,
        endMinutes: activityEnd,
        userId: userIdStr
      });

      remainingActivityMinutes -= activityDuration;
      lastBlockDate = dateStr; // 마지막 블록 날짜 업데이트
    }
  }

  if (remainingActivityMinutes > 0) {
    return { success: false, remainingMinutes: remainingActivityMinutes };
  }
  return { success: true, blocks: blocks };
};
