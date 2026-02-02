/**
 * ===================================================================================================
 * travelScheduleCalculator.js - 기존 자동 배정 결과에 이동 시간을 추가하여 새로운 스케줄을 재계산하고 검증하는 서비스
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/services/travelScheduleCalculator.js
 *
 * 🎯 주요 기능:
 *    - 분 단위를 시간 문자열로 변환 (`formatTime`).
 *    - 시간 문자열을 분 단위로 변환 (`parseTime`).
 *    - 하나의 스케줄 블록을 10분 단위 슬롯으로 분할 (`unmergeBlock`).
 *    - 도보 이동 모드의 유효성 검증 (경로의 1시간 초과 여부 확인) (`validateWalkingMode`).
 *    - 기존 시간표에 이동 시간을 반영하여 스케줄 재계산 (`recalculateScheduleWithTravel`).
 *    - 이동 시간과 활동 시간을 결합하여 새로운 스케줄을 생성.
 *
 * 🔗 연결된 파일:
 *    - ./travelModeService.js: 실제 이동 시간 계산을 위해 `travelModeService` 사용.
 *    - ../utils/timetableHelpers.js: 연속된 시간 슬롯을 병합하기 위해 `mergeConsecutiveTimeSlots` 사용.
 *
 * 💡 UI 위치:
 *    - '일정 맞추기' 탭 (`CoordinationTab`)에서 이동 수단을 선택하거나, 자동 배정된 스케줄에 이동 시간을 시각적으로 반영할 때 백그라운드에서 동작.
 *
 * ✏️ 수정 가이드:
 *    - 시간 포맷팅 또는 파싱 로직 변경 시: `formatTime`, `parseTime` 함수를 수정.
 *    - 스케줄 블록 분할 단위를 변경할 경우: `unmergeBlock` 함수의 로직을 수정.
 *    - 도보 모드 유효성 검증 기준을 변경할 경우: `validateWalkingMode` 함수의 `travelDurationMinutes > 60` 조건을 수정.
 *    - 이동 시간 재계산 로직(특히 이전 활동 종료 시간, 금지 시간 처리, 슬롯 병합 및 분할 로직)을 변경할 경우: `recalculateScheduleWithTravel` 함수 내부 로직을 수정.
 *
 * 📝 참고사항:
 *    - `recalculateScheduleWithTravel`은 자동 배정된 시간표를 10분 단위로 잘게 나누고, 각 이동 구간에 소요되는 시간을 계산하여 스케줄에 반영함.
 *    - 금지 시간(blockedTimes)을 고려하여 이동 시간 및 활동 시간이 겹치지 않도록 조정하는 로직이 포함됨.
 *    - 콘솔 로그(`console.log`)를 통해 상세한 계산 과정을 디버깅할 수 있도록 구현되어 있음.
 *
 * ===================================================================================================
 */

import travelModeService from './travelModeService';
import { mergeConsecutiveTimeSlots } from '../utils/timetableHelpers';

/**
 * TravelScheduleCalculator
 * @description 기존 자동 배정 결과에 이동 시간을 추가하여 새로운 스케줄을 재계산하고 검증하는 서비스 클래스.
 */
class TravelScheduleCalculator {

  /**
   * formatTime
   * @description 분 단위의 시간을 HH:MM 형식의 시간 문자열로 변환합니다.
   * @param {number} minutes - 변환할 시간 (분 단위).
   * @returns {string} HH:MM 형식의 시간 문자열.
   */
  formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  /**
   * parseTime
   * @description HH:MM 형식의 시간 문자열을 분 단위 정수로 변환합니다.
   * @param {string} timeString - HH:MM 형식의 시간 문자열.
   * @returns {number} 분 단위 정수 (00:00은 0, 01:00은 60). 유효하지 않은 문자열일 경우 0을 반환.
   */
  parseTime(timeString) {
    if (!timeString || !timeString.includes(':')) {
      return 0;
    }
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * toLocalDateString
   * @description Date 객체 또는 문자열을 YYYY-MM-DD 형식으로 변환 (시간대 문제 방지)
   * @param {Date|string} date - 변환할 날짜
   * @returns {string} YYYY-MM-DD 형식 문자열
   */
  toLocalDateString(date) {
    // 이미 YYYY-MM-DD 형식이면 그대로 반환
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return date;
    }

    // Date 객체로 변환 후 로컬 날짜 사용 (UTC 변환 시 시간대 문제 방지)
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * unmergeBlock
   * @description 병합된 스케줄 블록을 10분 단위의 개별 슬롯으로 분할합니다.
   * @param {Object} block - 병합된 스케줄 블록 객체 ({startTime, endTime, ...}).
   * @returns {Array<Object>} 10분 단위로 분할된 슬롯 배열.
   */
  unmergeBlock(block) {
      const slots = [];
      const startMinutes = this.parseTime(block.startTime);
      const endMinutes = this.parseTime(block.endTime);

      // 🔧 버그 수정: block에서 startTime/endTime 제외하고 나머지 속성만 추출
      const { startTime: _st, endTime: _et, originalSlots, isMerged, ...baseProps } = block;

      for (let m = startMinutes; m < endMinutes; m += 10) {
          // 완전히 새로운 객체 생성 (참조 공유 방지)
          const calculatedStart = this.formatTime(m);
          const calculatedEnd = this.formatTime(m + 10);

          const newSlot = {
              ...baseProps,
              startTime: calculatedStart,
              endTime: calculatedEnd
          };

          slots.push(newSlot);
      }
      return slots;
  }

  /**
   * validateWalkingMode
   * @description 도보 이동 모드의 유효성을 검증합니다. 특히 경로에 1시간을 초과하는 도보 이동이 있는지 확인합니다.
   * @param {Object} currentRoom - 현재 방 데이터 (owner, members, timeSlots 포함).
   * @returns {Promise<Object>} { isValid: boolean, message: string }. 도보 이동이 1시간을 초과하는 경로가 있으면 `isValid: false`를 반환.
   */
  async validateWalkingMode(currentRoom) {
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
      const slotDate = this.toLocalDateString(mergedSlot.date);
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
  }

  /**
   * buildMemberPreferences
   * @description 학생별 선호시간 정보를 요일별로 정리합니다.
   * @param {Object} currentRoom - 현재 방 데이터 (members 포함)
   * @returns {Object} 학생별 요일별 선호시간 객체
   */
  buildMemberPreferences(currentRoom) {
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
            const dateStr = this.toLocalDateString(schedule.specificDate);
            if (!memberPreferences[userId].byDate[dateStr]) {
              memberPreferences[userId].byDate[dateStr] = [];
            }
            memberPreferences[userId].byDate[dateStr].push({
              startMinutes: this.parseTime(schedule.startTime),
              endMinutes: this.parseTime(schedule.endTime)
            });
          } else {
            // specificDate가 없으면 요일별로 저장
            const dayOfWeek = schedule.dayOfWeek; // 0-6 (일-토)
            const dayName = dayNames[dayOfWeek];

            memberPreferences[userId].byDay[dayName].push({
              startMinutes: this.parseTime(schedule.startTime),
              endMinutes: this.parseTime(schedule.endTime)
            });
          }
        }

