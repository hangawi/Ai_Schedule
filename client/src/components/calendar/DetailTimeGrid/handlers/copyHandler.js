/**
 * ===================================================================================================
 * copyHandler.js - 시간표 복사 옵션 핸들러
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/calendar/DetailTimeGrid/handlers/copyHandler.js
 *
 * 🎯 주요 기능:
 *    - 예외일정(휴무일 등)을 다른 날짜에 복사
 *    - 선호시간을 다른 날짜에 복사
 *    - 다양한 복사 옵션 지원 (다음주, 이전주, 이번주 전체, 다음주 전체, 한달 전체)
 *    - 원본 슬롯과 복사본의 연결 관계 유지 (sourceId)
 *
 * 🔗 연결된 파일:
 *    - ../index.js - 메인 DetailTimeGrid 컴포넌트에서 사용
 *
 * 💡 UI 위치:
 *    - 탭: 내프로필
 *    - 섹션: 세부 시간표 모달의 '복사옵션' 기능
 *    - 화면: 복사옵션 드롭다운에서 옵션 선택 시 자동으로 실행됨
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 시간 복사 기능의 동작 방식이 변경됨
 *    - 새로운 복사 옵션 추가: applyCopyOptions와 applyCopyOptionsToSchedule 함수에 새로운 copyType 분기 추가
 *    - 복사 범위 변경: 각 copyType별 날짜 계산 로직 수정
 *    - 주말 포함/제외 변경: 반복문의 범위 수정 (현재 월~금 5일만 복사)
 *
 * 📝 참고사항:
 *    - 모든 복사본은 sourceId를 통해 원본과 연결됨
 *    - 원본 삭제 시 복사본도 함께 삭제됨
 *    - 복사본 삭제 시 원본 및 다른 복사본도 함께 삭제됨
 *    - 'wholeMonth' 옵션은 현재 날짜와 같은 요일만 복사함 (예: 화요일이면 모든 화요일에 복사)
 *    - 'thisWholeWeek', 'nextWholeWeek'는 월~금만 복사하며 주말은 제외됨
 *    - 복사 시 specificDate 필드가 자동으로 설정되어 특정 날짜로 지정됨
 *
 * ===================================================================================================
 */

/**
 * applyCopyOptions - 예외일정을 다른 날짜에 복사
 *
 * @description 선택된 복사 옵션에 따라 예외일정(휴무일 등)을 다른 날짜에 복사하는 함수
 * @param {Object} baseException - 원본 예외일정 객체
 * @param {Object} copyOptions - 복사 옵션 { copyType: 'none' | 'nextWeek' | 'prevWeek' | 'thisWholeWeek' | 'nextWholeWeek' | 'wholeMonth' }
 * @param {Date} selectedDate - 현재 선택된 날짜
 * @param {Function} setExceptions - 예외일정 상태 업데이트 함수
 *
 * @returns {void}
 *
 * @example
 * // 다음주 같은 요일에 휴무일 복사
 * applyCopyOptions(exception, { copyType: 'nextWeek' }, new Date(), setExceptions);
 *
 * @note
 * - copyType이 'none'이면 복사하지 않음
 * - 복사된 예외는 100ms 후에 상태에 추가됨 (렌더링 최적화)
 * - 모든 복사본은 sourceId로 원본과 연결됨
 */
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

/**
 * applyCopyOptionsToSchedule - 선호시간을 다른 날짜에 복사
 *
 * @description 선택된 복사 옵션에 따라 선호시간 슬롯을 다른 날짜에 복사하는 함수
 * @param {Array} baseSlots - 원본 시간 슬롯 배열
 * @param {Object} copyOptions - 복사 옵션 { copyType: 'none' | 'nextWeek' | 'prevWeek' | 'thisWholeWeek' | 'nextWholeWeek' | 'wholeMonth' }
 * @param {Date} selectedDate - 현재 선택된 날짜
 * @param {Function} setSchedule - 스케줄 상태 업데이트 함수
 *
 * @returns {void}
 *
 * @example
 * // 이번주 전체(월~금)에 선호시간 복사
 * applyCopyOptionsToSchedule([slot1, slot2], { copyType: 'thisWholeWeek' }, new Date(), setSchedule);
 *
 * @note
 * - copyType이 'none'이거나 baseSlots가 비어있으면 복사하지 않음
 * - 복사된 슬롯은 100ms 후에 상태에 추가됨 (렌더링 최적화)
 * - 모든 복사본은 sourceId로 원본과 연결됨
 * - 복사본의 dayOfWeek는 대상 날짜의 요일로 자동 설정됨
 */
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
