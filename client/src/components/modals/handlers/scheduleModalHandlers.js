/**
 * ============================================================================
 * scheduleModalHandlers.js - Schedule Modal Event Handlers
 * ============================================================================
 */

import { createFullScheduleWithFixed } from '../utils/scheduleTransform';

/**
 * 이전 조합으로 이동
 */
export const createHandlePrevious = (currentIndex, setCurrentIndex) => {
  return () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };
};

/**
 * 다음 조합으로 이동
 */
export const createHandleNext = (currentIndex, modifiedCombinations, setCurrentIndex) => {
  return () => {
    if (currentIndex < modifiedCombinations.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };
};

/**
 * 시간표 선택 핸들러
 */
export const createHandleSelectSchedule = (
  currentCombination,
  currentFixedSchedules,
  applyScope,
  onSelect,
  onSchedulesApplied,
  onClose
) => {
  return () => {
    const fullSchedule = createFullScheduleWithFixed(currentCombination, currentFixedSchedules);

    if (onSelect) {
      onSelect(fullSchedule, applyScope);
    }

    if (onSchedulesApplied) {
      onSchedulesApplied(fullSchedule, applyScope);
    }

    if (onClose && typeof onClose === 'function') {
      onClose();
    }
  };
};
