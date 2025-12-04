/**
 * ===================================================================================================
 * useFilteredSchedule.js - '내 프로필' 탭의 스케줄 필터링 커스텀 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ProfileTab/hooks/useFilteredSchedule.js
 *
 * 🎯 주요 기능:
 *    - `ProfileTab`에서 보여지는 월(`viewingMonth`)을 기준으로 스케줄 데이터(기본, 개인, 예외)를 필터링.
 *    - `useMemo`를 사용하여 필터링 연산의 결과를 메모이제이션함으로써, 불필요한 재계산을 방지하고 렌더링 성능을 최적화.
 *    - 반복되는 주간 스케줄(specificDate가 없는 항목)은 항상 포함시키고, 특정 날짜가 지정된 스케줄은 현재 보고 있는 월과 일치하는 경우에만 포함.
 *
 * 🔗 연결된 파일:
 *    - ../index.js (ProfileTab) - 이 훅을 사용하여 필터링된 스케줄 데이터를 얻음.
 *
 * 💡 UI 위치:
 *    - 이 훅 자체는 UI가 없으나, 반환하는 데이터가 '선호시간 관리', '개인시간 관리' 섹션 등 '내 프로필' 탭의 여러 부분에 표시됩니다.
 *
 * ✏️ 수정 가이드:
 *    - 스케줄을 월별로 필터링하는 기준을 변경하려면 이 파일 내의 `useMemo` 콜백 함수들의 로직을 수정해야 합니다.
 *    - 예를 들어, 주간 반복 일정을 필터링에서 제외하고 싶다면 `if (!slot.specificDate) return true;` 와 같은 부분을 수정합니다.
 *
 * 📝 참고사항:
 *    - 성능 최적화가 중요한 훅입니다. `useMemo`의 의존성 배열(`[defaultSchedule, viewingMonth]` 등)을 정확하게 관리하는 것이 핵심입니다.
 *    - 이 훅을 통해 `ProfileTab`의 자식 컴포넌트들은 현재 뷰에 필요한 최소한의 데이터만 props로 전달받게 됩니다.
 *
 * ===================================================================================================
 */

import { useMemo } from 'react';

/**
 * useFilteredSchedule
 * @description 스케줄 관련 배열들을 현재 보고 있는 월(`viewingMonth`) 기준으로 필터링하는 훅.
 *              `useMemo`를 사용하여 성능을 최적화합니다.
 * @param {Array} defaultSchedule - 필터링할 전체 기본 스케줄 배열.
 * @param {Array} personalTimes - 필터링할 전체 개인시간 배열.
 * @param {Array} scheduleExceptions - 필터링할 전체 예외 스케줄 배열.
 * @param {Date} viewingMonth - 현재 사용자가 보고 있는 월을 나타내는 Date 객체.
 * @returns {object} 필터링된 스케줄 배열들을 포함하는 객체.
 * @property {Array} filteredDefaultSchedule - 현재 월에 해당하는 기본 스케줄.
 * @property {Array} filteredPersonalTimes - 현재 월에 해당하는 개인시간.
 * @property {Array} filteredScheduleExceptions - 현재 월에 해당하는 예외 스케줄.
 */
export const useFilteredSchedule = (defaultSchedule, personalTimes, scheduleExceptions, viewingMonth) => {
  const filteredDefaultSchedule = useMemo(() => {
    if (!viewingMonth) return defaultSchedule;
    const year = viewingMonth.getFullYear();
    const month = viewingMonth.getMonth();

    return defaultSchedule.filter(slot => {
      if (!slot.specificDate) return true; // Always include recurring weekly schedules
      const [slotYear, slotMonth] = slot.specificDate.split('-').map(Number);
      return slotYear === year && (slotMonth - 1) === month;
    });
  }, [defaultSchedule, viewingMonth]);

  const filteredPersonalTimes = useMemo(() => {
    if (!viewingMonth) return personalTimes;
    const year = viewingMonth.getFullYear();
    const month = viewingMonth.getMonth();

    return personalTimes.filter(pt => {
      if (pt.isRecurring !== false) return true; // Always include recurring personal times
      if (!pt.specificDate) return true; // Include if no date is specified (should be recurring)
      const [slotYear, slotMonth] = pt.specificDate.split('-').map(Number);
      return slotYear === year && (slotMonth - 1) === month;
    });
  }, [personalTimes, viewingMonth]);

  const filteredScheduleExceptions = useMemo(() => {
    if (!viewingMonth) return scheduleExceptions;
    const year = viewingMonth.getFullYear();
    const month = viewingMonth.getMonth();

    return scheduleExceptions.filter(exception => {
      if (!exception.specificDate) return true; // Always include if no specific date
      const [slotYear, slotMonth] = exception.specificDate.split('-').map(Number);
      return slotYear === year && (slotMonth - 1) === month;
    });
  }, [scheduleExceptions, viewingMonth]);

  return {
    filteredDefaultSchedule,
    filteredPersonalTimes,
    filteredScheduleExceptions
  };
};
