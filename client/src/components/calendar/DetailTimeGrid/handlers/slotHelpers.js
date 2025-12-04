/**
 * ===================================================================================================
 * slotHelpers.js - 시간 슬롯 정보 조회 헬퍼 함수들
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/calendar/DetailTimeGrid/handlers/slotHelpers.js
 *
 * 🎯 주요 기능:
 *    - 특정 시간대의 선호시간 슬롯 정보 조회
 *    - 특정 시간대의 예외일정(휴무일 등) 조회
 *    - 특정 시간대의 개인시간(수면, 식사 등) 조회
 *    - 시간 범위 내 예외일정 존재 여부 확인
 *    - 병합/분할 모드에 따른 슬롯 검색 처리
 *
 * 🔗 연결된 파일:
 *    - ../utils/timeCalculations.js - timeToMinutes 유틸 함수
 *    - ../utils/dateFormatters.js - getDateString 유틸 함수
 *    - ../index.js - 메인 DetailTimeGrid 컴포넌트에서 사용
 *
 * 💡 UI 위치:
 *    - 탭: 내프로필
 *    - 섹션: 세부 시간표 모달의 각 시간 슬롯
 *    - 화면: 시간 슬롯 클릭 시 해당 시간의 정보를 조회하는 데 사용됨
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 시간 슬롯 정보 조회 로직이 변경됨
 *    - 슬롯 검색 조건 변경: getSlotInfo 함수의 dateMatches 또는 시간 비교 로직 수정
 *    - 예외일정 검색 로직 변경: getExceptionForSlot 함수 수정
 *    - 개인시간 overnight 처리 변경: getPersonalTimeForSlot 함수의 endMinutes <= startMinutes 분기 수정
 *
 * 📝 참고사항:
 *    - specificDate가 있으면 특정 날짜로, 없으면 요일(dayOfWeek)로 매칭함
 *    - 병합 모드에서는 시간 범위로 검색, 분할 모드에서는 정확한 startTime으로 검색
 *    - 개인시간은 overnight(다음날로 넘어가는 시간, 예: 수면) 처리를 지원함
 *    - 일요일은 dayOfWeek가 0이지만 개인시간에서는 7로 변환됨
 *    - ISO 형식("2025-09-26T10:00:00.000Z")과 "HH:MM" 형식을 모두 지원함
 *
 * ===================================================================================================
 */

import { timeToMinutes } from '../utils/timeCalculations';
import { getDateString } from '../utils/dateFormatters';

/**
 * getSlotInfo - 특정 시간대의 선호시간 슬롯 정보 조회
 *
 * @description 주어진 시간대에 해당하는 선호시간 슬롯을 찾아 반환하는 함수
 * @param {string} startTime - 조회할 시간 (HH:MM 형식)
 * @param {Date} selectedDate - 선택된 날짜
 * @param {Array} schedule - 전체 스케줄 배열 (분할 모드용)
 * @param {Array} mergedSchedule - 병합된 스케줄 배열 (병합 모드용)
 * @param {boolean} showMerged - 병합 모드 여부
 *
 * @returns {Object|null} 해당 시간의 슬롯 정보 또는 null
 *
 * @example
 * const slotInfo = getSlotInfo('09:00', selectedDate, schedule, mergedSchedule, false);
 *
 * @note
 * - 병합 모드에서는 시간 범위 내에 포함되는지 확인 (currentTimeMinutes >= slotStartMinutes && currentTimeMinutes < slotEndMinutes)
 * - 분할 모드에서는 정확한 startTime 매칭
 * - specificDate가 있으면 날짜로, 없으면 dayOfWeek로 매칭
 */
// 슬롯 정보 조회 함수들

export const getSlotInfo = (startTime, selectedDate, schedule, mergedSchedule, showMerged) => {
  const dayOfWeek = selectedDate.getDay();
  const dateStr = getDateString(selectedDate);
  const currentSchedule = showMerged ? mergedSchedule : schedule;

  if (showMerged) {
    // 병합 모드에서는 해당 시간이 병합된 슬롯에 포함되는지 확인
    for (const slot of currentSchedule) {
      // specificDate가 있으면 날짜도 비교, 없으면 dayOfWeek만 비교
      const dateMatches = slot.specificDate ? slot.specificDate === dateStr : slot.dayOfWeek === dayOfWeek;

      if (dateMatches) {
        const slotStartMinutes = timeToMinutes(slot.startTime);
        const slotEndMinutes = timeToMinutes(slot.endTime);
        const currentTimeMinutes = timeToMinutes(startTime);

        if (currentTimeMinutes >= slotStartMinutes && currentTimeMinutes < slotEndMinutes) {
          return slot;
        }
      }
    }
    return null;
  } else {
    return currentSchedule.find(
      s => {
        const dateMatches = s.specificDate ? s.specificDate === dateStr : s.dayOfWeek === dayOfWeek;
        return dateMatches && s.startTime === startTime;
      }
    );
  }
};

/**
 * getExceptionForSlot - 특정 시간대의 예외일정 조회
 *
 * @description 주어진 시간대에 예외일정(휴무일, 특정 일정)이 있는지 확인하는 함수
 * @param {string} startTime - 조회할 시간 (HH:MM 형식)
 * @param {Date} selectedDate - 선택된 날짜
 * @param {Array} exceptions - 예외일정 배열
 *
 * @returns {Object|null} 해당 시간의 예외일정 또는 null
 *
 * @example
 * const exception = getExceptionForSlot('09:00', selectedDate, exceptions);
 * if (exception) console.log(exception.title); // "휴무일"
 *
 * @note
 * - specificDate로 날짜 비교
 * - ISO 형식("2025-09-26T10:00:00.000Z")과 "HH:MM" 형식 모두 지원
 * - 유효하지 않은 데이터(ex, ex.specificDate, ex.startTime이 없는 경우)는 필터링됨
 */
