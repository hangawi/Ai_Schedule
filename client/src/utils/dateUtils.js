/**
 * Date and time utilities specific to timetable operations
 */

/**
 * Get the Monday of the current week
 * @param {Date} date - The date to get the Monday for
 * @returns {Date} - The Monday of that week
 */
export const getMondayOfCurrentWeek = (date) => {
  const d = new Date(date);
  const day = d.getUTCDay(); // Sunday - 0, Monday - 1, ..., Saturday - 6
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/**
 * Safe date handling function to prevent Invalid time value errors
 * @param {*} dateValue - The date value to convert
 * @returns {string|null} - ISO string or null if invalid
 */
export const safeDateToISOString = (dateValue) => {
  try {
    if (!dateValue) {
      return null;
    }

    // Handle various date formats
    let date;
    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
      date = new Date(dateValue);
    } else {
      return null;
    }

    if (isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  } catch (error) {
    return null;
  }
};

/**
 * Generate week dates for timetable display
 * @param {Date} baseDate - The base date to start from
 * @param {string[]} dayNamesKorean - Korean day names
 * @returns {Array} - Array of date objects with display strings
 */
export const generateWeekDates = (baseDate, dayNamesKorean) => {
  const mondayOfCurrentWeek = getMondayOfCurrentWeek(baseDate);

  const dates = [];
  let currentDay = new Date(mondayOfCurrentWeek);

  for (let i = 0; i < 5; i++) { // Generate 5 weekdays (Mon-Fri for current week)
    // Skip Saturday and Sunday
    while (currentDay.getUTCDay() === 0 || currentDay.getUTCDay() === 6) {
      currentDay.setUTCDate(currentDay.getUTCDate() + 1);
    }

    const month = String(currentDay.getUTCMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(currentDay.getUTCDate()).padStart(2, '0');
    const dayName = dayNamesKorean[currentDay.getUTCDay() - 1]; // Monday is 1, so -1 for 0-indexed array
    dates.push({
      fullDate: new Date(currentDay),
      display: `${dayName} (${month}.${dayOfMonth})`
    });

    currentDay.setUTCDate(currentDay.getUTCDate() + 1); // Move to the next day
  }

  return dates;
};

/**
 * Get correct day index from Date object for weekdays
 * @param {Date} date - The date to get the day index for
 * @returns {number} - Day index (Monday=0, Tuesday=1, etc.) or -1 for weekends
 */
export const getDayIndex = (date) => {
  const dayOfWeek = date.getUTCDay(); // 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
  // We want Monday=0, Tuesday=1, Wednesday=2, Thursday=3, Friday=4
  if (dayOfWeek === 0) return -1; // Sunday, not valid
  if (dayOfWeek === 6) return -1; // Saturday, not valid
  return dayOfWeek - 1; // Monday(1)->0, Tuesday(2)->1, etc.
};

/**
 * Get base date for calendar initialization
 * @param {string|Date} initialStartDate - Optional initial start date
 * @returns {Date} - The base date to use
 */
export const getBaseDate = (initialStartDate) => {
  if (initialStartDate) {
    return new Date(initialStartDate);
  }

  const today = new Date();
  // If it's Sunday, show next week's calendar starting Monday
  // This logic is already in getMondayOfCurrentWeek, but let's ensure today is a weekday for initial calculation
  let startDay = new Date(today);
  if (startDay.getUTCDay() === 0) { // If today is Sunday, start from tomorrow (Monday)
    startDay.setUTCDate(startDay.getUTCDate() + 1);
  } else if (startDay.getUTCDay() === 6) { // If today is Saturday, start from next Monday
    startDay.setUTCDate(startDay.getUTCDate() + 2);
  }
  return startDay;
};

/**
 * Create a formatted day display for UI
 * @param {Date} date - The date to format
 * @returns {string} - Formatted day display string
 */
export const createDayDisplay = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(date.getDate()).padStart(2, '0');
  const dayNames_kr = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = dayNames_kr[date.getDay()];
  return `${dayName} (${month}.${dayOfMonth})`;
};