/**
 * 이동 시간을 반영한 스케줄 재계산 서비스
 * 기존 자동배정 결과에 이동 시간을 추가하여 새로운 스케줄 생성
 */

import travelModeService from './travelModeService';
import { mergeConsecutiveTimeSlots } from '../utils/timetableHelpers';

class TravelScheduleCalculator {

  /**
   * 분 단위를 시간 문자열로 변환
   */
  formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  /**
   * 시간 문자열을 분 단위로 변환
   */
  parseTime(timeString) {
    if (!timeString || !timeString.includes(':')) {
      return 0;
    }
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * 하나의 블록을 10분 단위 슬롯으로 분할
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
   * 기존 시간표에 이동 시간을 반영하여 재계산
   * @param {Object} currentRoom - 현재 방 데이터
   * @param {string} travelMode - 이동 수단 ('normal', 'transit', 'driving', 'bicycling', 'walking')
   * @returns {Promise<Object>} - 재계산된 시간표 데이터
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
                memberLocations[userId.toString()] = { lat: m.user.addressLat, lng: m.user.addressLng, name: `${m.user.firstName} ${m.user.lastName}` };
            }
        }
    });

    // 1. Merge raw slots into activity blocks
    const mergedSlots = mergeConsecutiveTimeSlots(currentRoom.timeSlots);

    const processMergedSlot = async (mergedSlot) => {
        let userId = mergedSlot.user;
        if (typeof userId === 'object' && userId !== null) {
            userId = userId._id || userId.id;
        }
        if (!userId) {
            return this.unmergeBlock(mergedSlot);
        }

        const userIdStr = userId.toString();
        const memberLocation = memberLocations[userIdStr];
        if (!memberLocation) {
            return this.unmergeBlock(mergedSlot);
        }

        try {
            const travelInfo = await travelModeService.calculateTravelTime(
                { lat: owner.addressLat, lng: owner.addressLng },
                memberLocation,
                travelMode
            );

            const travelDurationSeconds = travelInfo.duration || 0;
            const travelDurationMinutes = Math.ceil(travelDurationSeconds / 60 / 10) * 10;

            if (travelDurationMinutes === 0) {
                return this.unmergeBlock(mergedSlot);
            }

            const slotStartMinutes = this.parseTime(mergedSlot.startTime);
            const slotEndMinutes = this.parseTime(mergedSlot.endTime);

            const newTravelEndTimeMinutes = slotStartMinutes + travelDurationMinutes;
            const newActivityStartTimeMinutes = newTravelEndTimeMinutes;
            const newActivityEndTimeMinutes = slotEndMinutes + travelDurationMinutes;

            const activityDurationMinutes = slotEndMinutes - slotStartMinutes;

            const travelBlock = {
                ...mergedSlot,
                isTravel: true,
                startTime: this.formatTime(slotStartMinutes),
                endTime: this.formatTime(newTravelEndTimeMinutes),
                subject: '이동시간',
                travelInfo: { ...travelInfo, durationText: `${travelDurationMinutes}분` },
            };

            const activityBlock = {
                ...mergedSlot,
                isTravel: false,
                startTime: this.formatTime(newActivityStartTimeMinutes),
                endTime: this.formatTime(newActivityEndTimeMinutes),
                subject: mergedSlot.subject || '수업',
            };

            const travelSlots10min = this.unmergeBlock(travelBlock);
            const activitySlots10min = this.unmergeBlock(activityBlock);

            return [...travelSlots10min, ...activitySlots10min];

        } catch (error) {
            return this.unmergeBlock(mergedSlot);
        }
    };

    const results = await Promise.all(mergedSlots.map(processMergedSlot));
    const flattenedSlots = results.flat();

    return {
        timeSlots: flattenedSlots,
        travelSlots: [],
        travelMode: travelMode
    };
  }
}

export default new TravelScheduleCalculator();
