/**
 * ===================================================================================================
 * scheduleUtils.js - 스케줄 데이터, 특히 연속된 시간 슬롯을 병합하거나 예외를 처리하는 유틸리티 함수 모음
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/utils/scheduleUtils.js
 *
 * 🎯 주요 기능:
 *    - 연속된 시간대를 하나의 블록으로 병합 (`mergeConsecutiveTimeSlots`).
 *    - 특정 시간대 범위 내에 예외 일정이 있는지 확인 (`hasExceptionInTimeRange`).
 *    - 특정 시간 슬롯에 해당하는 예외 일정을 찾음 (`getExceptionForSlot`).
 *
 * 🔗 연결된 파일:
 *    - ../hooks/useChat/hooks/useRecurringEventAdd.js: 연속된 슬롯을 병합하여 처리하는 데 사용.
 *    - ../components/tabs/ProfileTab/: 프로필 탭에서 시간표를 렌더링할 때, 예외 일정을 확인하고 처리하는 데 사용.
 *    - ../components/calendar/DetailTimeGrid/index.js: 상세 시간 그리드에서 시간 슬롯을 병합하고 예외를 처리하는 데 사용.
 *    - ./timeUtils.js: 시간 문자열을 분으로 변환하는 `timeToMinutes` 함수 사용.
 *
 * 💡 UI 위치:
 *    - 프로필 탭의 상세 시간 그리드(`DetailTimeGrid`)에서 연속된 선호 시간을 하나의 블록으로 묶어 표시하거나, 예외 일정을 다르게 표시하는 데 사용됨.
 *
 * ✏️ 수정 가이드:
 *    - 시간 슬롯 병합 로직을 변경해야 할 경우: `mergeConsecutiveTimeSlots` 함수의 정렬 및 병합 조건을 수정.
 *    - 예외 일정의 데이터 구조가 변경될 경우: `hasExceptionInTimeRange` 및 `getExceptionForSlot` 함수의 `ex` 객체 필드 접근 방식을 수정.
 *    - 예외를 확인하는 시간 단위를 변경할 경우: `hasExceptionInTimeRange` 및 `getExceptionForSlot`의 시간 비교 로직을 수정.
 *
 * 📝 참고사항:
 *    - `mergeConsecutiveTimeSlots`는 `dayOfWeek`와 `priority`가 동일한 연속된 슬롯만을 병합 대상으로 함.
 *    - 이 파일의 함수들은 주로 '내 프로필' 탭의 선호 시간 관리 및 예외 일정 처리에 중점을 두고 있음.
 *
 * ===================================================================================================
 */
import { timeToMinutes } from './timeUtils';

/**
 * mergeConsecutiveTimeSlots
 * @description 요일과 우선순위가 동일한 연속된 시간대 슬롯을 하나의 블록으로 병합합니다.
 * @param {Array<object>} schedule - 병합할 스케줄 슬롯의 배열.
 * @returns {Array<object>} 연속된 슬롯이 병합된 스케줄 객체의 배열.
 */
export const mergeConsecutiveTimeSlots = (schedule) => {
  if (!schedule || schedule.length === 0) return [];

  const sortedSchedule = [...schedule].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return a.startTime.localeCompare(b.startTime);
  });

  const merged = [];
  let currentGroup = null;

  for (const slot of sortedSchedule) {
    if (currentGroup &&
        currentGroup.dayOfWeek === slot.dayOfWeek &&
        currentGroup.priority === slot.priority &&
        currentGroup.endTime === slot.startTime) {
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
        merged.push(currentGroup);
      }
      currentGroup = { ...slot };
    }
  }

  if (currentGroup) {
    merged.push(currentGroup);
  }

  return merged;
};

/**
 * hasExceptionInTimeRange
 * @description 주어진 날짜와 시간 범위 내에 예외 일정이 존재하는지 확인합니다.
 * @param {Array<object>} exceptions - 확인할 예외 일정 목록.
 * @param {Date} selectedDate - 확인할 날짜.
 * @param {number} startHour - 시작 시간 (hour).
 * @param {number} endHour - 종료 시간 (hour).
 * @returns {boolean} 예외 일정의 존재 여부.
 */
export const hasExceptionInTimeRange = (exceptions, selectedDate, startHour, endHour) => {
  if (!exceptions || !selectedDate) return false;

  const year = selectedDate.getFullYear();
  const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
  const day = String(selectedDate.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  return exceptions.some(ex => {
    if (!ex || ex.specificDate !== dateStr || !ex.startTime) return false;

    const exceptionDate = new Date(ex.startTime);
    const exceptionHour = exceptionDate.getHours();

    return exceptionHour >= startHour && exceptionHour < endHour;
  });
};

/**
 * getExceptionForSlot
 * @description 특정 날짜와 시작 시간에 해당하는 예외 일정을 찾아서 반환합니다.
 * @param {Array<object>} exceptions - 검색할 예외 일정 목록.
 * @param {Date} selectedDate - 검색할 날짜.
 * @param {string} startTime - 검색할 시작 시간 (HH:MM 형식).
 * @returns {object|null} 해당하는 예외 일정 객체 또는 없을 경우 null.
 */
export const getExceptionForSlot = (exceptions, selectedDate, startTime) => {
  const year = selectedDate.getFullYear();
  const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
  const day = String(selectedDate.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  const [hour, minute] = startTime.split(':').map(Number);

  for (const ex of exceptions) {
    if (!ex || !ex.specificDate || !ex.startTime) continue;

    const exDateStr = ex.specificDate;
    if (exDateStr === dateStr) {
      const exceptionDate = new Date(ex.startTime);
      const exceptionHour = exceptionDate.getHours();
      const exceptionMinute = exceptionDate.getMinutes();

      if (exceptionHour === hour && exceptionMinute === minute) {
        return ex;
      }
    }
  }
  return null;
};