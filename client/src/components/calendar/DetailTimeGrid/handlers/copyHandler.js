// 복사 옵션을 예외(exceptions)에 적용하는 함수
export const applyCopyOptions = (baseException, copyOptions, selectedDate, setExceptions) => {
  // 복사 옵션에 따라 다른 날짜에도 동일한 예외 추가
  if (!setExceptions || copyOptions.copyType === 'none') return;

  const additionalExceptions = [];
  const baseDate = new Date(selectedDate);

  if (copyOptions.copyType === 'nextWeek') {
    // 다음주 같은 요일에 복사
    const nextWeekDate = new Date(baseDate);
    nextWeekDate.setDate(baseDate.getDate() + 7);

    const nextYear = nextWeekDate.getFullYear();
    const nextMonth = nextWeekDate.getMonth();
    const nextDay = nextWeekDate.getDate();
    const nextDateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;

    const baseStartTime = new Date(baseException.startTime);
    const baseEndTime = new Date(baseException.endTime);

    const newStartTime = new Date(nextYear, nextMonth, nextDay, baseStartTime.getHours(), baseStartTime.getMinutes(), 0);
    const newEndTime = new Date(nextYear, nextMonth, nextDay, baseEndTime.getHours(), baseEndTime.getMinutes(), 0);

    const newException = {
      ...baseException,
      _id: Date.now().toString() + Math.random(),
      sourceId: baseException.sourceId || baseException._id,
      startTime: newStartTime.toISOString(),
      endTime: newEndTime.toISOString(),
      specificDate: nextDateStr
    };
    additionalExceptions.push(newException);

  } else if (copyOptions.copyType === 'prevWeek') {
    // 이전주 같은 요일에 복사
    const prevWeekDate = new Date(baseDate);
    prevWeekDate.setDate(baseDate.getDate() - 7);

    const prevYear = prevWeekDate.getFullYear();
    const prevMonth = prevWeekDate.getMonth();
    const prevDay = prevWeekDate.getDate();
    const prevDateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`;

    const baseStartTime = new Date(baseException.startTime);
    const baseEndTime = new Date(baseException.endTime);

    const newStartTime = new Date(prevYear, prevMonth, prevDay, baseStartTime.getHours(), baseStartTime.getMinutes(), 0);
    const newEndTime = new Date(prevYear, prevMonth, prevDay, baseEndTime.getHours(), baseEndTime.getMinutes(), 0);

    const newException = {
      ...baseException,
      _id: Date.now().toString() + Math.random(),
      sourceId: baseException.sourceId || baseException._id,
      startTime: newStartTime.toISOString(),
      endTime: newEndTime.toISOString(),
      specificDate: prevDateStr
    };
    additionalExceptions.push(newException);

  } else if (copyOptions.copyType === 'thisWholeWeek' || copyOptions.copyType === 'nextWholeWeek') {
    const dayOffset = copyOptions.copyType === 'thisWholeWeek' ? 0 : 7;
    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() - (baseDate.getDay() === 0 ? 6 : baseDate.getDay() - 1) + dayOffset);

    for (let i = 0; i < 5; i++) { // Loop for Monday to Friday
      const targetDate = new Date(monday);
      targetDate.setDate(monday.getDate() + i);

      if (targetDate.toDateString() === baseDate.toDateString()) continue;

      const targetYear = targetDate.getFullYear();
      const targetMonth = targetDate.getMonth();
      const targetDay = targetDate.getDate();
      const targetDateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;

      const baseStartTime = new Date(baseException.startTime);
      const baseEndTime = new Date(baseException.endTime);

      const newStartTime = new Date(targetYear, targetMonth, targetDay, baseStartTime.getHours(), baseStartTime.getMinutes(), 0);
      const newEndTime = new Date(targetYear, targetMonth, targetDay, baseEndTime.getHours(), baseEndTime.getMinutes(), 0);

      const newException = {
          ...baseException,
          _id: Date.now().toString() + Math.random(),
          sourceId: baseException.sourceId || baseException._id,
          startTime: newStartTime.toISOString(),
          endTime: newEndTime.toISOString(),
          specificDate: targetDateStr
      };
      additionalExceptions.push(newException);
    }
  } else if (copyOptions.copyType === 'wholeMonth') {
    // 이번달 모든 같은 요일에 복사
    const currentMonth = baseDate.getMonth();
    const currentYear = baseDate.getFullYear();
    const dayOfWeek = baseDate.getDay();

    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const firstDayOfWeek = firstDayOfMonth.getDay();

    // 해당 요일의 첫 번째 날짜 계산
    let firstTargetDate = 1 + (dayOfWeek - firstDayOfWeek + 7) % 7;

    while (firstTargetDate <= 31) {
      const targetDate = new Date(currentYear, currentMonth, firstTargetDate);

      // 유효한 날짜이고 이번달이고 현재 날짜가 아닌 경우
      if (targetDate.getMonth() === currentMonth && targetDate.toDateString() !== baseDate.toDateString()) {
        const targetYear = targetDate.getFullYear();
        const targetMonth = targetDate.getMonth();
        const targetDay = targetDate.getDate();
        const targetDateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;

        const baseStartTime = new Date(baseException.startTime);
        const baseEndTime = new Date(baseException.endTime);

        const newStartTime = new Date(targetYear, targetMonth, targetDay, baseStartTime.getHours(), baseStartTime.getMinutes(), 0);
        const newEndTime = new Date(targetYear, targetMonth, targetDay, baseEndTime.getHours(), baseEndTime.getMinutes(), 0);

        const newException = {
          ...baseException,
          _id: Date.now().toString() + Math.random(),
          sourceId: baseException.sourceId || baseException._id,
          startTime: newStartTime.toISOString(),
          endTime: newEndTime.toISOString(),
          specificDate: targetDateStr
        };
        additionalExceptions.push(newException);
      }

      firstTargetDate += 7; // 다음 주 같은 요일
    }
  }

  if (additionalExceptions.length > 0) {
    setTimeout(() => {
      setExceptions(prev => [...prev, ...additionalExceptions]);
    }, 100);
  }
};

// 복사 옵션을 스케줄(선호시간)에 적용하는 함수
export const applyCopyOptionsToSchedule = (baseSlots, copyOptions, selectedDate, setSchedule) => {
  // 선호시간에 대한 복사 옵션 적용
  if (!setSchedule || copyOptions.copyType === 'none' || !baseSlots || baseSlots.length === 0) return;

  const additionalSlots = [];
  const baseDate = new Date(selectedDate);

  if (copyOptions.copyType === 'nextWeek') {
    // 다음주 같은 요일에 복사
    const nextWeekDate = new Date(baseDate);
    nextWeekDate.setDate(baseDate.getDate() + 7);
    const nextDateStr = `${nextWeekDate.getFullYear()}-${String(nextWeekDate.getMonth() + 1).padStart(2, '0')}-${String(nextWeekDate.getDate()).padStart(2, '0')}`;

    baseSlots.forEach(slot => {
      additionalSlots.push({
        ...slot,
        _id: Date.now().toString() + Math.random(),
        sourceId: slot.sourceId || slot._id,
        specificDate: nextDateStr
      });
    });

  } else if (copyOptions.copyType === 'prevWeek') {
    // 이전주 같은 요일에 복사
    const prevWeekDate = new Date(baseDate);
    prevWeekDate.setDate(baseDate.getDate() - 7);
    const prevDateStr = `${prevWeekDate.getFullYear()}-${String(prevWeekDate.getMonth() + 1).padStart(2, '0')}-${String(prevWeekDate.getDate()).padStart(2, '0')}`;

    baseSlots.forEach(slot => {
      additionalSlots.push({
        ...slot,
        _id: Date.now().toString() + Math.random(),
        sourceId: slot.sourceId || slot._id,
        specificDate: prevDateStr
      });
    });

  } else if (copyOptions.copyType === 'thisWholeWeek' || copyOptions.copyType === 'nextWholeWeek') {
    const dayOffset = copyOptions.copyType === 'thisWholeWeek' ? 0 : 7;
    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() - (baseDate.getDay() === 0 ? 6 : baseDate.getDay() - 1) + dayOffset);

    for (let i = 0; i < 5; i++) { // Loop for Monday to Friday
      const targetDate = new Date(monday);
      targetDate.setDate(monday.getDate() + i);
      const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

      // Don't copy to the source date itself
      if (targetDate.toDateString() === baseDate.toDateString()) continue;

      baseSlots.forEach(slot => {
        additionalSlots.push({
          ...slot,
          _id: Date.now().toString() + Math.random(),
          sourceId: slot.sourceId || slot._id,
          specificDate: targetDateStr,
          dayOfWeek: targetDate.getDay()
        });
      });
    }
  } else if (copyOptions.copyType === 'wholeMonth') {
    // 이번달 모든 같은 요일에 복사
    const currentMonth = baseDate.getMonth();
    const currentYear = baseDate.getFullYear();
    const dayOfWeek = baseDate.getDay();

    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const firstDayOfWeek = firstDayOfMonth.getDay();

    let firstTargetDate = 1 + (dayOfWeek - firstDayOfWeek + 7) % 7;

    while (firstTargetDate <= 31) {
      const targetDate = new Date(currentYear, currentMonth, firstTargetDate);

      if (targetDate.getMonth() === currentMonth && targetDate.toDateString() !== baseDate.toDateString()) {
        const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

        baseSlots.forEach(slot => {
          additionalSlots.push({
            ...slot,
            _id: Date.now().toString() + Math.random(),
            sourceId: slot.sourceId || slot._id,
            specificDate: targetDateStr
          });
        });
      }

      firstTargetDate += 7;
    }
  }

  if (additionalSlots.length > 0) {
    setTimeout(() => {
      setSchedule(prev => [...prev, ...additionalSlots]);
    }, 100);
  }
};
