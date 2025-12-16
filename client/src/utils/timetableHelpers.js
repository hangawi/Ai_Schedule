/**
 * ===================================================================================================
 * timetableHelpers.js - 타임테이블(시간표)의 슬롯 병합, 소유권 확인, 상태 계산 등 복잡한 로직을 처리하는 헬퍼 함수 모음
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/utils/timetableHelpers.js
 *
 * 🎯 주요 기능:
 *    - 연속된 시간대 슬롯을 사용자 및 날짜별로 그룹화하여 병합 (`mergeConsecutiveTimeSlots`).
 *    - 방 설정에서 시간 값을 안전하게 추출 (`getHourFromSettings`).
 *    - 하루 동안의 시간 슬롯 목록을 생성 (`generateDayTimeSlots`).
 *    - 특정 시간 슬롯이 방의 금지 시간 또는 예외 시간에 해당하는지 확인 (`getBlockedTimeInfo`, `getRoomExceptionInfo`).
 *    - 특정 시간 슬롯의 소유자(예약한 멤버) 정보 확인 (`getSlotOwner`).
 *    - 특정 시간 슬롯이 현재 사용자에 의해 선택되었는지 확인 (`isSlotSelected`).
 *    - 기본 스케줄(반복/특정일)을 병합 (`mergeDefaultSchedule`).
 *
 * 🔗 연결된 파일:
 *    - ./timeUtils.js: 시간 계산 유틸리티 사용.
 *    - ./dateUtils.js: 날짜 관련 유틸리티 사용.
 *    - ./timetableConstants.js: 요일, 색상 등 상수 사용.
 *    - ../components/timetable/TimetableGrid.js: 시간표를 렌더링하고 각 슬롯의 상태를 결정하는 데 이 헬퍼 함수들을 사용.
 *    - ../components/tabs/CoordinationTab/: 조율 탭에서 시간표 데이터를 처리하고 시각화하는 데 사용.
 *
 * 💡 UI 위치:
 *    - 조율 탭의 시간표 그리드(`TimetableGrid`)에서 각 시간 슬롯의 색상, 소유자 이름, 상태(예: 이동시간, 금지시간) 등을 결정하는 핵심 로직.
 *
 * ✏️ 수정 가이드:
 *    - 슬롯 병합 로직을 변경할 경우: `mergeConsecutiveTimeSlots` 또는 `mergeDefaultSchedule` 함수의 그룹화 및 병합 조건을 수정.
 *    - 슬롯의 소유자를 결정하는 로직을 변경할 경우: `getSlotOwner` 함수 내부에서 `bookedSlot`을 찾고 멤버 정보를 매핑하는 부분을 수정.
 *    - 금지 시간 또는 예외 시간 처리 로직을 변경할 경우: `getBlockedTimeInfo`, `getRoomExceptionInfo` 함수의 조건을 수정.
 *
 * 📝 참고사항:
 *    - `mergeConsecutiveTimeSlots`는 이동 시간(`isTravel`) 여부도 병합 조건으로 고려함.
 *    - `getSlotOwner`는 예약된 슬롯, 이동 시간 슬롯, 그리고 예약되지 않은 슬롯 등 다양한 경우를 처리함.
 *    - 함수들은 데이터 구조가 다른 여러 종류의 스케줄 객체(Google Calendar, 로컬 이벤트, 프로필 선호시간 등)를 처리할 수 있도록 방어적으로 작성됨.
 *
 * ===================================================================================================
 */

import { timeToMinutes, minutesToTime } from './timeUtils';
import { safeDateToISOString, getDayIndex } from './dateUtils';
import { DAY_NAMES, DEFAULT_COLORS } from './timetableConstants';

/**
 * mergeConsecutiveTimeSlots
 * @description 날짜와 사용자별로 슬롯을 그룹화하고, 연속된 시간대 슬롯을 하나의 블록으로 병합합니다.
 * @param {Array<object>} slots - 병합할 시간 슬롯의 배열.
 * @returns {Array<object>} 연속된 슬롯이 병합된 스케줄 객체의 배열.
 */
export const mergeConsecutiveTimeSlots = (slots) => {
  if (!slots || slots.length === 0) return [];

  // 날짜와 사용자별로 그룹화
  const groupedSlots = {};

  slots.forEach(slot => {
    const userId = slot.user?._id || slot.user;
    const dateKey = slot.date ? new Date(slot.date).toISOString().split('T')[0] : 'no-date';
    const key = `${userId}-${dateKey}`;

    if (!groupedSlots[key]) {
      groupedSlots[key] = [];
    }
    groupedSlots[key].push(slot);
  });

  const mergedSlots = [];

  Object.values(groupedSlots).forEach(userSlots => {
    const sortedSlots = userSlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    let currentGroup = null;

    for (const slot of sortedSlots) {
      const getUserId = (s) => s.user?._id || s.user;
      if (currentGroup &&
          currentGroup.endTime === slot.startTime &&
          getUserId(currentGroup) === getUserId(slot) &&
          currentGroup.isTravel === slot.isTravel) {
        // 연속된 슬롯이므로 병합
        currentGroup.endTime = slot.endTime;
        currentGroup.isMerged = true;
        if (!currentGroup.originalSlots) {
          currentGroup.originalSlots = [{ ...currentGroup }];
        }
        currentGroup.originalSlots.push(slot);
      } else {
        // 새로운 그룹 시작
        if (currentGroup) {
          mergedSlots.push(currentGroup);
        }
        currentGroup = { ...slot };
        delete currentGroup.isMerged;
        delete currentGroup.originalSlots;
      }
    }

    if (currentGroup) {
      mergedSlots.push(currentGroup);
    }
  });

  return mergedSlots;
};

