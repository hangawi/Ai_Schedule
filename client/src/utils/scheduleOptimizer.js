/**
 * 스마트 스케줄 최적화 시스템
 *
 * 기능:
 * 1. 겹치는 일정 자동 감지
 * 2. 사용자 맞춤 질문 생성
 * 3. GPT 기반 최적 스케줄 생성
 * 4. 충돌 해결 옵션 제시
 */

import { auth } from '../config/firebaseConfig';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

/**
 * 겹치는 일정 감지
 */
export const detectConflicts = (schedules) => {
  const conflicts = [];
  const timeToMinutes = (time) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  // 요일별로 그룹화
  const schedulesByDay = {};
  schedules.forEach(schedule => {
    if (!schedule.days || !Array.isArray(schedule.days)) return;

    schedule.days.forEach(day => {
      if (!schedulesByDay[day]) schedulesByDay[day] = [];
      schedulesByDay[day].push(schedule);
    });
  });

  // 각 요일별로 충돌 체크
  Object.entries(schedulesByDay).forEach(([day, daySchedules]) => {
    for (let i = 0; i < daySchedules.length; i++) {
      for (let j = i + 1; j < daySchedules.length; j++) {
        const s1 = daySchedules[i];
        const s2 = daySchedules[j];

        const start1 = timeToMinutes(s1.startTime);
        const end1 = timeToMinutes(s1.endTime);
        const start2 = timeToMinutes(s2.startTime);
        const end2 = timeToMinutes(s2.endTime);

        // 시간이 겹치는지 확인
        if (start1 < end2 && end1 > start2) {
          conflicts.push({
            day,
            schedule1: s1,
            schedule2: s2,
            overlapStart: Math.max(start1, start2),
            overlapEnd: Math.min(end1, end2)
          });
        }
      }
    }
  });

  return conflicts;
};

/**
 * 맞춤형 질문 생성 (상황에 따라 필요한 질문만)
 */
export const generateOptimizationQuestions = (schedules, conflicts) => {
  const questions = [];

  // 충돌이 없으면 질문 최소화
  if (conflicts.length === 0) {
    return []; // 충돌이 없으면 질문 불필요
  }

  // 1. 필수 질문만 (충돌이 있는 경우)

  // 충돌하는 과목만 추출
  const conflictingSubjects = new Set();
  conflicts.forEach(c => {
    conflictingSubjects.add(c.schedule1.title);
    conflictingSubjects.add(c.schedule2.title);
  });

  // 충돌하는 과목이 2개면 우선순위만 물어봄
  if (conflictingSubjects.size === 2) {
    const subjects = Array.from(conflictingSubjects);
    questions.push({
      id: 'priority_simple',
      type: 'text',
      category: 'priority',
      question: `"${subjects[0]}"와(과) "${subjects[1]}" 중 어떤 것이 더 중요한가요?`,
      placeholder: `예: ${subjects[0]}`,
      required: true,
      helpText: '더 중요한 과목을 남기고 나머지는 제거합니다'
    });
  } else {
    // 충돌이 복잡하면 우선순위 질문
    questions.push({
      id: 'priority_ranking',
      type: 'text',
      category: 'priority',
      question: '겹치는 과목들의 우선순위를 알려주세요',
      placeholder: '예: 영어 > 수학 > 태권도',
      required: true,
      helpText: `겹치는 과목: ${Array.from(conflictingSubjects).join(', ')}`
    });
  }

  // 2. 저녁 시간대 충돌이 있는 경우만 취침 시간 질문
  const hasLateConflict = conflicts.some(c => {
    const timeToMinutes = (time) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };
    return timeToMinutes(c.schedule1.startTime) >= 18 * 60 ||
           timeToMinutes(c.schedule2.startTime) >= 18 * 60;
  });

  if (hasLateConflict) {
    questions.push({
      id: 'bedtime',
      type: 'text',
      category: 'basic',
      question: '잠자는 시간은 몇 시인가요?',
      placeholder: '예: 밤 10시',
      required: true,
      helpText: '이 시간 이후의 일정은 제외됩니다'
    });
  }

  // 3. 같은 날 여러 충돌이 있으면 이동시간 질문
  const conflictsByDay = {};
  conflicts.forEach(c => {
    if (!conflictsByDay[c.day]) conflictsByDay[c.day] = [];
    conflictsByDay[c.day].push(c);
  });

  const hasMultipleConflictsPerDay = Object.values(conflictsByDay).some(dayConflicts => dayConflicts.length > 1);

  if (hasMultipleConflictsPerDay) {
    questions.push({
      id: 'travel_time',
      type: 'text',
      category: 'basic',
      question: '학원 간 이동 시간은 평균 몇 분인가요?',
      placeholder: '예: 15분',
      required: false,
      helpText: '일정 사이에 충분한 여유 시간을 확보합니다'
    });
  }

  // 4. 휴식일 질문 (선택사항으로 마지막에만)
  questions.push({
    id: 'preferred_rest_days',
    type: 'text',
    category: 'preference',
    question: '쉬고 싶은 요일이 있나요? (선택사항)',
    placeholder: '예: 수요일 (없으면 "없음")',
    required: false,
    helpText: '비워두면 자동으로 배치합니다'
  });

  return questions;
};

