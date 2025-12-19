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
   * unmergeBlock
   * @description 병합된 스케줄 블록을 10분 단위의 개별 슬롯으로 분할합니다.
   * @param {Object} block - 병합된 스케줄 블록 객체 ({startTime, endTime, ...}).
   * @returns {Array<Object>} 10분 단위로 분할된 슬롯 배열.
   */
  unmergeBlock(block) {
      const slots = [];
      const startMinutes = this.parseTime(block.startTime);
      const endMinutes = this.parseTime(block.endTime);

      for (let m = startMinutes; m < endMinutes; m += 10) {
          const newSlot = {
              ...block,
              startTime: this.formatTime(m),
              endTime: this.formatTime(m + 10),
          };
          delete newSlot.originalSlots;
          delete newSlot.isMerged;
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
      const slotDate = new Date(mergedSlot.date).toISOString().split('T')[0];
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
        console.error('도보 모드 검증 중 오류:', error);
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
        sunday: [],
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: []
      };

      // defaultSchedule이 있으면 사용, 없으면 기본값
      const defaultSchedule = user.defaultSchedule || [];

      if (defaultSchedule.length === 0) {
        // 기본값: 월-금 09:00-17:00
        for (let day = 1; day <= 5; day++) {
          memberPreferences[userId][dayNames[day]].push({
            startMinutes: 9 * 60,    // 09:00
            endMinutes: 17 * 60      // 17:00
          });
        }
      } else {
        // defaultSchedule을 요일별로 정리
        for (const schedule of defaultSchedule) {
          const dayOfWeek = schedule.dayOfWeek; // 0-6 (일-토)
          const dayName = dayNames[dayOfWeek];

          memberPreferences[userId][dayName].push({
            startMinutes: this.parseTime(schedule.startTime),
            endMinutes: this.parseTime(schedule.endTime)
          });
        }
        
        // 🆕 각 요일의 슬롯들을 병합 (10분 단위로 나뉜 슬롯들을 하나로 합침)
        for (const dayName of dayNames) {
          memberPreferences[userId][dayName] = this.mergeOverlappingSlots(memberPreferences[userId][dayName]);
        }
      }
    }

    console.log('📊 [buildMemberPreferences] 완료:', {
      멤버수: Object.keys(memberPreferences).length,
      전체_멤버ID: Object.keys(memberPreferences),
      병합후_슬롯수: Object.entries(memberPreferences).map(([id, prefs]) => ({
        userId: id.substring(0, 8),
        monday: prefs.monday?.length || 0,
        tuesday: prefs.tuesday?.length || 0,
        wednesday: prefs.wednesday?.length || 0
      }))
    });

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
   * @returns {Boolean} 선호시간 내이면 true, 아니면 false
   */
  isWithinPreferredTime(userId, dayOfWeek, startMinutes, endMinutes, memberPreferences) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];

    const userIdStr = userId.toString();
    const userPrefs = memberPreferences[userIdStr];

    if (!userPrefs || !userPrefs[dayName] || userPrefs[dayName].length === 0) {
      return false; // 선호시간 없음
    }

    // 모든 선호시간 슬롯 중 하나라도 완전히 포함되면 true
    for (const pref of userPrefs[dayName]) {
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
  async findAvailableSlot(mergedSlot, userId, memberPreferences, travelDurationMinutes, activityDurationMinutes, blockedTimes, assignedSlotsByDate, startFromLocation, lastLocationByDate, memberLocation, travelMode, travelModeService) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const userIdStr = userId.toString();
    const originalDate = new Date(mergedSlot.date);

    console.log('🔍 [findAvailableSlot] 시작:', {
      userId: userIdStr,
      원본날짜: originalDate.toISOString().split('T')[0],
      이동시간: travelDurationMinutes,
      수업시간: activityDurationMinutes
    });

    // 월-금 순회 (5일간)
    for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
      const targetDate = new Date(originalDate);
      targetDate.setDate(targetDate.getDate() + dayOffset);
      const dateStr = targetDate.toISOString().split('T')[0];
      const dayOfWeek = targetDate.getDay();
      const dayName = dayNames[dayOfWeek];

      // 주말이면 건너뛰기
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      console.log(`  📅 [요일 시도] ${dateStr} (${dayName})`);

      const userPrefs = memberPreferences[userIdStr];
      if (!userPrefs || !userPrefs[dayName]) continue;

      const preferredSlots = userPrefs[dayName];

      // 🆕 선호시간 슬롯을 시간 순으로 정렬 (빠른 시간부터 배치)
      preferredSlots.sort((a, b) => a.startMinutes - b.startMinutes);
      
      console.log(`    📋 [선호시간 슬롯] ${dayName}:`, preferredSlots.map(s => 
        `${this.formatTime(s.startMinutes)}-${this.formatTime(s.endMinutes)}`
      ).join(', '));

      // 🆕 해당 날짜의 마지막 위치 확인하여 이동시간 재계산
      let actualTravelMinutes = travelDurationMinutes; // 기본값: 방장 기준
      
      if (lastLocationByDate && lastLocationByDate[dateStr] && travelModeService) {
        const lastLoc = lastLocationByDate[dateStr];
        console.log(`    🔄 [이동시간 재계산] ${dateStr}에 ${lastLoc.location.name} 있음`);
        try {
          const travelInfo = await travelModeService.calculateTravelTime(
            { lat: lastLoc.location.lat, lng: lastLoc.location.lng },
            { lat: memberLocation.lat, lng: memberLocation.lng },
            travelMode
          );
          actualTravelMinutes = Math.ceil(travelInfo.duration / 60 / 10) * 10;
          console.log(`       ${lastLoc.location.name} → ${memberLocation.name}: ${actualTravelMinutes}분`);
        } catch (err) {
          console.warn(`    ⚠️ [재계산 실패] 기본값 사용:`, err.message);
        }
      } else {
        console.log(`    🏠 [방장에서 출발] ${dateStr} - ${actualTravelMinutes}분`);
      }

      // 선호시간 슬롯들에 배치 시도
      for (const prefSlot of preferredSlots) {
        // 이동시간 + 수업시간 계산 (재계산된 이동시간 사용)
        const travelStart = prefSlot.startMinutes;
        const travelEnd = travelStart + actualTravelMinutes;
        const activityStart = travelEnd;
        const activityEnd = activityStart + activityDurationMinutes;

        // 선호시간 내에 완전히 들어가는지 체크
        if (activityEnd > prefSlot.endMinutes) {
          console.log(`    ⚠️ [선호시간 초과] ${this.formatTime(activityEnd)} > ${this.formatTime(prefSlot.endMinutes)}`);
          continue;
        }

        // 금지시간과 겹치는지 체크
        const travelBlockedCheck = this.checkBlockedTimeConflict(travelStart, travelEnd, blockedTimes);
        const activityBlockedCheck = this.checkBlockedTimeConflict(activityStart, activityEnd, blockedTimes);

        if (travelBlockedCheck.conflict || activityBlockedCheck.conflict) {
          console.log(`    🚫 [금지시간 충돌]`);
          continue;
        }

        // 이미 배정된 슬롯과 겹치는지 체크
        const travelOverlap = this.checkOverlap(dateStr, travelStart, travelEnd, assignedSlotsByDate);
        const activityOverlap = this.checkOverlap(dateStr, activityStart, activityEnd, assignedSlotsByDate);

        if (travelOverlap || activityOverlap) {
          console.log(`    ⚠️ [겹침 발생]`);
          continue;
        }

        // 배치 가능!
        console.log(`    ✅ [배치 가능] ${this.formatTime(travelStart)}-${this.formatTime(activityEnd)} (이동 ${actualTravelMinutes}분)`);
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
    console.log('  ❌ [배치 실패] 모든 요일에 배치 불가능');
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
  async findAvailableSlotsWithSplit(mergedSlot, userId, memberPreferences, travelDurationMinutes, totalActivityDurationMinutes, blockedTimes, assignedSlotsByDate, startFromLocation, lastLocationByDate, currentMemberLocation, travelMode, travelModeService, ownerToMemberTravelInfo) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const userIdStr = userId.toString();
    const originalDate = new Date(mergedSlot.date);
    
    console.log('🔄 [findAvailableSlotsWithSplit] 시작:', {
      userId: userIdStr,
      이동시간: travelDurationMinutes,
      총수업시간: totalActivityDurationMinutes
    });

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

      console.log(`  📅 [요일 시도] ${dateStr} (${dayName}), 남은 수업시간: ${remainingActivityMinutes}분`);

      const userPrefs = memberPreferences[userIdStr];
      if (!userPrefs || !userPrefs[dayName]) continue;

      const preferredSlots = userPrefs[dayName];

      // 🆕 선호시간 슬롯을 시간 순으로 정렬 (빠른 시간부터 배치)
      preferredSlots.sort((a, b) => a.startMinutes - b.startMinutes);
      
      console.log(`    📋 [선호시간 슬롯] ${dayName}:`, preferredSlots.map(s => 
        `${this.formatTime(s.startMinutes)}-${this.formatTime(s.endMinutes)}`
      ).join(', '));

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
            console.log(`    🔄 [이동시간 재계산] ${dateStr}에 이미 배치된 학생 있음`);
            console.log(`       출발: ${lastLocOnDate.location.name || '이전 학생'}`);
            console.log(`       도착: ${currentMemberLocation.name || '현재 학생'}`);
            
            try {
              const lastToCurrentTravel = await travelModeService.calculateTravelTime(
                { lat: lastLocOnDate.location.lat, lng: lastLocOnDate.location.lng },
                { lat: currentMemberLocation.lat, lng: currentMemberLocation.lng },
                travelMode
              );
              actualTravelDuration = Math.ceil(lastToCurrentTravel.duration / 60 / 10) * 10;
              fromLocation = lastLocOnDate.location;
              fromLocationName = lastLocOnDate.location.name || '이전 학생';
              console.log(`       계산된 이동시간: ${actualTravelDuration}분`);
            } catch (err) {
              console.warn(`    ⚠️ [이동시간 계산 실패] 방장 위치로 대체`, err.message);
              fromLocation = startFromLocation;
              fromLocationName = startFromLocation.name || '방장';
              actualTravelDuration = travelDurationMinutes;
            }
          } else {
            // 해당 날짜 첫 학생: 방장에서 출발
            fromLocation = startFromLocation;
            fromLocationName = startFromLocation.name || '방장';
            actualTravelDuration = travelDurationMinutes;
            console.log(`    🏠 [방장에서 출발] 이동시간: ${actualTravelDuration}분`);
          }
        } else {
          // 같은 날짜의 다음 블록: 이미 해당 위치에 있음
          actualTravelDuration = 0;
          fromLocation = null;
          fromLocationName = null;
          console.log(`    ⏭️ [같은 날 연속] 이동시간 없음`);
        }
        
        const travelStart = prefSlot.startMinutes;
        const travelEnd = travelStart + actualTravelDuration;
        const activityStart = travelEnd;

        // 이 슬롯에 배치 가능한 최대 수업시간 계산
        const availableMinutes = prefSlot.endMinutes - activityStart;
        
        if (availableMinutes <= 0) {
          console.log(`    ⚠️ [슬롯 부족] ${this.formatTime(prefSlot.startMinutes)}-${this.formatTime(prefSlot.endMinutes)}: 이동시간 후 여유 없음`);
          continue;
        }

        // 실제 배치할 수업시간 (남은 시간과 가능한 시간 중 작은 값)
        const activityDuration = Math.min(remainingActivityMinutes, availableMinutes);
        const activityEnd = activityStart + activityDuration;

        // 금지시간 체크
        const travelBlockedCheck = this.checkBlockedTimeConflict(travelStart, travelEnd, blockedTimes);
        const activityBlockedCheck = this.checkBlockedTimeConflict(activityStart, activityEnd, blockedTimes);

        if (travelBlockedCheck.conflict || activityBlockedCheck.conflict) {
          console.log(`    🚫 [금지시간 충돌]`);
          continue;
        }

        // 겹침 체크
        const travelOverlap = this.checkOverlap(dateStr, travelStart, travelEnd, assignedSlotsByDate);
        const activityOverlap = this.checkOverlap(dateStr, activityStart, activityEnd, assignedSlotsByDate);

        if (travelOverlap || activityOverlap) {
          console.log(`    ⚠️ [겹침 발생]`);
          continue;
        }

        // 배치 성공!
        console.log(`    ✅ [부분 배치] ${this.formatTime(travelStart)}-${this.formatTime(activityEnd)} (수업 ${activityDuration}분, 이동 ${actualTravelDuration}분)${isNewDay ? ' [새 날짜]' : ' [연속]'}`);
        
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
      console.log(`  ❌ [배치 실패] 남은 수업시간: ${remainingActivityMinutes}분`);
      return { success: false, remainingMinutes: remainingActivityMinutes };
    }

    console.log(`  ✅ [배치 완료] 총 ${blocks.length}개 블록으로 분할`);
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
    console.log('🎯 [simulateTimeSlotPlacement] 시작:', {
      userId: userId.toString().substring(0, 8),
      날짜: selectedDate,
      시작시간: this.formatTime(selectedStartMinutes),
      수업시간: duration
    });

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
      const slotDate = new Date(slot.date).toISOString().split('T')[0];
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

    console.log(`📍 [출발 위치] ${previousLocation.name} (${this.formatTime(previousEndMinutes)} 종료)`);

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
        console.log(`🚗 [이동시간] ${previousLocation.name} → ${memberLocation.name}: ${travelDurationMinutes}분`);
      } catch (error) {
        console.error('이동시간 계산 실패:', error);
        return { canPlace: false, reason: '이동시간 계산 실패' };
      }
    }

    // 6. 시간 계산
    const travelStartMinutes = Math.max(selectedStartMinutes, previousEndMinutes);
    const travelEndMinutes = travelStartMinutes + travelDurationMinutes;
    const activityStartMinutes = travelEndMinutes;
    const activityEndMinutes = activityStartMinutes + duration;

    console.log(`⏰ [시간 계산]`, {
      이동: `${this.formatTime(travelStartMinutes)}-${this.formatTime(travelEndMinutes)}`,
      수업: `${this.formatTime(activityStartMinutes)}-${this.formatTime(activityEndMinutes)}`
    });

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

    console.log(`${canPlace ? '✅' : '❌'} [결과] ${canPlace ? '배치 가능' : '배치 불가'}`);
    if (!canPlace) {
      console.log(`   충돌 개수: ${conflicts.length}`);
    }

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
    console.log('🚫 [getBlockedTimesForMember] 시작:', {
      userId: userId.toString().substring(0, 8),
      날짜: selectedDate
    });

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
      const slotDate = new Date(slot.date).toISOString().split('T')[0];
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

    console.log(`   총 ${blockedSlots.length}개 금지 구간`);
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
    console.log('📅 [getAvailableTimesForMember] 시작:', {
      userId: userId.toString().substring(0, 8),
      날짜: selectedDate,
      수업시간: duration
    });

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

    console.log(`   선택 가능: ${availableSlots.length}개, 금지: ${blockedSlots.length}개`);

    return {
      availableSlots,
      blockedSlots: [...baseBlockedTimes, ...blockedSlots]
    };
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
    
    console.log('🏠 [방장 주소 정보]', {
        이름: `${owner.firstName} ${owner.lastName}`,
        주소: owner.address,
        위도: owner.addressLat,
        경도: owner.addressLng
    });
    
    if (!owner.addressLat || !owner.addressLng) {
        throw new Error('방장의 주소 정보가 필요합니다. 프로필에서 주소를 설정해주세요.');
    }

    const members = currentRoom.members;
    const memberLocations = {};
    
    console.log('👥 [멤버 주소 정보]');
    members.forEach(m => {
        console.log(`  - ${m.user.firstName} ${m.user.lastName}:`, {
            주소: m.user.address,
            위도: m.user.addressLat,
            경도: m.user.addressLng
        });
        
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

    // 1. Merge raw slots into activity blocks
    const mergedSlots = mergeConsecutiveTimeSlots(currentRoom.timeSlots);

    // 🆕 시간 순서대로 정렬 (이동 경로를 올바르게 계산하기 위해)
    const sortedMergedSlots = mergedSlots.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateA.getTime() !== dateB.getTime()) {
            return dateA.getTime() - dateB.getTime();
        }
        return a.startTime.localeCompare(b.startTime);
    });

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
    
    console.log('🔍 [recalculateScheduleWithTravel] 시작:', {
        '전체_병합슬롯': sortedMergedSlots.length,
        '방장_ID': owner._id,
        '멤버수': Object.keys(memberLocations).length,
        '병합슬롯_목록': sortedMergedSlots.map(s => ({
            날짜: new Date(s.date).toISOString().split('T')[0],
            시간: `${s.startTime}-${s.endTime}`,
            사용자: s.user?.firstName || s.userId,
            과목: s.subject
        }))
    });

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
            const slotDate = new Date(mergedSlot.date).toISOString().split('T')[0];
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

    console.log('📊 [방장 스케줄 추가]:', {
        방장ID: ownerIdStr,
        추가된_날짜: Object.keys(assignedSlotsByDate)
    });

    // 🆕 날짜별 previousLocation 초기화를 위한 변수
    let currentDate = null;

    // 🆕 이전 활동 종료 시간 추적 (분 단위, 날짜별로 리셋)
    let previousActivityEndMinutes = 0;

    for (const mergedSlot of sortedMergedSlots) {
        // 🆕 날짜가 바뀌면 previousLocation을 방장으로 초기화
        const slotDate = new Date(mergedSlot.date).toISOString().split('T')[0];
        
        console.log('🔄 [슬롯 처리 중]:', {
            날짜: slotDate,
            시간: `${mergedSlot.startTime}-${mergedSlot.endTime}`,
            사용자: mergedSlot.user?.firstName || mergedSlot.userId,
            과목: mergedSlot.subject
        });
        if (slotDate !== currentDate) {
            currentDate = slotDate;
            previousActivityEndMinutes = 0;  // 🆕 날짜 변경 시 종료 시간도 리셋
            previousLocation = {
                lat: owner.addressLat,
                lng: owner.addressLng,
                name: '방장',
                color: '#4B5563'
            };
            console.log(`📅 [날짜 변경] ${slotDate} - previousLocation을 방장으로 초기화`);
        }
        let userId = mergedSlot.user;
        if (typeof userId === 'object' && userId !== null) {
            userId = userId._id || userId.id;
        }
        if (!userId) {
            console.log('⚠️ [원본 추가] userId 없음:', mergedSlot.startTime, mergedSlot.subject);
            allResultSlots.push(...this.unmergeBlock(mergedSlot));
            continue;
        }

        const userIdStr = userId.toString();
        
        // 🆕 방장의 슬롯은 이동시간 없이 원본 그대로 추가
        if (userIdStr === owner._id.toString()) {
            console.log('👑 [방장 슬롯] 이동시간 없이 원본 추가:', mergedSlot.startTime, mergedSlot.subject);
            allResultSlots.push(...this.unmergeBlock(mergedSlot));
            // previousLocation은 업데이트하지 않음 (방장은 이동하지 않음)
            // previousActivityEndMinutes도 업데이트하지 않음
            continue;
        }
        
        const memberLocation = memberLocations[userIdStr];
        if (!memberLocation) {
            console.log('⚠️ [원본 추가] memberLocation 없음:', { userId: userIdStr, startTime: mergedSlot.startTime, subject: mergedSlot.subject });
            allResultSlots.push(...this.unmergeBlock(mergedSlot));
            continue;
        }

        try {
            // 먼저 현재 슬롯의 시간 정보 파싱
            const slotStartMinutes = this.parseTime(mergedSlot.startTime);
            const slotEndMinutes = this.parseTime(mergedSlot.endTime);
            const activityDurationMinutes = slotEndMinutes - slotStartMinutes;
            
            // 🆕 현재 날짜에 이미 배정된 슬롯 중 가장 늦게 끝나는 슬롯의 위치에서 출발
            let actualPreviousLocation = previousLocation; // 기본값: 방장 (날짜가 바뀌었을 때)
            let actualPreviousEndMinutes = 0;
            
            const assignedSlots = assignedSlotsByDate[slotDate] || [];
            if (assignedSlots.length > 0) {
                // 🔍 현재 슬롯보다 먼저 시작하는 슬롯 중 가장 늦게 끝나는 슬롯 찾기
                const slotsBeforeCurrent = assignedSlots.filter(slot => 
                    slot.startMinutes < slotStartMinutes
                );
                
                if (slotsBeforeCurrent.length > 0) {
                    const lastSlot = slotsBeforeCurrent.reduce((latest, slot) => 
                        slot.endMinutes > latest.endMinutes ? slot : latest
                    );
                
                console.log(`🔍 [이전 슬롯 발견] ${slotDate}:`, {
                        userId: lastSlot.userId,
                        startTime: this.formatTime(lastSlot.startMinutes),
                        endTime: this.formatTime(lastSlot.endMinutes),
                        isOwner: lastSlot.isOwner
                    });
                    
                    // 그 슬롯의 사용자 위치 찾기
                    const lastUserId = lastSlot.userId;
                    if (lastUserId === owner._id.toString()) {
                        actualPreviousLocation = {
                            lat: owner.addressLat,
                            lng: owner.addressLng,
                            name: '방장',
                            color: '#4B5563'
                        };
                    } else {
                        actualPreviousLocation = memberLocations[lastUserId] || previousLocation;
                    }
                    actualPreviousEndMinutes = lastSlot.endMinutes;
                    
                    console.log(`📍 [실제 출발 위치] ${actualPreviousLocation.name} (${this.formatTime(actualPreviousEndMinutes)} 종료)`);
                } else {
                    console.log(`📍 [해당 날짜 첫 배정] ${slotDate} ${this.formatTime(slotStartMinutes)} - 방장에서 출발`);
                }
            } else {
                console.log(`📍 [해당 날짜 첫 배정] ${slotDate} - 방장에서 출발`);
            }
            
            // 이전 위치에서 현재 학생 위치로 이동 시간 계산
            const travelInfo = await travelModeService.calculateTravelTime(
                { lat: actualPreviousLocation.lat, lng: actualPreviousLocation.lng },
                { lat: memberLocation.lat, lng: memberLocation.lng },
                travelMode
            );

            const travelDurationSeconds = travelInfo.duration || 0;
            const travelDurationMinutes = Math.ceil(travelDurationSeconds / 60 / 10) * 10;
            
            console.log('🚗 [이동시간 계산]', {
                from: actualPreviousLocation.name,
                to: memberLocation.name,
                travelDurationSeconds,
                travelDurationMinutes,
                원래값_초: travelInfo.duration,
                계산된_분: Math.ceil(travelDurationSeconds / 60),
                '10분단위_반올림': travelDurationMinutes
            });
            
            if (travelDurationMinutes === 0) {
                allResultSlots.push(...this.unmergeBlock(mergedSlot));
                // 🆕 현재 위치 업데이트
                previousLocation = memberLocation;
                continue;
            }

            // ✅ 수정: 이동시간 시작은 원본 시작 시간과 실제 마지막 활동 종료 시간 중 늦은 것
            // 예1: 원본 09:00, 마지막 활동 없음 → 이동 09:00 시작
            // 예2: 원본 10:00, 마지막 활동 11:00 종료 → 이동 11:00 시작 (겹치지 않도록)
            let newTravelStartMinutes = Math.max(slotStartMinutes, actualPreviousEndMinutes);
            let newTravelEndTimeMinutes = newTravelStartMinutes + travelDurationMinutes; // ✅ 조정된 시작 기준으로 종료 계산
            let newActivityStartTimeMinutes = newTravelEndTimeMinutes; // 이동 후 수업 시작
            let newActivityEndTimeMinutes = newActivityStartTimeMinutes + activityDurationMinutes; // 수업 종료
            
            console.log('✅ [이동시간 슬롯 차지]', {
                출발지: actualPreviousLocation.name,
                도착지: memberLocation.name,
                원래_수업: `${this.formatTime(slotStartMinutes)}-${this.formatTime(slotEndMinutes)}`,
                이동시간: `${this.formatTime(newTravelStartMinutes)}-${this.formatTime(newTravelEndTimeMinutes)} (${travelDurationMinutes}분)`,
                조정된_수업: `${this.formatTime(newActivityStartTimeMinutes)}-${this.formatTime(newActivityEndTimeMinutes)}`,
                실제_거리: travelInfo.distanceText || `${(travelInfo.distance / 1000).toFixed(1)}km`,
                실제_소요시간: `${Math.floor(travelDurationSeconds / 60)}분 ${travelDurationSeconds % 60}초`,
                총_시간_증가: `${travelDurationMinutes}분`
            });

            // 🔒 방 금지시간 체크 - 금지시간을 절대 침범하지 않도록 조정
            // 명시적으로 지정한 금지시간만 사용 (점심시간 등)
            const allBlockedTimes = currentRoom.settings?.blockedTimes || [];

            let canPlace = true;  // 배치 가능 여부 플래그

            console.log(`🔍 [금지시간 체크] allBlockedTimes:`, allBlockedTimes);

            for (const blocked of allBlockedTimes) {
                const blockedStart = this.parseTime(blocked.startTime);
                const blockedEnd = this.parseTime(blocked.endTime);

                // 이동시간 또는 활동시간이 금지시간과 겹치는지 체크
                const travelOverlap = newTravelStartMinutes < blockedEnd && newTravelEndTimeMinutes > blockedStart;
                const activityOverlap = newActivityStartTimeMinutes < blockedEnd && newActivityEndTimeMinutes > blockedStart;

                if (travelOverlap || activityOverlap) {
                    console.log(`🚫 [금지시간 감지] ${blocked.name} (${blocked.startTime}-${blocked.endTime})`);
                    console.log(`   현재 이동: ${this.formatTime(newTravelStartMinutes)}-${this.formatTime(newTravelEndTimeMinutes)}`);
                    console.log(`   현재 수업: ${this.formatTime(newActivityStartTimeMinutes)}-${this.formatTime(newActivityEndTimeMinutes)}`);

                    // ✅ 핵심 수정: 금지시간 **이후**로 시작하도록 조정
                    const totalDuration = travelDurationMinutes + activityDurationMinutes;

                    // 금지시간 이후로 이동시간 시작
                    const adjustedStartTime = blockedEnd;
                    const adjustedEndTime = adjustedStartTime + totalDuration;

                    console.log(`   필요한 총 시간: ${totalDuration}분 (이동 ${travelDurationMinutes}분 + 수업 ${activityDurationMinutes}분)`);
                    console.log(`   조정된 시작 시간: ${this.formatTime(adjustedStartTime)} (금지시간 ${blocked.endTime} 이후로 시작)`);
                    console.log(`   조정된 종료 시간: ${this.formatTime(adjustedEndTime)}`);

                    // 시작 시간 조정 (금지시간 이후에 모든 것이 시작하도록)
                    newTravelStartMinutes = adjustedStartTime;
                    newTravelEndTimeMinutes = adjustedStartTime + travelDurationMinutes;
                    newActivityStartTimeMinutes = newTravelEndTimeMinutes;
                    newActivityEndTimeMinutes = newActivityStartTimeMinutes + activityDurationMinutes;

                    console.log(`✅ [금지시간 회피 성공] 조정 완료:`);
                    console.log(`   이동: ${this.formatTime(newTravelStartMinutes)}-${this.formatTime(newTravelEndTimeMinutes)}`);
                    console.log(`   수업: ${this.formatTime(newActivityStartTimeMinutes)}-${this.formatTime(newActivityEndTimeMinutes)}`);
                    console.log(`   시작 시간(${this.formatTime(newTravelStartMinutes)}) >= 금지시간 종료(${blocked.endTime}) ✅`);
                    break;
                }
            }

            // 🆕 선호시간 체크 (금지시간 체크 통과 후)
            if (canPlace) {
                const slotDayOfWeek = new Date(mergedSlot.date).getDay();

                // 이전 활동 때문에 밀렸는지 확인
                const isPushedByPrevious = previousActivityEndMinutes > slotStartMinutes;

                // 조정된 시간이 선호시간 내인지 체크
                const isAdjustedPreferred = this.isWithinPreferredTime(
                    userId,
                    slotDayOfWeek,
                    newActivityStartTimeMinutes,
                    newActivityEndTimeMinutes,
                    memberPreferences
                );

                console.log(`🔍 [선호시간 체크]`, {
                    조정: `${this.formatTime(newActivityStartTimeMinutes)}-${this.formatTime(newActivityEndTimeMinutes)}`,
                    이전활동종료: this.formatTime(previousActivityEndMinutes),
                    이전활동때문에밀림: isPushedByPrevious,
                    조정선호시간내: isAdjustedPreferred
                });

                // 📌 이동시간 추가 후 선호시간 초과 여부 체크
                // 이유 불문하고 조정된 시간이 선호시간 외면 재배정 필요
                if (!isAdjustedPreferred) {
                    if (isPushedByPrevious) {
                        console.warn(`⚠️ [재배정 필요] 이전 활동으로 밀려서 선호시간 외`);
                    } else {
                        console.warn(`⚠️ [재배정 필요] 이동시간 추가로 선호시간 초과 (${this.formatTime(newActivityStartTimeMinutes)}-${this.formatTime(newActivityEndTimeMinutes)})`);
                    }
                    canPlace = false;
                }
                // 조정 후에도 선호시간 내 → OK
                else {
                    console.log(`✅ [선호시간 체크 통과] 같은 날짜 배치 가능`);
                }
            }
            
            // 🆕 겹침 체크 (선호시간 체크 통과 후)
            if (canPlace) {
                // 이동시간 겹침 체크
                const travelOverlap = this.checkOverlap(
                    slotDate,
                    newTravelStartMinutes,
                    newTravelEndTimeMinutes,
                    assignedSlotsByDate
                );
                
                // 수업시간 겹침 체크
                const activityOverlap = this.checkOverlap(
                    slotDate,
                    newActivityStartTimeMinutes,
                    newActivityEndTimeMinutes,
                    assignedSlotsByDate
                );
                
                if (travelOverlap || activityOverlap) {
                    console.warn(`⚠️ [재배정 필요] 기존 배정과 겹침 발생`);
                    console.warn(`   이동시간 겹침: ${travelOverlap}, 수업시간 겹침: ${activityOverlap}`);
                    console.warn(`   이동: ${this.formatTime(newTravelStartMinutes)}-${this.formatTime(newTravelEndTimeMinutes)}`);
                    console.warn(`   수업: ${this.formatTime(newActivityStartTimeMinutes)}-${this.formatTime(newActivityEndTimeMinutes)}`);
                    canPlace = false;
                } else {
                    console.log(`✅ [겹침 체크 통과] 같은 날짜 배치 가능`);
                }
            }

            // 배치 불가능하면 다른 요일로 재배정 시도
            if (!canPlace) {
                console.warn(`⚠️ [현재 날짜 배치 불가] 다른 요일 검색 시작`);

                // 🆕 재배정 시 날짜별 이동 출발지 확인 (이미 배치된 학생이 있으면 그 위치에서 출발)
                // 원본 날짜의 마지막 위치를 확인 (재배정은 다른 날짜로 하므로, 각 날짜의 마지막 위치 체크)
                console.log(`🔄 [재배정 이동시간 계산] lastLocationByDate 확인:`, Object.keys(lastLocationByDate).map(d => `${d}: ${lastLocationByDate[d]?.location?.name || '없음'}`).join(', '));
                
                // 방장에서 출발하는 이동시간 (기본값)
                const ownerToMemberTravelInfo = await travelModeService.calculateTravelTime(
                    { lat: owner.addressLat, lng: owner.addressLng },
                    { lat: memberLocation.lat, lng: memberLocation.lng },
                    travelMode
                );
                const ownerTravelDurationSeconds = ownerToMemberTravelInfo.duration || 0;
                const ownerTravelDurationMinutes = Math.ceil(ownerTravelDurationSeconds / 60 / 10) * 10;

                console.log(`   방장 → ${memberLocation.name}: ${ownerTravelDurationMinutes}분 (방장에서 출발 기본값)`);

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
                    travelModeService    // 🆕 이동시간 계산 서비스
                );

                // 한 블록으로 배치 실패 → 여러 블록으로 분할 시도
                if (!alternativePlacement.success) {
                    console.warn(`⚠️ [한 블록 배치 실패] 수업 분할 시도`);
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
                        ownerToMemberTravelInfo  // 🆕 방장→학생 이동시간
                    );
                }

                if (alternativePlacement.success && alternativePlacement.blocks) {
                    // 여러 블록으로 분할 배치 성공
                    console.log(`✅ [분할 배치 성공] ${alternativePlacement.blocks.length}개 블록`);

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
                        };
                        allResultSlots.push(...this.unmergeBlock(altActivityBlock));
                        
                        // 🆕 해당 날짜의 마지막 위치 업데이트 (더 늦게 끝나는 경우만)
                        const blockDateStr = new Date(block.date).toISOString().split('T')[0];
                        if (!lastLocationByDate[blockDateStr] || block.activityEndMinutes > lastLocationByDate[blockDateStr].endMinutes) {
                            lastLocationByDate[blockDateStr] = {
                                location: memberLocation,
                                endMinutes: block.activityEndMinutes
                            };
                            console.log(`   📍 [lastLocationByDate 업데이트] ${blockDateStr}: ${memberLocation.name} (${this.formatTime(block.activityEndMinutes)} 종료)`);
                        }
                    }

                    previousLocation = memberLocation;
                    continue;
                } else if (alternativePlacement.success) {
                    // 다른 요일에 배치 성공
                    console.log(`✅ [요일 재배정 성공] ${alternativePlacement.dateStr} (${alternativePlacement.dayOfWeek})`);

                    // 🔄 실제 이동시간 확인 (findAvailableSlot에서 이미 계산됨)
                    const targetDateStr = alternativePlacement.dateStr;
                    let actualTravelMinutes = alternativePlacement.actualTravelMinutes || ownerTravelDurationMinutes;
                    let actualFromLocationName = '방장';  // 기본값
                    
                    // findAvailableSlot에서 재계산되었는지 확인
                    if (alternativePlacement.actualTravelMinutes && alternativePlacement.actualTravelMinutes !== ownerTravelDurationMinutes) {
                        const lastLocOnTargetDate = lastLocationByDate[targetDateStr];
                        if (lastLocOnTargetDate && lastLocOnTargetDate.location) {
                            actualFromLocationName = lastLocOnTargetDate.location.name;
                            console.log(`   ✅ [findAvailableSlot에서 재계산됨] ${actualFromLocationName} → ${memberLocation.name}: ${actualTravelMinutes}분`);
                        }
                    } else {
                        console.log(`   🏠 [방장 기준] ${actualTravelMinutes}분`);
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
                        
                        console.log(`   🔍 [assignedSlotsByDate에서 발견] ${targetDateStr}:`, {
                            userId: lastSlot.userId,
                            endTime: this.formatTime(lastSlot.endMinutes)
                        });
                        
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
                                console.log(`   ✅ [재계산 완료] ${actualFromLocationName} → ${memberLocation.name}: ${actualTravelMinutes}분`);
                            } catch (err) {
                                console.warn(`   ⚠️ [재계산 실패] 방장 기준 사용:`, err.message);
                            }
                        }
                    } else {
                        console.log(`   🏠 [방장에서 출발] ${targetDateStr}에 배치된 학생 없음 - 방장 기준 ${actualTravelMinutes}분`);
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
                        console.log(`   📍 [lastLocationByDate 업데이트] ${alternativePlacement.dateStr}: ${memberLocation.name} (${this.formatTime(actualActivityEndMinutes)} 종료)`);
                    }

                    previousLocation = memberLocation;
                    continue;
                } else {
                    // 모든 요일에 배치 불가능 - 원본 슬롯 유지
                    console.warn(`⚠️ [재배정 실패] 모든 요일에 배치 불가능 - 원본 슬롯 유지 (겹침 발생 가능)`);
                    console.warn(`   원본: ${mergedSlot.startTime}-${mergedSlot.endTime}, 날짜: ${new Date(mergedSlot.date).toISOString().split('T')[0]}`);
                    console.warn(`   경고: 이 슬롯은 선호시간 외이거나 다른 슬롯과 겹칠 수 있습니다.`);
                    
                    // 원본 슬롯을 그대로 추가 (겹침이나 선호시간 외 경고와 함께)
                    allResultSlots.push(...this.unmergeBlock(mergedSlot));
                    
                    // 다음 슬롯으로 이동 (아래 코드를 실행하지 않음)
                    continue;
                }
            }

            const travelBlock = {
                ...mergedSlot,
                isTravel: true,
                startTime: this.formatTime(newTravelStartMinutes),
                endTime: this.formatTime(newTravelEndTimeMinutes),
                subject: '이동시간',
                user: userId,  // 🆕 사용자 ID 추가 (색상 매칭용)
                color: memberLocation.color,  // 🆕 사용자 색상 추가
                travelInfo: { 
                    ...travelInfo, 
                    durationText: `${travelDurationMinutes}분`,
                    from: actualPreviousLocation.name,  // 🆕 실제 출발지 이름
                    to: memberLocation.name  // 🆕 도착지 이름
                },
            };

            const activityBlock = {
                ...mergedSlot,
                isTravel: false,
                startTime: this.formatTime(newActivityStartTimeMinutes),
                endTime: this.formatTime(newActivityEndTimeMinutes),
                subject: mergedSlot.subject || '수업',
            };

            // 🆕 travelSlots 배열에 이동시간 슬롯 추가
            const travelSlotData = {
                date: mergedSlot.date,
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
            
            console.log('📊 [travelSlots 추가]', {
                날짜: travelSlotData.date,  // ← 날짜 추가
                from: travelSlotData.from,
                to: travelSlotData.to,
                startTime: travelSlotData.startTime,
                endTime: travelSlotData.endTime,
                '실제_duration_분': travelDurationMinutes,
                '표시_duration': travelSlotData.travelInfo.durationText,
                newTravelStartMinutes,
                newTravelEndTimeMinutes,
                '계산된_차이_분': newTravelEndTimeMinutes - newTravelStartMinutes
            });
            
travelSlotsArray.push(travelSlotData);

            const travelSlots10min = this.unmergeBlock(travelBlock);
            const activitySlots10min = this.unmergeBlock(activityBlock);
            
            console.log('✅ [조정된 슬롯 추가]:', {
                원본: `${mergedSlot.startTime}-${mergedSlot.endTime}`,
                이동: `${travelBlock.startTime}-${travelBlock.endTime}`,
                조정된수업: `${activityBlock.startTime}-${activityBlock.endTime}`,
                추가개수: travelSlots10min.length + activitySlots10min.length,
                이전종료: this.formatTime(previousActivityEndMinutes),
                새종료: this.formatTime(newActivityEndTimeMinutes)
            });

            allResultSlots.push(...travelSlots10min, ...activitySlots10min);

            // 🆕 assignedSlotsByDate에 기록 (겹침 방지)
            if (!assignedSlotsByDate[slotDate]) {
                assignedSlotsByDate[slotDate] = [];
            }
            assignedSlotsByDate[slotDate].push({
                startMinutes: newTravelStartMinutes,
                endMinutes: newActivityEndTimeMinutes,
                userId: userId
            });
            
            // 🆕 각 날짜의 마지막 위치 업데이트 (더 늦게 끝나는 경우만)
            if (!lastLocationByDate[slotDate] || newActivityEndTimeMinutes > lastLocationByDate[slotDate].endMinutes) {
                lastLocationByDate[slotDate] = {
                    location: memberLocation,
                    endMinutes: newActivityEndTimeMinutes
                };
                console.log(`   📍 [lastLocationByDate 업데이트] ${slotDate}: ${memberLocation.name} (${this.formatTime(newActivityEndTimeMinutes)} 종료)`);
            }

            // 🆕 이전 활동 종료 시간 업데이트 (다음 학생은 이 시간 이후에 시작)
            previousActivityEndMinutes = newActivityEndTimeMinutes;

            // 🆕 현재 위치를 이전 위치로 업데이트 (다음 학생은 여기서 출발)
            previousLocation = memberLocation;

        } catch (error) {
            console.error('❌ [에러 발생 - 원본 추가]:', {
                error: error.message,
                슬롯: `${mergedSlot.startTime}-${mergedSlot.endTime}`,
                날짜: mergedSlot.date,
                사용자: mergedSlot.user?.firstName || mergedSlot.userId
            });
            allResultSlots.push(...this.unmergeBlock(mergedSlot));
        }
    }

    // 🔄 [FINAL PASS] 모든 배치 완료 후 이동시간 재계산
    console.log('🔄 [FINAL PASS] 이동시간 최종 재계산 시작');
    
    for (let i = 0; i < travelSlotsArray.length; i++) {
        const travelSlot = travelSlotsArray[i];
        const dateStr = new Date(travelSlot.date).toISOString().split('T')[0];
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
            
            console.log(`   🔍 [재계산 대상] ${travelSlot.to} (${dateStr} ${travelSlot.startTime})`);
            console.log(`      이전 슬롯 발견: userId=${lastSlot.userId}, 종료=${this.formatTime(lastSlot.endMinutes)}`);
            
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
                            console.log(`      ✅ 재계산: ${fromLocationName} → ${travelSlot.to}: ${oldTravelMinutes}분 → ${newTravelMinutes}분`);
                            console.log(`      🔍 toUserId: ${toUserId}, 날짜: ${new Date(travelSlot.date).toISOString().split('T')[0]}`);
                            
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
                            
                            console.log(`      📝 슬롯 업데이트: 이동 ${travelSlotsUpdated}개, 수업 ${activitySlotsUpdated}개`);
                            console.log(`      📝 수업 시간 조정: ${this.formatTime(oldActivityStartMinutes)} → ${this.formatTime(newActivityStartMinutes)} (${timeDifference}분 앞당김)`);
                        }
                    } catch (err) {
                        console.warn(`      ⚠️ 재계산 실패:`, err.message);
                    }
                }
            }
        }
    }
    
    console.log('✅ [FINAL PASS] 이동시간 최종 재계산 완료');
    
    // travelSlots 배열을 실제 데이터와 함께 반환
    
    console.log('📦 [recalculateScheduleWithTravel] 완료:', {
        '최종_timeSlots': allResultSlots.length,
        '이동_슬롯': travelSlotsArray.length,
        '10시_슬롯들': allResultSlots.filter(s => s.startTime >= '10:00' && s.startTime < '11:00').map(s => ({
            시작: s.startTime,
            종료: s.endTime,
            과목: s.subject,
            isTravel: s.isTravel,
            사용자: s.user?.firstName || s.userId
        }))
    });
    
    return {
        timeSlots: allResultSlots,
        travelSlots: travelSlotsArray,
        travelMode: travelMode
    };
  }
}

export default new TravelScheduleCalculator();
