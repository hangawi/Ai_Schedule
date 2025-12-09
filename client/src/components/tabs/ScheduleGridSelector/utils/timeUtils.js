/**
 * ===================================================================================================
 * timeUtils.js - 시간 관련 유틸리티 함수
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ScheduleGridSelector/utils
 *
 * 🎯 주요 기능:
 *    - 시간 문자열과 분 단위 변환 (timeToMinutes, minutesToTime)
 *    - 시간 슬롯 배열 생성 (10분 단위)
 *    - 주의 일요일 날짜 계산
 *    - 시간 범위 관련 유틸리티 (연속성, 자정 넘김, 범위 확인)
 *
 * 🔗 연결된 파일:
 *    - ../constants/scheduleConstants.js - TIME_SLOT_INTERVAL 상수 사용
 *    - ../hooks/useTimeSlots.js - generateTimeSlots 함수 사용
 *    - ../hooks/useWeekNavigation.js - getSundayOfCurrentWeek 함수 사용
 *    - ../components/MergedWeekView.js - 시간 변환 함수들 사용
 *    - ../components/DetailedWeekView.js - timeToMinutes 함수 사용
 *
 * 💡 UI 위치:
 *    - 탭: 프로필 탭
 *    - 섹션: 스케줄 그리드 (모든 뷰)
 *    - 경로: 앱 실행 > 프로필 탭 > 스케줄 그리드
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 시간 처리 로직이 변경됨
 *    - 시간 슬롯 간격 변경: generateTimeSlots의 TIME_SLOT_INTERVAL 참조 수정
 *    - 시간 형식 변경: timeToMinutes, minutesToTime 함수 수정
 *    - 주 시작일 변경: getSundayOfCurrentWeek 로직 수정
 *
 * 📝 참고사항:
 *    - 시간 형식: "HH:MM" (24시간 형식)
 *    - 시간 슬롯 간격: 10분 (상수에서 가져옴)
 *    - 주는 일요일부터 시작 (0=일, 1=월, ..., 6=토)
 *
 * ===================================================================================================
 */

import { TIME_SLOT_INTERVAL } from '../constants/scheduleConstants';

/**
 * timeToMinutes - 시간 문자열을 분으로 변환
 *
 * @description "HH:MM" 형식의 시간을 분 단위 숫자로 변환
 * @param {string} timeString - "HH:MM" 형식의 시간
 * @returns {number} 분 단위 시간 (0~1440)
 *
 * @example
 * timeToMinutes("09:30"); // 570 (9*60 + 30)
 * timeToMinutes("00:00"); // 0
 * timeToMinutes("23:50"); // 1430
 *
 * @note
 * - 유효하지 않은 입력 시 0 반환
 * - ':' 포함 여부 확인
 */
export const timeToMinutes = (timeString) => {
  if (!timeString || !timeString.includes(':')) return 0;
  const [hour, minute] = timeString.split(':').map(Number);
  return hour * 60 + minute;
};

/**
 * minutesToTime - 분을 시간 문자열로 변환
 *
 * @description 분 단위 숫자를 "HH:MM" 형식의 시간으로 변환
 * @param {number} minutes - 분 단위 시간
 * @returns {string} "HH:MM" 형식의 시간
 *
 * @example
 * minutesToTime(570); // "09:30"
 * minutesToTime(0); // "00:00"
 * minutesToTime(1430); // "23:50"
 *
 * @note
 * - 24시간 형식으로 반환
 * - 2자리 숫자로 패딩 (01, 02, ..., 23)
 */
export const minutesToTime = (minutes) => {
  const hour = Math.floor(minutes / 60);
  const min = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

/**
 * generateTimeSlots - 시간 슬롯 배열 생성
 *
 * @description 시작 시간부터 종료 시간까지 지정된 간격으로 시간 슬롯 배열 생성
 * @param {number} [startHour=0] - 시작 시간 (기본값: 0)
 * @param {number} [endHour=24] - 종료 시간 (기본값: 24)
 * @returns {string[]} 시간 슬롯 배열 ("HH:MM" 형식)
 *
 * @example
 * generateTimeSlots(9, 18);
 * // ["09:00", "09:10", "09:20", ..., "17:50"]
 *
 * generateTimeSlots(0, 24);
 * // ["00:00", "00:10", "00:20", ..., "23:50"]
 *
 * @note
 * - TIME_SLOT_INTERVAL 상수 사용 (10분)
 * - endHour는 포함하지 않음 (h < endHour)
 * - 24:00은 생성되지 않음 (23:50까지)
 */
export const generateTimeSlots = (startHour = 0, endHour = 24) => {
  const slots = [];
  // 24:00 이후 생성 방지: h < endHour 사용
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += TIME_SLOT_INTERVAL) {
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      slots.push(time);
    }
  }
  return slots;
};

