/**
 * ===================================================================================================
 * createAutoSaveHandler.js - '내 프로필' 탭의 자동 저장 핸들러 생성 팩토리 함수
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ProfileTab/handlers/createAutoSaveHandler.js
 *
 * 🎯 주요 기능:
 *    - 사용자가 '편집' 모드가 아닐 때 스케줄을 변경하면(예: 캘린더에서 바로 시간 추가) 자동으로 서버에 저장하는 핸들러를 생성.
 *    - `isEditing` 또는 `justCancelled` 상태를 확인하여, '편집' 모드 중이거나 '취소' 직후에는 자동 저장이 실행되지 않도록 방지.
 *    - 스케줄 데이터를 서버에 맞게 가공한 후 `userService.updateUserSchedule` API를 호출.
 *
 * 🔗 연결된 파일:
 *    - ../index.js (ProfileTab) - 이 팩토리 함수를 사용하여 `onAutoSave` 핸들러를 생성.
 *    - ../../../../services/userService.js - 사용자 스케줄을 업데이트하는 API 호출 서비스.
 *
 * 💡 UI 위치:
 *    - 이 파일은 UI가 없으나, `ProfileTab`의 하위 컴포넌트들(예: CalendarView, PersonalTimeManager)에서
 *      사용자의 액션에 의해 트리거되는 자동 저장 로직을 담당합니다.
 *
 * ✏️ 수정 가이드:
 *    - 자동 저장이 트리거되는 조건을 변경하려면 이 파일의 첫 부분에 있는 `if (isEditing || justCancelled)` 로직을 수정합니다.
 *    - 자동 저장 시 서버로 보내는 데이터 형식을 변경하려면 각 데이터의 `map` 부분을 수정합니다.
 *
 * 📝 참고사항:
 *    - 자동 저장 실패는 사용자에게 알림 없이 조용히 처리됩니다(silent failure). 이는 백그라운드 작업에서 일시적인 네트워크 오류 등으로 사용자 경험을 방해하지 않기 위함입니다.
 *    - 이 기능은 사용자가 '편집' 버튼을 누르지 않고도 직관적으로 스케줄을 수정하고 그 내용이 저장되도록 하는 데 핵심적인 역할을 합니다.
 *
 * ===================================================================================================
 */

import { userService } from '../../../../services/userService';

/**
 * createAutoSaveHandler (팩토리 함수)
 * @description 스케줄 변경 시 자동으로 서버에 저장하는 이벤트 핸들러를 생성합니다. (단, 편집 모드가 아닐 때)
 * @param {boolean} isEditing - 현재 편집 모드인지 여부.
 * @param {boolean} justCancelled - '취소' 버튼이 방금 눌렸는지 여부.
 * @param {Array} defaultSchedule - 현재의 기본 스케줄 상태.
 * @param {Array} scheduleExceptions - 현재의 예외 스케줄 상태.
 * @param {Array} personalTimes - 현재의 개인시간 상태.
 * @returns {function} 비동기 이벤트 핸들러 함수.
 */
export const createAutoSaveHandler = (
  isEditing,
  justCancelled,
  defaultSchedule,
  scheduleExceptions,
  personalTimes
) => {
  return async () => {
    // 편집 모드이거나 방금 취소한 상태일 때는 자동 저장하지 않음
    if (isEditing || justCancelled) {
      return;
    }

    try {
      // defaultSchedule은 그대로 저장 (specificDate 포함)
      const scheduleToSave = defaultSchedule.map(s => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        priority: s.priority || 2,
        specificDate: s.specificDate
      }));

      const exceptionsToSave = scheduleExceptions.map(
        ({ title, startTime, endTime, isHoliday, isAllDay, _id, specificDate, priority }) =>
        ({ title, startTime, endTime, isHoliday, isAllDay, _id, specificDate, priority })
      );

      const personalTimesToSave = personalTimes.map(
        ({ title, type, startTime, endTime, days, isRecurring, id, specificDate, color }) => {
          return { title, type, startTime, endTime, days, isRecurring, id, specificDate, color };
        }
      );

      await userService.updateUserSchedule({
        defaultSchedule: scheduleToSave,
        scheduleExceptions: exceptionsToSave,
        personalTimes: personalTimesToSave
      });

    } catch (err) {
      // 자동 저장 실패는 무시
    }
  };
};
