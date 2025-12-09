/**
 * ===================================================================================================
 * scheduleFilters.js - 스케줄 필터링 유틸리티 함수
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ScheduleGridSelector/utils
 *
 * 🎯 주요 기능:
 *    - 수면시간 여부 확인
 *    - 수면시간 필터링 (기본 모드에서 제외)
 *    - 중복 이벤트 제거
 *    - 요일 포함 여부 확인
 *    - 특정 날짜 일치 여부 확인
 *
 * 🔗 연결된 파일:
 *    - ./timeUtils.js - timeToMinutes 함수 사용
 *    - ../components/MergedWeekView.js - 수면시간 필터링 사용
 *    - ../components/DateDetailModal.js - 개인시간 필터링 사용
 *
 * 💡 UI 위치:
 *    - 탭: 프로필 탭
 *    - 섹션: 스케줄 그리드 (병합/상세 뷰)
 *    - 경로: 앱 실행 > 프로필 탭 > 스케줄 그리드 > 24시간 모드 토글
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 일정 필터링 로직이 변경됨
 *    - 수면시간 기준 변경: isSleepTime 함수의 22 * 60 값 수정
 *    - 중복 제거 기준 변경: removeDuplicateEvents의 key 생성 로직 수정
 *
 * 📝 참고사항:
 *    - 수면시간: 제목에 '수면' 포함 또는 22:00 이후 시작
 *    - 중복 제거: type, title, priority, 시간이 모두 같으면 중복
 *    - 24시간 모드에서는 수면시간도 표시
 *
 * ===================================================================================================
 */

import { timeToMinutes } from './timeUtils';

/**
 * isSleepTime - 수면시간 여부 확인
 *
 * @description 일정이 수면시간인지 확인 (제목 또는 시작 시간 기준)
 * @param {Object} schedule - 일정 객체
 * @param {string} [schedule.title] - 일정 제목
 * @param {string} [schedule.name] - 일정 이름
 * @param {string} [schedule.startTime] - 시작 시간
 * @returns {boolean} 수면시간 여부
 *
 * @example
 * isSleepTime({ title: '수면시간' }); // true
 * isSleepTime({ startTime: '22:30' }); // true
 * isSleepTime({ title: '운동', startTime: '09:00' }); // false
 *
 * @note
 * - 제목/이름에 '수면' 포함 확인
 * - 시작 시간이 22:00 이후인지 확인
 * - 둘 중 하나라도 해당하면 수면시간으로 판단
 */
export const isSleepTime = (schedule) => {
  if (!schedule) return false;

  // 제목이나 이름에 '수면' 포함 확인
  if (schedule.title?.includes('수면') || schedule.name?.includes('수면')) {
    return true;
  }

  // 시작 시간이 22:00 이후인지 확인
  if (schedule.startTime && timeToMinutes(schedule.startTime) >= 22 * 60) {
    return true;
  }

  return false;
};

/**
 * filterSleepTime - 수면시간 필터 (기본 모드에서만 제외)
 *
 * @description 기본 모드에서는 수면시간 제외, 24시간 모드에서는 모두 표시
 * @param {Object} schedule - 일정 객체
 * @param {boolean} showFullDay - 24시간 모드 여부
 * @returns {boolean} 표시 여부
 *
 * @example
 * filterSleepTime({ title: '수면시간' }, false); // false (기본 모드에서 제외)
 * filterSleepTime({ title: '수면시간' }, true); // true (24시간 모드에서 표시)
 * filterSleepTime({ title: '운동' }, false); // true (수면시간 아니므로 표시)
 *
 * @note
 * - showFullDay가 true이면 항상 true 반환
 * - showFullDay가 false이면 isSleepTime 결과의 반대 반환
 */
export const filterSleepTime = (schedule, showFullDay) => {
  // 24시간 모드이면 모든 시간 표시
  if (showFullDay) return true;

  // 기본 모드에서는 수면시간 제외
  return !isSleepTime(schedule);
};

/**
 * filterPersonalSlots - 개인시간 필터링 (수면시간 제외)
 *
 * @description 개인시간 배열에서 수면시간을 필터링하여 반환
 * @param {Array} personalSlots - 개인시간 배열
 * @param {boolean} showFullDay - 24시간 모드 여부
 * @returns {Array} 필터링된 개인시간 배열
 *
 * @example
 * const slots = [
 *   { title: '운동', startTime: '09:00' },
 *   { title: '수면', startTime: '22:00' }
 * ];
 * filterPersonalSlots(slots, false);
 * // [{ title: '운동', startTime: '09:00' }]
 *
 * filterPersonalSlots(slots, true);
 * // [{ title: '운동', startTime: '09:00' }, { title: '수면', startTime: '22:00' }]
 *
 * @note
 * - personalSlots가 null/undefined이면 빈 배열 반환
 * - 각 슬롯에 대해 filterSleepTime 적용
 */
