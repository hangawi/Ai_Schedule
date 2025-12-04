/**
 * ===================================================================================================
 * createCancelHandler.js - '내 프로필' 탭의 '취소' 버튼 핸들러 생성 팩토리 함수
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ProfileTab/handlers/createCancelHandler.js
 *
 * 🎯 주요 기능:
 *    - '내 프로필' 탭의 '취소' 버튼을 클릭했을 때 실행될 이벤트 핸들러 함수를 생성.
 *    - 편집 모드 진입 시 저장해두었던 `initialState`를 사용하여 클라이언트의 스케줄 상태를 원상 복구.
 *    - 서버의 데이터도 `initialState`로 복원 시도 (실패하더라도 UI는 복원된 상태 유지).
 *    - `justCancelled` 플래그를 사용하여, 취소 직후 자동 저장이 실행되는 것을 방지.
 *
 * 🔗 연결된 파일:
 *    - ../index.js (ProfileTab) - 이 팩토리 함수를 사용하여 `onCancel` 핸들러를 생성.
 *    - ../../../../services/userService.js - 스케줄을 초기 상태로 되돌리기 위해 API를 호출.
 *    - ../hooks/useEditingState.js - `initialState`와 `justCancelled` 상태를 관리하는 훅.
 *
 * 💡 UI 위치:
 *    - 이 파일은 UI가 없으나, '내 프로필' 탭의 '편집' 모드에서 나타나는 '취소' 버튼의 핵심 로직을 담당.
 *
 * ✏️ 수정 가이드:
 *    - 취소 시 스케줄 상태를 복원하는 로직을 변경하려면 이 파일을 수정해야 합니다.
 *    - `justCancelled` 플래그의 타임아웃(1초)을 조절하려면 `setTimeout` 부분을 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 함수는 '팩토리 함수' 패턴을 사용합니다.
 *    - 서버 복원(`updateUserSchedule`)이 실패하더라도 UI는 즉시 복원됩니다. 이는 사용자 경험을 우선시하는 정책입니다.
 *    - `setTimeout`을 사용해 `justCancelled` 플래그를 잠시 유지하는 것은, 취소 동작과 다른 `useEffect` 기반 로직(특히 자동 저장) 간의 충돌을 막기 위함입니다.
 *
 * ===================================================================================================
 */

import { userService } from '../../../../services/userService';

/**
 * createCancelHandler (팩토리 함수)
 * @description '취소' 버튼의 onClick 이벤트 핸들러를 생성합니다. 편집 중이던 스케줄을 초기 상태로 되돌립니다.
 * @param {object} initialState - 편집 시작 시점의 스케줄 상태 스냅샷.
 * @param {function} setDefaultSchedule - 기본 스케줄 상태를 변경하는 함수.
 * @param {function} setScheduleExceptions - 예외 스케줄 상태를 변경하는 함수.
 * @param {function} setPersonalTimes - 개인시간 상태를 변경하는 함수.
 * @param {function} setIsEditing - 편집 모드 상태를 변경하는 함수.
 * @param {function} setWasCleared - '전체 초기화' 플래그를 리셋하는 함수.
 * @param {function} setJustCancelled - '방금 취소됨' 플래그를 설정하는 함수.
 * @returns {function} 비동기 이벤트 핸들러 함수.
 */
export const createCancelHandler = (
  initialState,
  setDefaultSchedule,
  setScheduleExceptions,
  setPersonalTimes,
  setIsEditing,
  setWasCleared,
  setJustCancelled
) => {
  return async () => {
    // 편집 모드 진입 시 저장된 초기 상태로 복원
    setDefaultSchedule([...initialState.defaultSchedule]);
    setScheduleExceptions([...initialState.scheduleExceptions]);
    setPersonalTimes([...initialState.personalTimes]);

    try {
      // 서버에도 초기 상태로 복원
      const exceptionsToRestore = initialState.scheduleExceptions.map(
        ({ title, startTime, endTime, isHoliday, isAllDay, _id, specificDate, priority }) =>
        ({ title, startTime, endTime, isHoliday, isAllDay, _id, specificDate, priority })
      );
      const personalTimesToRestore = initialState.personalTimes.map(
        ({ title, type, startTime, endTime, days, isRecurring, id, specificDate, color }) => {
          return { title, type, startTime, endTime, days, isRecurring, id, specificDate, color };
        }
      );

      await userService.updateUserSchedule({
        defaultSchedule: initialState.defaultSchedule,
        scheduleExceptions: exceptionsToRestore,
        personalTimes: personalTimesToRestore
      });
    } catch (err) {
      // 서버 복원 실패해도 UI는 복원된 상태로 유지
    }

    setIsEditing(false);
    setWasCleared(false); // 초기화 상태도 리셋
    setJustCancelled(true);

    // 일정 시간 후 취소 상태 해제
    setTimeout(() => {
      setJustCancelled(false);
    }, 1000);
  };
};
