/**
 * ===================================================================================================
 * [timeSlotMerger.js] - 연속된 시간 슬롯 병합 유틸리티
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > client/src/components/calendar/DetailTimeGrid/utils/timeSlotMerger.js
 *
 * 🎯 주요 기능:
 *    - 선호 시간, 개인 시간 등 연속된 시간 슬롯들을 하나의 긴 슬롯으로 병합
 *    - 특정 날짜(specificDate) 또는 요일(dayOfWeek)을 기준으로 슬롯을 정렬하고 그룹화
 *
 * 🔗 연결된 파일:
 *    - ../index.js: DetailTimeGrid 컴포넌트에서 시간표를 렌더링하기 전에 슬롯을 병합하기 위해 사용
 *    - ../../ProfileTab/index.js: 프로필 탭에서 병합된 시간 슬롯을 화면에 표시할 때 사용될 수 있음
 *
 * ✏️ 수정 가이드:
 *    - 병합 조건을 변경하려면 (예: 다른 속성도 일치해야 함): `mergeConsecutiveTimeSlots` 함수 내의 if 조건을 수정합니다.
 *    - 정렬 순서를 변경하려면: `sortedSchedule`의 정렬 로직을 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 함수는 `priority`가 동일하고, `endTime`과 `startTime`이 정확히 일치하는 연속된 슬롯만 병합합니다.
 *    - `specificDate`가 있는 슬롯과 `dayOfWeek`만 있는 슬롯은 서로 다른 그룹으로 처리됩니다.
 *
 * ===================================================================================================
 */

/**
 * mergeConsecutiveTimeSlots
 *
 * @description 날짜(또는 요일)와 우선순위가 동일한 연속된 시간 슬롯들을 하나의 슬롯으로 병합합니다.
 * @param {Array<Object>} schedule - 병합할 시간 슬롯 객체의 배열. 각 객체는 startTime, endTime, priority, dayOfWeek 또는 specificDate를 포함해야 합니다.
 * @returns {Array<Object>} 병합된 시간 슬롯 객체의 배열.
 *
 * @example
 * const schedule = [
 *   { dayOfWeek: 1, startTime: '09:00', endTime: '09:10', priority: 1 },
 *   { dayOfWeek: 1, startTime: '09:10', endTime: '09:20', priority: 1 },
 *   { dayOfWeek: 1, startTime: '10:00', endTime: '10:10', priority: 1 }
 * ];
 * const merged = mergeConsecutiveTimeSlots(schedule);
 * // merged = [
 * //   { dayOfWeek: 1, startTime: '09:00', endTime: '09:20', priority: 1, isMerged: true, ... },
 * //   { dayOfWeek: 1, startTime: '10:00', endTime: '10:10', priority: 1 }
 * // ]
 *
 * @note
 * - 슬롯을 병합하기 전에 날짜/요일과 시작 시간 순으로 정렬합니다.
 * - `specificDate`가 존재하면 `dayOfWeek`보다 우선하여 정렬 및 그룹화 기준으로 사용됩니다.
 */
export const mergeConsecutiveTimeSlots = (schedule) => {
  if (!schedule || schedule.length === 0) return [];

  const sortedSchedule = [...schedule].sort((a, b) => {
    // specificDate가 있으면 날짜로 정렬, 없으면 dayOfWeek로 정렬
    if (a.specificDate && b.specificDate) {
      if (a.specificDate !== b.specificDate) return a.specificDate.localeCompare(b.specificDate);
    } else if (a.dayOfWeek !== b.dayOfWeek) {
      return a.dayOfWeek - b.dayOfWeek;
    }
    return a.startTime.localeCompare(b.startTime);
  });

  const merged = [];
  let currentGroup = null;

  for (const slot of sortedSchedule) {
    const sameDate = (currentGroup && slot.specificDate && currentGroup.specificDate)
      ? (currentGroup.specificDate === slot.specificDate)
      : (currentGroup && currentGroup.dayOfWeek === slot.dayOfWeek && !slot.specificDate && !currentGroup.specificDate);

    if (currentGroup &&
        sameDate &&
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
      // 기존 속성 정리
      delete currentGroup.isMerged;
      delete currentGroup.originalSlots;
    }
  }

  if (currentGroup) {
    merged.push(currentGroup);
  }

  return merged;
};