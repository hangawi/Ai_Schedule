/**
 * ============================================================================
 * scheduleTransform.js - Schedule Transformation Utilities
 * ============================================================================
 */

import { getColorForImageIndex } from '../../../utils/scheduleAnalysis/assignScheduleColors';
import { DAY_MAP } from '../constants/modalConstants';

/**
 * initialCombinations 생성 함수
 */
export const createInitialCombinations = (combinations, initialSchedules) => {
  if (combinations && Array.isArray(combinations) && combinations.length > 0) {
    const isValid = combinations.every(c => Array.isArray(c));
    if (isValid) {
      return combinations;
    }
  }

  if (initialSchedules && Array.isArray(initialSchedules) && initialSchedules.length > 0) {
    return [initialSchedules];
  }

  return [[]];
};

/**
 * ScheduleGridSelector를 위해 personalTimes 형식으로 변환
 */
export const convertToPersonalTimes = (currentCombination, hoveredImageIndex) => {
  try {
    const schedulesToShow = hoveredImageIndex !== null
      ? currentCombination.filter(schedule => schedule.sourceImageIndex === hoveredImageIndex)
      : currentCombination;

    const dayMap = {
      'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4,
      'FRI': 5, 'SAT': 6, 'SUN': 7,
      '월': 1, '화': 2, '수': 3, '목': 4,
      '금': 5, '토': 6, '일': 7
    };

    return schedulesToShow.map((schedule, index) => {
      if (!schedule || !schedule.days || schedule.days.length === 0) {
        return null;
      }

      const daysArray = Array.isArray(schedule.days) ? schedule.days : [schedule.days];
      const mappedDays = daysArray.map(day => dayMap[day] || day).filter(d => d && typeof d === 'number');

      let scheduleColor = '#9333ea';
      if (schedule.sourceImageIndex !== undefined) {
        const colorInfo = getColorForImageIndex(schedule.sourceImageIndex);
        scheduleColor = colorInfo.border;
      }

      return {
        id: Date.now() + index,
        type: 'study',
        days: mappedDays,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        title: schedule.title || '수업',
        academyName: schedule.academyName,
        subjectName: schedule.subjectName,
        instructor: schedule.instructor,
        color: scheduleColor,
        description: schedule.description || '',
        isRecurring: true
      };
    }).filter(item => item !== null);
  } catch (error) {
    return [];
  }
};

/**
 * 총 수업 시간 계산
 */
export const getTotalClassHours = (currentCombination) => {
  let total = 0;
  currentCombination.forEach(schedule => {
    if (schedule.duration) {
      total += schedule.duration;
    }
  });
  return total;
};

/**
 * 고정 일정을 포함한 전체 스케줄 생성
 */
export const createFullScheduleWithFixed = (currentCombination, currentFixedSchedules) => {
  const fixedSchedulesFlat = (currentFixedSchedules || []).map(fixed => {
    const base = fixed.originalSchedule || fixed;
    return {
      ...base,
      title: fixed.title,
      days: fixed.days,
      startTime: fixed.startTime,
      endTime: fixed.endTime
    };
  });

  const combinationTitles = new Set(currentCombination.map(s => `${s.title}_${s.startTime}_${s.days}`));
  const fixedToAdd = fixedSchedulesFlat.filter(f =>
    !combinationTitles.has(`${f.title}_${f.startTime}_${f.days}`)
  );

  return [...currentCombination, ...fixedToAdd];
};
