// 스케줄 데이터 관리 훅

import { useState, useCallback, useEffect } from 'react';
import { userService } from '../../../../services/userService';

export const useScheduleData = () => {
  const [defaultSchedule, setDefaultSchedule] = useState([]);
  const [scheduleExceptions, setScheduleExceptions] = useState([]);
  const [personalTimes, setPersonalTimes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSchedule = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await userService.getUserSchedule();

      setDefaultSchedule(data.defaultSchedule || []);
      setScheduleExceptions(data.scheduleExceptions || []);
      setPersonalTimes(data.personalTimes || []);

      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  return {
    defaultSchedule,
    setDefaultSchedule,
    scheduleExceptions,
    setScheduleExceptions,
    personalTimes,
    setPersonalTimes,
    isLoading,
    error,
    setError,
    fetchSchedule
  };
};
