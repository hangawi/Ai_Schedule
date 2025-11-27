const { DAY_CODE_TO_NAME } = require('../constants/dayMappings');

/**
 * 겹치는 수업 자동 감지
 */
function detectConflicts(schedules) {
  const conflicts = [];

  // 요일별로 그룹화
  const byDay = {};
  schedules.forEach((schedule, idx) => {
    const daysArray = Array.isArray(schedule.days) ? schedule.days : [schedule.days];
    daysArray.forEach(day => {
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push({ ...schedule, originalIndex: idx });
    });
  });

  // 각 요일별로 시간 겹침 체크
  Object.keys(byDay).forEach(day => {
    const daySchedules = byDay[day];

    for (let i = 0; i < daySchedules.length; i++) {
      for (let j = i + 1; j < daySchedules.length; j++) {
        const s1 = daySchedules[i];
        const s2 = daySchedules[j];

        // 시간 겹침 체크
        const overlaps = (s1.startTime < s2.endTime && s2.startTime < s1.endTime);

        if (overlaps) {
          const typeLabel1 = s1.type === 'school' ? '[학교]' : s1.type === 'academy' ? '[학원]' : '';
          const typeLabel2 = s2.type === 'school' ? '[학교]' : s2.type === 'academy' ? '[학원]' : '';

          conflicts.push({
            day: DAY_CODE_TO_NAME[day] || day,
            schedule1: {
              title: `${typeLabel1} ${s1.title}`,
              startTime: s1.startTime,
              endTime: s1.endTime,
              type: s1.type
            },
            schedule2: {
              title: `${typeLabel2} ${s2.title}`,
              startTime: s2.startTime,
              endTime: s2.endTime,
              type: s2.type
            }
          });
        }
      }
    }
  });

  return conflicts;
}

module.exports = {
  detectConflicts
};
