// Alert state management hook

import { useState, useCallback } from 'react';
import { INITIAL_CUSTOM_ALERT } from '../constants';

/**
 * Custom hook for managing alert state
 * @returns {Object} - Alert state and functions
 */
export const useAlertState = () => {
  const [customAlert, setCustomAlert] = useState(INITIAL_CUSTOM_ALERT);

  const showAlert = useCallback((message, type = 'warning') => {
    setCustomAlert({ show: true, message, type });
  }, []);

  const closeAlert = useCallback(() => {
    setCustomAlert(INITIAL_CUSTOM_ALERT);
  }, []);

  return {
    customAlert,
    showAlert,
    closeAlert
  };
};
