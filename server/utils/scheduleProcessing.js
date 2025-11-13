/**
 * 스케줄 처리 유틸리티
 * 스케줄 병합, 분석, 포맷팅 등
 */

/**
 * 연속된 같은 제목의 스케줄을 하나로 병합
 * 예: 수학 13:50-14:00 + 수학 14:00-14:20 + 수학 14:20-14:40 → 수학 13:50-14:40
 */
function mergeConsecutiveSchedules(schedules) {
  if (!schedules || schedules.length === 0) return schedules;

  const merged = [];
  const processed = new Set();

  // 각 스케줄을 요일별로 전개
  const expandedSchedules = [];
  schedules.forEach(schedule => {
    const days = Array.isArray(schedule.days) ? schedule.days : [schedule.days];
    days.forEach(day => {
      expandedSchedules.push({ ...schedule, days: [day], originalDaysCount: days.length });
    });
  });

  // 요일별로 그룹화 및 시간순 정렬
  const byDay = {};
  expandedSchedules.forEach(schedule => {
    const day = schedule.days[0];
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(schedule);
  });

  Object.keys(byDay).forEach(day => {
    const daySchedules = byDay[day].sort((a, b) => a.startTime.localeCompare(b.startTime));

    for (let i = 0; i < daySchedules.length; i++) {
      const current = daySchedules[i];
      const currentId = `${day}_${current.title}_${current.startTime}_${current.endTime}`;

      if (processed.has(currentId)) continue;

      // 연속된 같은 제목의 스케줄 찾기
      let endTime = current.endTime;
      const toMerge = [current];

      for (let j = i + 1; j < daySchedules.length; j++) {
        const next = daySchedules[j];

        if (next.title === current.title &&
            next.instructor === current.instructor &&
            next.floor === current.floor &&  // ⭐ 층도 같아야 병합
            next.startTime === endTime) {
          toMerge.push(next);
          endTime = next.endTime;

          const nextId = `${day}_${next.title}_${next.startTime}_${next.endTime}`;
          processed.add(nextId);
        } else {
          break;
        }
      }

      const mergedSchedule = { ...current };
      mergedSchedule.endTime = endTime;
      mergedSchedule.days = [day];

      // duration 재계산
      const [startH, startM] = current.startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      mergedSchedule.duration = (endH * 60 + endM) - (startH * 60 + startM);

      merged.push(mergedSchedule);
      processed.add(currentId);
    }
  });

  // 같은 title + startTime + endTime + instructor를 가진 스케줄을 다시 묶기
  const finalMerged = [];
  const scheduleMap = new Map();

  merged.forEach(schedule => {
    const key = `${schedule.title}_${schedule.startTime}_${schedule.endTime}_${schedule.instructor || ''}_${schedule.floor || ''}`;  // ⭐ 층도 키에 포함

    if (scheduleMap.has(key)) {
      // 기존 스케줄에 요일 추가
      const existing = scheduleMap.get(key);
      existing.days.push(schedule.days[0]);
    } else {
      // 새로운 스케줄 추가
      scheduleMap.set(key, {
        ...schedule,
        days: [schedule.days[0]]
      });
    }
  });

  // Map에서 배열로 변환
  scheduleMap.forEach(schedule => finalMerged.push(schedule));
  return finalMerged;
}

module.exports = {
  mergeConsecutiveSchedules
};
