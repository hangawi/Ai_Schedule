/**
 * 고정 일정 기반 시간표 재최적화 서비스
 *
 * 기능:
 * 1. 고정 일정을 필수로 포함
 * 2. 고정 일정과 겹치는 수업 자동 제외
 * 3. 나머지 수업으로 최적 조합 생성
 */

/**
 * 두 일정이 시간적으로 겹치는지 확인
 */
function hasTimeConflict(schedule1, schedule2) {
  // 같은 요일이 있는지 확인
  const days1 = Array.isArray(schedule1.days) ? schedule1.days : [schedule1.days];
  const days2 = Array.isArray(schedule2.days) ? schedule2.days : [schedule2.days];

  const commonDays = days1.filter(day => days2.includes(day));
  if (commonDays.length === 0) return false;

  // 시간 겹침 확인
  const timeToMinutes = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const start1 = timeToMinutes(schedule1.startTime);
  const end1 = timeToMinutes(schedule1.endTime);
  const start2 = timeToMinutes(schedule2.startTime);
  const end2 = timeToMinutes(schedule2.endTime);

  // 겹침 조건: start1 < end2 AND start2 < end1
  return start1 < end2 && start2 < end1;
}

/**
 * 고정 일정과 겹치는 수업 찾기
 */
function findConflictingSchedules(fixedSchedule, allSchedules) {
  return allSchedules.filter(schedule =>
    hasTimeConflict(fixedSchedule, schedule)
  );
}

/**
 * 고정 일정을 기반으로 시간표 재최적화
 *
 * @param {Array} allSchedules - 업로드된 모든 시간표 수업
 * @param {Array} fixedSchedules - 현재 고정된 일정들
 * @param {Object} newFixedSchedule - 새로 추가할 고정 일정
 * @returns {Object} 재최적화 결과
 */
function reoptimizeWithFixedSchedules(allSchedules, fixedSchedules = [], newFixedSchedule = null) {

  // 전체 고정 일정 목록
  const allFixed = newFixedSchedule
    ? [...fixedSchedules, newFixedSchedule]
    : fixedSchedules;

  // 1. 고정 일정과 겹치는 수업 찾기
  const conflicts = [];
  const conflictingScheduleIds = new Set();

  allFixed.forEach(fixed => {
    const conflicting = findConflictingSchedules(fixed, allSchedules);

    if (conflicting.length > 0) {
      conflicts.push({
        fixedSchedule: fixed,
        conflictingSchedules: conflicting
      });

      conflicting.forEach(c => {
        const id = `${c.title}-${c.startTime}-${c.endTime}-${c.days?.join(',')}`;
        conflictingScheduleIds.add(id);
      });
    }
  });

  // 2. 충돌 없는 수업만 필터링
  const availableSchedules = allSchedules.filter(schedule => {
    const id = `${schedule.title}-${schedule.startTime}-${schedule.endTime}-${schedule.days?.join(',')}`;
    return !conflictingScheduleIds.has(id);
  });

  // 3. 고정 일정 + 충돌 없는 수업 = 최종 시간표
  const optimizedSchedule = [
    ...allFixed.map(f => {
      const baseSchedule = f.originalSchedule || f;

      return {
        ...baseSchedule,
        isFixed: true,
        fixedType: f.type
      };
    }),
    ...availableSchedules
  ];

  return {
    success: true,
    optimizedSchedule,
    fixedSchedules: allFixed,
    conflicts: conflicts.map(c => ({
      fixedSchedule: {
        title: c.fixedSchedule.title,
        days: c.fixedSchedule.days,
        time: `${c.fixedSchedule.startTime}-${c.fixedSchedule.endTime}`
      },
      conflictingSchedules: c.conflictingSchedules.map(s => ({
        title: s.title,
        instructor: s.instructor,
        days: s.days,
        time: `${s.startTime}-${s.endTime}`
      }))
    })),
    removedCount: conflictingScheduleIds.size,
    totalCount: optimizedSchedule.length
  };
}

/**
 * 새 고정 일정 추가 시 충돌 체크만 수행 (시간표 재생성 안 함)
 *
 * @param {Object} newFixedSchedule - 추가하려는 고정 일정
 * @param {Array} existingFixed - 기존 고정 일정들
 * @returns {Object} 충돌 정보
 */
function checkFixedScheduleConflicts(newFixedSchedule, existingFixed = []) {
  const conflicts = existingFixed
    .filter(fixed => hasTimeConflict(newFixedSchedule, fixed))
    .map(fixed => ({
      title: fixed.title,
      days: fixed.days,
      time: `${fixed.startTime}-${fixed.endTime}`,
      type: fixed.type
    }));

  return {
    hasConflict: conflicts.length > 0,
    conflicts
  };
}

module.exports = {
  hasTimeConflict,
  findConflictingSchedules,
  reoptimizeWithFixedSchedules,
  checkFixedScheduleConflicts
};
