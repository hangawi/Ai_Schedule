/**
 * ===================================================================================================
 * scheduleUtils.js - 스케줄 관련 범용 유틸리티
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/modals/utils
 *
 * 🎯 주요 기능:
 *    - 요일 및 학년부 문자열을 표준 코드로 매핑하는 객체 제공
 *    - 다양한 형식의 시간 문자열(예: "오후 3시", "3pm")을 "HH:MM" 형식으로 파싱
 *    - 스케줄 목록의 총 수업 시간을 계산
 *
 * 🔗 연결된 파일:
 *    - 이 유틸리티들을 필요로 하는 다수의 컴포넌트 및 핸들러 파일
 *
 * 💡 UI 위치:
 *    - 이 파일은 UI가 없으며, 애플리케이션 전반의 스케줄 데이터 처리 로직에 사용됩니다.
 *
 * ✏️ 수정 가이드:
 *    - 새로운 요일 또는 학년부 키워드 추가: `dayMap`, `gradeLevelMap` 객체에 새로운 키-값 쌍 추가
 *    - 새로운 시간 형식 파싱 지원: `parseTime` 함수에 새로운 정규식 및 변환 로직 추가
 *
 * 📝 참고사항:
 *    - 이 파일의 유틸리티들은 다른 유틸리티 파일(예: `commandParser.js`)에서도 사용될 수 있습니다.
 *    - `parseTime`은 여러 가지 일반적인 시간 표현을 처리하도록 설계되었습니다.
 *
 * ===================================================================================================
 */

/**
 * @constant dayMap
 * @description 한글 및 축약형 요일 문자열을 영문 표준 코드(MON, TUE 등)로 매핑하는 객체입니다.
 */
export const dayMap = {
  '월요일': 'MON', '화요일': 'TUE', '수요일': 'WED', '목요일': 'THU',
  '금요일': 'FRI', '토요일': 'SAT', '일요일': 'SUN',
  '월': 'MON', '화': 'TUE', '수': 'WED', '목': 'THU',
  '금': 'FRI', '토': 'SAT', '일': 'SUN'
};

/**
 * @constant gradeLevelMap
 * @description 한글 학년부 문자열을 영문 표준 코드(elementary, middle, high)로 매핑하는 객체입니다.
 */
export const gradeLevelMap = {
  '초등부': 'elementary', '중등부': 'middle', '고등부': 'high',
  '초등': 'elementary', '중등': 'middle', '고등': 'high'
};

/**
 * parseTime
 * @description 다양한 형식의 시간 문자열을 "HH:MM" 형식으로 파싱합니다.
 * @param {string} timeStr - 파싱할 시간 문자열 (예: "오후 3시", "3pm", "14:40").
 * @returns {string | null} "HH:MM" 형식으로 변환된 시간 문자열 또는 파싱 실패 시 null.
 */
export const parseTime = (timeStr) => {
  if (!timeStr) return null;
  // "오후 3시", "오전 10시 30분" 형식
  const koreanTimeMatch = timeStr.match(/(오전|오후)\s*(\d{1,2})시(?:\s*(\d{1,2})분)?/);
  if (koreanTimeMatch) {
    let hour = parseInt(koreanTimeMatch[2], 10);
    const minute = koreanTimeMatch[3] ? parseInt(koreanTimeMatch[3], 10) : 0;
    if (koreanTimeMatch[1] === '오후' && hour !== 12) hour += 12;
    if (koreanTimeMatch[1] === '오전' && hour === 12) hour = 0; // 자정
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  // "3pm", "3PM" 형식
  const pmMatch = timeStr.match(/(\d{1,2})\s*(pm|PM)/i);
  if (pmMatch) {
    let hour = parseInt(pmMatch[1], 10);
    if (hour !== 12) hour += 12;
    return `${String(hour).padStart(2, '0')}:00`;
  }

  // "3am", "3AM" 형식
  const amMatch = timeStr.match(/(\d{1,2})\s*(am|AM)/i);
  if (amMatch) {
    let hour = parseInt(amMatch[1], 10);
    if (hour === 12) hour = 0; // 자정
    return `${String(hour).padStart(2, '0')}:00`;
  }

  // "14:40", "14시 40분" 형식
  const timeMatch = timeStr.match(/(\d{1,2})[시:]\s*(\d{1,2})분?/);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
  
  // "3시" 같은 단독 시간
  const singleHourMatch = timeStr.match(/(\d{1,2})시/);
  if(singleHourMatch) {
      const hour = parseInt(singleHourMatch[1], 10);
      return `${String(hour).padStart(2, '0')}:00`;
  }

  return null;
};

/**
 * getTotalClassHours
 * @description 스케줄 목록의 총 수업 시간(duration) 합계를 분 단위로 계산합니다.
 * @param {Array<Object>} schedules - 스케줄 객체 목록. 각 객체는 `duration` 속성을 가질 수 있습니다.
 * @returns {number} 총 수업 시간 (분).
 */
export const getTotalClassHours = (schedules) => {
  if (!schedules) return 0;
  return schedules.reduce((total, schedule) => total + (schedule.duration || 0), 0);
};

/**
 * @constant gradeLevelLabels
 * @description 영문 학년부 코드를 한글 레이블로 매핑하는 객체입니다.
 */
export const gradeLevelLabels = {
  elementary: '초등부',
  middle: '중등부',
  high: '고등부'
};