export const getExceptionForSlot = (startTime, selectedDate, exceptions) => {
  const dateStr = getDateString(selectedDate);
  const [hour, minute] = startTime.split(':').map(Number);

  for (const ex of exceptions) {
    // 유효하지 않은 데이터 필터링
    if (!ex || !ex.specificDate || !ex.startTime) continue;

    // specificDate 필드를 사용해야 함
    const exDateStr = ex.specificDate;

    if (exDateStr === dateStr) {
      // startTime이 ISO 형식인 경우와 "HH:MM" 형식인 경우를 모두 처리
      let exStartHour, exStartMinute;

      if (ex.startTime.includes('T')) {
        // ISO 형식 (예: "2025-09-26T10:00:00.000Z")
        const exStartTime = new Date(ex.startTime);
        exStartHour = exStartTime.getHours();
        exStartMinute = exStartTime.getMinutes();
      } else {
        // "HH:MM" 형식
        [exStartHour, exStartMinute] = ex.startTime.split(':').map(Number);
      }

      if (hour === exStartHour && minute === exStartMinute) {
        return ex;
      }
    }
  }
  return null;
};

/**
 * getPersonalTimeForSlot - 특정 시간대의 개인시간 조회
 *
 * @description 주어진 시간대에 개인시간(수면, 식사 등)이 있는지 확인하는 함수
 * @param {string} startTime - 조회할 시간 (HH:MM 형식)
 * @param {Date} selectedDate - 선택된 날짜
 * @param {Array} personalTimes - 개인시간 배열
 *
 * @returns {Object|null} 해당 시간의 개인시간 또는 null
 *
 * @example
 * const personalTime = getPersonalTimeForSlot('23:00', selectedDate, personalTimes);
 * if (personalTime) console.log(personalTime.title); // "수면"
 *
 * @note
 * - specificDate가 있으면 특정 날짜로, 없으면 반복 개인시간으로 처리
 * - overnight 시간 지원 (예: 23:00-07:00 수면시간)
 * - 일요일(0)은 7로 변환하여 처리
 * - days 배열에 요일이 포함되어야 함
 */
export const getPersonalTimeForSlot = (startTime, selectedDate, personalTimes) => {
  const dayOfWeek = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();
  const [hour, minute] = startTime.split(':').map(Number);
  const slotMinutes = hour * 60 + minute;

  for (const pt of personalTimes) {
    let shouldInclude = false;

    // specificDate가 있으면 날짜가 일치하는지만 체크
    if (pt.specificDate) {
      const dateStr = getDateString(selectedDate);

      if (pt.specificDate === dateStr) {
        shouldInclude = true;
      }
    }
    // specificDate가 없으면 반복되는 개인시간 체크
    else if (pt.isRecurring !== false && pt.days && pt.days.includes(dayOfWeek)) {
      shouldInclude = true;
    }

    if (!shouldInclude) {
      continue;
    }

    const [startHour, startMin] = pt.startTime.split(':').map(Number);
    const [endHour, endMin] = pt.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    let endMinutes = endHour * 60 + endMin;

    // 수면시간과 같은 overnight 시간 처리
    if (endMinutes <= startMinutes) {
      endMinutes += 24 * 60;
      if (slotMinutes >= startMinutes || slotMinutes < (endMinutes - 24 * 60)) {
        return pt;
      }
    } else {
      if (slotMinutes >= startMinutes && slotMinutes < endMinutes) {
        return pt;
      }
    }
  }
  return null;
};

/**
 * hasExceptionInTimeRange - 시간 범위 내 예외일정 존재 여부 확인
 *
 * @description 주어진 시간 범위 내에 title이 '일정'인 예외가 있는지 확인하는 함수
 * @param {Date} selectedDate - 선택된 날짜
 * @param {Array} exceptions - 예외일정 배열
 * @param {number} startHour - 시작 시간 (시)
 * @param {number} endHour - 종료 시간 (시)
 *
 * @returns {boolean} 범위 내 예외 존재 여부
 *
 * @example
 * const hasException = hasExceptionInTimeRange(selectedDate, exceptions, 9, 18);
 * if (hasException) console.log('해당 범위에 예외일정이 있습니다');
 *
 * @note
 * - 10분 단위로 체크 (minute += 10)
 * - title이 '일정'인 예외만 체크
 * - specificDate로 날짜 비교
 * - 범위 내 하나라도 발견되면 true 반환
 */
// 특정 시간대에 예외가 있는지 확인하는 함수
export const hasExceptionInTimeRange = (selectedDate, exceptions, startHour, endHour) => {
  const dateStr = getDateString(selectedDate);

  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 10) {
      const hasException = exceptions.some(ex => {
        // specificDate로 날짜 비교, startTime으로 시간 비교
        if (!ex || ex.specificDate !== dateStr || !ex.startTime) return false;

        const [exHour, exMinute] = ex.startTime.split(':').map(Number);
        return exHour === hour && exMinute === minute && ex.title === '일정';
      });
      if (hasException) return true;
    }
  }
  return false;
};
