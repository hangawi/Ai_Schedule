/**
 * ============================================================================
 * chatUtils.js - 채팅 관련 유틸리티 함수들
 * ============================================================================
 */

/**
 * 시간 형식 검증 (HH:MM)
 */
export const validateTimeFormat = (timeStr) => {
  if (!timeStr) return false;
  return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr);
};

/**
 * 시간 문자열을 분(minutes)으로 변환
 */
export const parseTime = (timeStr) => {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * 두 스케줄 간의 충돌 감지
 */
export const hasConflict = (schedule1, schedule2) => {
  // 같은 요일이 있는지 확인
  const commonDays = schedule1.days?.filter(day => schedule2.days?.includes(day));
  if (!commonDays || commonDays.length === 0) return false;

  // 시간 중복 확인
  const start1 = parseTime(schedule1.startTime);
  const end1 = parseTime(schedule1.endTime);
  const start2 = parseTime(schedule2.startTime);
  const end2 = parseTime(schedule2.endTime);

  if (!start1 || !end1 || !start2 || !end2) return false;

  // 시간 겹침 체크
  return start1 < end2 && end1 > start2;
};

/**
 * 충돌 없는 스케줄 조합 생성
 */
export const generateNonConflictingCombination = (schedules) => {
  const shuffled = [...schedules].sort(() => Math.random() - 0.5);
  const result = [];

  for (const schedule of shuffled) {
    let conflict = false;
    for (const selected of result) {
      if (hasConflict(schedule, selected)) {
        conflict = true;
        break;
      }
    }
    if (!conflict) {
      result.push(schedule);
    }
  }

  return result;
};

/**
 * 여러 개의 충돌 없는 조합 생성
 */
export const generateMultipleCombinations = (schedules, maxCombinations = 5, maxAttempts = 20) => {
  const combinations = [];

  for (let i = 0; i < maxAttempts && combinations.length < maxCombinations; i++) {
    const combo = generateNonConflictingCombination(schedules);

    // 이미 같은 조합이 있는지 확인
    const isDuplicate = combinations.some(existing => {
      if (existing.length !== combo.length) return false;
      const existingIds = existing.map(s => `${s.title}_${s.startTime}_${s.days?.join('')}`).sort().join('|');
      const comboIds = combo.map(s => `${s.title}_${s.startTime}_${s.days?.join('')}`).sort().join('|');
      return existingIds === comboIds;
    });

    if (!isDuplicate && combo.length > 0) {
      combinations.push(combo);
    }
  }

  // 최소 1개 이상의 조합 보장
  if (combinations.length === 0) {
    combinations.push(schedules);
  }

  // 조합들을 스케줄 개수가 많은 순으로 정렬
  combinations.sort((a, b) => b.length - a.length);

  return combinations;
};

/**
 * ISO 시간 문자열을 HH:MM 형식으로 변환
 */
export const convertISOToTimeFormat = (isoString) => {
  if (!isoString) return null;

  if (isoString.includes('T') || isoString.includes(':00+')) {
    const date = new Date(isoString);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  return isoString;
};

/**
 * 요일 매핑 (한글/영문 → 숫자)
 */
export const mapDayToNumber = (day) => {
  const dayMap = {
    'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4,
    'FRI': 5, 'SAT': 6, 'SUN': 7,
    '월': 1, '화': 2, '수': 3, '목': 4,
    '금': 5, '토': 6, '일': 7
  };
  return dayMap[day] || day;
};

/**
 * 요일 배열을 숫자 배열로 변환
 */
export const mapDaysToNumbers = (days) => {
  if (!days) return [];

  const daysArray = Array.isArray(days) ? days : [days];

  return daysArray.map(day => {
    if (Array.isArray(day)) {
      return day.map(d => mapDayToNumber(d)).filter(d => d);
    }
    return mapDayToNumber(day);
  }).flat().filter(d => d && typeof d === 'number');
};
