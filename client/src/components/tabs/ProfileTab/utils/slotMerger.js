// 슬롯 병합 유틸리티 함수

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