        // 🆕 각 요일의 슬롯들을 병합 (10분 단위로 나뉜 슬롯들을 하나로 합침)
        for (const dayName of dayNames) {
          memberPreferences[userId].byDay[dayName] = this.mergeOverlappingSlots(memberPreferences[userId].byDay[dayName]);
        }

        // 🆕 각 날짜의 슬롯들도 병합
        for (const dateStr in memberPreferences[userId].byDate) {
          memberPreferences[userId].byDate[dateStr] = this.mergeOverlappingSlots(memberPreferences[userId].byDate[dateStr]);
        }
      }
    }



    return memberPreferences;
  }

  /**
   * mergeOverlappingSlots
   * @description 겹치거나 연속된 선호시간 슬롯들을 병합합니다.
   * @param {Array} slots - 선호시간 슬롯 배열
   * @returns {Array} 병합된 슬롯 배열
   */
  mergeOverlappingSlots(slots) {
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
  }

  /**
   * isWithinPreferredTime
   * @description 특정 시간이 학생의 선호시간 내인지 확인합니다.
   * @param {String} userId - 학생 ID
   * @param {Number} dayOfWeek - 요일 (0-6: 일-토)
   * @param {Number} startMinutes - 시작 시간 (분)
   * @param {Number} endMinutes - 종료 시간 (분)
   * @param {Object} memberPreferences - 학생별 선호시간 객체
   * @param {String} dateStr - 날짜 문자열 (YYYY-MM-DD) - 선택 사항
   * @returns {Boolean} 선호시간 내이면 true, 아니면 false
   */
  isWithinPreferredTime(userId, dayOfWeek, startMinutes, endMinutes, memberPreferences, dateStr = null) {
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
  }

  /**
   * checkOverlap
   * @description 특정 시간이 이미 배정된 슬롯과 겹치는지 확인합니다.
   * @param {String} date - 날짜 문자열 ("YYYY-MM-DD")
   * @param {Number} startMinutes - 시작 시간 (분)
   * @param {Number} endMinutes - 종료 시간 (분)
   * @param {Object} assignedSlotsByDate - 날짜별 배정된 슬롯
   * @returns {Boolean} 겹치면 true, 안 겹치면 false
   */
  checkOverlap(date, startMinutes, endMinutes, assignedSlotsByDate) {
    const slotsOnDate = assignedSlotsByDate[date] || [];

    for (const slot of slotsOnDate) {
      // 시간이 겹치는지 체크
      if (startMinutes < slot.endMinutes && endMinutes > slot.startMinutes) {
        return true; // 겹침
      }
    }

    return false; // 겹치지 않음
  }

  /**
   * checkBlockedTimeConflict
   * @description 특정 시간이 금지시간과 겹치는지 확인합니다.
   * @param {Number} startMinutes - 시작 시간 (분)
   * @param {Number} endMinutes - 종료 시간 (분)
   * @param {Array} blockedTimes - 금지시간 배열
   * @returns {Object} { conflict: boolean, blockedTime: {...} }
   */
  checkBlockedTimeConflict(startMinutes, endMinutes, blockedTimes) {
    for (const blocked of blockedTimes) {
      const blockedStart = this.parseTime(blocked.startTime);
      const blockedEnd = this.parseTime(blocked.endTime);

      // 겹침 체크
      if (startMinutes < blockedEnd && endMinutes > blockedStart) {
        return { conflict: true, blockedTime: blocked };
      }
    }

    return { conflict: false };
  }

  /**
   * findAvailableSlot
   * @description 다른 요일에서 배치 가능한 시간을 찾습니다.
   * @param {Object} mergedSlot - 원본 슬롯
   * @param {String} userId - 학생 ID
   * @param {Object} memberPreferences - 학생별 선호시간
   * @param {Number} travelDurationMinutes - 이동시간 (분)
   * @param {Number} activityDurationMinutes - 수업시간 (분)
   * @param {Array} blockedTimes - 금지시간 배열
   * @param {Object} assignedSlotsByDate - 날짜별 배정 슬롯
   * @param {Object} startFromLocation - 시작 위치 (방장)
   * @returns {Object} { success: boolean, date, dayOfWeek, ... }
   */
  async findAvailableSlot(mergedSlot, userId, memberPreferences, travelDurationMinutes, activityDurationMinutes, blockedTimes, assignedSlotsByDate, startFromLocation, lastLocationByDate, memberLocation, travelMode, travelModeService, minStartMinutes = 0) {
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
        const travelBlockedCheck = this.checkBlockedTimeConflict(travelStart, travelEnd, blockedTimes);
        const activityBlockedCheck = this.checkBlockedTimeConflict(activityStart, activityEnd, blockedTimes);

        if (travelBlockedCheck.conflict || activityBlockedCheck.conflict) {
          continue;
        }

        // 이미 배정된 슬롯과 겹치는지 체크
        const travelOverlap = this.checkOverlap(dateStr, travelStart, travelEnd, assignedSlotsByDate);
        const activityOverlap = this.checkOverlap(dateStr, activityStart, activityEnd, assignedSlotsByDate);

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
  }

  /**
   * findAvailableSlotsWithSplit
   * @description 수업을 여러 블록으로 나눠서 배치합니다.
   * @param {Object} mergedSlot - 원본 슬롯
   * @param {String} userId - 학생 ID
   * @param {Object} memberPreferences - 학생별 선호시간
   * @param {Number} travelDurationMinutes - 이동시간 (분)
   * @param {Number} totalActivityDurationMinutes - 총 수업시간 (분)
   * @param {Array} blockedTimes - 금지시간 배열
   * @param {Object} assignedSlotsByDate - 날짜별 배정 슬롯
   * @param {Object} startFromLocation - 시작 위치 (방장)
   * @returns {Object} { success: boolean, blocks: [...] }
   */
  async findAvailableSlotsWithSplit(mergedSlot, userId, memberPreferences, travelDurationMinutes, totalActivityDurationMinutes, blockedTimes, assignedSlotsByDate, startFromLocation, lastLocationByDate, currentMemberLocation, travelMode, travelModeService, ownerToMemberTravelInfo, minStartMinutes = 0) {
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
          // 🚨 중요: 마지막 활동이 현재 시작 시간보다 먼저 끝나야 함!
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
        const travelBlockedCheck = this.checkBlockedTimeConflict(travelStart, travelEnd, blockedTimes);
        const activityBlockedCheck = this.checkBlockedTimeConflict(activityStart, activityEnd, blockedTimes);

        if (travelBlockedCheck.conflict || activityBlockedCheck.conflict) {
          continue;
        }

        // 겹침 체크
        const travelOverlap = this.checkOverlap(dateStr, travelStart, travelEnd, assignedSlotsByDate);
        const activityOverlap = this.checkOverlap(dateStr, activityStart, activityEnd, assignedSlotsByDate);

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
  }

  /**
   * simulateTimeSlotPlacement
   * @description 조원이 특정 시간에 배치될 경우 이동시간을 시뮬레이션합니다.
   * @param {Object} currentRoom - 현재 방 데이터
   * @param {String} userId - 조원 ID
   * @param {String} selectedDate - 선택한 날짜 (YYYY-MM-DD)
   * @param {Number} selectedStartMinutes - 선택한 시작 시간 (분)
   * @param {Number} duration - 수업 시간 (분)
   * @param {String} travelMode - 이동 수단
   * @returns {Promise<Object>} { canPlace: boolean, travelTime: number, from: string, conflicts: [] }
   */
  async simulateTimeSlotPlacement(currentRoom, userId, selectedDate, selectedStartMinutes, duration, travelMode = 'normal') {

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
      const slotDate = this.toLocalDateString(slot.date);
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
      const slotStartMinutes = this.parseTime(slot.startTime);
      const slotEndMinutes = this.parseTime(slot.endTime);

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
      const blockedStart = this.parseTime(blocked.startTime);
      const blockedEnd = this.parseTime(blocked.endTime);

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
      const slotStartMinutes = this.parseTime(slot.startTime);
      const slotEndMinutes = this.parseTime(slot.endTime);

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
      travelStart: this.formatTime(travelStartMinutes),
      travelEnd: this.formatTime(travelEndMinutes),
      activityStart: this.formatTime(activityStartMinutes),
      activityEnd: this.formatTime(activityEndMinutes),
      conflicts,
      blockedSlots: [
        // 이동시간 구간
        ...(travelDurationMinutes > 0 ? [{
          startTime: this.formatTime(travelStartMinutes),
          endTime: this.formatTime(travelEndMinutes),
          type: 'travel',
          hidden: true // 조원에게는 이유를 숨김
        }] : []),
        // 수업시간 구간
        {
          startTime: this.formatTime(activityStartMinutes),
          endTime: this.formatTime(activityEndMinutes),
          type: 'activity'
        }
      ]
    };
  }

  /**
   * getBlockedTimesForMember
   * @description 조원에게 보여줄 금지 시간대를 계산합니다 (이동시간 포함, 하지만 이유는 숨김).
   * @param {Object} currentRoom - 현재 방 데이터
   * @param {String} userId - 조원 ID
   * @param {String} selectedDate - 날짜 (YYYY-MM-DD)
   * @param {String} travelMode - 이동 수단
   * @returns {Promise<Array>} 금지 시간대 배열
   */
  async getBlockedTimesForMember(currentRoom, userId, selectedDate, travelMode = 'normal') {

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
      const slotDate = this.toLocalDateString(slot.date);
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
  }

  /**
   * getAvailableTimesForMember
   * @description 조원이 선택 가능한 시간대를 계산합니다.
   * @param {Object} currentRoom - 현재 방 데이터
   * @param {String} userId - 조원 ID
   * @param {String} selectedDate - 날짜 (YYYY-MM-DD)
   * @param {Number} duration - 수업 시간 (분)
   * @param {String} travelMode - 이동 수단
   * @returns {Promise<Object>} { availableSlots: [], blockedSlots: [] }
   */
  async getAvailableTimesForMember(currentRoom, userId, selectedDate, duration, travelMode = 'normal') {

    const availableSlots = [];
    const blockedSlots = [];

    // 1. 금지 시간대 가져오기
    const baseBlockedTimes = await this.getBlockedTimesForMember(currentRoom, userId, selectedDate, travelMode);

    // 2. 09:00 ~ 18:00 범위에서 10분 단위로 체크
    const startHour = 9;
    const endHour = 18;

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 10) {
        const timeMinutes = hour * 60 + minute;

        // 해당 시간에 배치 가능한지 시뮬레이션
        const result = await this.simulateTimeSlotPlacement(
          currentRoom,
          userId,
          selectedDate,
          timeMinutes,
          duration,
          travelMode
        );

        if (result.canPlace) {
          availableSlots.push({
            startTime: this.formatTime(timeMinutes),
            endTime: this.formatTime(timeMinutes + 10),
            actualActivityStart: result.activityStart,
            actualActivityEnd: result.activityEnd,
            travelTime: result.travelTime,
            from: result.from
          });
        } else {
          // 배치 불가능한 시간은 blockedSlots에 추가
          blockedSlots.push({
            startTime: this.formatTime(timeMinutes),
            endTime: this.formatTime(timeMinutes + 10),
            hidden: true // 조원에게는 이유를 숨김
          });
        }
      }
    }
    return {
      availableSlots,
      blockedSlots: [...baseBlockedTimes, ...blockedSlots]
    };
  }

