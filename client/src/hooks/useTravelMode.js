/**
 * ===================================================================================================
 * useTravelMode.js - 이동 시간을 고려한 스케줄 재계산 및 표시를 관리하는 React Hook
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks
 *
 * 🎯 주요 기능:
 *    - '일반 모드'와 '이동 시간 모드'(대중교통/자가용) 간의 상태 전환 관리
 *    - 이동 시간 모드 선택 시 `travelScheduleCalculator` 서비스를 호출하여 스케줄 재계산
 *    - 재계산된 스케줄(이동 시간 포함) 및 계산 상태(로딩, 에러) 관리
 *    - 현재 모드에 맞는 시간표 데이터를 주간/월간 뷰 형식으로 가공하여 제공
 *
 * 🔗 연결된 파일:
 *    - src/services/travelScheduleCalculator.js - 실제 이동 시간 계산 및 스케줄 재구성을 담당하는 서비스
 *    - src/components/tabs/CoordinationTab/index.js - 협업 탭에서 이동 모드 버튼과 상호작용하며 이 훅을 사용
 *    - src/components/coordination/TravelModeButtons.js - 이 훅의 `handleModeChange` 함수를 호출하는 UI 컴포넌트
 *
 * ✏️ 수정 가이드:
 *    - 새로운 이동 수단 추가: `handleModeChange` 함수에서 새로운 `newMode`에 대한 처리를 추가하고, `travelScheduleCalculator`에도 관련 로직을 구현
 *    - 에러 메시지 변경: `handleModeChange` 함수의 `catch` 블록에서 에러 처리 로직 수정
 *    - 뷰 데이터 가공 방식 변경: `getWeekViewData` 또는 `getMonthViewData` 함수 내부의 포맷팅 로직 수정
 *
 * 📝 참고사항:
 *    - 이 훅은 `currentRoom` 데이터가 있어야 정상적으로 동작합니다.
 *    - 이동 시간 계산을 위해서는 방 멤버들의 프로필에 주소 정보가 필수로 입력되어 있어야 합니다.
 *    - `currentRoom`이 변경되면 모든 상태가 '일반 모드'로 초기화됩니다.
 *
 * ===================================================================================================
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import travelScheduleCalculator from '../services/travelScheduleCalculator';
import { coordinationService } from '../services/coordinationService';

/**
 * useTravelMode - 이동 시간 계산 모드를 관리하고, 모드에 따라 스케줄 데이터를 변환하여 제공하는 훅
 *
 * @description 사용자가 선택한 이동 수단(일반, 대중교통, 자가용)에 따라
 *              기존 스케줄에 이동 시간을 포함하여 재계산하고,
 *              계산된 데이터를 다양한 뷰(주간, 월간)에 맞게 가공하여 반환합니다.
 * @param {object|null} currentRoom - 현재 선택된 방 정보 객체
 * @param {boolean} isOwner - 현재 사용자가 방장인지 여부 (기본값: true)
 * @returns {object} 이동 모드 상태 및 관련 함수들을 포함하는 객체
 * @property {string} travelMode - 현재 선택된 이동 모드 ('normal', 'transit', 'driving', 'bicycling', 'walking')
 * @property {Function} handleModeChange - 이동 모드를 변경하고 스케줄 재계산을 트리거하는 함수
 * @property {boolean} isCalculating - 이동 시간 계산이 진행 중인지 여부
 * @property {string|null} error - 계산 중 발생한 에러 메시지
 * @property {object|null} enhancedSchedule - 이동 시간이 포함된 재계산된 스케줄 데이터
 * @property {Function} getCurrentScheduleData - 현재 모드에 맞는 원본 또는 재계산된 스케줄 데이터를 반환하는 함수
 * @property {Function} getWeekViewData - 주간 뷰에 맞게 포맷된 스케줄 데이터를 반환하는 함수
 * @property {Function} getMonthViewData - 월간 뷰에 맞게 포맷된 스케줄 데이터를 반환하는 함수
 */
