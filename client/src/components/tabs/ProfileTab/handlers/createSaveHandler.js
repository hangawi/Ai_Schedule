/**
 * ===================================================================================================
 * createSaveHandler.js - '내 프로필' 탭의 '저장' 버튼 핸들러 생성 팩토리 함수
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ProfileTab/handlers/createSaveHandler.js
 *
 * 🎯 주요 기능:
 *    - '내 프로필' 탭의 '저장' 버튼을 클릭했을 때 실행될 이벤트 핸들러 함수를 생성.
 *    - 클로저(closure)를 이용하여 `ProfileTab` 컴포넌트의 현재 스케줄 상태와 상태 설정 함수들에 접근.
 *    - 서버에 전송하기 전에 스케줄 데이터를 정리하고 가공.
 *    - `userService.updateUserSchedule`를 호출하여 변경된 스케줄을 서버에 저장.
 *    - 저장 성공 후, 서버로부터 최신 데이터를 다시 가져와 클라이언트 상태를 동기화.
 *    - 전역 'calendarUpdate' 이벤트를 발생시켜 다른 컴포넌트들의 리렌더링을 유도.
 *
 * 🔗 연결된 파일:
 *    - ../index.js (ProfileTab) - 이 팩토리 함수를 사용하여 `onSave` 핸들러를 생성.
 *    - ../../../../services/userService.js - 사용자 스케줄을 업데이트하는 API 호출 서비스.
 *    - ../constants/messages.js - 저장 성공/실패 시 표시할 메시지 상수.
 *
 * 💡 UI 위치:
 *    - 이 파일은 UI가 없으나, '내 프로필' 탭의 '편집' 모드에서 나타나는 '저장' 버튼의 핵심 로직을 담당.
 *
 * ✏️ 수정 가이드:
 *    - 서버로 전송되는 데이터 페이로드(payload)를 변경하려면 이 파일 내의 `scheduleToSave`, `exceptionsToSave` 등의 매핑 로직을 수정해야 합니다.
 *    - 저장 후의 후속 처리(예: 데이터 재검증, 다른 상태 업데이트)를 변경하려면 `try` 블록의 성공 부분을 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 함수는 '팩토리 함수' 패턴을 사용합니다. 함수를 실행하면 내부에 정의된 또 다른 함수(실제 이벤트 핸들러)를 반환합니다.
 *    - 저장 성공 후 UI 깜박임을 방지하기 위해, 서버에서 받은 데이터와 현재 상태를 `JSON.stringify`로 비교하여 변경이 있을 때만 상태를 업데이트하는 최적화가 포함되어 있습니다.
 *
 * ===================================================================================================
 */

import { userService } from '../../../../services/userService';
import { MESSAGES, TITLES } from '../constants/messages';

/**
 * createSaveHandler (팩토리 함수)
 * @description '저장' 버튼의 onClick 이벤트 핸들러를 생성합니다.
 * @param {Array} defaultSchedule - 현재의 기본 스케줄 상태.
 * @param {Array} scheduleExceptions - 현재의 예외 스케줄 상태.
 * @param {Array} personalTimes - 현재의 개인시간 상태.
 * @param {function} setIsEditing - 편집 모드 상태를 변경하는 함수.
 * @param {function} setDefaultSchedule - 기본 스케줄 상태를 변경하는 함수.
 * @param {function} setScheduleExceptions - 예외 스케줄 상태를 변경하는 함수.
 * @param {function} setPersonalTimes - 개인시간 상태를 변경하는 함수.
 * @param {function} setError - 에러 상태를 변경하는 함수.
 * @param {function} showAlert - 알림 모달을 표시하는 함수.
 * @returns {function} 비동기 이벤트 핸들러 함수.
 */
export const createSaveHandler = (
  defaultSchedule,
  scheduleExceptions,
  personalTimes,
  setIsEditing,
  setDefaultSchedule,
  setScheduleExceptions,
  setPersonalTimes,
  setError,
  showAlert
) => {
  return async () => {
    // defaultSchedule은 그대로 저장 (specificDate 포함)
    const scheduleToSave = defaultSchedule.map(s => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      priority: s.priority || 2,
      specificDate: s.specificDate
    }));

    // scheduleExceptions도 그대로 저장
    const exceptionsToSave = scheduleExceptions.map(
      ({ title, startTime, endTime, isHoliday, isAllDay, _id, specificDate, priority }) =>
      ({ title, startTime, endTime, isHoliday, isAllDay, _id, specificDate, priority })
    );

    const personalTimesToSave = personalTimes.map(
      ({ title, type, startTime, endTime, days, isRecurring, id, specificDate, color }) => {
        return { title, type, startTime, endTime, days, isRecurring, id, specificDate, color };
      }
    );

    try {
      await userService.updateUserSchedule({
        defaultSchedule: scheduleToSave,
        scheduleExceptions: exceptionsToSave,
        personalTimes: personalTimesToSave
      });
      showAlert(MESSAGES.SAVE_SUCCESS, TITLES.SAVE_COMPLETE);
      setIsEditing(false);

      // 저장 후 서버에서 최신 데이터 동기화
      const freshData = await userService.getUserSchedule();

      // UI 깜박임 방지: 데이터가 실제로 변경된 경우만 상태 업데이트
      if (JSON.stringify(freshData.defaultSchedule || []) !== JSON.stringify(defaultSchedule)) {
        setDefaultSchedule(freshData.defaultSchedule || []);
      }
      if (JSON.stringify(freshData.scheduleExceptions || []) !== JSON.stringify(scheduleExceptions)) {
        setScheduleExceptions(freshData.scheduleExceptions || []);
      }
      if (JSON.stringify(freshData.personalTimes || []) !== JSON.stringify(personalTimes)) {
        setPersonalTimes(freshData.personalTimes || []);
      }

      // CalendarView 강제 리렌더링
      window.dispatchEvent(new Event('calendarUpdate'));

    } catch (err) {
      setError(err.message);
      showAlert(MESSAGES.SAVE_ERROR + err.message, TITLES.ERROR);
    }
  };
};