/**
 * sortSlotsByDistance
 * @description 슬롯을 날짜별로 그룹화한 후 거리 순서대로 정렬합니다 (Greedy 알고리즘).
 * @param {Array} slots - 정렬할 슬롯 배열
 * @param {Object} owner - 방장 정보 (addressLat, addressLng 포함)
 * @param {Object} memberLocations - 멤버 위치 정보 객체 { userId: { lat, lng, name, color } }
 * @returns {Array} 거리 순서대로 정렬된 슬롯 배열
 */
  sortSlotsByDistance(slots, owner, memberLocations) {
    // 🔧 수정: 날짜별로 그룹화 후, 각 날짜 내에서 거리 순서로 정렬
    
    // 1️⃣ 날짜별로 슬롯 그룹화
    const slotsByDate = {};
    
    slots.forEach(slot => {
      const dateStr = this.toLocalDateString(slot.date);
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

            const distance = this.calculateDistance(
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
  }

/**
 * calculateDistance
 * @description Haversine 공식을 사용하여 두 지점 간의 거리를 계산합니다 (km).
 * @param {number} lat1 - 시작점 위도
 * @param {number} lng1 - 시작점 경도
 * @param {number} lat2 - 도착점 위도
 * @param {number} lng2 - 도착점 경도
 * @returns {number} 거리 (km)
 */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // 지구 반지름 (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

/**
 * recalculateScheduleWithTravel
 * @description 기존에 자동 배정된 시간표 데이터에 이동 시간을 반영하여 새로운 스케줄을 재계산합니다.
 * @param {Object} currentRoom - 현재 방 데이터 (방장, 멤버, 시간 슬롯 정보 포함).
 * @param {string} travelMode - 적용할 이동 수단 ('normal', 'transit', 'driving', 'bicycling', 'walking').
 * @returns {Promise<Object>} 재계산된 시간표 데이터 ({timeSlots, travelSlots, travelMode}).
 * @throws {Error} 시간표 데이터가 없거나 방장의 주소 정보가 없을 경우 에러 발생.
 */
  async recalculateScheduleWithTravel(currentRoom, travelMode = 'normal') {
    if (!currentRoom || !currentRoom.timeSlots || currentRoom.timeSlots.length === 0) {
        throw new Error('시간표 데이터가 없습니다.');
    }
    if (travelMode === 'normal') {
        return { timeSlots: currentRoom.timeSlots.map(s => ({...s, isTravel: false})), travelSlots: [], travelMode: 'normal' };
    }

    const owner = currentRoom.owner;
    
    if (!owner.addressLat || !owner.addressLng) {
        throw new Error('방장의 주소 정보가 필요합니다. 프로필에서 주소를 설정해주세요.');
    }

    const members = currentRoom.members;
    const memberLocations = {};
    
    members.forEach(m => {
        
        if (m.user && m.user.addressLat && m.user.addressLng) {
            let userId = m.user._id || m.user.id;
            if (userId) {
                memberLocations[userId.toString()] = { 
                    lat: m.user.addressLat, 
                    lng: m.user.addressLng, 
                    name: `${m.user.firstName} ${m.user.lastName}`,
                    color: m.color || '#9CA3AF'
                };
            }
        }
    });

    // 🆕 학생별 선호시간 정보 생성
    const memberPreferences = this.buildMemberPreferences(currentRoom);

    // 🔍 디버깅: 선호시간 정보 출력
    // 1. Merge raw slots into activity blocks
    const mergedSlots = mergeConsecutiveTimeSlots(currentRoom.timeSlots);

    // 🆕 이동 모드에 따라 정렬 방식 결정
    let sortedMergedSlots;

    if (travelMode === 'normal') {
        // 일반 모드: 시간 순서대로만 정렬
        sortedMergedSlots = mergedSlots.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            if (dateA.getTime() !== dateB.getTime()) {
                return dateA.getTime() - dateB.getTime();
            }
            return a.startTime.localeCompare(b.startTime);
        });
    } else {
        // 이동 모드 (대중교통, 자동차 등): 날짜별로 거리 순서대로 정렬
        sortedMergedSlots = this.sortSlotsByDistance(mergedSlots, owner, memberLocations);

        // 🔍 디버깅: 거리 순서 출력
    }

    // 🆕 이동시간 슬롯을 저장할 배열 추가
    const travelSlotsArray = [];
    
    // 🆕 이전 위치 추적 (초기값: 방장)
    let previousLocation = {
        lat: owner.addressLat,
        lng: owner.addressLng,
        name: '방장',
        color: '#4B5563'  // 방장은 기본 회색
    };

    const allResultSlots = [];

    // 🆕 날짜별로 배정된 슬롯 추적 (겹침 방지)
    const assignedSlotsByDate = {};

    // 🆕 각 날짜별 마지막 위치 추적 (재배정 시 사용)
    const lastLocationByDate = {};
    
    // 🆕 방장의 스케줄을 assignedSlotsByDate에 미리 추가 (학생들이 방장 시간에 배치되지 않도록)
    const ownerIdStr = owner._id.toString();
    for (const mergedSlot of sortedMergedSlots) {
        let userId = mergedSlot.user;
        if (typeof userId === 'object' && userId !== null) {
            userId = userId._id || userId.id;
        }
        
        if (userId && userId.toString() === ownerIdStr) {
            // 방장의 슬롯
            const slotDate = this.toLocalDateString(mergedSlot.date);
            if (!assignedSlotsByDate[slotDate]) {
                assignedSlotsByDate[slotDate] = [];
            }
            assignedSlotsByDate[slotDate].push({
                startMinutes: this.parseTime(mergedSlot.startTime),
                endMinutes: this.parseTime(mergedSlot.endTime),
                userId: ownerIdStr,
                isOwner: true
            });
        }
    }

    // 🔧 수정: 거리 순서 연속 배치를 위해 날짜 리셋 로직 제거
    // 이전 슬롯 정보 추적
    let previousSlotOriginalDate = null;  // 거리 정렬 순서상 이전 슬롯의 원본 날짜
    let previousActivityEndMinutes = 0;  // 이전 활동 종료 시간 (분)
    let previousUserId = null;  // 이전 슬롯의 사용자 ID
    let previousSlotIndex = -1;  // 거리 정렬 순서 인덱스

    for (let slotIndex = 0; slotIndex < sortedMergedSlots.length; slotIndex++) {
        const mergedSlot = sortedMergedSlots[slotIndex];
        const slotDate = this.toLocalDateString(mergedSlot.date);

        // 🔧 수정: 날짜 리셋 로직 제거 - 거리 순서대로 연속 배치
        let userId = mergedSlot.user;
        if (typeof userId === 'object' && userId !== null) {
            userId = userId._id || userId.id;
        }
        if (!userId) {
            allResultSlots.push(...this.unmergeBlock(mergedSlot));
            continue;
        }

        const userIdStr = userId.toString();
        
        // 🆕 방장의 슬롯은 이동시간 없이 원본 그대로 추가
        if (userIdStr === owner._id.toString()) {
            allResultSlots.push(...this.unmergeBlock(mergedSlot));
            // previousLocation은 업데이트하지 않음 (방장은 이동하지 않음)
            // previousActivityEndMinutes도 업데이트하지 않음
            continue;
        }
        
        const memberLocation = memberLocations[userIdStr];
        if (!memberLocation) {
            allResultSlots.push(...this.unmergeBlock(mergedSlot));
            continue;
        }

        try {
            // 먼저 현재 슬롯의 시간 정보 파싱
            const slotStartMinutes = this.parseTime(mergedSlot.startTime);
            const slotEndMinutes = this.parseTime(mergedSlot.endTime);
            const activityDurationMinutes = slotEndMinutes - slotStartMinutes;
            
            // 🔧 수정: 같은 날짜 내에서는 이전 학생에서 출발, 다른 날짜면 방장에서 출발
            let actualPreviousLocation;

            // 날짜가 바뀌었거나 첫 슬롯이면 방장에서 출발
            if (!previousSlotOriginalDate || previousSlotOriginalDate !== slotDate) {
                actualPreviousLocation = {
                    lat: owner.addressLat,
                    lng: owner.addressLng,
                    name: '방장',
                    color: '#4B5563'
                };

            } else {
                // 같은 날짜면 이전 학생에서 출발
                actualPreviousLocation = previousLocation;

            }

            // 이전 위치에서 현재 학생 위치로 이동 시간 계산
            const travelInfo = await travelModeService.calculateTravelTime(
                { lat: actualPreviousLocation.lat, lng: actualPreviousLocation.lng },
                { lat: memberLocation.lat, lng: memberLocation.lng },
                travelMode
            );

            const travelDurationSeconds = travelInfo.duration || 0;
            const travelDurationMinutes = Math.ceil(travelDurationSeconds / 60 / 10) * 10;

            
            if (travelDurationMinutes === 0) {
                allResultSlots.push(...this.unmergeBlock(mergedSlot));
                // 🔧 수정: previousLocation 업데이트 (같은 날짜 내 연속 이동)
                previousLocation = memberLocation;
                continue;
            }

            // 🔧 수정: 거리 순서로 연속 배치
            let targetDate = slotDate;
            let newActivityStartTimeMinutes, newActivityEndTimeMinutes, newTravelStartMinutes, newTravelEndTimeMinutes;

            // 같은 날짜에 이미 배정된 슬롯이 있는지 확인
            const assignedOnDate = assignedSlotsByDate[slotDate] || [];
            
            // 🔧 수정: 거리 순서상 이전 학생 정보 사용 (assignedSlotsByDate가 아닌 previousActivityEndMinutes 직접 사용)
            let lastAssignedSlot = null;
            if (previousSlotOriginalDate === slotDate && previousUserId && previousActivityEndMinutes > 0) {
                // 이전 학생이 같은 원본 날짜였으면 연속 배치 (재배정 여부 무관)
                lastAssignedSlot = {
                    userId: previousUserId,
                    endMinutes: previousActivityEndMinutes
                };
            }

            // 같은 날짜 내에서 이미 배정된 슬롯이 있으면 연속 배치
            if (previousSlotOriginalDate === slotDate && lastAssignedSlot && lastAssignedSlot.userId !== userIdStr) {
                // 연속 배치: 마지막 배정 종료 시간부터 시작
                newTravelStartMinutes = lastAssignedSlot.endMinutes;
                newTravelEndTimeMinutes = newTravelStartMinutes + travelDurationMinutes;
                newActivityStartTimeMinutes = newTravelEndTimeMinutes;
                newActivityEndTimeMinutes = newActivityStartTimeMinutes + activityDurationMinutes;
                

            } else {
                // 새로운 날짜 또는 첫 슬롯: 원래 시간 기준
                newActivityStartTimeMinutes = slotStartMinutes;
                newActivityEndTimeMinutes = slotEndMinutes;
                newTravelStartMinutes = slotStartMinutes - travelDurationMinutes;
                newTravelEndTimeMinutes = slotStartMinutes;
                

            }




            // 🔒 방 금지시간 체크 - 금지시간을 절대 침범하지 않도록 조정
            // 명시적으로 지정한 금지시간만 사용 (점심시간 등)
            const allBlockedTimes = currentRoom.settings?.blockedTimes || [];

            let canPlace = true;  // 배치 가능 여부 플래그

            for (const blocked of allBlockedTimes) {
                const blockedStart = this.parseTime(blocked.startTime);
                const blockedEnd = this.parseTime(blocked.endTime);

                // 이동시간 또는 활동시간이 금지시간과 겹치는지 체크
                const travelOverlap = newTravelStartMinutes < blockedEnd && newTravelEndTimeMinutes > blockedStart;
                const activityOverlap = newActivityStartTimeMinutes < blockedEnd && newActivityEndTimeMinutes > blockedStart;

                if (travelOverlap || activityOverlap) {
                    canPlace = false;
                    break;
                }
            }

            // 🆕 선호시간 체크 (금지시간 체크 통과 후)
            if (canPlace) {
                // 🔧 수정: targetDate의 요일 사용
                const targetDayOfWeek = new Date(targetDate).getDay();

                // 🔧 수정: 이동시간 시작부터 수업 종료까지 전체가 선호시간 내인지 체크
                const isAdjustedPreferred = this.isWithinPreferredTime(
                    userId,
                    targetDayOfWeek,
                    newTravelStartMinutes,        // 이동시간 시작
                    newActivityEndTimeMinutes,    // 수업 종료
                    memberPreferences,
                    targetDate                    // 날짜 정보 추가
                );

                // 🔧 수정: 선호시간 체크 결과 적용
                if (!isAdjustedPreferred) {
                    canPlace = false;
                    console.log(`❌ [선호시간 벗어남] ${targetDate} ${this.formatTime(newTravelStartMinutes)}-${this.formatTime(newActivityEndTimeMinutes)} (이동+수업) - ${memberLocation.name}`);
                }
            }
            
            // 🔧 추가: 24시간 범위 체크
            if (canPlace && newActivityEndTimeMinutes > 1440) {  // 24:00 = 1440분
                canPlace = false;
                console.log(`❌ [하루 범위 초과] ${targetDate} ${this.formatTime(newActivityEndTimeMinutes)} - ${memberLocation.name}`);
            }
            
            // 🆕 겹침 체크 (선호시간 체크 통과 후)
            if (canPlace) {
                // 🔧 수정: targetDate로 겹침 체크
                const travelOverlap = this.checkOverlap(
                    targetDate,
                    newTravelStartMinutes,
                    newTravelEndTimeMinutes,
                    assignedSlotsByDate
                );

                const activityOverlap = this.checkOverlap(
                    targetDate,
                    newActivityStartTimeMinutes,
                    newActivityEndTimeMinutes,
                    assignedSlotsByDate
                );

                if (travelOverlap || activityOverlap) {
                    console.log(`❌ [겹침 발견] ${targetDate} - ${memberLocation.name}`, {
                        이동시간: `${this.formatTime(newTravelStartMinutes)} - ${this.formatTime(newTravelEndTimeMinutes)}`,
                        수업시간: `${this.formatTime(newActivityStartTimeMinutes)} - ${this.formatTime(newActivityEndTimeMinutes)}`,
                        이동시간겹침: travelOverlap,
                        수업시간겹침: activityOverlap,
                        원래날짜: slotDate,
                        배치날짜: targetDate
                    });
                    canPlace = false;
                }
            }

            // 배치 불가능하면 다른 요일로 재배정 시도
            if (!canPlace) {

                // 🆕 재배정 시 날짜별 이동 출발지 확인 (이미 배치된 학생이 있으면 그 위치에서 출발)
                // 원본 날짜의 마지막 위치를 확인 (재배정은 다른 날짜로 하므로, 각 날짜의 마지막 위치 체크)
                
                // 방장에서 출발하는 이동시간 (기본값)
                const ownerToMemberTravelInfo = await travelModeService.calculateTravelTime(
                    { lat: owner.addressLat, lng: owner.addressLng },
                    { lat: memberLocation.lat, lng: memberLocation.lng },
                    travelMode
                );
                const ownerTravelDurationSeconds = ownerToMemberTravelInfo.duration || 0;
                const ownerTravelDurationMinutes = Math.ceil(ownerTravelDurationSeconds / 60 / 10) * 10;

                
                // 🆕 연속 배치 실패 시 최소 시작 시간 계산
                let minStartTime = 0;
                if (previousSlotOriginalDate === slotDate && lastAssignedSlot && lastAssignedSlot.userId !== userIdStr) {
                    // 연속 배치 실패: 이전 학생 종료 시간 이후로만 재배정
                    minStartTime = lastAssignedSlot.endMinutes;
                    console.log(`🔧 [연속 배치 재배정] ${memberLocation.name}: 최소 시작 시간 ${this.formatTime(minStartTime)} (이전 학생 종료 시간)`);
                }
                
                // 먼저 한 블록으로 배치 시도
                let alternativePlacement = await this.findAvailableSlot(
                    mergedSlot,
                    userId,
                    memberPreferences,
                    ownerTravelDurationMinutes,
                    activityDurationMinutes,
                    allBlockedTimes,
                    assignedSlotsByDate,
                    { lat: owner.addressLat, lng: owner.addressLng, name: '방장' },
                    lastLocationByDate,  // 🆕 각 날짜의 마지막 위치
                    memberLocation,      // 🆕 현재 학생 위치
                    travelMode,          // 🆕 이동 모드
                    travelModeService,   // 🆕 이동시간 계산 서비스
                    minStartTime         // 🆕 최소 시작 시간
                );

                // 한 블록으로 배치 실패 → 여러 블록으로 분할 시도
                if (!alternativePlacement.success) {
                    alternativePlacement = await this.findAvailableSlotsWithSplit(
                        mergedSlot,
                        userId,
                        memberPreferences,
                        ownerTravelDurationMinutes,  // ← 수정: 방장 기준 이동시간
                        activityDurationMinutes,
                        allBlockedTimes,
                        assignedSlotsByDate,
                        { lat: owner.addressLat, lng: owner.addressLng, name: '방장' },
                        lastLocationByDate,  // 🆕 각 날짜의 마지막 위치
                        memberLocation,      // 🆕 현재 학생 위치
                        travelMode,          // 🆕 이동 모드
                        travelModeService,   // 🆕 이동시간 계산 서비스
                        ownerToMemberTravelInfo,  // 🆕 방장→학생 이동시간
                        minStartTime         // 🆕 최소 시작 시간
                    );
                }

                if (alternativePlacement.success && alternativePlacement.blocks) {
                    // 여러 블록으로 분할 배치 성공

                    for (const block of alternativePlacement.blocks) {
                        // 🆕 이동시간이 필요한 블록만 이동시간 블록 생성
                        if (block.needsTravel) {
                            const altTravelBlock = {
                            ...mergedSlot,
                            date: block.date,
                            day: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][block.dayOfWeek],
                            isTravel: true,
                            startTime: this.formatTime(block.travelStartMinutes),
                            endTime: this.formatTime(block.travelEndMinutes),
                            subject: '이동시간',
                            user: userId,
                            color: memberLocation.color,
                            travelInfo: {
                                duration: block.travelDuration * 60, // 분을 초로 변환
                                durationText: `${block.travelDuration}분`,
                                from: block.fromLocationName || '방장',
                                to: memberLocation.name
                            },
                        };

                        const altActivityBlock = {
                            ...mergedSlot,
                            date: block.date,
                            day: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][block.dayOfWeek],
                            isTravel: false,
                            startTime: this.formatTime(block.activityStartMinutes),
                            endTime: this.formatTime(block.activityEndMinutes),
                            subject: `${mergedSlot.subject || '수업'} (${block.activityDuration}분)`,
                            // 🆕 원본 시간 및 이동시간 메타데이터 추가
                            originalStartTime: mergedSlot.originalStartTime || mergedSlot.startTime,
                            originalEndTime: mergedSlot.originalEndTime || mergedSlot.endTime,
                            actualStartTime: this.formatTime(block.travelStartMinutes),
                            travelTimeBefore: block.travelDuration,
                            adjustedForTravelTime: true
                        };

                        // travelSlots 배열에 추가
                            travelSlotsArray.push({
                                date: block.date,
                                startTime: this.formatTime(block.travelStartMinutes),
                                endTime: this.formatTime(block.travelEndMinutes),
                                from: block.fromLocationName || '방장',
                                to: memberLocation.name,
                                user: userId,
                                color: memberLocation.color,
                                travelInfo: {
                                    duration: block.travelDuration * 60, // 분을 초로 변환
                                    durationText: `${block.travelDuration}분`
                                },
                                travelMode: travelMode
                            });

                            // 10분 단위로 분할 후 추가
                            allResultSlots.push(...this.unmergeBlock(altTravelBlock));
                        }

                        // 수업 블록은 항상 추가
                        const altActivityBlock = {
                            ...mergedSlot,
                            date: block.date,
                            day: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][block.dayOfWeek],
                            isTravel: false,
                            startTime: this.formatTime(block.activityStartMinutes),
                            endTime: this.formatTime(block.activityEndMinutes),
                            subject: `${mergedSlot.subject || '수업'} (${block.activityDuration}분)`,
                            // 🆕 원본 시간 및 이동시간 메타데이터 추가
                            originalStartTime: mergedSlot.originalStartTime || mergedSlot.startTime,
                            originalEndTime: mergedSlot.originalEndTime || mergedSlot.endTime,
                            actualStartTime: this.formatTime(block.travelStartMinutes),
                            travelTimeBefore: block.travelDuration,
                            adjustedForTravelTime: true
                        };
                        allResultSlots.push(...this.unmergeBlock(altActivityBlock));
                        
                        // 🆕 해당 날짜의 마지막 위치 업데이트 (더 늦게 끝나는 경우만)
                        const blockDateStr = this.toLocalDateString(block.date);
                        if (!lastLocationByDate[blockDateStr] || block.activityEndMinutes > lastLocationByDate[blockDateStr].endMinutes) {
                            lastLocationByDate[blockDateStr] = {
                                location: memberLocation,
                                endMinutes: block.activityEndMinutes
                            };
                        }
                    }

                    // 🔧 수정: 마지막 블록 정보로 이전 슬롯 정보 업데이트
                    const lastBlock = alternativePlacement.blocks[alternativePlacement.blocks.length - 1];
                    const lastBlockDateStr = new Date(lastBlock.date).toISOString().split('T')[0];
                    previousSlotOriginalDate = slotDate;  // 🔧 거리 순서 유지: 원본 날짜 저장
                    previousActivityEndMinutes = lastBlock.activityEndMinutes;
                    previousUserId = userIdStr;
                    previousSlotIndex = slotIndex;
                    previousLocation = memberLocation;  // 🔧 수정: 같은 날짜 내 연속 이동
                    
                    continue;
                } else if (alternativePlacement.success) {
                    // 다른 요일에 배치 성공
                    
                    // 🔄 실제 이동시간 확인 (findAvailableSlot에서 이미 계산됨)
                    const targetDateStr = alternativePlacement.dateStr;
                    let actualTravelMinutes = alternativePlacement.actualTravelMinutes || ownerTravelDurationMinutes;
                    let actualFromLocationName = '방장';  // 기본값
                    
                    // findAvailableSlot에서 재계산되었는지 확인
                    if (alternativePlacement.actualTravelMinutes && alternativePlacement.actualTravelMinutes !== ownerTravelDurationMinutes) {
                        const lastLocOnTargetDate = lastLocationByDate[targetDateStr];
                        if (lastLocOnTargetDate && lastLocOnTargetDate.location) {
                            actualFromLocationName = lastLocOnTargetDate.location.name;
                        }
                    } else {
                    }
                    
                    // 🔍 추가 확인: assignedSlotsByDate에서 실제 마지막 학생 찾기
                    const assignedSlotsOnTarget = assignedSlotsByDate[targetDateStr] || [];
                    const targetStartMinutes = alternativePlacement.travelStartMinutes || alternativePlacement.activityStartMinutes;
                    
                    // 현재 슬롯보다 먼저 시작하는 슬롯 중 가장 늦게 끝나는 슬롯 찾기
                    const slotsBeforeCurrent = assignedSlotsOnTarget.filter(slot => 
                        slot.startMinutes < targetStartMinutes && slot.endMinutes <= targetStartMinutes
                    );
                    
                    if (slotsBeforeCurrent.length > 0) {
                        const lastSlot = slotsBeforeCurrent.reduce((latest, slot) => 
                            slot.endMinutes > latest.endMinutes ? slot : latest
                        );
                        
                        // 그 슬롯의 사용자 위치 찾기
                        const lastUserId = lastSlot.userId;
                        let actualPreviousLocation;
                        
                        if (lastUserId === owner._id.toString()) {
                            actualPreviousLocation = {
                                lat: owner.addressLat,
                                lng: owner.addressLng,
                                name: '방장'
                            };
                        } else {
                            actualPreviousLocation = memberLocations[lastUserId];
                        }
                        
                        if (actualPreviousLocation) {
                            try {
                                const lastToCurrentTravel = await travelModeService.calculateTravelTime(
                                    { lat: actualPreviousLocation.lat, lng: actualPreviousLocation.lng },
                                    { lat: memberLocation.lat, lng: memberLocation.lng },
                                    travelMode
                                );
                                actualTravelMinutes = Math.ceil(lastToCurrentTravel.duration / 60 / 10) * 10;
                                actualFromLocationName = actualPreviousLocation.name;
                            } catch (err) {
                            }
                        }
                    } else {
                    }

                    // 재배정된 날짜와 시간으로 블록 생성 (실제 계산된 이동시간 사용)
                    const altTravelBlock = {
                        ...mergedSlot,
                        date: alternativePlacement.date,
                        day: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][alternativePlacement.dayOfWeek],
                        isTravel: true,
                        startTime: this.formatTime(alternativePlacement.travelStartMinutes),
                        endTime: this.formatTime(alternativePlacement.travelStartMinutes + actualTravelMinutes),  // ← 실제 이동시간으로 종료 시간 재계산
                        subject: '이동시간',
                        user: userId,
                        color: memberLocation.color,
                        travelInfo: {
                            duration: actualTravelMinutes * 60,  // 분을 초로 변환
                            durationText: `${actualTravelMinutes}분`,
                            from: actualFromLocationName,  // ← 실제 출발지
                            to: memberLocation.name
                        },
                    };

                    // ← 수업 시작/종료 시간도 실제 이동시간에 맞춰 재계산
                    const actualActivityStartMinutes = alternativePlacement.travelStartMinutes + actualTravelMinutes;
                    const actualActivityEndMinutes = actualActivityStartMinutes + activityDurationMinutes;
                    
                    const altActivityBlock = {
                        ...mergedSlot,
                        date: alternativePlacement.date,
                        day: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][alternativePlacement.dayOfWeek],
                        isTravel: false,
                        startTime: this.formatTime(actualActivityStartMinutes),
                        endTime: this.formatTime(actualActivityEndMinutes),
                        subject: mergedSlot.subject || '수업',
                        // 🆕 원본 시간 및 이동시간 메타데이터 추가
                        originalStartTime: mergedSlot.originalStartTime || mergedSlot.startTime,
                        originalEndTime: mergedSlot.originalEndTime || mergedSlot.endTime,
                        actualStartTime: this.formatTime(alternativePlacement.travelStartMinutes),
                        travelTimeBefore: actualTravelMinutes,
                        adjustedForTravelTime: true
                    };

                    // travelSlots 배열에 추가 (실제 계산된 정보 사용)
                    travelSlotsArray.push({
                        date: alternativePlacement.date,
                        startTime: this.formatTime(alternativePlacement.travelStartMinutes),
                        endTime: this.formatTime(alternativePlacement.travelStartMinutes + actualTravelMinutes),  // ← 실제 이동시간
                        from: actualFromLocationName,  // ← 실제 출발지
                        to: memberLocation.name,
                        user: userId,
                        color: memberLocation.color,
                        travelInfo: {
                            duration: actualTravelMinutes * 60,  // 분을 초로 변환
                            durationText: `${actualTravelMinutes}분`
                        },
                        travelMode: travelMode
                    });

                    // 10분 단위로 분할 후 추가
                    allResultSlots.push(...this.unmergeBlock(altTravelBlock), ...this.unmergeBlock(altActivityBlock));

                    // assignedSlotsByDate에 기록 (실제 계산된 시간 사용)
                    if (!assignedSlotsByDate[alternativePlacement.dateStr]) {
                        assignedSlotsByDate[alternativePlacement.dateStr] = [];
                    }
                    assignedSlotsByDate[alternativePlacement.dateStr].push({
                        startMinutes: alternativePlacement.travelStartMinutes,
                        endMinutes: actualActivityEndMinutes,  // ← 실제 수업 종료 시간
                        userId: userId
                    });

                    // 🆕 해당 날짜의 마지막 위치 업데이트 (더 늦게 끝나는 경우만)
                    if (!lastLocationByDate[alternativePlacement.dateStr] || actualActivityEndMinutes > lastLocationByDate[alternativePlacement.dateStr].endMinutes) {
                        lastLocationByDate[alternativePlacement.dateStr] = {
                            location: memberLocation,
                            endMinutes: actualActivityEndMinutes
                        };
                    }

                    // 🔧 수정: 이전 슬롯 정보 업데이트 (거리 연속 배치용)
                    previousSlotOriginalDate = slotDate;  // 🔧 거리 순서 유지: 원본 날짜 저장
                    previousActivityEndMinutes = actualActivityEndMinutes;
                    previousUserId = userIdStr;
                    previousSlotIndex = slotIndex;
                    previousLocation = memberLocation;  // 🔧 수정: 같은 날짜 내 연속 이동
                    
                    continue;
                } else {
                    console.log(`❌ [재배정 실패] ${slotDate} - ${memberLocation.name}`, {
                        원본시간: `${mergedSlot.startTime} - ${mergedSlot.endTime}`,
                        수업시간: `${activityDurationMinutes}분`,
                        이동시간: `${travelDurationMinutes}분`,
                        사유: '모든 날짜에서 배치 불가능'
                    });

                    // ❌ 원본 슬롯도 추가하지 않음 (선호시간 외 배치 방지)
                    // allResultSlots.push(...this.unmergeBlock(mergedSlot));

                    // 다음 슬롯으로 이동
                    continue;
                }
            }

            // 🔧 수정: targetDate를 사용해서 블록 생성
            const targetDateObj = new Date(targetDate);
            const targetDayOfWeek = targetDateObj.getDay();
            const targetDayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][targetDayOfWeek];
            
            const travelBlock = {
                ...mergedSlot,
                date: targetDateObj,  // targetDate 사용
                day: targetDayName,
                isTravel: true,
                startTime: this.formatTime(newTravelStartMinutes),
                endTime: this.formatTime(newTravelEndTimeMinutes),
                subject: '이동시간',
                user: userId,
                color: memberLocation.color,
                travelInfo: { 
                    ...travelInfo, 
                    durationText: `${travelDurationMinutes}분`,
                    from: actualPreviousLocation.name,
                    to: memberLocation.name
                },
            };

            const activityBlock = {
                ...mergedSlot,
                date: targetDateObj,  // targetDate 사용
                day: targetDayName,
                isTravel: false,
                startTime: this.formatTime(newActivityStartTimeMinutes),
                endTime: this.formatTime(newActivityEndTimeMinutes),
                subject: mergedSlot.subject || '수업',
                originalStartTime: mergedSlot.originalStartTime || mergedSlot.startTime,
                originalEndTime: mergedSlot.originalEndTime || mergedSlot.endTime,
                actualStartTime: this.formatTime(newTravelStartMinutes),
                travelTimeBefore: travelDurationMinutes,
                adjustedForTravelTime: true
            };

            // 🆕 travelSlots 배열에 이동시간 슬롯 추가
            const travelSlotData = {
                date: targetDateObj,  // targetDate 사용
                startTime: this.formatTime(newTravelStartMinutes),
                endTime: this.formatTime(newTravelEndTimeMinutes),
                from: actualPreviousLocation.name,
                to: memberLocation.name,
                user: userId,  // 🆕 사용자 ID 추가
                color: memberLocation.color,  // 🆕 사용자 색상 추가
                travelInfo: {
                    ...travelInfo,
                    durationText: `${travelDurationMinutes}분`,
                    distanceText: travelInfo.distanceText || `${(travelInfo.distance / 1000).toFixed(1)}km`
                },
                travelMode: travelMode
            };
            
