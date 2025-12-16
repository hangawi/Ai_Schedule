/**
 * ===================================================================================================
 * dateUtils.js - 타임테이블(시간표) 운영에 특화된 날짜 및 시간 유틸리티 함수 모음
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/utils/dateUtils.js
 *
 * 🎯 주요 기능:
 *    - 현재 주의 월요일 날짜 계산 (`getMondayOfCurrentWeek`).
 *    - 다양한 형식의 날짜 값을 ISO 문자열로 안전하게 변환 (`safeDateToISOString`).
 *    - 타임테이블에 표시할 주간 날짜 목록 생성 (`generateWeekDates`).
 *    - 날짜 객체에서 평일 인덱스(월요일=0) 추출 (`getDayIndex`).
 *    - 캘린더 초기화를 위한 기준 날짜 계산 (`getBaseDate`).
 *    - UI에 표시할 날짜 형식 생성 (`createDayDisplay`).
 *
 * 🔗 연결된 파일:
 *    - ../components/timetable/TimetableGrid.js: 주간 날짜를 생성하고, 날짜 관련 계산에 이 유틸리티 함수들을 사용.
 *    - ../components/tabs/CoordinationTab/: 조율 탭에서 주간/월간 뷰의 날짜를 계산하고 표시하는 데 사용.
 *
 * 💡 UI 위치:
 *    - 조율 탭(`CoordinationTab`)의 시간표 그리드 헤더에 날짜를 표시하거나, 캘린더의 날짜를 계산하는 데 사용됨.
 *
 * ✏️ 수정 가이드:
 *    - 주의 시작을 일요일로 변경하거나 날짜 계산 로직을 변경해야 할 경우: `getMondayOfCurrentWeek`, `generateWeekDates`, `getDayIndex` 함수를 수정.
 *    - 날짜 표시 형식을 변경해야 할 경우: `generateWeekDates`의 `display` 속성 생성 로직과 `createDayDisplay` 함수를 수정.
 *    - 새로운 날짜 형식을 처리해야 할 경우: `safeDateToISOString` 함수를 확장.
 *
 * 📝 참고사항:
 *    - 이 파일의 날짜 계산은 주로 UTC 기준 (`getUTCDay`, `getUTCDate` 등)으로 이루어지므로, 시간대(Timezone) 관련 이슈에 주의해야 함.
 *    - `getDayIndex`는 주말(토,일)을 제외하고 평일(월~금)에 대해서만 유효한 인덱스(0~4)를 반환.
 *
 * ===================================================================================================
 */

/**
 * getMondayOfCurrentWeek
 * @description 주어진 날짜가 속한 주의 월요일을 나타내는 Date 객체를 반환합니다.
 * @param {Date} date - 기준이 되는 날짜.
 * @returns {Date} 해당 주의 월요일 00:00:00 (UTC) 시점의 Date 객체.
 */
export const getMondayOfCurrentWeek = (date) => {
  const d = new Date(date);
  const day = d.getUTCDay(); // Sunday - 0, Monday - 1, ..., Saturday - 6
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/**
 * safeDateToISOString
 * @description 다양한 형식의 날짜 값을 ISO 8601 문자열로 안전하게 변환합니다. 유효하지 않은 값이면 null을 반환합니다.
 * @param {*} dateValue - 변환할 날짜 값 (Date 객체, 문자열, 숫자 등).
 * @returns {string|null} ISO 8601 형식의 날짜 문자열 또는 변환 실패 시 null.
 */
export const safeDateToISOString = (dateValue) => {
  try {
    if (!dateValue) {
      return null;
    }

    // Handle various date formats
    let date;
    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
      date = new Date(dateValue);
    } else {
      return null;
    }

    if (isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  } catch (error) {
    return null;
  }
};

/**
 * generateWeekDates
 * @description 기준 날짜로부터 한 주의 평일(월~금) 날짜 목록을 생성하여 타임테이블 표시에 사용합니다.
 * @param {Date} baseDate - 기준 날짜.
 * @param {string[]} dayNamesKorean - 요일 표시를 위한 한글 요일 이름 배열.
 * @returns {Array<object>} {fullDate: Date, display: string} 형태의 객체 배열.
 */
export const generateWeekDates = (baseDate, dayNamesKorean) => {
  const mondayOfCurrentWeek = getMondayOfCurrentWeek(baseDate);

  const dates = [];
  let currentDay = new Date(mondayOfCurrentWeek);

  for (let i = 0; i < 5; i++) { // Generate 5 weekdays (Mon-Fri for current week)
    // Skip Saturday and Sunday
    while (currentDay.getUTCDay() === 0 || currentDay.getUTCDay() === 6) {
      currentDay.setUTCDate(currentDay.getUTCDate() + 1);
    }

    const month = String(currentDay.getUTCMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(currentDay.getUTCDate()).padStart(2, '0');
    const dayName = dayNamesKorean[currentDay.getUTCDay() - 1]; // Monday is 1, so -1 for 0-indexed array
    dates.push({
      fullDate: new Date(currentDay),
      display: `${dayName} (${month}.${dayOfMonth})`
    });

    currentDay.setUTCDate(currentDay.getUTCDate() + 1); // Move to the next day
  }

  return dates;
};

/**
 * getDayIndex
 * @description Date 객체에서 평일 인덱스를 가져옵니다. (월요일=0, ... 금요일=4). 주말은 -1을 반환합니다.
 * @param {Date} date - 날짜 객체.
 * @returns {number} 0~4 사이의 평일 인덱스 또는 -1.
 */
export const getDayIndex = (date) => {
  const dayOfWeek = date.getUTCDay(); // 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
  // We want Monday=0, Tuesday=1, Wednesday=2, Thursday=3, Friday=4
  if (dayOfWeek === 0) return -1; // Sunday, not valid
  if (dayOfWeek === 6) return -1; // Saturday, not valid
  return dayOfWeek - 1; // Monday(1)->0, Tuesday(2)->1, etc.
};

/**
 * getBaseDate
 * @description 캘린더 초기화를 위한 기준 날짜를 계산합니다. 주말일 경우 다음 주 월요일로 조정될 수 있습니다.
 * @param {string|Date} [initialStartDate] - 선택적인 초기 시작 날짜.
 * @returns {Date} 캘린더의 기준이 될 Date 객체.
 */
export const getBaseDate = (initialStartDate) => {
  if (initialStartDate) {
    return new Date(initialStartDate);
  }

  const today = new Date();
  // If it's Sunday, show next week's calendar starting Monday
  // This logic is already in getMondayOfCurrentWeek, but let's ensure today is a weekday for initial calculation
  let startDay = new Date(today);
  if (startDay.getUTCDay() === 0) { // If today is Sunday, start from tomorrow (Monday)
    startDay.setUTCDate(startDay.getUTCDate() + 1);
  } else if (startDay.getUTCDay() === 6) { // If today is Saturday, start from next Monday
    startDay.setUTCDate(startDay.getUTCDate() + 2);
  }
  return startDay;
};

/**
 * createDayDisplay
 * @description UI에 표시할 "요일 (월.일)" 형식의 날짜 문자열을 생성합니다.
 * @param {Date} date - 포맷할 Date 객체.
 * @returns {string} "월 (01.01)" 형식의 날짜 문자열.
 */
export const createDayDisplay = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(date.getDate()).padStart(2, '0');
  const dayNames_kr = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = dayNames_kr[date.getDay()];
  return `${dayName} (${month}.${dayOfMonth})`;
};