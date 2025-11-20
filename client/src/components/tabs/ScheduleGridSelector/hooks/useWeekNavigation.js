import { useState, useEffect } from 'react';
import { getSundayOfCurrentWeek } from '../utils/timeUtils';

/**
 * 주간 네비게이션 관련 상태와 함수를 관리하는 커스텀 훅
 * @returns {Object} 주간 네비게이션 상태 및 함수들
 */
const useWeekNavigation = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weekDates, setWeekDates] = useState([]);

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
   * 주 단위 네비게이션
   * @param {number} direction - 이동 방향 (1: 다음 주, -1: 이전 주)
   */
  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  /**
   * 오늘 날짜로 이동
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
