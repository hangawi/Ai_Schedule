/**
 * ===================================================================================================
 * slotMerger.js - '내 프로필' 탭에서 사용되는 연속 시간대 병합 유틸리티
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ProfileTab/utils/slotMerger.js
 *
 * 🎯 주요 기능:
 *    - `mergeConsecutiveSlots`: 동일한 날짜 내에서, 우선순위가 같고 서로 맞닿아 있는 시간대(slot)들을 하나의 긴 시간대로 병합.
 *    - `mergeTimeRanges`: 예외 스케줄(exception) 배열에서 연속되는 시간 범위를 병합.
 *
 * 🔗 연결된 파일:
 *    - ../components/PreferenceTimeSection.js - 날짜별로 그룹화된 선호시간을 UI에 표시하기 전에 `mergeConsecutiveSlots`를 사용하여 보기 좋게 만듦.
 *
 * 💡 UI 위치:
 *    - 이 파일은 UI가 없으나, 반환된 데이터가 '선호시간 관리' 섹션 등에 시각적으로 병합된 시간대로 표시됩니다.
 *
 * ✏️ 수정 가이드:
 *    - 시간대 병합 조건을 변경하려면 이 파일의 해당 함수 내부 로직을 수정합니다.
 *    - 예를 들어, `mergeConsecutiveSlots`에서 우선순위가 달라도 병합하도록 하려면 `currentGroup.priority === slot.priority` 조건을 제거합니다.
 *
 * 📝 참고사항:
 *    - `mergeConsecutiveSlots`는 `09:00-09:30`, `09:30-10:00` 과 같이 분리된 여러 슬롯을 `09:00-10:00` 하나로 합쳐 UI를 간결하게 만드는 데 사용됩니다.
 *    - 각 함수는 정렬된 배열을 입력으로 받는 것을 가정하고 동작합니다.
 *
 * ===================================================================================================
 */

/**
 * 연속된 시간대를 병합
 * @param {Array} slots - 슬롯 배열
 * @returns {Array} 병합된 슬롯 배열
 */
export const mergeConsecutiveSlots = (slots) => {
  const mergedSlots = [];
  let currentGroup = null;

  for (const slot of slots) {
    if (currentGroup &&
        currentGroup.priority === slot.priority &&
        currentGroup.endTime === slot.startTime) {
      // 연속된 슬롯이므로 병합
      currentGroup.endTime = slot.endTime;
    } else {
      // 새로운 그룹 시작
      if (currentGroup) {
        mergedSlots.push(currentGroup);
      }
      currentGroup = { ...slot };
    }
  }

  if (currentGroup) {
    mergedSlots.push(currentGroup);
  }

  return mergedSlots;
};

/**
 * 예외 일정의 시간 범위를 병합
 * @param {Array} exceptions - 예외 배열 (시간순 정렬 필요)
 * @returns {Array} 병합된 시간 범위 배열
 */
export const mergeTimeRanges = (exceptions) => {
  const mergedTimeRanges = [];
  let currentRange = null;

  exceptions.forEach(exception => {
    const startDate = new Date(exception.startTime);
    const endDate = new Date(exception.endTime);

    if (!currentRange) {
      currentRange = {
        startTime: startDate,
        endTime: endDate,
        originalException: exception
      };
    } else {
      // 현재 범위의 끝과 다음 예외의 시작이 연결되는지 확인
      if (currentRange.endTime.getTime() === startDate.getTime()) {
        // 연속되므로 끝시간을 확장
        currentRange.endTime = endDate;
      } else {
        // 연속되지 않으므로 현재 범위를 저장하고 새로운 범위 시작
        mergedTimeRanges.push(currentRange);
        currentRange = {
          startTime: startDate,
          endTime: endDate,
          originalException: exception
        };
      }
    }
  });

  if (currentRange) {
    mergedTimeRanges.push(currentRange);
  }

  return mergedTimeRanges;
};