/**
 * getSundayOfCurrentWeek - 해당 주의 일요일 날짜 계산
 *
 * @description 주어진 날짜가 속한 주의 일요일 날짜 반환
 * @param {Date} date - 기준 날짜
 * @returns {Date} 해당 주의 일요일 (00:00:00으로 설정됨)
 *
 * @example
 * const wednesday = new Date('2025-12-10'); // 수요일
 * const sunday = getSundayOfCurrentWeek(wednesday);
 * // 2025-12-07 (일요일)
 *
 * @note
 * - 일요일이 주의 첫날
 * - 시간은 00:00:00으로 초기화됨
 * - 원본 날짜 객체는 수정되지 않음 (새 객체 반환)
 */
export const getSundayOfCurrentWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  // 현재 날짜에서 요일만큼 빼서 해당 주의 일요일을 구함
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * getEndTimeForBlock - 블록의 종료 시간 계산
 *
 * @description 시작 시간과 지속 시간으로 종료 시간 계산
 * @param {Object} block - 시간 블록 객체
 * @param {string} block.startTime - 시작 시간 ("HH:MM")
 * @param {number} block.duration - 지속 시간 (분)
 * @returns {string} "HH:MM" 형식의 종료 시간
 *
 * @example
 * getEndTimeForBlock({ startTime: "09:00", duration: 60 });
 * // "10:00"
 *
 * getEndTimeForBlock({ startTime: "09:30", duration: 90 });
 * // "11:00"
 *
 * @note
 * - duration은 분 단위
 * - 자정 넘김은 자동 처리되지 않음 (24시간 넘으면 다음날)
 */
export const getEndTimeForBlock = (block) => {
  const startMinutes = timeToMinutes(block.startTime);
  const endMinutes = startMinutes + block.duration;
  return minutesToTime(endMinutes);
};

/**
 * areTimesConsecutive - 두 시간이 연속되는지 확인
 *
 * @description 첫 번째 시간의 종료와 두 번째 시간의 시작이 같은지 확인
 * @param {string} endTime1 - 첫 번째 시간의 종료 시간
 * @param {string} startTime2 - 두 번째 시간의 시작 시간
 * @returns {boolean} 연속 여부
 *
 * @example
 * areTimesConsecutive("09:30", "09:30"); // true
 * areTimesConsecutive("09:30", "09:40"); // false
 *
 * @note
 * - 정확히 같을 때만 true
 * - 병합 가능한 시간 블록 판단에 사용
 */
export const areTimesConsecutive = (endTime1, startTime2) => {
  return endTime1 === startTime2;
};

/**
 * crossesMidnight - 시간 범위가 자정을 넘는지 확인
 *
 * @description 종료 시간이 시작 시간보다 작거나 같으면 자정을 넘는 것으로 판단
 * @param {string} startTime - 시작 시간
 * @param {string} endTime - 종료 시간
 * @returns {boolean} 자정 넘김 여부
 *
 * @example
 * crossesMidnight("22:00", "08:00"); // true (22시~익일 08시)
 * crossesMidnight("09:00", "17:00"); // false (09시~17시)
 * crossesMidnight("23:00", "23:00"); // true (같으면 자정 넘김)
 *
 * @note
 * - endMinutes <= startMinutes이면 true
 * - 개인시간 등에서 수면시간 처리에 사용
 */
export const crossesMidnight = (startTime, endTime) => {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  return endMinutes <= startMinutes;
};

/**
 * isTimeInRange - 특정 시간이 시간 범위 내에 있는지 확인
 *
 * @description 주어진 시간이 시작 시간과 종료 시간 사이에 있는지 확인 (자정 넘김 고려)
 * @param {string} time - 확인할 시간
 * @param {string} startTime - 범위 시작 시간
 * @param {string} endTime - 범위 종료 시간
 * @returns {boolean} 범위 내 포함 여부
 *
 * @example
 * isTimeInRange("10:00", "09:00", "17:00"); // true
 * isTimeInRange("08:00", "09:00", "17:00"); // false
 * isTimeInRange("23:00", "22:00", "08:00"); // true (자정 넘김)
 * isTimeInRange("07:00", "22:00", "08:00"); // true (자정 넘김)
 *
 * @note
 * - 자정을 넘나드는 시간인지 자동 감지
 * - startTime >= endTime이면 자정 넘김으로 처리
 * - 시작 시간 포함, 종료 시간 미포함 (>= start && < end)
 */
export const isTimeInRange = (time, startTime, endTime) => {
  const timeMinutes = timeToMinutes(time);
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  // 자정을 넘나드는 시간인지 확인
  if (endMinutes <= startMinutes) {
    // 예: 22:00~08:00의 경우
    return timeMinutes >= startMinutes || timeMinutes < endMinutes;
  } else {
    // 일반적인 하루 내 시간
    return timeMinutes >= startMinutes && timeMinutes < endMinutes;
  }
};
