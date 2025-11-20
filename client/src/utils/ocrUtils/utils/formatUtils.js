/**
 * 시간표 포맷팅 및 요약 유틸리티
 */

import { WEEKLY_SCHEDULE_TEMPLATE } from '../constants/dayConstants';
import { parseTime } from './timeUtils';

/**
 * 주간 시간표 데이터를 보기 좋은 형태로 변환
 * @param {Array} schedules - 시간표 배열
 * @returns {Object} - 요일별로 그룹화된 시간표
 */
export const formatWeeklySchedule = (schedules) => {
  const weeklySchedule = { ...WEEKLY_SCHEDULE_TEMPLATE };

  // 안전 장치: schedules가 없거나 배열이 아니면 빈 객체 반환
  if (!schedules || !Array.isArray(schedules)) {
    return weeklySchedule;
  }

  schedules.forEach(schedule => {
    if (schedule.days) {
      // days가 배열이 아니면 배열로 변환
      const daysArray = Array.isArray(schedule.days) ? schedule.days : [schedule.days];

      daysArray.forEach(day => {
        if (weeklySchedule[day]) {
          weeklySchedule[day].push(schedule);
        }
      });
    }
  });

  // 각 요일의 시간표를 시간순으로 정렬
  Object.keys(weeklySchedule).forEach(day => {
    weeklySchedule[day].sort((a, b) => {
      const timeA = parseTime(a.startTime);
      const timeB = parseTime(b.startTime);
      if (!timeA || !timeB) return 0;
      return (timeA.hour * 60 + timeA.minute) - (timeB.hour * 60 + timeB.minute);
    });
  });

  return weeklySchedule;
};

/**
 * 시간표를 텍스트로 요약
 * @param {Array} schedules - 시간표 배열
 * @returns {string} - 시간표 요약 텍스트
 */
export const summarizeSchedule = (schedules) => {
  if (!schedules || schedules.length === 0) {
    return '시간표가 없습니다.';
  }

  const summary = schedules.map(schedule => {
    const daysStr = schedule.days ? schedule.days.join(', ') : '요일 미정';
    const timeStr = schedule.startTime && schedule.endTime
      ? `${schedule.startTime} - ${schedule.endTime}`
      : '시간 미정';

    return `• ${schedule.title || '수업'}: ${daysStr} ${timeStr}`;
  }).join('\n');

  return summary;
};
