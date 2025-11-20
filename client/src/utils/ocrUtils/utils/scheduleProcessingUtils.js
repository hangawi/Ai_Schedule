/**
 * 시간표 가공, 필터링, 분할 유틸리티
 */

import { GRADE_LEVELS, DEFAULT_CLASS_DURATION } from '../constants/gradeLevelConstants';
import { convertAmPmTo24Hour, convertPeriodToTime, timeToMinutes, minutesToTime } from './timeUtils';
import { extractDaysFromText, convertDaysToEnglish, getDefaultDaysByCount } from './dayUtils';

/**
 * 시간표에 기본 수업 시간 추론하여 추가
 * @param {Object} schedule - 시간표 객체
 * @param {string} gradeLevel - 학년부
 * @param {number} index - 인덱스
 * @returns {Object} - 수업 시간이 추가된 시간표
 */
export const inferClassDuration = (schedule, gradeLevel, index = 0) => {
  if (!schedule) return schedule;

  // startTime 처리
  let startTime = schedule.startTime;

  // 1. startTime에 PM/AM이 포함되어 있으면 24시간 형식으로 변환
  if (startTime) {
    const converted = convertAmPmTo24Hour(startTime);
    if (converted) {
      startTime = converted;
    }
  }

  // 2. startTime이 null이면 description에서 교시 정보나 PM/AM 시간 추출
  if (!startTime && schedule.description) {
    const ampmConverted = convertAmPmTo24Hour(schedule.description);
    const periodConverted = convertPeriodToTime(schedule.description);
    startTime = ampmConverted || periodConverted;
  }

  // 3. title에서도 시도
  if (!startTime && schedule.title) {
    const converted = convertAmPmTo24Hour(schedule.title);
    if (converted) {
      startTime = converted;
    }
  }

  // 4. 여전히 startTime이 없으면 기본 시간 할당 (9시부터 시작, 1시간 간격)
  if (!startTime) {
    const defaultStartHour = 9 + index; // 9시, 10시, 11시...
    startTime = `${String(defaultStartHour).padStart(2, '0')}:00`;
  }

  // 이미 endTime이 있으면 그대로 반환
  if (schedule.endTime) return { ...schedule, startTime };

  // startTime이 있고 endTime이 없으면 기본 시간 추가
  if (startTime && !schedule.endTime) {
    const duration = DEFAULT_CLASS_DURATION[gradeLevel] || 50;

    // HH:MM 형식의 시간을 파싱
    const timeMatch = startTime.match(/(\d{1,2}):(\d{2})/);
    if (!timeMatch) return { ...schedule, startTime };

    const startHour = parseInt(timeMatch[1]);
    const startMinute = parseInt(timeMatch[2]);

    // 종료 시간 계산
    const totalMinutes = startHour * 60 + startMinute + duration;
    const endHour = Math.floor(totalMinutes / 60) % 24;
    const endMinute = totalMinutes % 60;

    const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

    return {
      ...schedule,
      startTime: startTime,
      endTime: endTime,
      inferredDuration: true,
      duration: duration
    };
  }

  return { ...schedule, startTime };
};

/**
 * 학년부 필터링
 * @param {Array} schedules - 추출된 시간표 배열
 * @param {string} targetGradeLevel - 대상 학년부
 * @returns {Array} - 필터링된 시간표
 */
export const filterByGradeLevel = (schedules, targetGradeLevel) => {
  if (!targetGradeLevel || !schedules) return schedules;

  return schedules.filter(schedule => {
    // gradeLevel이 명시되어 있으면 그것을 사용
    if (schedule.gradeLevel) {
      return schedule.gradeLevel === targetGradeLevel;
    }

    // 텍스트에서 학년부 키워드 찾기
    const text = ((schedule.title || '') + ' ' + (schedule.description || '')).toLowerCase();

    if (targetGradeLevel === GRADE_LEVELS.ELEMENTARY) {
      return text.includes('초등') || text.includes('초등부');
    } else if (targetGradeLevel === GRADE_LEVELS.MIDDLE) {
      return text.includes('중등') || text.includes('중학') || text.includes('중등부');
    } else if (targetGradeLevel === GRADE_LEVELS.HIGH) {
      return text.includes('고등') || text.includes('고등부');
    }

    // 학년부를 특정할 수 없으면 포함
    return true;
  });
};

/**
 * 병합된 시간대를 분리하는 함수
 * @param {Object} schedule - 시간표 객체
 * @returns {Array} - 분리된 시간표 배열
 */
