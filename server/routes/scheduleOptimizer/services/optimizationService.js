/**
 * 고정 일정 처리 서비스
 */

/**
 * 고정 일정 원본 찾기
 */
function findFixedScheduleOriginals(fixedSchedules, schedulesByImage) {
  if (!fixedSchedules || fixedSchedules.length === 0) {
    return [];
  }

  const allSchedulesForSearch = schedulesByImage?.flatMap(img => img.schedules || []) || [];

  return fixedSchedules.map(fixed => {
    if (fixed.originalSchedule) return fixed.originalSchedule;

    const found = allSchedulesForSearch.find(s =>
      s.title === fixed.title &&
      s.startTime === fixed.startTime &&
      s.endTime === fixed.endTime
    );

    return found || fixed;
  });
}

/**
 * 고정 일정을 스케줄에 추가 (중복 제거)
 */
function addFixedSchedulesToOptimization(schedules, fixedOriginals) {
  const result = [...schedules];

  fixedOriginals.forEach(fixedOrig => {
    const exists = result.some(s =>
      s.title === fixedOrig.title &&
      s.startTime === fixedOrig.startTime &&
      s.endTime === fixedOrig.endTime
    );

    if (!exists) {
      result.push(fixedOrig);
    }
  });

  return result;
}

/**
 * 커스텀 고정 일정 범례 생성
 */
function createCustomScheduleLegend(fixedSchedules) {
  if (!fixedSchedules || fixedSchedules.length === 0) {
    return [];
  }

  const customFixed = fixedSchedules.filter(f => f.type === 'custom');
  if (customFixed.length === 0) {
    return [];
  }

  return customFixed.map(custom => ({
    fileName: `커스텀 일정`,
    sourceImageIndex: custom.sourceImageIndex,
    title: custom.title,
    isCustom: true
  }));
}

module.exports = {
  findFixedScheduleOriginals,
  addFixedSchedulesToOptimization,
  createCustomScheduleLegend
};
