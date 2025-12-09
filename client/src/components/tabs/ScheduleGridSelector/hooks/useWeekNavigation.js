/**
 * ===================================================================================================
 * useWeekNavigation.js - 주간 네비게이션 관리 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/ScheduleGridSelector/hooks
 *
 * 🎯 주요 기능:
 *    - 현재 날짜 상태 관리 (useMonthNavigation과 공유)
 *    - 주간 날짜 배열 생성 (일주일 7일)
 *    - 주 단위 네비게이션 (이전/다음 주)
 *    - 오늘 날짜로 이동
 *
 * 🔗 연결된 파일:
 *    - ../index.js (ScheduleGridSelector) - 이 훅을 사용하여 주간 네비게이션 처리
 *    - ./useMonthNavigation.js - currentDate, setCurrentDate 공유
 *    - ../components/ViewControls.js - 네비게이션 버튼에서 호출
 *    - ../components/MergedWeekView.js, DetailedWeekView.js - weekDates 사용
 *    - ../utils/timeUtils.js - getSundayOfCurrentWeek 함수 사용
 *
 * 💡 UI 위치:
 *    - 탭: 프로필 탭
 *    - 섹션: 스케줄 그리드 상단 컨트롤 바
 *    - 경로: 앱 실행 > 프로필 탭 > 스케줄 그리드 > 주간 뷰 > 이전/다음 버튼
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 주간 네비게이션 및 날짜 표시가 변경됨
 *    - 주 시작일 변경: getSundayOfCurrentWeek 대신 다른 함수 사용
 *    - 날짜 형식 변경: weekDates 생성 로직 수정
 *    - 네비게이션 단위 변경: navigateWeek의 direction * 7 값 수정
 *
 * 📝 참고사항:
 *    - 주는 일요일부터 시작 (일-토)
 *    - weekDates: 7개 요소 배열 (fullDate, display, dayOfWeek)
 *    - currentDate 변경 시 자동으로 weekDates 재계산 (useEffect)
 *
 * ===================================================================================================
 */

import { useState, useEffect } from 'react';
import { getSundayOfCurrentWeek } from '../utils/timeUtils';

/**
 * useWeekNavigation - 주간 네비게이션 관련 상태와 함수를 관리하는 커스텀 훅
 *
 * @description 주 단위로 날짜를 관리하고 이전/다음 주로 이동하는 기능 제공
 * @returns {Object} 주간 네비게이션 상태 및 함수들
 * @returns {Date} return.currentDate - 현재 날짜
 * @returns {Function} return.setCurrentDate - 현재 날짜 설정 함수
 * @returns {Array} return.weekDates - 주간 날짜 배열 (7개 요소)
 * @returns {Function} return.navigateWeek - 주 단위 네비게이션 함수
 * @returns {Function} return.goToToday - 오늘로 이동 함수
 *
 * @example
 * const {
 *   currentDate,
 *   weekDates,
 *   navigateWeek,
 *   goToToday
 * } = useWeekNavigation();
 *
 * // 다음 주로 이동
 * navigateWeek(1);
 *
 * // 이전 주로 이동
 * navigateWeek(-1);
 *
 * // 오늘로 이동
 * goToToday();
 *
 * @note
 * - currentDate는 useMonthNavigation과 공유됨
 * - weekDates는 currentDate 변경 시 자동 업데이트
 * - 주는 일요일부터 시작 (dayOfWeek: 0=일, 1=월, ..., 6=토)
 */
const useWeekNavigation = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weekDates, setWeekDates] = useState([]);

  /**
   * useEffect - currentDate 변경 시 주간 날짜 배열 생성
   *
   * @description 현재 날짜가 속한 주의 일요일부터 토요일까지 7개 날짜 객체 생성
   *
   * @note
   * - getSundayOfCurrentWeek: 해당 주의 일요일 계산
   * - dayNamesKorean: 한글 요일명 배열
   * - weekDates 각 요소:
   *   - fullDate: Date 객체
   *   - display: "월 (12.08)" 형식 문자열
   *   - dayOfWeek: JavaScript 요일 (0=일, 1=월, ...)
   */
  // currentDate가 변경될 때마다 해당 주의 날짜들 계산
  useEffect(() => {
    const sunday = getSundayOfCurrentWeek(currentDate);
    const dates = [];
    const dayNamesKorean = ['일', '월', '화', '수', '목', '금', '토'];

    for (let i = 0; i < 7; i++) {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + i);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const dayOfMonth = String(date.getDate()).padStart(2, '0');
      // 실제 요일을 확인 (JavaScript의 getDay()는 0=일요일, 1=월요일, ...)
      const actualDayOfWeek = date.getDay();
      dates.push({
        fullDate: date,
        display: `${dayNamesKorean[actualDayOfWeek]} (${month}.${dayOfMonth})`,
        dayOfWeek: actualDayOfWeek
      });
    }
    setWeekDates(dates);
  }, [currentDate]);

  /**
   * navigateWeek - 주 단위 네비게이션
   *
   * @description 현재 날짜를 기준으로 지정한 방향으로 주 단위 이동
   * @param {number} direction - 이동 방향 (1: 다음 주, -1: 이전 주)
   *
   * @example
   * navigateWeek(1);  // 다음 주로 이동 (+7일)
   * navigateWeek(-1); // 이전 주로 이동 (-7일)
   *
   * @note
   * - direction * 7: 주 단위로 이동 (7일씩)
   * - 새로운 Date 객체 생성하여 불변성 유지
   */
  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  /**
   * goToToday - 오늘 날짜로 이동
   *
   * @description 현재 날짜를 오늘로 설정
   *
   * @example
   * goToToday(); // 현재 날짜가 오늘로 변경됨
   *
   * @note
   * - 주간 뷰와 월간 뷰 모두 오늘 날짜로 이동
   * - useMonthNavigation에도 동일한 함수 있음 (중복)
   */
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  return {
    currentDate,
    setCurrentDate,
    weekDates,
    navigateWeek,
    goToToday
  };
};

export default useWeekNavigation;
