/**
 * 이동 시간을 반영한 스케줄 재계산 서비스
 * 기존 자동배정 결과에 이동 시간을 추가하여 새로운 스케줄 생성
 */

import travelModeService from './travelModeService';

class TravelScheduleCalculator {
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

    // 일반 모드는 기존 시간표 그대로 반환
    if (travelMode === 'normal') {
      return {
        timeSlots: currentRoom.timeSlots,
        travelSlots: [],
        travelMode: 'normal'
      };
    }

    const owner = currentRoom.owner;
    const members = currentRoom.members;
    const timeSlots = currentRoom.timeSlots;

    // 1. 날짜별로 시간표 그룹화
    const slotsByDate = this.groupSlotsByDate(timeSlots);

    // 2. 각 날짜별로 이동 순서 계산 및 이동 시간 추가
    const enhancedSchedule = await this.calculateDailyTravelTimes(
      slotsByDate,
      owner,
      members,
      travelMode
    );

    return enhancedSchedule;
  }

  /**
   * 날짜별로 시간 슬롯 그룹화
   */
  groupSlotsByDate(timeSlots) {
    const grouped = {};

    timeSlots.forEach(slot => {
      const dateKey = new Date(slot.date).toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(slot);
    });

    // 각 날짜별로 시간순 정렬
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => {
        const timeA = a.startTime.split(':').map(Number);
        const timeB = b.startTime.split(':').map(Number);
        return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
      });
    });

    return grouped;
  }

  /**
   * 날짜별로 이동 시간 계산
   */
  async calculateDailyTravelTimes(slotsByDate, owner, members, travelMode) {
    console.log('[TravelCalculator] 이동 시간 계산 시작');
    console.log('[TravelCalculator] Owner:', owner);
    console.log('[TravelCalculator] Members:', members.length);
    console.log('[TravelCalculator] Travel Mode:', travelMode);

    const allTimeSlots = [];
    const allTravelSlots = [];

    for (const [date, slots] of Object.entries(slotsByDate)) {
      console.log(`[TravelCalculator] 날짜 ${date} 처리 중, 슬롯 수:`, slots.length);
      const dateObj = new Date(date);

      // 해당 날짜의 멤버별 슬롯 추출
      const memberSlots = this.groupSlotsByMember(slots, members);
      console.log('[TravelCalculator] 멤버별 슬롯:', Object.keys(memberSlots).length, '명');

      // 방문 순서 계산 (시간순)
      const sortedMembers = this.sortMembersByTime(memberSlots);
      console.log('[TravelCalculator] 정렬된 멤버 순서:', sortedMembers.map(m => m.memberInfo?.user?.firstName));

      let currentLocation = {
        lat: owner.addressLat,
        lng: owner.addressLng,
        name: `${owner.firstName} ${owner.lastName}` || '방장'
      };

      console.log('[TravelCalculator] 시작 위치 (방장):', currentLocation);

      let previousEndTime = null;

      // 각 멤버별로 이동 시간 계산
      for (let i = 0; i < sortedMembers.length; i++) {
        const { memberId, memberInfo, slots: memberDaySlots } = sortedMembers[i];
        console.log(`[TravelCalculator] 멤버 ${i+1}/${sortedMembers.length} 처리:`, memberInfo?.user?.firstName);

        // 첫 번째 슬롯의 시작 시간
        const firstSlot = memberDaySlots[0];
        const memberStartTime = this.parseTime(firstSlot.startTime);

        // 이동 시간 계산
        if (previousEndTime) {
          try {
            const destination = {
              lat: memberInfo.user.addressLat,
              lng: memberInfo.user.addressLng
            };

            console.log('[TravelCalculator] 이동 계산:', currentLocation, '->', destination);

            const travelInfo = await travelModeService.calculateTravelTime(
              currentLocation,
              destination,
              travelMode
            );

            console.log('[TravelCalculator] 이동 정보:', travelInfo);

            // 이동 슬롯 생성
            const travelSlot = {
              type: 'travel',
              date: dateObj,
              from: currentLocation.name,
              to: `${memberInfo.user.firstName} ${memberInfo.user.lastName}`,
              travelInfo: travelInfo,
              travelMode: travelMode,
              startTime: previousEndTime,
              duration: travelModeService.convertToSlots(travelInfo.duration)
            };

            console.log('[TravelCalculator] 이동 슬롯 생성:', travelSlot);
            allTravelSlots.push(travelSlot);
          } catch (error) {
            console.error('[TravelCalculator] 이동 시간 계산 실패:', error);
          }
        }

        // 멤버의 실제 슬롯 추가
        allTimeSlots.push(...memberDaySlots);

        // 마지막 슬롯의 종료 시간 업데이트
        const lastSlot = memberDaySlots[memberDaySlots.length - 1];
        previousEndTime = lastSlot.endTime;

        // 현재 위치 업데이트
        currentLocation = {
          lat: memberInfo.user.addressLat,
          lng: memberInfo.user.addressLng,
          name: `${memberInfo.user.firstName} ${memberInfo.user.lastName}`
        };
      }
    }

    console.log('[TravelCalculator] 계산 완료!');
    console.log('[TravelCalculator] 총 timeSlots:', allTimeSlots.length);
    console.log('[TravelCalculator] 총 travelSlots:', allTravelSlots.length);

    return {
      timeSlots: allTimeSlots,
      travelSlots: allTravelSlots,
      travelMode: travelMode
    };
  }

  /**
   * 멤버별로 슬롯 그룹화
   */
  groupSlotsByMember(slots, members) {
    const grouped = {};

    slots.forEach(slot => {
      const userId = slot.user._id ? slot.user._id.toString() : slot.user.toString();

      if (!grouped[userId]) {
        const memberInfo = members.find(m =>
          (m.user._id ? m.user._id.toString() : m.user.toString()) === userId
        );

        grouped[userId] = {
          memberId: userId,
          memberInfo: memberInfo,
          slots: []
        };
      }

      grouped[userId].slots.push(slot);
    });

    return grouped;
  }

  /**
   * 시간순으로 멤버 정렬
   */
  sortMembersByTime(memberSlots) {
    return Object.values(memberSlots).sort((a, b) => {
      const timeA = this.parseTime(a.slots[0].startTime);
      const timeB = this.parseTime(b.slots[0].startTime);
      return timeA - timeB;
    });
  }

  /**
   * 시간 문자열을 분 단위로 변환
   */
  parseTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * 분 단위를 시간 문자열로 변환
   */
  formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  /**
   * 이동 시간을 포함한 전체 스케줄 타임라인 생성
   * (주간/월간 뷰에서 사용)
   */
  generateTimelineWithTravel(timeSlots, travelSlots) {
    const timeline = [];

    // 모든 슬롯 합치기
    const allSlots = [
      ...timeSlots.map(slot => ({ ...slot, type: 'activity' })),
      ...travelSlots
    ];

    // 날짜 및 시간순 정렬
    allSlots.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA - dateB;
      }
      return this.parseTime(a.startTime) - this.parseTime(b.startTime);
    });

    return allSlots;
  }

  /**
   * 주간 뷰용 데이터 변환
   */
  formatForWeekView(timeSlots, travelSlots, weekStartDate) {
    const weekData = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: []
    };

    const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const timeline = this.generateTimelineWithTravel(timeSlots, travelSlots);

    timeline.forEach(slot => {
      const slotDate = new Date(slot.date);
      const dayIndex = slotDate.getDay();
      const dayName = dayMap[dayIndex];

      if (weekData[dayName]) {
        weekData[dayName].push(slot);
      }
    });

    return weekData;
  }

  /**
   * 월간 뷰용 데이터 변환
   */
  formatForMonthView(timeSlots, travelSlots) {
    const monthData = {};
    const timeline = this.generateTimelineWithTravel(timeSlots, travelSlots);

    timeline.forEach(slot => {
      const dateKey = new Date(slot.date).toISOString().split('T')[0];

      if (!monthData[dateKey]) {
        monthData[dateKey] = [];
      }

      monthData[dateKey].push(slot);
    });

    return monthData;
  }
}

export default new TravelScheduleCalculator();
