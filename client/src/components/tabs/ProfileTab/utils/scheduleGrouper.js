/**
 * ===================================================================================================
 * scheduleGrouper.js - '내 프로필' 탭에서 사용되는 스케줄 그룹화 유틸리티
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ProfileTab/utils/scheduleGrouper.js
 *
 * 🎯 주요 기능:
 *    - `groupScheduleByDate`: 스케줄 배열을 `specificDate` 기준으로 그룹화.
 *    - `groupExceptionsByDateAndTitle`: 예외 스케줄 배열을 날짜와 제목을 조합한 키로 그룹화.
 *
 * 🔗 연결된 파일:
 *    - ../components/PreferenceTimeSection.js - 선호시간 목록을 날짜별로 묶어서 표시하기 위해 `groupScheduleByDate` 사용.
 *
 * 💡 UI 위치:
 *    - 이 파일은 UI가 없으나, 반환된 그룹 데이터를 기반으로 '선호시간 관리' 등의 UI가 구성됩니다.
 *
 * ✏️ 수정 가이드:
 *    - 스케줄을 그룹화하는 방식을 변경하려면 이 파일의 해당 함수들을 수정합니다.
 *    - 예를 들어, `groupExceptionsByDateAndTitle`에서 제목을 제외하고 날짜로만 그룹화하려면 `groupKey` 생성 로직을 변경합니다.
 *
 * 📝 참고사항:
 *    - 이 유틸리티 함수들은 복잡한 배열 데이터를 UI에서 쉽게 표현할 수 있는 구조(객체)로 변환하는 데 사용됩니다.
 *
 * ===================================================================================================
 */

/**
 * 스케줄을 날짜별로 그룹화
 * @param {Array} schedule - 스케줄 배열
 * @returns {Object} 날짜별로 그룹화된 객체
 */
export const groupScheduleByDate = (schedule) => {
  const dateGroups = {};

  schedule.forEach(slot => {
    if (slot.specificDate) {
      if (!dateGroups[slot.specificDate]) {
        dateGroups[slot.specificDate] = [];
      }
      dateGroups[slot.specificDate].push(slot);
    }
  });

  return dateGroups;
};

/**
 * 예외 일정을 날짜/제목별로 그룹화
 * @param {Array} exceptions - 예외 일정 배열
 * @returns {Object} 그룹화된 예외 일정
 */
export const groupExceptionsByDateAndTitle = (exceptions) => {
  const exceptionGroups = {};

  (exceptions || []).forEach(exception => {
    const startDate = new Date(exception.startTime);
    const dateKey = startDate.toLocaleDateString('ko-KR');
    const title = exception.title || '일정';
    const groupKey = `${dateKey}-${title}`;

    if (!exceptionGroups[groupKey]) {
      exceptionGroups[groupKey] = {
        title: title,
        date: dateKey,
        exceptions: []
      };
    }
    exceptionGroups[groupKey].exceptions.push(exception);
  });

  return exceptionGroups;
};
