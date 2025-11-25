/**
 * ============================================================================
 * useOcrProcessing.js - OCR 처리 관련 상태 관리 훅
 * ============================================================================
 */

import { useState } from 'react';

export const useOcrProcessing = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [error, setError] = useState(null);

  return {
    isProcessing,
    setIsProcessing,
    progress,
    setProgress,
    error,
    setError
  };
};
