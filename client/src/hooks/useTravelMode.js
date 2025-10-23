/**
 * 이동 모드 상태 관리 커스텀 훅
 */

import { useState, useEffect, useCallback } from 'react';
import travelScheduleCalculator from '../services/travelScheduleCalculator';

export const useTravelMode = (currentRoom) => {
  const [travelMode, setTravelMode] = useState('normal');
  const [enhancedSchedule, setEnhancedSchedule] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState(null);

  /**
   * 이동 모드 변경 핸들러
   */
  const handleModeChange = useCallback(async (newMode) => {
    if (!currentRoom || !currentRoom.timeSlots || currentRoom.timeSlots.length === 0) {
      setError('시간표 데이터가 없습니다. 먼저 자동 배정을 실행해주세요.');
      return;
    }

    setTravelMode(newMode);
    setError(null);

    if (newMode === 'normal') {
      setEnhancedSchedule(null);
      return;
    }

    setIsCalculating(true);
    try {
      const result = await travelScheduleCalculator.recalculateScheduleWithTravel(
        currentRoom,
        newMode
      );
      setEnhancedSchedule(result);
    } catch (err) {
      if (err.message.includes('주소 정보가 필요합니다')) {
        setError(err.message);
      } else {
        setError('이동 시간 계산 중 오류가 발생했습니다. 모든 사용자가 프로필에서 주소를 입력했는지 확인해주세요.');
      }
      setTravelMode('normal');
      setEnhancedSchedule(null);
    } finally {
      setIsCalculating(false);
    }

  }, [currentRoom]);

  /**
   * 현재 표시할 시간표 데이터 반환
   */
  const getCurrentScheduleData = useCallback(() => {
    if (travelMode === 'normal' || !enhancedSchedule) {
      return {
        timeSlots: currentRoom?.timeSlots || [],
        travelSlots: [],
        travelMode: 'normal'
      };
    }
    return enhancedSchedule;
  }, [travelMode, enhancedSchedule, currentRoom]);

  /**
   * 주간 뷰용 데이터
   */
  const getWeekViewData = useCallback((weekStartDate) => {
    const scheduleData = getCurrentScheduleData();
    return travelScheduleCalculator.formatForWeekView(
      scheduleData.timeSlots,
      scheduleData.travelSlots,
      weekStartDate
    );
  }, [getCurrentScheduleData]);

  /**
   * 월간 뷰용 데이터
   */
  const getMonthViewData = useCallback(() => {
    const scheduleData = getCurrentScheduleData();
    return travelScheduleCalculator.formatForMonthView(
      scheduleData.timeSlots,
      scheduleData.travelSlots
    );
  }, [getCurrentScheduleData]);

  /**
   * 현재 방이 변경되면 초기화
   */
  useEffect(() => {
    setTravelMode('normal');
    setEnhancedSchedule(null);
    setError(null);
  }, [currentRoom?._id]);

  return {
    travelMode,
    handleModeChange,
    isCalculating,
    error,
    enhancedSchedule,
    getCurrentScheduleData,
    getWeekViewData,
    getMonthViewData
  };
};