export const splitMergedTimeSlots = (schedule) => {
  if (!schedule.startTime || !schedule.endTime) return [schedule];

  const [startHour, startMin] = schedule.startTime.split(':').map(Number);
  const [endHour, endMin] = schedule.endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const totalMinutes = endMinutes - startMinutes;

  // 70분 이상이면 여러 시간대로 분리
  if (totalMinutes >= 70) {
    const slots = [];
    let currentStart = startMinutes;

    // 일반적인 시간표 패턴을 고려한 분리
    // 50분 수업 또는 60분 수업 기준
    while (currentStart < endMinutes) {
      let slotDuration = 50; // 기본 50분

      // 남은 시간이 70분 이상이면 50분 또는 60분 단위로
      const remainingMinutes = endMinutes - currentStart;
      if (remainingMinutes >= 70) {
        slotDuration = 50;
      } else {
        // 남은 시간을 그대로 사용
        slotDuration = remainingMinutes;
      }

      const slotEnd = Math.min(currentStart + slotDuration, endMinutes);
      const slotStartHour = Math.floor(currentStart / 60);
      const slotStartMin = currentStart % 60;
      const slotEndHour = Math.floor(slotEnd / 60);
      const slotEndMin = slotEnd % 60;

      const newSlot = {
        ...schedule,
        startTime: `${String(slotStartHour).padStart(2, '0')}:${String(slotStartMin).padStart(2, '0')}`,
        endTime: `${String(slotEndHour).padStart(2, '0')}:${String(slotEndMin).padStart(2, '0')}`,
        duration: slotEnd - currentStart
      };

      slots.push(newSlot);
      currentStart = slotEnd;
    }

    return slots;
  }

  return [schedule];
};

/**
 * 겹치는 시간 블록 분할
 * @param {Array} schedules - 시간표 배열
 * @returns {Array} - 분할된 시간표 배열
 */
export const splitOverlappingBlocks = (schedules) => {
  // 모든 시간 경계점 수집
  const allBoundaries = new Set();
  schedules.forEach(s => {
    if (s.days && s.startTime && s.endTime) {
      s.days.forEach(day => {
        allBoundaries.add(`${day}:${timeToMinutes(s.startTime)}`);
        allBoundaries.add(`${day}:${timeToMinutes(s.endTime)}`);
      });
    }
  });

  // 각 스케줄을 경계점에서 분할
  const splitSchedules = [];
  schedules.forEach(schedule => {
    if (!schedule.days || !schedule.startTime || !schedule.endTime) {
      splitSchedules.push(schedule);
      return;
    }

    const startMin = timeToMinutes(schedule.startTime);
    const endMin = timeToMinutes(schedule.endTime);

    schedule.days.forEach(day => {
      // 이 요일의 모든 경계점 찾기
      const dayBoundaries = Array.from(allBoundaries)
        .filter(b => b.startsWith(`${day}:`))
        .map(b => parseInt(b.split(':')[1]))
        .filter(b => b > startMin && b < endMin)
        .sort((a, b) => a - b);

      // 경계점으로 분할
      const boundaries = [startMin, ...dayBoundaries, endMin];

      for (let i = 0; i < boundaries.length - 1; i++) {
        const segmentStart = boundaries[i];
        const segmentEnd = boundaries[i + 1];

        splitSchedules.push({
          ...schedule,
          days: [day],
          startTime: minutesToTime(segmentStart),
          endTime: minutesToTime(segmentEnd),
          duration: segmentEnd - segmentStart
        });
      }
    });
  });

  return splitSchedules;
};

/**
 * 요일을 영문 코드로 변환하여 스케줄 처리
 * @param {Array} schedules - 원본 스케줄 배열
 * @param {string} gradeLevel - 학년부
 * @returns {Array} - 처리된 스케줄 배열
 */
export const processScheduleDays = (schedules, gradeLevel) => {
  return schedules.flatMap(schedule => {
    // 먼저 시간대 분리
    const splitSchedules = splitMergedTimeSlots(schedule);

    return splitSchedules.map(splitSchedule => {
      let days = null;

      // 1. splitSchedule.days가 있으면 그것을 사용
      if (splitSchedule.days && Array.isArray(splitSchedule.days) && splitSchedule.days.length > 0) {
        days = convertDaysToEnglish(splitSchedule.days);
      } else {
        // 2. days가 null이거나 비어있으면 description이나 title에서 요일 정보 추출 시도
        const textToSearch = (splitSchedule.description || '') + ' ' + (splitSchedule.title || '');
        const extractedDays = extractDaysFromText(textToSearch);

        if (extractedDays && extractedDays.length > 0) {
          days = extractedDays;
        } else {
          // 3. 그래도 없으면 "주 5회"처럼 횟수만 있는 경우 기본값 설정
          if (textToSearch.includes('주 5회') || textToSearch.includes('주5회')) {
            days = getDefaultDaysByCount(5);
          } else if (textToSearch.includes('주 3회') || textToSearch.includes('주3회')) {
            days = getDefaultDaysByCount(3);
          } else if (textToSearch.includes('주 2회') || textToSearch.includes('주2회')) {
            days = getDefaultDaysByCount(2);
          } else {
            // 요일 정보가 전혀 없으면 일단 null로 유지
            days = null;
          }
        }
      }

      // 학년부 정보 변환
      let detectedGradeLevel = gradeLevel;
      if (splitSchedule.gradeLevel) {
        const gradeLevelMap = {
          '초등부': GRADE_LEVELS.ELEMENTARY,
          '중등부': GRADE_LEVELS.MIDDLE,
          '고등부': GRADE_LEVELS.HIGH
        };
        detectedGradeLevel = gradeLevelMap[splitSchedule.gradeLevel] || gradeLevel;
      }

      return {
        ...splitSchedule,
        days: days,
        gradeLevel: detectedGradeLevel,
        source: 'ocr'
      };
    });
  });
};
