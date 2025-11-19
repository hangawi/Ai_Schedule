/**
 * ============================================================================
 * conflictModalHandlers.js - Conflict Resolution Handlers
 * ============================================================================
 */

import { resolveFixedConflict, selectFixedOption } from '../../../services/fixedSchedule/fixedScheduleAPI';

/**
 * 충돌 해결 핸들러 생성
 */
export const createHandleConflictResolution = (
  conflictState,
  schedulesByImage,
  modifiedCombinations,
  currentIndex,
  currentFixedSchedules,
  setModifiedCombinations,
  setCurrentFixedSchedules,
  setConflictState,
  setChatMessages
) => {
  return async (resolution) => {
    if (!conflictState) return;

    try {
      const allSchedules = schedulesByImage?.flatMap(img => img.schedules || []) || modifiedCombinations[currentIndex];

      const result = await resolveFixedConflict(
        resolution,
        conflictState.pendingFixed,
        conflictState.conflicts,
        allSchedules,
        currentFixedSchedules
      );

      if (result.success) {
        const updatedCombinations = [...modifiedCombinations];
        updatedCombinations[currentIndex] = result.optimizedSchedule;
        setModifiedCombinations(updatedCombinations);
        setCurrentFixedSchedules(result.fixedSchedules);
        setConflictState(null);

        const botMessage = {
          id: Date.now(),
          text: `${result.message}\n\n✨ 시간표가 재최적화되었습니다!\n- 총 ${result.stats.total}개 수업\n- 고정 ${result.stats.fixed}개\n- 제외 ${result.stats.removed}개`,
          sender: 'bot',
          timestamp: new Date()
        };

        setChatMessages(prev => [...prev, botMessage]);
      }
    } catch (error) {
      const errorMessage = {
        id: Date.now(),
        text: '충돌 해결 중 오류가 발생했습니다. 다시 시도해주세요.',
        sender: 'bot',
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, errorMessage]);
    }
  };
};

/**
 * 옵션 선택 핸들러 생성
 */
export const createHandleOptionSelection = (
  currentFixedSchedules,
  schedulesByImage,
  modifiedCombinations,
  currentIndex,
  setModifiedCombinations,
  setCurrentFixedSchedules,
  setChatMessages
) => {
  return async (selectedSchedule) => {
    try {
      const allSchedules = schedulesByImage?.flatMap(img => img.schedules || []) || modifiedCombinations[currentIndex];

      const result = await selectFixedOption(
        selectedSchedule,
        currentFixedSchedules,
        allSchedules,
        schedulesByImage
      );

      if (result.success) {
        const updatedCombinations = [...modifiedCombinations];
        updatedCombinations[currentIndex] = result.optimizedSchedule;
        setModifiedCombinations(updatedCombinations);
        setCurrentFixedSchedules(result.fixedSchedules);

        const botMessage = {
          id: Date.now(),
          text: `${result.message}\n\n✨ 시간표가 자동으로 재최적화되었습니다!\n- 총 ${result.stats.total}개 수업\n- 고정 ${result.stats.fixed}개`,
          sender: 'bot',
          timestamp: new Date()
        };

        setChatMessages(prev => [...prev, botMessage]);
      }
    } catch (error) {
      const errorMessage = {
        id: Date.now(),
        text: '❌ 옵션 선택 중 오류가 발생했습니다.',
        sender: 'bot',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    }
  };
};
