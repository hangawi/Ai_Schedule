/**
 * ===================================================================================================
 * chatUtils.js - 채팅 관련 유틸리티 함수들
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/chat/utils
 *
 * 🎯 주요 기능:
 *    - 시간 형식 검증 및 변환
 *    - 스케줄 간 충돌 감지
 *    - 충돌 없는 스케줄 조합 생성 (단일 및 다수)
 *    - 요일 문자(한/영)를 숫자로 매핑
 *
 * 🔗 연결된 파일:
 *    - ../handlers/scheduleHandlers.js - `generateMultipleCombinations` 함수를 사용
 *    - 다양한 컴포넌트 및 핸들러에서 시간/충돌/스케줄 관련 로직에 이 유틸리티들을 사용
 *
 * 💡 UI 위치:
 *    - 이 파일은 UI를 직접 렌더링하지 않으나, 챗봇 및 스케줄 관련 UI의 데이터 처리 로직에 사용됩니다.
 *
 * ✏️ 수정 가이드:
 *    - 시간 충돌 감지 로직 변경: `hasConflict` 함수 수정
 *    - 스케줄 조합 생성 알고리즘 변경: `generateNonConflictingCombination` 또는 `generateMultipleCombinations` 함수 수정
 *    - 새로운 요일 형식 지원: `mapDayToNumber` 함수에 매핑 추가
 *
 * 📝 참고사항:
 *    - `generateNonConflictingCombination` 함수는 무작위로 섞인 스케줄 배열을 기반으로 조합을 생성하므로,
 *      실행할 때마다 다른 결과가 나올 수 있습니다.
 *    - `generateMultipleCombinations` 함수는 중복된 조합을 피하는 로직을 포함하고 있습니다.
 *
 * ===================================================================================================
 */

/**
 * validateTimeFormat
 *
 * @description 주어진 문자열이 "HH:MM" 형식의 유효한 시간인지 검증합니다.
 * @param {string} timeStr - 검증할 시간 문자열
 * @returns {boolean} 유효한 형식이면 true, 아니면 false
 *
 * @example
 * validateTimeFormat("14:30"); // true
 * validateTimeFormat("25:00"); // false
 */
export const validateTimeFormat = (timeStr) => {
  if (!timeStr) return false;
  return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr);
};

/**
 * parseTime
 *
 * @description "HH:MM" 형식의 시간 문자열을 자정부터의 총 분(minutes)으로 변환합니다.
 * @param {string} timeStr - 변환할 시간 문자열
 * @returns {number | null} 변환된 총 분. 유효하지 않은 입력 시 null을 반환합니다.
 *
 * @example
 * parseTime("01:30"); // 90
 * parseTime("14:00"); // 840
 */
export const parseTime = (timeStr) => {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * hasConflict
 *
 * @description 두 개의 스케줄 객체가 같은 요일에 시간적으로 겹치는지(충돌하는지) 확인합니다.
 * @param {Object} schedule1 - 첫 번째 스케줄 객체. { days: string[], startTime: string, endTime: string }
 * @param {Object} schedule2 - 두 번째 스케줄 객체. { days: string[], startTime: string, endTime: string }
 * @returns {boolean} 충돌하면 true, 아니면 false
 *
 * @example
 * const s1 = { days: ['MON'], startTime: '10:00', endTime: '11:00' };
 * const s2 = { days: ['MON', 'WED'], startTime: '10:30', endTime: '11:30' };
 * hasConflict(s1, s2); // true
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

  if (start1 === null || end1 === null || start2 === null || end2 === null) return false;

  // 시간 겹침 체크
  return start1 < end2 && end1 > start2;
};