/**
 * getHourFromSettings
 * @description 방 설정 객체에서 시간 값을 안전하게 추출합니다. (문자열, 숫자 등 다양한 형식 처리)
 * @param {string|number} setting - 시간 설정 값 (예: "09:00" 또는 9).
 * @param {string} defaultValue - 설정 값이 없을 경우 사용할 기본값.
 * @returns {number} 추출된 시간(hour).
 */
export const getHourFromSettings = (setting, defaultValue) => {
  if (setting === null || setting === undefined) return parseInt(defaultValue, 10);
  if (typeof setting === 'string') return parseInt(String(setting).split(':')[0], 10);
  if (typeof setting === 'number') return setting;
  return parseInt(defaultValue, 10);
};

/**
 * generateDayTimeSlots
 * @description 주어진 시작 시간과 종료 시간 사이의 10분 단위 시간 슬롯 목록을 생성합니다.
 * @param {number} scheduleStartHour - 시작 시간.
 * @param {number} scheduleEndHour - 종료 시간.
 * @returns {string[]} HH:MM 형식의 시간 문자열 배열.
 */
export const generateDayTimeSlots = (scheduleStartHour, scheduleEndHour) => {
  const timeSlotsInDay = [];
  for (let h = scheduleStartHour; h < scheduleEndHour; h++) {
    for (let m = 0; m < 60; m += 10) {
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      timeSlotsInDay.push(time);
    }
  }
  return timeSlotsInDay;
};

/**
 * getBlockedTimeInfo
 * @description 특정 시간이 방의 금지 시간대에 속하는지 확인하고, 그렇다면 해당 금지 시간 정보를 반환합니다.
 * @param {string} time - 확인할 시간 (HH:MM 형식).
 * @param {object} roomSettings - 방 설정 객체.
 * @returns {object|null} 금지 시간 정보 객체 또는 null.
 */
export const getBlockedTimeInfo = (time, roomSettings) => {
  if (!roomSettings?.blockedTimes || roomSettings.blockedTimes.length === 0) {
    return null;
  }

  const blockedTime = roomSettings.blockedTimes.find(blockedTime => {
    return time >= blockedTime.startTime && time < blockedTime.endTime;
  });

  return blockedTime || null;
};

/**
 * getRoomExceptionInfo
 * @description 특정 날짜와 시간이 방의 예외 시간(휴일 등)에 속하는지 확인하고, 그렇다면 해당 예외 시간 정보를 반환합니다.
 * @param {Date} date - 확인할 날짜.
 * @param {string} time - 확인할 시간 (HH:MM 형식).
 * @param {object} roomSettings - 방 설정 객체.
 * @returns {object|null} 예외 시간 정보 객체 또는 null.
 */
export const getRoomExceptionInfo = (date, time, roomSettings) => {
  if (!roomSettings?.roomExceptions || roomSettings.roomExceptions.length === 0) {
    return null;
  }


  const slotDateTime = new Date(date);
  slotDateTime.setHours(parseInt(time.split(':')[0]), parseInt(time.split(':')[1]), 0, 0);
  const slotEndTime = new Date(date);
  slotEndTime.setHours(parseInt(time.split(':')[0]), parseInt(time.split(':')[1]) + 10, 0, 0);

  const exception = roomSettings.roomExceptions.find(ex => {
    if (ex.type === 'daily_recurring') {
      const slotDayOfWeek = date.getDay();
      if (slotDayOfWeek === ex.dayOfWeek) {
        return time >= ex.startTime && time < ex.endTime;
      }
    } else if (ex.type === 'date_specific') {
      const exStartDate = new Date(ex.startDate);
      const exEndDate = new Date(ex.endDate);

      // 14:40 문제 디버깅용 로깅
      if (time === '14:40' || time === '15:00') {
      }

      return (slotDateTime < exEndDate && slotEndTime > exStartDate);
    }
    return false;
  });


  return exception || null;
};

/**
 * getSlotOwner
 * @description 특정 날짜와 시간의 슬롯을 누가 점유하고 있는지(소유자) 정보를 반환합니다. (이동시간, 활동, 빈 슬롯 등)
 * @param {Date} date - 확인할 날짜.
 * @param {string} time - 확인할 시간 (HH:MM 형식).
 * @param {Array<object>} timeSlots - 전체 시간 슬롯 목록.
 * @param {Array<object>} members - 방 멤버 목록.
 * @param {object} currentUser - 현재 로그인된 사용자 정보.
 * @param {boolean} isRoomOwner - 현재 사용자의 방장 여부.
 * @returns {object|null} 슬롯 소유자 정보(이름, 색상, ID 등) 또는 null.
 */
