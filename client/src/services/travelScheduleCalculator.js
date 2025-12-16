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
        const memberLocation = memberLocations[userIdStr];
        if (!memberLocation) {
            console.log('⚠️ [원본 추가] memberLocation 없음:', { userId: userIdStr, startTime: mergedSlot.startTime, subject: mergedSlot.subject });
            allResultSlots.push(...this.unmergeBlock(mergedSlot));
            continue;
        }

        try {
            // 🆕 이전 위치에서 현재 학생 위치로 이동 시간 계산
            const travelInfo = await travelModeService.calculateTravelTime(
                { lat: previousLocation.lat, lng: previousLocation.lng },  // ✅ 이전 위치에서 출발!
                { lat: memberLocation.lat, lng: memberLocation.lng },
                travelMode
            );

            const travelDurationSeconds = travelInfo.duration || 0;
            const travelDurationMinutes = Math.ceil(travelDurationSeconds / 60 / 10) * 10;
            
            console.log('🚗 [이동시간 계산]', {
                from: previousLocation.name,
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

            const slotStartMinutes = this.parseTime(mergedSlot.startTime);
            const slotEndMinutes = this.parseTime(mergedSlot.endTime);
            const activityDurationMinutes = slotEndMinutes - slotStartMinutes;

            // ✅ 수정: 이동시간 시작은 원본 시작 시간과 이전 활동 종료 시간 중 늦은 것
            // 예1: 원본 09:00, 이전 종료 없음 → 이동 09:00 시작
            // 예2: 원본 10:00, 이전 종료 11:00 → 이동 11:00 시작 (겹치지 않도록)
            let newTravelStartMinutes = Math.max(slotStartMinutes, previousActivityEndMinutes);
            let newTravelEndTimeMinutes = newTravelStartMinutes + travelDurationMinutes; // ✅ 조정된 시작 기준으로 종료 계산
            let newActivityStartTimeMinutes = newTravelEndTimeMinutes; // 이동 후 수업 시작
            let newActivityEndTimeMinutes = newActivityStartTimeMinutes + activityDurationMinutes; // 수업 종료
            
            console.log('✅ [이동시간 슬롯 차지]', {
                출발지: previousLocation.name,
                도착지: memberLocation.name,
                원래_수업: `${this.formatTime(slotStartMinutes)}-${this.formatTime(slotEndMinutes)}`,
                이동시간: `${this.formatTime(newTravelStartMinutes)}-${this.formatTime(newTravelEndTimeMinutes)} (${travelDurationMinutes}분)`,
                조정된_수업: `${this.formatTime(newActivityStartTimeMinutes)}-${this.formatTime(newActivityEndTimeMinutes)}`,
                실제_거리: travelInfo.distanceText || `${(travelInfo.distance / 1000).toFixed(1)}km`,
                실제_소요시간: `${Math.floor(travelDurationSeconds / 60)}분 ${travelDurationSeconds % 60}초`,
                총_시간_증가: `${travelDurationMinutes}분`
            });

            // 방 금지시간 체크 (이동시간이 수업 전에 오므로 로직 수정)
            const blockedTimes = currentRoom.settings?.blockedTimes || [];
            for (const blocked of blockedTimes) {
                const blockedStart = this.parseTime(blocked.startTime);
                const blockedEnd = this.parseTime(blocked.endTime);

                // 이동시간 또는 활동시간이 금지시간과 겹치는지 체크
                const travelOverlap = newTravelStartMinutes < blockedEnd && newTravelEndTimeMinutes > blockedStart;
                const activityOverlap = newActivityStartTimeMinutes < blockedEnd && newActivityEndTimeMinutes > blockedStart;
                
                if (travelOverlap || activityOverlap) {
                    // ✅ 수정: 금지시간 이후로 이동+수업을 배치
                    newTravelStartMinutes = blockedEnd;
                    newTravelEndTimeMinutes = blockedEnd + travelDurationMinutes;
                    newActivityStartTimeMinutes = newTravelEndTimeMinutes;
                    newActivityEndTimeMinutes = newActivityStartTimeMinutes + activityDurationMinutes;
                    
                    console.log(`🚫 [금지시간 회피] ${blocked.name} (${blocked.startTime}-${blocked.endTime}), 이동+수업을 ${this.formatTime(blockedEnd)} 이후로 이동`);
                    break;
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
                    from: previousLocation.name,  // 🆕 출발지 이름
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
                from: previousLocation.name,
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
