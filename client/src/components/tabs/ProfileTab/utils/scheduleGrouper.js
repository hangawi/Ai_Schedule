// 스케줄 그룹화 유틸리티 함수

/**
 * 스케줄을 날짜별로 그룹화
 * @param {Array} schedule - 스케줄 배열
 * @returns {Object} 날짜별로 그룹화된 객체
 */
export const groupScheduleByDate = (schedule) => {
  const dateGroups = {};

  schedule.forEach(slot => {
    if (slot.specificDate) {
      if (!dateGroups[slot.specificDate]) {
        dateGroups[slot.specificDate] = [];
      }
      dateGroups[slot.specificDate].push(slot);
    }
  });

  return dateGroups;
};

/**
 * 예외 일정을 날짜/제목별로 그룹화
 * @param {Array} exceptions - 예외 일정 배열
 * @returns {Object} 그룹화된 예외 일정
 */
export const groupExceptionsByDateAndTitle = (exceptions) => {
  const exceptionGroups = {};

  (exceptions || []).forEach(exception => {
    const startDate = new Date(exception.startTime);
    const dateKey = startDate.toLocaleDateString('ko-KR');
    const title = exception.title || '일정';
    const groupKey = `${dateKey}-${title}`;

    if (!exceptionGroups[groupKey]) {
      exceptionGroups[groupKey] = {
        title: title,
        date: dateKey,
        exceptions: []
      };
    }
    exceptionGroups[groupKey].exceptions.push(exception);
  });

  return exceptionGroups;
};