export const useTravelMode = (currentRoom, isOwner = true) => {
  const [travelMode, setTravelMode] = useState('normal');
  const [enhancedSchedule, setEnhancedSchedule] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState(null);

  // 이전 방 ID를 추적하여 실제로 방이 변경되었을 때만 상태 초기화
  const prevRoomIdRef = useRef(null);

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
      // 도보 모드일 때 먼저 검증
      if (newMode === 'walking') {
        const validation = await travelScheduleCalculator.validateWalkingMode(currentRoom);
        if (!validation.isValid) {
          throw new Error(validation.message);
        }
      }

      const result = await travelScheduleCalculator.recalculateScheduleWithTravel(
        currentRoom,
        newMode
      );

      console.log('✅ [useTravelMode] enhancedSchedule 설정:', {
        timeSlots개수: result.timeSlots?.length,
        travelSlots개수: result.travelSlots?.length,
        '이동시간_슬롯': result.timeSlots?.filter(s => s.isTravel).length,
        '수업_슬롯': result.timeSlots?.filter(s => !s.isTravel).length,
        '조정된_수업_샘플': result.timeSlots?.filter(s => !s.isTravel && s.startTime >= '09:00' && s.startTime <= '12:00').slice(0, 5).map(s => ({
          날짜: s.date,
          시작: s.startTime,
          종료: s.endTime,
          과목: s.subject,
          사용자: s.user
        }))
      });

      setEnhancedSchedule(result);

      // ⚠️ 서버 저장은 "적용" 버튼 클릭 시에만 수행
      // (모드 선택만으로는 서버에 저장하지 않음)
    } catch (err) {
      if (err.message.includes('주소 정보가 필요합니다')) {
        setError(err.message);
      } else if (err.message.includes('도보 이동 시간이 1시간을 초과') || err.message.includes('차단되었습니다')) {
        setError(err.message);
      } else {
        setError('이동 시간 계산 중 오류가 발생했습니다. 모든 사용자가 프로필에서 주소를 입력했는지 확인해주세요.');
      }
      setTravelMode('normal');
      setEnhancedSchedule(null);
    } finally {
      setIsCalculating(false);
    }

  }, [currentRoom, isOwner]);

  const getCurrentScheduleData = useCallback(() => {
    if (travelMode === 'normal' || !enhancedSchedule) {
      console.log('📋 [getCurrentScheduleData] 일반 모드 또는 enhancedSchedule 없음:', {
        travelMode,
        enhancedSchedule: !!enhancedSchedule,
        원본timeSlots개수: currentRoom?.timeSlots?.length
      });
      return {
        timeSlots: currentRoom?.timeSlots || [],
        travelSlots: [],
        travelMode: travelMode  // 하드코딩된 'normal' 대신 실제 travelMode 반환
      };
    }
    console.log('📋 [getCurrentScheduleData] enhancedSchedule 사용:', {
      travelMode,
      timeSlots개수: enhancedSchedule.timeSlots?.length,
      travelSlots개수: enhancedSchedule.travelSlots?.length,
      isOwner
    });

    // ✨ 조원이면 이동시간 블록 숨김 (방장의 이동시간 정보 보호)
    if (!isOwner) {
      return {
        timeSlots: enhancedSchedule.timeSlots.filter(slot => !slot.isTravel),
        travelSlots: [],
        travelMode: travelMode
      };
    }

    // ✨ 방장도 이동시간 슬롯은 timeSlots에서 제외 (travelSlots에만 포함)
    return {
      timeSlots: enhancedSchedule.timeSlots.filter(slot => !slot.isTravel),
      travelSlots: enhancedSchedule.travelSlots,
      travelMode: enhancedSchedule.travelMode
    };
    }, [travelMode, enhancedSchedule, currentRoom, isCalculating, isOwner]);

  const getWeekViewData = useCallback((weekStartDate) => {
    const scheduleData = getCurrentScheduleData();
    return travelScheduleCalculator.formatForWeekView(
      scheduleData.timeSlots,
      scheduleData.travelSlots,
      weekStartDate
    );
  }, [getCurrentScheduleData]);

  const getMonthViewData = useCallback(() => {
    const scheduleData = getCurrentScheduleData();
    return travelScheduleCalculator.formatForMonthView(
      scheduleData.timeSlots,
      scheduleData.travelSlots
    );
  }, [getCurrentScheduleData]);

  /**
   * 현재 선택된 이동시간 모드를 확정합니다 (조원들에게 표시)
   * 방장만 호출 가능
   */
  const confirmTravelMode = useCallback(async () => {
    if (!isOwner) {
      setError('방장만 모드를 확정할 수 있습니다.');
      return false;
    }

    if (!currentRoom?._id) {
      setError('방 정보가 없습니다.');
      return false;
    }

    try {
      console.log(`📤 [confirmTravelMode] 확정 중... 모드: ${travelMode}`);
      const result = await coordinationService.confirmTravelMode(currentRoom._id, travelMode);
      console.log(`✅ [confirmTravelMode] 확정 완료:`, result);
      return true;
    } catch (err) {
      console.error('⚠️ [confirmTravelMode] 실패:', err.message);
      setError('모드 확정에 실패했습니다.');
      return false;
    }
  }, [currentRoom, travelMode, isOwner]);

  // 현재 방이 변경되면 모든 관련 상태를 초기화합니다.
  // 🔧 버그 수정: 같은 방 ID가 재fetch되어도 상태를 유지하도록 수정
  useEffect(() => {
    const currentRoomId = currentRoom?._id?.toString();

    // 실제로 다른 방으로 변경되었을 때만 초기화 (같은 방 재fetch는 무시)
    if (currentRoomId !== prevRoomIdRef.current) {
      console.log(`🔄 [useTravelMode] 방 변경 감지: ${prevRoomIdRef.current} → ${currentRoomId}, 상태 초기화`);
      setTravelMode('normal');
      setEnhancedSchedule(null);
      setError(null);
      prevRoomIdRef.current = currentRoomId;
    }
  }, [currentRoom?._id]);

  return {
    travelMode,
    handleModeChange,
    confirmTravelMode,
    isCalculating,
    error,
    enhancedSchedule,
    getCurrentScheduleData,
    getWeekViewData,
    getMonthViewData
  };
};