export const filterPersonalSlots = (personalSlots, showFullDay) => {
  if (!personalSlots) return [];

  return personalSlots.filter(p => filterSleepTime(p, showFullDay));
};

/**
 * removeDuplicateEvents - 중복 제거
 *
 * @description 같은 타입, 제목, 우선순위, 시간을 가진 이벤트는 하나만 유지
 * @param {Array} events - 이벤트 배열
 * @returns {Array} 중복 제거된 이벤트 배열
 *
 * @example
 * const events = [
 *   { type: 'schedule', title: '수업', priority: 3, startTime: '09:00', endTime: '10:00' },
 *   { type: 'schedule', title: '수업', priority: 3, startTime: '09:00', endTime: '10:00' },
 *   { type: 'personal', title: '운동', startTime: '14:00', endTime: '15:00' }
 * ];
 * removeDuplicateEvents(events);
 * // [
 * //   { type: 'schedule', title: '수업', priority: 3, startTime: '09:00', endTime: '10:00' },
 * //   { type: 'personal', title: '운동', startTime: '14:00', endTime: '15:00' }
 * // ]
 *
 * @note
 * - key 생성: type-title-priority-startTime-endTime
 * - Set을 사용하여 중복 제거
 * - 순서는 원본 배열 순서 유지
 */
export const removeDuplicateEvents = (events) => {
  const uniqueEvents = [];
  const seenKeys = new Set();

  events.forEach(event => {
    const key = `${event.type}-${event.title || ''}-${event.priority || ''}-${event.startTime || ''}-${event.endTime || ''}`;

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueEvents.push(event);
    }
  });

  return uniqueEvents;
};

/**
 * isDayIncluded - 특정 날짜의 요일이 포함되는지 확인
 *
 * @description 요일 배열에 특정 요일이 포함되어 있는지 확인 (DB 형식 → JS 형식 변환)
 * @param {Array} days - 요일 배열 (1=월, 2=화, ..., 7=일)
 * @param {number} dayOfWeek - JavaScript 요일 (0=일, 1=월, ..., 6=토)
 * @returns {boolean} 포함 여부
 *
 * @example
 * isDayIncluded([1, 2, 3], 1); // true (월요일 포함)
 * isDayIncluded([1, 2, 3], 0); // false (일요일 미포함)
 * isDayIncluded([7], 0); // true (7은 일요일 → 0으로 변환)
 * isDayIncluded([], 1); // true (빈 배열이면 모든 요일)
 *
 * @note
 * - DB 형식 (1=월, 7=일) → JS 형식 (0=일, 1=월) 변환
 * - 빈 배열이면 모든 요일에 해당
 */
export const isDayIncluded = (days, dayOfWeek) => {
  if (!days || days.length === 0) return true; // 빈 배열이면 모든 요일

  // DB 형식 (1=월, 7=일) → JS 형식 (0=일, 1=월, ...)
  const convertedDays = days.map(day => day === 7 ? 0 : day);

  return convertedDays.includes(dayOfWeek);
};

/**
 * isSpecificDateMatch - 특정 날짜가 일정의 specificDate와 일치하는지 확인
 *
 * @description 일정의 특정 날짜와 대상 날짜가 같은 날인지 확인 (YYYY-MM-DD 형식 비교)
 * @param {string} specificDate - 일정의 특정 날짜
 * @param {Date} targetDate - 확인할 대상 날짜
 * @returns {boolean} 일치 여부
 *
 * @example
 * isSpecificDateMatch('2025-12-08', new Date('2025-12-08')); // true
 * isSpecificDateMatch('2025-12-08', new Date('2025-12-09')); // false
 * isSpecificDateMatch(null, new Date('2025-12-08')); // false
 *
 * @note
 * - specificDate 또는 targetDate가 없으면 false 반환
 * - YYYY-MM-DD 형식으로 변환하여 문자열 비교
 * - 시간은 무시하고 날짜만 비교
 */
export const isSpecificDateMatch = (specificDate, targetDate) => {
  if (!specificDate || !targetDate) return false;

  const scheduleDate = new Date(specificDate);
  const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
  const scheduleDateStr = `${scheduleDate.getFullYear()}-${String(scheduleDate.getMonth() + 1).padStart(2, '0')}-${String(scheduleDate.getDate()).padStart(2, '0')}`;

  return targetDateStr === scheduleDateStr;
};
