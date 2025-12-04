/**
 * ===================================================================================================
 * useScheduleData.js - '내 프로필' 탭의 스케줄 데이터 관리 커스텀 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ProfileTab/hooks/useScheduleData.js
 *
 * 🎯 주요 기능:
 *    - 사용자의 스케줄 관련 데이터를 서버로부터 가져오는(fetch) 역할.
 *    - 세 가지 주요 스케줄 상태(defaultSchedule, scheduleExceptions, personalTimes)를 관리.
 *    - 데이터 로딩 및 에러 상태를 관리하여 UI에 피드백을 제공.
 *
 * 🔗 연결된 파일:
 *    - ../index.js (ProfileTab) - 이 훅을 사용하여 스케줄 데이터를 관리하는 주체.
 *    - ../../../../services/userService.js - 실제 API 호출을 담당하는 서비스.
 *
 * 💡 UI 위치:
 *    - 이 훅 자체는 UI가 없으나, 반환하는 데이터가 '내 프로필' 탭 전체에 걸쳐 사용됩니다.
 *
 * ✏️ 수정 가이드:
 *    - 스케줄 데이터를 가져오는 API 엔드포인트나 방식이 변경되면 `fetchSchedule` 함수 내의 `userService.getUserSchedule()` 호출 부분을 수정해야 합니다.
 *    - 새로운 스케줄 관련 상태를 추가하려면 `useState`를 추가하고 `fetchSchedule` 내에서 해당 상태를 설정하는 로직을 구현해야 합니다.
 *
 * 📝 참고사항:
 *    - 이 훅은 컴포넌트 마운트 시 `useEffect`를 통해 자동으로 한 번 `fetchSchedule`을 호출하여 초기 데이터를 로드합니다.
 *    - `fetchSchedule` 함수는 `useCallback`으로 메모이제이션되어 있어 불필요한 재생성을 방지합니다.
 *
 * ===================================================================================================
 */

import { useState, useCallback, useEffect } from 'react';
import { userService } from '../../../../services/userService';

/**
 * useScheduleData
 * @description '내 프로필' 탭에 필요한 사용자의 모든 스케줄 데이터(기본, 예외, 개인)를
 *              서버에서 가져오고 관련 상태(데이터, 로딩, 에러)를 관리하는 커스텀 훅.
 * @returns {object} 스케줄 데이터 및 관련 상태, 함수들을 포함하는 객체
 * @property {Array} defaultSchedule - 주간 기본 스케줄(선호시간) 배열.
 * @property {function} setDefaultSchedule - `defaultSchedule` 상태를 업데이트하는 함수.
 * @property {Array} scheduleExceptions - 특정 날짜의 예외 스케줄 배열.
 * @property {function} setScheduleExceptions - `scheduleExceptions` 상태를 업데이트하는 함수.
 * @property {Array} personalTimes - 개인시간(식사, 수면 등) 배열.
 * @property {function} setPersonalTimes - `personalTimes` 상태를 업데이트하는 함수.
 * @property {boolean} isLoading - 데이터 로딩 중인지 여부.
 * @property {string|null} error - 발생한 에러 메시지.
 * @property {function} setError - `error` 상태를 업데이트하는 함수.
 * @property {function} fetchSchedule - 서버에서 모든 스케줄 데이터를 다시 가져오는 함수.
 */
export const useScheduleData = () => {
  const [defaultSchedule, setDefaultSchedule] = useState([]);
  const [scheduleExceptions, setScheduleExceptions] = useState([]);
  const [personalTimes, setPersonalTimes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSchedule = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await userService.getUserSchedule();

      setDefaultSchedule(data.defaultSchedule || []);
      setScheduleExceptions(data.scheduleExceptions || []);
      setPersonalTimes(data.personalTimes || []);

      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  return {
    defaultSchedule,
    setDefaultSchedule,
    scheduleExceptions,
    setScheduleExceptions,
    personalTimes,
    setPersonalTimes,
    isLoading,
    error,
    setError,
    fetchSchedule
  };
};
