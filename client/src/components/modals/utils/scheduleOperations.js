/**
 * ============================================================================
 * scheduleOperations.js - Schedule Modification Operations
 * ============================================================================
 */

import { calculateTimeDifference, calculateEndTime, adjustTimeByMinutes } from './timeUtils';

/**
 * 스케줄 삭제 작업
 */
export const deleteSchedules = (currentSchedules, { day, time, gradeLevel }) => {
  const filteredSchedules = currentSchedules.map((schedule) => {
    let shouldModify = false;
    let matchesAllConditions = true;

    const hasAnyCondition = day || time || gradeLevel;

    if (hasAnyCondition) {
      if (day) {
        if (!schedule.days || !schedule.days.includes(day)) {
          matchesAllConditions = false;
        } else {
          shouldModify = true;
        }
      }

      if (time && matchesAllConditions) {
        if (schedule.startTime !== time) {
          matchesAllConditions = false;
        }
      }

      if (gradeLevel && matchesAllConditions) {
        if (schedule.gradeLevel !== gradeLevel) {
          matchesAllConditions = false;
        }
      }
    }

    if (matchesAllConditions && shouldModify && day) {
      if (!time && !gradeLevel && schedule.days && schedule.days.length > 1) {
        const updatedDays = schedule.days.filter(d => d !== day);
        if (updatedDays.length > 0) {
          return { ...schedule, days: updatedDays };
        }
      }
      return null;
    }

    return schedule;
  }).filter(schedule => schedule !== null);

  const deletedCount = currentSchedules.length - filteredSchedules.length;
  const hasChanges = deletedCount > 0 || JSON.stringify(currentSchedules) !== JSON.stringify(filteredSchedules);

  return { filteredSchedules, deletedCount, hasChanges };
};

/**
 * 스케줄 선택 작업 (겹치는 시간에서 하나만 선택)
 */
export const selectSchedule = (currentSchedules, { day, time, title }) => {
  if (!day || !time || !title) {
    return { success: false, message: '요일, 시간, 과목명을 모두 입력해주세요.' };
  }

  const matchingSchedules = currentSchedules.filter(schedule => {
    return schedule.days?.includes(day) && schedule.startTime === time;
  });

  if (matchingSchedules.length <= 1) {
    return { success: false, message: '해당 시간대에 겹치는 스케줄이 없거나 이미 하나만 있습니다.' };
  }

  const filteredSchedules = currentSchedules.filter(schedule => {
    const isTargetSchedule = schedule.days?.includes(day) && schedule.startTime === time;
    if (isTargetSchedule) {
      return schedule.title?.includes(title);
    }
    return true;
  });

  const deletedCount = currentSchedules.length - filteredSchedules.length;

  return {
    success: true,
    filteredSchedules,
    deletedCount,
    message: `${day} ${time} 시간대에서 "${title}"만 남기고 ${deletedCount}개를 제거했습니다.`
  };
};

/**
 * 스케줄 수정 작업
 */
export const modifySchedules = (currentSchedules, { day, oldTime, newTime, gradeLevel }) => {
  if (!oldTime || !newTime) {
    return { success: false, message: '시간 정보를 찾을 수 없습니다.' };
  }

  let modified = false;
  const newSchedules = currentSchedules.map(schedule => {
    let shouldModify = true;

    if (day && (!schedule.days || !schedule.days.includes(day))) {
      shouldModify = false;
    }

    if (oldTime && schedule.startTime !== oldTime) {
      shouldModify = false;
    }

    if (gradeLevel && schedule.gradeLevel !== gradeLevel) {
      shouldModify = false;
    }

    if (shouldModify) {
      modified = true;
      const diff = calculateTimeDifference(oldTime, newTime);

      if (schedule.endTime) {
        return {
          ...schedule,
          startTime: newTime,
          endTime: adjustTimeByMinutes(schedule.endTime, diff)
        };
      }

      return { ...schedule, startTime: newTime };
    }

    return schedule;
  });

  return {
    success: modified,
    newSchedules,
    message: modified
      ? `시간표를 ${oldTime}에서 ${newTime}로 수정했습니다.`
      : '해당 조건에 맞는 시간표를 찾을 수 없습니다.'
  };
};

/**
 * 스케줄 추가 작업
 */
export const addSchedule = (currentSchedules, { day, time, gradeLevel, title }) => {
  if (!day || !time) {
    return { success: false, message: '요일과 시간을 지정해주세요.' };
  }

  const endTime = calculateEndTime(time, 60);

  const newSchedule = {
    title,
    days: [day],
    startTime: time,
    endTime,
    duration: 60,
    gradeLevel
  };

  const updatedSchedules = [...currentSchedules, newSchedule];

  return {
    success: true,
    updatedSchedules,
    message: `${day} ${time}에 ${title} 시간표를 추가했습니다.`
  };
};
