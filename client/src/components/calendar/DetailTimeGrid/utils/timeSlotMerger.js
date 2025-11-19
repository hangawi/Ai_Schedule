// 연속된 시간대 병합 함수
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
