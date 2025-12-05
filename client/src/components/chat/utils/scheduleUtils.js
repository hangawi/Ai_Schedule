/**
 * ===================================================================================================
 * scheduleUtils.js - 스케줄 관련 유틸리티 함수들
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/chat/utils
 *
 * 🎯 주요 기능:
 *    - 시간 형식 변환 및 데이터 정제
 *    - 특정 요일에 해당하는 이번 주 날짜 계산
 *    - OCR로 추출된 스케줄을 캘린더에 저장할 수 있는 'personalTime' 형식으로 변환
 *    - 변환된 스케줄을 서버에 저장하여 캘린더에 최종적으로 추가
 *
 * 🔗 연결된 파일:
 *    - ../../../services/userService - 사용자 스케줄을 가져오고 업데이트하는 API 서비스
 *    - ../constants/chatConstants - 기본 색상, 정규식 등 상수
 *    - ./chatUtils - `mapDaysToNumbers` 등 공통 유틸리티 함수
 *    - ../handlers/scheduleHandlers.js - `addSchedulesToCalendar` 함수를 사용
 *
 * 💡 UI 위치:
 *    - 이 파일은 UI를 직접 렌더링하지 않으나, 챗봇 및 시간표 최적화 모달에서 '일정 추가' 기능의 핵심 로직을 담당합니다.
 *
 * ✏️ 수정 가이드:
 *    - 캘린더에 저장되는 `personalTime` 객체의 스키마 변경 시: `sanitizeExistingSchedule`, `convertScheduleToPersonalTimeWeek`, `convertScheduleToPersonalTimeMonth` 함수 수정
 *    - '이번 주'의 기준 변경 시: `calculateThisWeekDate` 함수 수정
 *    - 서버에 스케줄 저장 전 데이터 가공 로직 변경: `addSchedulesToCalendar` 함수 내 `validatedPersonalTimes` 생성 로직 수정
 *
 * 📝 참고사항:
 *    - `addSchedulesToCalendar` 함수는 `applyScope` 파라미터('week' 또는 'month')에 따라 일정을 '반복' 또는 '단일(이번 주)'로 다르게 처리합니다.
 *    - 스케줄 추가 후 `calendarUpdate` 커스텀 이벤트를 발생시켜 프로필 탭의 캘린더를 갱신합니다.
 *    - ID 충돌을 피하기 위해 기존 스케줄에서 가장 큰 ID를 찾아 새 스케줄의 ID를 순차적으로 부여합니다.
 *
 * ===================================================================================================
 */

import { userService } from '../../../services/userService';
import { DEFAULT_COLORS, TIME_FORMAT_REGEX } from '../constants/chatConstants';
import { validateTimeFormat, mapDaysToNumbers } from './chatUtils';

/**
 * convertISOToTimeFormat
 *
 * @description ISO 8601 형식의 날짜/시간 문자열에서 "HH:MM" 형식의 시간 부분만 추출합니다.
 * @param {string | null} isoString - 변환할 ISO 형식 문자열
 * @returns {string | null} "HH:MM" 형식의 시간 문자열. 유효하지 않은 입력 시 원본 문자열 또는 null을 반환합니다.
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
 * sanitizeExistingSchedule
 *
 * @description 기존 개인 시간(personalTime) 객체를 정제하고 검증합니다.
 *              필수 필드(startTime, endTime)의 유무를 확인하고, 시간 형식을 변환하며, 기본값을 설정합니다.
 * @param {Object} personalTime - 검증 및 정제할 개인 시간 객체
 * @returns {Object | null} 정제된 개인 시간 객체. 유효하지 않은 경우 null을 반환합니다.
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
 * calculateThisWeekDate
 *
 * @description 목표 요일(1~7)에 해당하는 '이번 주'의 날짜(Date 객체)를 계산합니다.
 * @param {number} targetDay - 목표 요일 (1=월, 2=화, ..., 7=일)
 * @returns {Date} 계산된 '이번 주'의 해당 요일 날짜
 *
 * @note
 * - 주의 시작은 월요일입니다.
 * - 오늘이 일요일(getDay() === 0)인 경우, 월요일을 6일 전으로 계산합니다.
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
 * convertScheduleToPersonalTimeWeek
 *
 * @description 일반 스케줄 객체를 '이번 주 특정일'에만 적용되는 personalTime 형식으로 변환합니다.
 * @param {Object} schedule - 변환할 스케줄 객체 { title, startTime, endTime }
 * @param {number} targetDay - 적용할 요일 (1=월, ..., 7=일)
 * @param {number} maxId - 현재까지 사용된 가장 큰 ID 값
 * @returns {Object | null} 변환된 personalTime 객체. 유효하지 않은 경우 null을 반환합니다.
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
 * convertScheduleToPersonalTimeMonth
 *
 * @description 일반 스케줄 객체를 '매주 반복'되는 personalTime 형식으로 변환합니다.
 * @param {Object} schedule - 변환할 스케줄 객체 { title, startTime, endTime }
 * @param {Array<number>} mappedDays - 적용할 요일의 숫자 배열 [1, 3, 5]
 * @param {number} maxId - 현재까지 사용된 가장 큰 ID 값
 * @returns {Object | null} 변환된 personalTime 객체. 유효하지 않은 경우 null을 반환합니다.
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
 * addSchedulesToCalendar
 *
 * @description 추출된 스케줄 목록을 사용자의 캘린더(personalTimes)에 추가하는 비동기 함수입니다.
 * @param {Array<Object>} schedules - 캘린더에 추가할 스케줄 객체 목록
 * @param {string} [applyScope='month'] - 적용 범위 ('week' 또는 'month')
 * @param {Function} [onEventUpdate] - 이벤트 업데이트 시 호출될 콜백 함수
 * @returns {Promise<Object>} 성공 여부와 추가된 개수를 포함하는 결과 객체
 *
 * @example
 * const result = await addSchedulesToCalendar(schedules, 'week', refreshCalendar);
 * if (result.success) {
 *   console.log(`${result.count}개의 일정이 추가되었습니다.`);
 * }
 *
 * @note
 * - `applyScope`에 따라 '이번 주' 또는 '매주 반복'으로 스케줄을 변환합니다.
 * - 기존 스케줄과 새로운 스케줄을 병합하고 최종 유효성 검사를 거친 후 서버에 업데이트 요청을 보냅니다.
 * - 성공적으로 업데이트되면 `calendarUpdate` 커스텀 이벤트를 발생시켜 다른 컴포넌트에 알립니다.
 */
export const addSchedulesToCalendar = async (schedules, applyScope = 'month', onEventUpdate) => {
  try {
    // 기존 스케줄 가져오기
    const userSchedule = await userService.getUserSchedule();
    const existingPersonalTimes = (userSchedule.personalTimes || [])
      .map(pt => sanitizeExistingSchedule(pt))
      .filter(pt => pt !== null);

    // 가장 큰 id 값 찾기
    let maxId = Math.max(0, ...existingPersonalTimes.map(pt => (typeof pt.id === 'number' ? pt.id : 0)));

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
    console.error("Error adding schedules to calendar:", error);
    return { success: false, error: error.message || '알 수 없는 오류가 발생했습니다' };
  }
};