/**
 * generateNonConflictingCombination
 *
 * @description 주어진 스케줄 목록에서 서로 충돌하지 않는 스케줄들로 이루어진 하나의 조합을 생성합니다.
 *              스케줄을 무작위로 섞은 후, 순서대로 충돌하지 않는 스케줄을 선택하여 조합을 만듭니다.
 * @param {Array<Object>} schedules - 전체 스케줄 목록
 * @returns {Array<Object>} 충돌 없는 스케줄 조합
 *
 * @note
 * - 입력된 스케줄 배열을 무작위로 섞기 때문에 실행 시마다 다른 결과가 나올 수 있습니다.
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
 * generateMultipleCombinations
 *
 * @description 주어진 스케줄 목록에서 충돌 없는 여러 개의 조합을 생성합니다.
 *              중복된 조합은 피하며, 생성된 조합들은 스케줄 개수가 많은 순으로 정렬됩니다.
 * @param {Array<Object>} schedules - 전체 스케줄 목록
 * @param {number} [maxCombinations=5] - 생성할 최대 조합의 수
 * @param {number} [maxAttempts=20] - 조합 생성을 시도할 최대 횟수
 * @returns {Array<Array<Object>>} 충돌 없는 스케줄 조합들의 배열
 *
 * @note
 * - `generateNonConflictingCombination`을 반복 호출하여 여러 조합을 생성합니다.
 * - 조합이 하나도 생성되지 않을 경우, 원본 스케줄 목록을 하나의 조합으로 반환합니다.
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
  if (combinations.length === 0 && schedules.length > 0) {
    combinations.push(generateNonConflictingCombination(schedules));
  }

  // 조합들을 스케줄 개수가 많은 순으로 정렬
  combinations.sort((a, b) => b.length - a.length);

  return combinations;
};


/**
 * convertISOToTimeFormat
 *
 * @description ISO 8601 형식의 날짜/시간 문자열에서 "HH:MM" 형식의 시간 부분만 추출합니다.
 * @param {string | null} isoString - 변환할 ISO 형식 문자열
 * @returns {string | null} "HH:MM" 형식의 시간 문자열. 유효하지 않은 입력 시 null을 반환합니다.
 *
 * @example
 * convertISOToTimeFormat("2025-12-05T14:30:00.000Z"); // "14:30"
 */
export const convertISOToTimeFormat = (isoString) => {
  if (!isoString) return null;

  try {
    if (isoString.includes('T') || isoString.includes(':00+')) {
      const date = new Date(isoString);
      if (isNaN(date)) return isoString; // 유효하지 않은 날짜면 원본 반환
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
  } catch (e) {
    return isoString; // 파싱 중 에러 발생 시 원본 반환
  }

  return isoString;
};

/**
 * mapDayToNumber
 *
 * @description 요일을 나타내는 문자열(한/영)을 숫자(월요일=1, ..., 일요일=7)로 변환합니다.
 * @param {string} day - 변환할 요일 문자열 (예: 'MON', '월')
 * @returns {number | string} 변환된 숫자. 매핑되는 값이 없으면 원본 문자를 반환합니다.
 *
 * @example
 * mapDayToNumber('MON'); // 1
 * mapDayToNumber('화');  // 2
 */
export const mapDayToNumber = (day) => {
  const dayMap = {
    'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4,
    'FRI': 5, 'SAT': 6, 'SUN': 7,
    '월': 1, '화': 2, '수': 3, '목': 4,
    '금': 5, '토': 6, '일': 7
  };
  return dayMap[day.toUpperCase()] || day;
};

/**
 * mapDaysToNumbers
 *
 * @description 요일 문자열 배열을 숫자 배열로 변환합니다. 중첩 배열도 처리합니다.
 * @param {Array<string | Array<string>>} days - 변환할 요일 문자열 배열
 * @returns {Array<number>} 숫자로 변환된 요일 배열
 *
 * @example
 * mapDaysToNumbers(['MON', '수']); // [1, 3]
 * mapDaysToNumbers([['FRI'], '토']); // [5, 6]
 */
export const mapDaysToNumbers = (days) => {
  if (!days) return [];

  const daysArray = Array.isArray(days) ? days : [days];

  return daysArray.map(day => {
    if (Array.isArray(day)) {
      return day.map(d => mapDayToNumber(d)).filter(d => typeof d === 'number');
    }
    const numDay = mapDayToNumber(day);
    return typeof numDay === 'number' ? numDay : null;
  }).flat().filter(d => d !== null);
};
