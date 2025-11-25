/**
 * ============================================================================
 * useModalState.js - 모달 관련 상태 관리 훅
 * ============================================================================
 */

import { useState } from 'react';

export const useModalState = () => {
  const [showOptimizationModal, setShowOptimizationModal] = useState(false);
  const [slideDirection, setSlideDirection] = useState('left');
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  return {
    showOptimizationModal,
    setShowOptimizationModal,
    slideDirection,
    setSlideDirection,
    duplicateInfo,
    setDuplicateInfo,
    showDuplicateModal,
    setShowDuplicateModal
  };
};
