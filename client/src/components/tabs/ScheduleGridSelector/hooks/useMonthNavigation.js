/**
 * 월간 네비게이션 관련 함수를 제공하는 커스텀 훅
 * Note: currentDate는 useWeekNavigation과 공유됨
 * @param {Date} currentDate - 현재 날짜
 * @param {Function} setCurrentDate - 날짜 설정 함수
 * @returns {Object} 월간 네비게이션 함수들
 */
const useMonthNavigation = (currentDate, setCurrentDate) => {
  /**
   * 월 단위 네비게이션
   * @param {number} direction - 이동 방향 (1: 다음 달, -1: 이전 달)
   */
  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  /**
   * 오늘 날짜로 이동
   */
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  return {
    navigateMonth,
    goToToday
  };
};

export default useMonthNavigation;