export const getSlotOwner = (date, time, timeSlots, members, currentUser, isRoomOwner) => {
  if (!timeSlots || !time || !date) return null;

  const currentTime = time.trim();
  const currentMinutes = timeToMinutes(currentTime);
  const currentDateStr = date.toISOString().split('T')[0];

  // Find the specific slot for the given time
  const bookedSlot = (timeSlots || []).find(slot => {
    if (!slot || !slot.date || !slot.startTime || !slot.endTime) return false;
    
    const slotDateStr = new Date(slot.date).toISOString().split('T')[0];
    if (slotDateStr !== currentDateStr) return false;

    const startMinutes = timeToMinutes(slot.startTime);
    const endMinutes = timeToMinutes(slot.endTime);
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  });

  // 3. If a slot is found, determine its type and return info
  if (bookedSlot) {
    // Handle travel slots
    if (bookedSlot.isTravel) {
        return {
            name: bookedSlot.subject,
            color: '#20B2AA', // LightSeaGreen (background)
            textColor: '#000000', // Black (text)
            isTravel: true,
            userId: 'travel',
            subject: bookedSlot.subject,
            travelInfo: bookedSlot.travelInfo
        };
    }

    // Handle activity slots
    let userId = bookedSlot.userId || bookedSlot.user;
    if (typeof userId === 'object' && userId !== null) {
      userId = userId._id || userId.id;
    }

    const member = (members || []).find(m => {
      const memberId = m.user?._id?.toString() || m.user?.id?.toString();
      return memberId && userId && memberId === userId.toString();
    });

    if (member) {
      const memberData = member.user || member;
      const memberName = `${memberData.firstName || ''} ${memberData.lastName || ''}`.trim() || '알 수 없음';
      const actualUserId = member.user?._id || member.user?.id || member._id || member.id;

      return {
        name: memberName,
        color: member.color || DEFAULT_COLORS.UNKNOWN_USER,
        userId: userId,
        actualUserId: actualUserId,
        subject: bookedSlot.subject,
        isTravel: false, // Explicitly set
        travelInfo: bookedSlot.travelInfo
      };
    }

    // Fallback for unknown slots
    return {
      name: '알 수 없음',
      color: DEFAULT_COLORS.UNKNOWN_USER,
      userId: null,
      subject: bookedSlot.subject
    };
  }

  // 4. If no slot is found, return null
  return null;
};

/**
 * isSlotSelected
 * @description 특정 날짜와 시간의 슬롯이 현재 사용자에 의해 선택되었는지 확인합니다.
 * @param {Date} date - 확인할 날짜.
 * @param {string} time - 확인할 시간 (HH:MM 형식).
 * @param {Array<object>} currentSelectedSlots - 현재 사용자가 선택한 슬롯 목록.
 * @returns {boolean} 선택 여부.
 */
export const isSlotSelected = (date, time, currentSelectedSlots) => {
  // Add defensive check for date
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return false; // Or handle as appropriate
  }
  const dayIndex = getDayIndex(date);
  if (dayIndex === -1) return false; // Weekend
  const dayKey = DAY_NAMES[dayIndex];
  return currentSelectedSlots.some(s => s.day === dayKey && s.startTime === time);
};

/**
 * mergeDefaultSchedule
 * @description 프로필의 기본 스케줄(반복 일정, 특정일 일정)을 그룹화하고 연속된 슬롯을 병합합니다.
 * @param {Array<object>} schedule - 병합할 프로필 스케줄 목록.
 * @returns {Array<object>} 연속된 슬롯이 병합된 스케줄 객체의 배열.
 */
export const mergeDefaultSchedule = (schedule) => {
  if (!schedule || schedule.length === 0) return [];

  const recurringGroups = {};
  const dateGroups = {};

  // 1. Group slots
  schedule.forEach(slot => {
    if (slot.specificDate) {
      if (!dateGroups[slot.specificDate]) dateGroups[slot.specificDate] = [];
      dateGroups[slot.specificDate].push(slot);
    } else {
      if (!recurringGroups[slot.dayOfWeek]) recurringGroups[slot.dayOfWeek] = [];
      recurringGroups[slot.dayOfWeek].push(slot);
    }
  });

  const finalMergedSlots = [];

  // 2. Merge each group
  const mergeGroup = (group) => {
    const sortedSlots = group.sort((a, b) => a.startTime.localeCompare(b.startTime));
    let currentBlock = null;
    for (const slot of sortedSlots) {
      if (currentBlock &&
          currentBlock.priority === slot.priority &&
          currentBlock.endTime === slot.startTime) {
        currentBlock.endTime = slot.endTime;
      } else {
        if (currentBlock) finalMergedSlots.push(currentBlock);
        currentBlock = { ...slot };
      }
    }
    if (currentBlock) finalMergedSlots.push(currentBlock);
  };

  Object.values(recurringGroups).forEach(mergeGroup);
  Object.values(dateGroups).forEach(mergeGroup);

  return finalMergedSlots;
};