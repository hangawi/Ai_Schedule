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
    console.log('[useTravelMode] 모드 변경 요청:', newMode);

    if (!currentRoom || !currentRoom.timeSlots || currentRoom.timeSlots.length === 0) {
      console.warn('[useTravelMode] 시간표 데이터 없음');
      setError('시간표 데이터가 없습니다. 먼저 자동 배정을 실행해주세요.');
      return;
    }

    console.log('[useTravelMode] currentRoom timeSlots:', currentRoom.timeSlots.length);
    setTravelMode(newMode);
    setError(null);

    // 일반 모드는 재계산 불필요
    if (newMode === 'normal') {
      console.log('[useTravelMode] 일반 모드로 변경');
      setEnhancedSchedule(null);
      return;
    }

    // 이동 시간 재계산
    console.log('[useTravelMode] 이동 시간 계산 시작:', newMode);
    setIsCalculating(true);
    try {
      const result = await travelScheduleCalculator.recalculateScheduleWithTravel(
        currentRoom,
        newMode
      );
      console.log('[useTravelMode] 계산 결과:', result);
      console.log('[useTravelMode] travelSlots 개수:', result.travelSlots?.length);
      setEnhancedSchedule(result);

      // 성공 시 에러 초기화
      setError(null);
    } catch (err) {
      console.error('[useTravelMode] 이동 시간 계산 실패:', err);

      // 주소 없음 에러는 사용자에게 친절하게 표시
      if (err.message.includes('주소 정보가 필요합니다')) {
        setError(err.message);
      } else {
        setError('이동 시간 계산 중 오류가 발생했습니다. 모든 사용자가 프로필에서 주소를 입력했는지 확인해주세요.');
      }

      setTravelMode('normal'); // 에러 시 일반 모드로 복귀
      setEnhancedSchedule(null);
    } finally {
      setIsCalculating(false);
    }
  }, [currentRoom]);

  /**
   * 현재 표시할 시간표 데이터 반환
   */
  const getCurrentScheduleData = useCallback(() => {
    console.log('[useTravelMode] getCurrentScheduleData 호출 - travelMode:', travelMode);
    console.log('[useTravelMode] enhancedSchedule:', enhancedSchedule);

    if (travelMode === 'normal' || !enhancedSchedule) {
      const result = {
        timeSlots: currentRoom?.timeSlots || [],
        travelSlots: [],
        travelMode: 'normal'
      };
      console.log('[useTravelMode] 일반 모드 반환:', result.timeSlots.length, 'slots');
      return result;
    }

    console.log('[useTravelMode] 이동 모드 반환:', enhancedSchedule.timeSlots.length, 'slots,', enhancedSchedule.travelSlots.length, 'travel slots');
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