/**
 * GPT API를 통한 스케줄 최적화
 */
export const optimizeScheduleWithGPT = async (schedules, conflicts, userAnswers) => {
  try {

    const response = await fetch(`${API_BASE_URL}/api/schedule/optimize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
      },
      body: JSON.stringify({
        schedules,
        conflicts,
        userPreferences: userAnswers
      })
    });

    if (!response.ok) {
      throw new Error(`스케줄 최적화 실패: ${response.status}`);
    }

    const data = await response.json();

    return {
      optimizedSchedule: data.optimizedSchedule,
      alternatives: data.alternatives || [],
      explanation: data.explanation,
      conflictsResolved: data.conflictsResolved
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 충돌 해결 옵션 생성
 */
export const generateConflictResolutionOptions = (conflict, userPreferences) => {
  const { schedule1, schedule2, day } = conflict;
  const options = [];

  // 옵션 1: schedule1 선택
  options.push({
    id: `keep_${schedule1.title}_${day}`,
    type: 'keep_first',
    title: `${schedule1.title} 유지`,
    description: `${schedule1.title} (${schedule1.startTime}~${schedule1.endTime})를 선택하고 ${schedule2.title}는 제외합니다`,
    schedule: schedule1,
    excludes: [schedule2.title],
    impact: {
      kept: [schedule1.title],
      removed: [schedule2.title]
    }
  });

  // 옵션 2: schedule2 선택
  options.push({
    id: `keep_${schedule2.title}_${day}`,
    type: 'keep_second',
    title: `${schedule2.title} 유지`,
    description: `${schedule2.title} (${schedule2.startTime}~${schedule2.endTime})를 선택하고 ${schedule1.title}는 제외합니다`,
    schedule: schedule2,
    excludes: [schedule1.title],
    impact: {
      kept: [schedule2.title],
      removed: [schedule1.title]
    }
  });

  // 옵션 3: 요일 변경
  const availableDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  availableDays.forEach(alternativeDay => {
    if (alternativeDay !== day) {
      options.push({
        id: `move_${schedule1.title}_to_${alternativeDay}`,
        type: 'reschedule',
        title: `${schedule1.title}를 다른 요일로 변경`,
        description: `${schedule1.title}를 ${getDayName(alternativeDay)}로 옮기면 충돌이 해결됩니다`,
        originalSchedule: schedule1,
        newDay: alternativeDay,
        impact: {
          moved: [{ schedule: schedule1.title, from: day, to: alternativeDay }],
          kept: [schedule2.title]
        },
        requiresConfirmation: true,
        confirmationMessage: `${schedule1.title}의 학원/선생님에게 요일 변경이 가능한지 확인이 필요합니다`
      });
    }
  });

  // 옵션 4: 둘 다 유지 (시간 조정 필요)
  options.push({
    id: `adjust_both_${schedule1.title}_${schedule2.title}`,
    type: 'adjust_time',
    title: '둘 다 유지 (시간 조정)',
    description: `두 일정 모두 참여하되, 시간을 조정합니다`,
    suggestions: [
      `${schedule1.title} 시작 시간을 앞당기기`,
      `${schedule2.title} 시작 시간을 늦추기`,
      `이동 시간을 단축하기 (차량 이용 등)`
    ],
    impact: {
      kept: [schedule1.title, schedule2.title],
      adjustmentRequired: true
    },
    requiresConfirmation: true,
    confirmationMessage: '학원/선생님과 시간 조정 협의가 필요합니다'
  });

  return options;
};

/**
 * 요일 한글 이름 반환
 */
const getDayName = (dayCode) => {
  const dayNames = {
    'MON': '월요일',
    'TUE': '화요일',
    'WED': '수요일',
    'THU': '목요일',
    'FRI': '금요일',
    'SAT': '토요일',
    'SUN': '일요일'
  };
  return dayNames[dayCode] || dayCode;
};

/**
 * 자동 스케줄 생성 (규칙 기반)
 */
export const generateAutoSchedule = (schedules, userPreferences) => {
  const {
    school_end_time,
    bedtime,
    travel_time,
    priority_subjects,
    priority_ranking,
    rest_day,
    preferred_rest_days,
    dinner_time,
    homework_time
  } = userPreferences;

  // 1. 우선순위 기반 필터링
  let filteredSchedules = schedules;
  if (priority_subjects && priority_subjects.length > 0) {
    filteredSchedules = schedules.filter(s => priority_subjects.includes(s.title));
  }

  // 2. 취침 시간 이후 일정 제외
  if (bedtime) {
    const bedtimeMinutes = timeToMinutes(bedtime);
    filteredSchedules = filteredSchedules.filter(s => {
      const endMinutes = timeToMinutes(s.endTime);
      return endMinutes <= bedtimeMinutes;
    });
  }

  // 3. 쉬는 날 제외
  if (preferred_rest_days && preferred_rest_days.length > 0) {
    const restDaysCodes = preferred_rest_days.map(dayNameToCode);
    filteredSchedules = filteredSchedules.filter(s => {
      return !s.days.some(day => restDaysCodes.includes(day));
    });
  }

  // 4. 충돌 해결 (우선순위 기반)
  const resolvedSchedules = resolveConflictsByPriority(
    filteredSchedules,
    priority_ranking,
    travel_time
  );

  // 5. 스케줄 구조화
  const structuredSchedule = structureWeeklySchedule(
    resolvedSchedules,
    {
      school_end_time,
      dinner_time,
      homework_time,
      travel_time
    }
  );

  return {
    schedules: resolvedSchedules,
    structured: structuredSchedule,
    statistics: calculateScheduleStatistics(resolvedSchedules)
  };
};

/**
 * 우선순위 기반 충돌 해결
 */
const resolveConflictsByPriority = (schedules, priorityRanking, travelTime) => {
  const resolved = [];
  const conflicts = detectConflicts(schedules);

  schedules.forEach(schedule => {
    let hasConflict = false;

    for (const conflict of conflicts) {
      if (conflict.schedule1 === schedule || conflict.schedule2 === schedule) {
        const otherSchedule = conflict.schedule1 === schedule ? conflict.schedule2 : conflict.schedule1;

        // 우선순위 비교
        const myPriority = priorityRanking ? priorityRanking.indexOf(schedule.title) : -1;
        const otherPriority = priorityRanking ? priorityRanking.indexOf(otherSchedule.title) : -1;

        if (myPriority !== -1 && (otherPriority === -1 || myPriority < otherPriority)) {
          // 내가 우선순위가 높음 - 유지
          hasConflict = false;
        } else {
          // 상대방이 우선순위가 높음 - 제외
          hasConflict = true;
          break;
        }
      }
    }

    if (!hasConflict) {
      resolved.push(schedule);
    }
  });

  return resolved;
};

/**
 * 주간 스케줄 구조화
 */
const structureWeeklySchedule = (schedules, preferences) => {
  const weekStructure = {
    MON: [],
    TUE: [],
    WED: [],
    THU: [],
    FRI: [],
    SAT: [],
    SUN: []
  };

  schedules.forEach(schedule => {
    schedule.days.forEach(day => {
      weekStructure[day].push({
        ...schedule,
        activities: generateDailyActivities(schedule, preferences)
      });
    });
  });

  return weekStructure;
};

/**
 * 일일 활동 생성 (하교 후 ~ 취침 전)
 */
const generateDailyActivities = (schedule, preferences) => {
  const activities = [];
  const { school_end_time, dinner_time, homework_time } = preferences;

  // 하교
  if (school_end_time) {
    activities.push({
      time: school_end_time,
      type: 'school_end',
      title: '하교 및 간식',
      duration: 30
    });
  }

  // 숙제 시간
  if (homework_time) {
    activities.push({
      time: calculateTimeAfter(school_end_time, 30),
      type: 'homework',
      title: '숙제 및 복습',
      duration: homework_time
    });
  }

  // 학원/활동
  activities.push({
    time: schedule.startTime,
    type: 'class',
    title: schedule.title,
    duration: timeToMinutes(schedule.endTime) - timeToMinutes(schedule.startTime)
  });

  // 저녁 식사
  if (dinner_time) {
    activities.push({
      time: dinner_time.split('~')[0].trim(),
      type: 'dinner',
      title: '저녁 식사',
      duration: 60
    });
  }

  return activities.sort((a, b) =>
    timeToMinutes(a.time) - timeToMinutes(b.time)
  );
};

/**
 * 스케줄 통계 계산
 */
const calculateScheduleStatistics = (schedules) => {
  const stats = {
    totalClasses: schedules.length,
    classesByDay: {},
    classesByType: {},
    totalHoursPerWeek: 0,
    averageHoursPerDay: 0
  };

  schedules.forEach(schedule => {
    const duration = timeToMinutes(schedule.endTime) - timeToMinutes(schedule.startTime);
    stats.totalHoursPerWeek += duration / 60;

    // 요일별 집계
    schedule.days.forEach(day => {
      if (!stats.classesByDay[day]) stats.classesByDay[day] = 0;
      stats.classesByDay[day]++;
    });

    // 타입별 집계
    const type = schedule.type || 'etc';
    if (!stats.classesByType[type]) stats.classesByType[type] = 0;
    stats.classesByType[type]++;
  });

  stats.averageHoursPerDay = stats.totalHoursPerWeek / 7;

  return stats;
};

/**
 * 헬퍼 함수들
 */
const timeToMinutes = (time) => {
  if (!time || typeof time !== 'string') return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const minutesToTime = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const calculateTimeAfter = (startTime, durationMinutes) => {
  const start = timeToMinutes(startTime);
  return minutesToTime(start + durationMinutes);
};

const dayNameToCode = (dayName) => {
  const map = {
    '월요일': 'MON',
    '화요일': 'TUE',
    '수요일': 'WED',
    '목요일': 'THU',
    '금요일': 'FRI',
    '토요일': 'SAT',
    '일요일': 'SUN'
  };
  return map[dayName] || dayName;
};
