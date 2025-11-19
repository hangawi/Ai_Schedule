/**
 * ============================================================================
 * scheduleUtils.js - 스케줄 관련 유틸리티 함수들
 * ============================================================================
 */

import { userService } from '../../../services/userService';
import { DAY_MAP, DEFAULT_COLORS, TIME_FORMAT_REGEX } from '../constants/chatConstants';
import { validateTimeFormat, mapDaysToNumbers } from './chatUtils';

/**
 * ISO 시간 문자열을 HH:MM 형식으로 변환
 */
export const convertISOToTimeFormat = (isoString) => {
  if (!isoString) return null;

  if (isoString.includes('T') || isoString.includes(':00+')) {
    const date = new Date(isoString);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  return isoString;
};

/**
 * 기존 스케줄 데이터를 정제하고 검증
 */
export const sanitizeExistingSchedule = (personalTime) => {
  // startTime과 endTime이 제대로 있는지 확인
  const hasValidTimes = personalTime.startTime && personalTime.endTime &&
    typeof personalTime.startTime === 'string' &&
    typeof personalTime.endTime === 'string' &&
    personalTime.startTime.trim() !== '' &&
    personalTime.endTime.trim() !== '';

  if (!hasValidTimes) return null;

  // startTime이 ISO 형식인 경우 HH:MM 형식으로 변환
  let startTime = convertISOToTimeFormat(personalTime.startTime);
  let endTime = convertISOToTimeFormat(personalTime.endTime);

  return {
    id: personalTime.id || Date.now() + Math.floor(Math.random() * 1000000),
    title: personalTime.title || '일정',
    type: personalTime.type || 'event',
    startTime,
    endTime,
    days: personalTime.days || [],
    isRecurring: personalTime.isRecurring !== undefined ? personalTime.isRecurring : true,
    specificDate: personalTime.specificDate || undefined,
    color: personalTime.color || DEFAULT_COLORS.SCHEDULE
  };
};

/**
 * 이번 주 날짜 계산 (이번 주만 옵션)
 */
export const calculateThisWeekDate = (targetDay) => {
  const today = new Date();
  const currentDay = today.getDay(); // 0=일, 1=월, ..., 6=토

  // 이번 주 월요일 날짜 계산
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const thisWeekMonday = new Date(today);
  thisWeekMonday.setDate(today.getDate() + mondayOffset);

  // targetDay는 1=월, 2=화, ..., 7=일
  const daysFromMonday = targetDay === 7 ? 6 : targetDay - 1;

  const targetDate = new Date(thisWeekMonday);
  targetDate.setDate(thisWeekMonday.getDate() + daysFromMonday);

  return targetDate;
};

/**
 * 스케줄을 personalTime 형식으로 변환 (이번 주만)
 */
export const convertScheduleToPersonalTimeWeek = (schedule, targetDay, maxId) => {
  const targetDate = calculateThisWeekDate(targetDay);

  // 시간 형식 검증
  if (!validateTimeFormat(schedule.startTime) || !validateTimeFormat(schedule.endTime)) {
    return null;
  }

  // targetDate 유효성 검사
  if (isNaN(targetDate.getTime())) {
    return null;
  }

  return {
    id: maxId + 1,
    title: schedule.title || '수업',
    type: 'study',
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    days: [targetDay],
    isRecurring: false,
    specificDate: targetDate.toISOString().split('T')[0], // YYYY-MM-DD
    color: DEFAULT_COLORS.SCHEDULE
  };
};

/**
 * 스케줄을 personalTime 형식으로 변환 (전체 달 - 반복)
 */
export const convertScheduleToPersonalTimeMonth = (schedule, mappedDays, maxId) => {
  // 시간 형식 검증
  if (!validateTimeFormat(schedule.startTime) || !validateTimeFormat(schedule.endTime)) {
    return null;
  }

  return {
    id: maxId + 1,
    title: schedule.title || '수업',
    type: 'study',
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    days: mappedDays,
    isRecurring: true,
    color: DEFAULT_COLORS.SCHEDULE
  };
};

/**
 * 스케줄을 캘린더에 추가하는 함수
 */
export const addSchedulesToCalendar = async (schedules, applyScope = 'month', onEventUpdate) => {
  try {
    // 기존 스케줄 가져오기
    const userSchedule = await userService.getUserSchedule();
    const existingPersonalTimes = (userSchedule.personalTimes || [])
      .map(pt => sanitizeExistingSchedule(pt))
      .filter(pt => pt !== null);

    // 가장 큰 id 값 찾기
    let maxId = Math.max(0, ...existingPersonalTimes.map(pt => pt.id || 0));

    const newPersonalTimes = [];

    schedules.forEach((schedule) => {
      if (!schedule.days || (Array.isArray(schedule.days) && schedule.days.length === 0)) {
        return; // 요일 정보가 없으면 스킵
      }

      if (!schedule.startTime || !schedule.endTime) {
        return;
      }

      // 요일 매핑
      const mappedDays = mapDaysToNumbers(schedule.days);

      if (mappedDays.length === 0) {
        return;
      }

      // 이번 주만 옵션일 경우 각 요일별로 이번 주 날짜 계산
      if (applyScope === 'week') {
        mappedDays.forEach(targetDay => {
          const converted = convertScheduleToPersonalTimeWeek(schedule, targetDay, maxId);
          if (converted) {
            maxId++;
            newPersonalTimes.push(converted);
          }
        });
      } else {
        // 전체 달 옵션 (반복)
        const converted = convertScheduleToPersonalTimeMonth(schedule, mappedDays, maxId);
        if (converted) {
          maxId++;
          newPersonalTimes.push(converted);
        }
      }
    });

    // 기존 일정과 합치기 (유효한 것만)
    const validExistingTimes = existingPersonalTimes.filter(pt =>
      pt.startTime && pt.endTime &&
      pt.startTime !== 'null' && pt.endTime !== 'null'
    );
    const updatedPersonalTimes = [...validExistingTimes, ...newPersonalTimes];

    // 최종 검증 - 모든 항목이 startTime과 endTime을 가지고 있는지 확인
    const validatedPersonalTimes = updatedPersonalTimes.filter(pt => {
      const isValid = pt.startTime && pt.endTime &&
        TIME_FORMAT_REGEX.test(pt.startTime) &&
        TIME_FORMAT_REGEX.test(pt.endTime);

      return isValid;
    });

    // 서버에 저장
    await userService.updateUserSchedule({
      ...userSchedule,
      personalTimes: validatedPersonalTimes
    });

    if (onEventUpdate) {
      onEventUpdate();
    }

    // ProfileTab의 calendarUpdate 이벤트 발생
    window.dispatchEvent(new CustomEvent('calendarUpdate', {
      detail: { type: 'schedule_added', context: 'profile' }
    }));

    return { success: true, count: newPersonalTimes.length };
  } catch (error) {
    return { success: false, error: error.message || '알 수 없는 오류가 발생했습니다' };
  }
};
