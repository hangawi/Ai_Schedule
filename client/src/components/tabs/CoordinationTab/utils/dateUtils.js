// Date utility functions for CoordinationTab

import { DAYS_OF_WEEK, DAY_NAME_TO_INDEX } from '../constants';

/**
 * Calculate date from day index
 * @param {number} dayIndex - Day index (1-5 for Mon-Fri)
 * @returns {string} - Date string in YYYY-MM-DD format
 */
export const calculateDateFromDayIndex = (dayIndex) => {
  const targetDayName = DAYS_OF_WEEK[dayIndex - 1];
  const targetDayOfWeek = DAY_NAME_TO_INDEX[targetDayName];

  const currentDate = new Date();
  const currentDay = currentDate.getDay(); // 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
  const diff = targetDayOfWeek - currentDay;
  const targetDate = new Date(currentDate);
  targetDate.setDate(currentDate.getDate() + (diff >= 0 ? diff : diff + 7));
  return targetDate.toISOString().split('T')[0]; // YYYY-MM-DD 형식
};

/**
 * Get day index from Date object
 * @param {Date} date - Date object
 * @returns {number} - Day index (0-4 for Mon-Fri, -1 for weekend)
 */
export const getDayIndex = (date) => {
  const dayOfWeek = date.getUTCDay(); // 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
  // We want Monday=0, Tuesday=1, Wednesday=2, Thursday=3, Friday=4
  if (dayOfWeek === 0) return -1; // Sunday, not valid
  if (dayOfWeek === 6) return -1; // Saturday, not valid
  return dayOfWeek - 1; // Monday(1)->0, Tuesday(2)->1, etc.
};

/**
 * Get request date from slot data
 * @param {Object} slotData - Slot data with date or dayIndex
 * @returns {string} - Date string in YYYY-MM-DD format
 */
export const getRequestDate = (slotData) => {
  if (slotData.date) {
    return slotData.date instanceof Date
      ? slotData.date.toISOString().split('T')[0]
      : slotData.date;
  }
  return calculateDateFromDayIndex(slotData.dayIndex);
};
