// 필터링된 스케줄 훅

import { useMemo } from 'react';

export const useFilteredSchedule = (defaultSchedule, personalTimes, viewingMonth) => {
  const filteredDefaultSchedule = useMemo(() => {
    if (!viewingMonth) return defaultSchedule;
    const year = viewingMonth.getFullYear();
    const month = viewingMonth.getMonth();

    return defaultSchedule.filter(slot => {
      if (!slot.specificDate) return true; // Always include recurring weekly schedules
      const [slotYear, slotMonth] = slot.specificDate.split('-').map(Number);
      return slotYear === year && (slotMonth - 1) === month;
    });
  }, [defaultSchedule, viewingMonth]);

  const filteredPersonalTimes = useMemo(() => {
    if (!viewingMonth) return personalTimes;
    const year = viewingMonth.getFullYear();
    const month = viewingMonth.getMonth();

    return personalTimes.filter(pt => {
      if (pt.isRecurring !== false) return true; // Always include recurring personal times
      if (!pt.specificDate) return true; // Include if no date is specified (should be recurring)
      const [slotYear, slotMonth] = pt.specificDate.split('-').map(Number);
      return slotYear === year && (slotMonth - 1) === month;
    });
  }, [personalTimes, viewingMonth]);

  return {
    filteredDefaultSchedule,
    filteredPersonalTimes
  };
};
