/**
 * memberUtils.js - 멤버 선호시간 관련 유틸리티
 *
 * 📍 위치: services/travelSchedule/memberUtils.js
 * 🔗 연결: ../travelScheduleCalculator.js (index.js)
 */

import { parseTime, toLocalDateString } from './timeUtils';

export const mergeOverlappingSlots = (slots) => {
  if (!slots || slots.length === 0) return [];

  // 시작 시간 순으로 정렬
  const sorted = [...slots].sort((a, b) => a.startMinutes - b.startMinutes);

  const merged = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    // 현재 슬롯이 마지막 병합 슬롯과 겹치거나 연속되면 병합
    if (current.startMinutes <= last.endMinutes) {
      last.endMinutes = Math.max(last.endMinutes, current.endMinutes);
    } else {
      merged.push(current);
    }
  }

  return merged;
};

export const buildMemberPreferences = (currentRoom) => {
  const memberPreferences = {};
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  if (!currentRoom) {
    return memberPreferences;
  }

  // 🆕 방장과 멤버 모두 포함
  const allUsers = [];

  // 방장 추가
  if (currentRoom.owner && currentRoom.owner._id) {
    allUsers.push({ user: currentRoom.owner, isOwner: true });
  }

  // 멤버들 추가
  if (currentRoom.members) {
    for (const member of currentRoom.members) {
      allUsers.push({ user: member.user, isOwner: false });
    }
  }

  for (const { user, isOwner } of allUsers) {
    if (!user || !user._id) continue;

    const userId = (user._id || user.id).toString();
    memberPreferences[userId] = {
      byDay: {
        sunday: [],
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: []
      },
      byDate: {} // 특정 날짜별 선호시간 (예: '2025-12-29': [...])
    };

    // defaultSchedule이 있으면 사용, 없으면 기본값
    const defaultSchedule = user.defaultSchedule || [];

    if (defaultSchedule.length === 0) {
      // 기본값: 월-금 09:00-17:00
      for (let day = 1; day <= 5; day++) {
        memberPreferences[userId].byDay[dayNames[day]].push({
          startMinutes: 9 * 60,    // 09:00
          endMinutes: 17 * 60      // 17:00
        });
      }
    } else {
      // defaultSchedule을 요일별 / 날짜별로 정리 (priority >= 2만 선호시간으로 간주)
      for (const schedule of defaultSchedule) {
        // 🔧 수정: priority가 2 이상인 것만 선호시간으로 간주 (서버와 동일한 로직)
        if (schedule.priority < 2) continue;

        // 🔧 수정: specificDate가 있으면 날짜별로 저장
        if (schedule.specificDate) {
          // 🔧 수정: 시간대 문제 방지 - 헬퍼 함수 사용
          const dateStr = toLocalDateString(schedule.specificDate);
          if (!memberPreferences[userId].byDate[dateStr]) {
            memberPreferences[userId].byDate[dateStr] = [];
          }
          memberPreferences[userId].byDate[dateStr].push({
            startMinutes: parseTime(schedule.startTime),
            endMinutes: parseTime(schedule.endTime)
          });
        } else {
          // specificDate가 없으면 요일별로 저장
          const dayOfWeek = schedule.dayOfWeek; // 0-6 (일-토)
          const dayName = dayNames[dayOfWeek];

          memberPreferences[userId].byDay[dayName].push({
            startMinutes: parseTime(schedule.startTime),
            endMinutes: parseTime(schedule.endTime)
          });
        }
      }

      // 🆕 각 요일의 슬롯들을 병합 (10분 단위로 나눈 슬롯들을 하나로 합침)
      for (const dayName of dayNames) {
        memberPreferences[userId].byDay[dayName] = mergeOverlappingSlots(memberPreferences[userId].byDay[dayName]);
      }

      // 🆕 각 날짜의 슬롯들도 병합
      for (const dateStr in memberPreferences[userId].byDate) {
        memberPreferences[userId].byDate[dateStr] = mergeOverlappingSlots(memberPreferences[userId].byDate[dateStr]);
      }
    }
  }



  return memberPreferences;
};

export const isWithinPreferredTime = (userId, dayOfWeek, startMinutes, endMinutes, memberPreferences, dateStr = null) => {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[dayOfWeek];

  const userIdStr = userId.toString();
  const userPrefs = memberPreferences[userIdStr];

  if (!userPrefs) {
    return false; // 선호시간 없음
  }

  // 🔧 수정: 특정 날짜가 있으면 먼저 byDate 확인
  if (dateStr && userPrefs.byDate && userPrefs.byDate[dateStr] && userPrefs.byDate[dateStr].length > 0) {
    // 특정 날짜의 선호시간이 있으면 그것만 사용
    for (const pref of userPrefs.byDate[dateStr]) {
      if (startMinutes >= pref.startMinutes && endMinutes <= pref.endMinutes) {
        return true;
      }
    }
    return false; // 특정 날짜 선호시간이 있지만 범위를 벗어남
  }

  // 🔧 수정: byDay 구조 확인
  const dayPrefs = userPrefs.byDay ? userPrefs.byDay[dayName] : userPrefs[dayName];
  if (!dayPrefs || dayPrefs.length === 0) {
    return false; // 선호시간 없음
  }

  // 모든 선호시간 슬롯 중 하나라도 완전히 포함되면 true
  for (const pref of dayPrefs) {
    if (startMinutes >= pref.startMinutes && endMinutes <= pref.endMinutes) {
      return true;
    }
  }

  return false;
};