travelSlotsArray.push(travelSlotData);

            const travelSlots10min = this.unmergeBlock(travelBlock);
            const activitySlots10min = this.unmergeBlock(activityBlock);

            allResultSlots.push(...travelSlots10min, ...activitySlots10min);
            
            // 🔍 배치 성공 로그
            // 🔧 수정: targetDate로 기록 (거리 연속 배치 지원)
            if (!assignedSlotsByDate[targetDate]) {
                assignedSlotsByDate[targetDate] = [];
            }
            assignedSlotsByDate[targetDate].push({
                startMinutes: newTravelStartMinutes,
                endMinutes: newActivityEndTimeMinutes,
                userId: userId
            });
            
            // 🔧 수정: targetDate로 마지막 위치 업데이트
            if (!lastLocationByDate[targetDate] || newActivityEndTimeMinutes > lastLocationByDate[targetDate].endMinutes) {
                lastLocationByDate[targetDate] = {
                    location: memberLocation,
                    endMinutes: newActivityEndTimeMinutes
                };
            }

            // 🔧 수정: 이전 슬롯 정보 업데이트 (거리 연속 배치용)
            previousSlotOriginalDate = slotDate;  // 🔧 거리 순서 유지: 원본 날짜 저장
            previousActivityEndMinutes = newActivityEndTimeMinutes;
            previousUserId = userIdStr;
            previousSlotIndex = slotIndex;
            previousLocation = memberLocation;  // 🔧 수정: 같은 날짜 내 연속 이동

        } catch (error) {
            allResultSlots.push(...this.unmergeBlock(mergedSlot));
        }
    }

    // 🔄 [FINAL PASS] 모든 배치 완료 후 이동시간 재계산
    
    for (let i = 0; i < travelSlotsArray.length; i++) {
        const travelSlot = travelSlotsArray[i];
        const dateStr = this.toLocalDateString(travelSlot.date);
        const travelStartMinutes = this.parseTime(travelSlot.startTime);
        
        // 해당 날짜에서 현재 이동시간 슬롯보다 먼저 끝나는 슬롯 찾기
        const assignedOnDate = assignedSlotsByDate[dateStr] || [];
        const slotsBeforeCurrent = assignedOnDate.filter(slot => 
            slot.endMinutes <= travelStartMinutes && slot.userId !== travelSlot.user
        );
        
        if (slotsBeforeCurrent.length > 0) {
            // 가장 늦게 끝나는 슬롯 찾기
            const lastSlot = slotsBeforeCurrent.reduce((latest, slot) => 
                slot.endMinutes > latest.endMinutes ? slot : latest
            );
            // 이전 슬롯의 사용자 위치 찾기
            const lastUserId = lastSlot.userId;
            let fromLocation;
            let fromLocationName;
            
            if (lastUserId === owner._id.toString()) {
                fromLocation = { lat: owner.addressLat, lng: owner.addressLng };
                fromLocationName = '방장';
            } else {
                const lastMemberLocation = memberLocations[lastUserId];
                if (lastMemberLocation) {
                    fromLocation = { lat: lastMemberLocation.lat, lng: lastMemberLocation.lng };
                    fromLocationName = lastMemberLocation.name;
                }
            }
            
            if (fromLocation && fromLocationName !== travelSlot.from) {
                // 현재와 다른 출발지 → 재계산 필요
                const toUserId = travelSlot.user;
                const toLocation = memberLocations[toUserId];
                
                if (toLocation) {
                    try {
                        const recalcTravel = await travelModeService.calculateTravelTime(
                            fromLocation,
                            { lat: toLocation.lat, lng: toLocation.lng },
                            travelMode
                        );
                        const newTravelMinutes = Math.ceil(recalcTravel.duration / 60 / 10) * 10;
                        const oldTravelMinutes = this.parseTime(travelSlot.endTime) - this.parseTime(travelSlot.startTime);
                        
                        if (newTravelMinutes !== oldTravelMinutes) {
                            
                            // travelSlot 업데이트
                            travelSlot.from = fromLocationName;
                            travelSlot.endTime = this.formatTime(travelStartMinutes + newTravelMinutes);
                            travelSlot.travelInfo.durationText = `${newTravelMinutes}분`;
                            travelSlot.travelInfo.duration = recalcTravel.duration;
                            
                            // 시간 차이 계산
                            const timeDifference = oldTravelMinutes - newTravelMinutes;
                            const newActivityStartMinutes = travelStartMinutes + newTravelMinutes;
                            const oldActivityStartMinutes = travelStartMinutes + oldTravelMinutes;
                            
                            // allResultSlots에서 해당 이동 슬롯과 수업 슬롯 모두 업데이트
                            const dateObj = new Date(travelSlot.date);
                            let travelSlotsUpdated = 0;
                            let activitySlotsUpdated = 0;
                            
                            allResultSlots.forEach(slot => {
                                // slot.user는 객체일 수 있으므로 ID 추출
                                const slotUserId = typeof slot.user === 'object' && slot.user ? (slot.user._id || slot.user.id) : slot.user;
                                const slotUserIdStr = slotUserId ? slotUserId.toString() : null;
                                
                                if (new Date(slot.date).getTime() === dateObj.getTime() && slotUserIdStr === toUserId.toString()) {
                                    if (slot.isTravel && slot.startTime === travelSlot.startTime) {
                                        // 이동 슬롯 업데이트
                                        slot.endTime = this.formatTime(travelStartMinutes + newTravelMinutes);
                                        if (slot.travelInfo) {
                                            slot.travelInfo.durationText = `${newTravelMinutes}분`;
                                            slot.travelInfo.from = fromLocationName;
                                        }
                                        travelSlotsUpdated++;
                                    } else if (!slot.isTravel) {
                                        // 수업 슬롯의 시작/종료 시간 조정
                                        const slotStartMinutes = this.parseTime(slot.startTime);
                                        const slotEndMinutes = this.parseTime(slot.endTime);
                                        
                                        // 원래 수업 시작 시간 이후의 슬롯만 조정
                                        if (slotStartMinutes >= oldActivityStartMinutes) {
                                            const newSlotStartMinutes = slotStartMinutes - timeDifference;
                                            const newSlotEndMinutes = slotEndMinutes - timeDifference;
                                            slot.startTime = this.formatTime(newSlotStartMinutes);
                                            slot.endTime = this.formatTime(newSlotEndMinutes);
                                            activitySlotsUpdated++;
                                        }
                                    }
                                }
                            });
                            
                            }
                    } catch (err) {
                    }
                }
            }
        }
    }
    
    // travelSlots 배열을 실제 데이터와 함께 반환
    
    return {
        timeSlots: allResultSlots,
        travelSlots: travelSlotsArray,
        travelMode: travelMode
    };
  }
}

export default new TravelScheduleCalculator();
