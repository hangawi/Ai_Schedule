/**
 * 이벤트 필터링 관련 유틸리티 함수
 */

import { isSameDay } from './dateUtils';
import { SCHEDULE_KEYWORDS } from '../constants/keywordConstants';

/**
 * 제목이 일반적인 일정 키워드인지 확인
 * @param {string} title
 * @returns {boolean}
 */
export const isGeneralSchedule = (title) => {
  return !title || SCHEDULE_KEYWORDS.includes(title);
};

/**
 * 이벤트 제목이 검색 제목과 매칭되는지 확인
 * @param {string} eventTitle
 * @param {string} searchTitle
 * @returns {boolean}
 */
export const matchesTitle = (eventTitle, searchTitle) => {
  if (isGeneralSchedule(searchTitle)) {
    return true;
  }
  if (!eventTitle) {
    return false;
  }
  return eventTitle.toLowerCase().includes(searchTitle.toLowerCase());
};

/**
 * Profile context에서 이벤트 날짜 추출
 * @param {Object} event
 * @param {Date} targetDate
 * @returns {Date|null}
 */
export const getEventDateForProfile = (event, targetDate) => {
  if (event.isDefaultSchedule) {
    // 🔧 specificDate가 있으면 날짜 매칭, 없으면 요일 매칭
    if (event.specificDate) {
      // 채팅으로 추가된 선호시간 (특정 날짜)
      const targetDateStr = targetDate.toISOString().split('T')[0];
      if (event.specificDate === targetDateStr) {
        return targetDate;
      }
      return null;
    } else {
      // 버튼으로 추가된 선호시간 (매주 반복)
      const targetDayOfWeek = targetDate.getDay() === 0 ? 7 : targetDate.getDay();
      if (event.dayOfWeek === targetDayOfWeek) {
        return targetDate;
      }
      return null;
    }
  } else if (event.isPersonalTime) {
    const eventTitle = event.title;
    if (event.specificDate) {
      const eventSpecificDate = new Date(event.specificDate + 'T00:00:00+09:00');
      if (eventSpecificDate.toDateString() === targetDate.toDateString()) {
        return targetDate;
      } else {
        return null;
      }
    } else {
      const dayOfWeek = targetDate.getDay() === 0 ? 7 : targetDate.getDay();
      if (!event.days || !event.days.includes(dayOfWeek)) {
        return null;
      }
      return targetDate;
    }
  } else {
    if (!event.startTime) {
      return null;
    }
    return new Date(event.startTime);
  }
};

/**
 * Local context에서 이벤트 날짜 추출
 * @param {Object} event
 * @returns {Date|null}
 */
export const getEventDateForLocal = (event) => {
  if (!event.startTime) {
    return null;
  }
  return new Date(event.startTime);
};

/**
 * Google context에서 이벤트 날짜 추출
 * @param {Object} event
 * @returns {Date|null}
 */
export const getEventDateForGoogle = (event) => {
  if (!event.start) {
    return null;
  }
  return new Date(event.start.dateTime || event.start.date);
};

/**
 * 컨텍스트에 따라 이벤트 제목 추출
 * @param {Object} event
 * @param {Object} context
 * @returns {string}
 */
export const getEventTitle = (event, context) => {
  return event.title || event.summary;
};

/**
 * 특정 날짜에 해당하는 이벤트 필터링 (단일 날짜)
 * @param {Array} events
 * @param {Date} targetDate
 * @param {string} searchTitle
 * @param {Object} context
 * @returns {Array}
 */
export const filterEventsByDate = (events, targetDate, searchTitle, context) => {
  // 🆕 구글 사용자 여부 확인
  const isGoogleUser = context.loginMethod === 'google';

  return events.filter(event => {
    if (!event) return false;

    let eventDate;
    let eventTitle;

    if (isGoogleUser) {
      // 구글 사용자: Google Calendar 이벤트 형식
      eventDate = getEventDateForGoogle(event);
      eventTitle = event.summary;
    } else if (context.context === 'profile' && context.tabType === 'local') {
      eventDate = getEventDateForProfile(event, targetDate);
      eventTitle = event.title;
    } else {
      eventDate = getEventDateForLocal(event);
      eventTitle = event.title;
    }

    if (!eventDate) {
      return false;
    }

    const isSameDayMatch = isSameDay(eventDate, targetDate);
    const titleMatch = matchesTitle(eventTitle, searchTitle);

    return isSameDayMatch && titleMatch;
  });
};

/**
 * 날짜 범위에 해당하는 이벤트 필터링
 * @param {Array} events
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {string} searchTitle
 * @param {Object} context
 * @returns {Array}
 */
export const filterEventsByRange = (events, startDate, endDate, searchTitle, context) => {
  // 🆕 구글 사용자 여부 확인
  const isGoogleUser = context.loginMethod === 'google';

  return events.filter(event => {
    if (!event) return false;

    let eventDate;
    let eventTitle;

    if (isGoogleUser) {
      // 구글 사용자: Google Calendar 이벤트 형식
      if (!event.start) return false;
      eventDate = new Date(event.start.dateTime || event.start.date);
      eventTitle = event.summary;
    } else if (context.context === 'profile' && context.tabType === 'local') {
      if (event.isDefaultSchedule) {
        eventTitle = event.title;

        // 🔧 매우 중요! specificDate가 없는 defaultSchedule은 매주 반복이므로 범위 삭제 대상이 아님
        if (!event.specificDate) {
          console.log('🚫 [범위 삭제] 매주 반복 일정 제외:', event.title, event.dayOfWeek);
          return false; // 매주 반복 일정은 범위 삭제에서 제외
        }

        // specificDate가 있는 경우만 범위에 포함
        const eventSpecificDate = new Date(event.specificDate + 'T00:00:00+09:00');
        if (eventSpecificDate < startDate || eventSpecificDate > endDate) {
          return false;
        }
        eventDate = eventSpecificDate;
      } else if (event.isPersonalTime) {
        eventTitle = event.title;
        if (event.specificDate) {
          eventDate = new Date(event.specificDate + 'T00:00:00+09:00');
        } else {
          // specificDate가 없으면 포함시키지 않음
          return false;
        }
      } else {
        // scheduleExceptions
        if (!event.startTime) return false;
        eventDate = new Date(event.startTime);
        eventTitle = event.title;
      }
    } else {
      // 일반 사용자: 로컬 DB 이벤트 형식
      if (!event.startTime) return false;
      eventDate = new Date(event.startTime);
      eventTitle = event.title;
    }

    const inRange = eventDate >= startDate && eventDate <= endDate;
    const titleMatch = matchesTitle(eventTitle, searchTitle);

    return inRange && titleMatch;
  });
};

/**
 * Profile context의 이벤트 데이터 구조 변환
 * @param {Object} eventsData
 * @returns {Array}
 */
export const convertProfileEvents = (eventsData) => {
  const exceptions = eventsData.scheduleExceptions || [];
  const personalTimes = eventsData.personalTimes || [];
  const defaultSchedule = eventsData.defaultSchedule || [];

  const convertedPersonalTimes = personalTimes.map(pt => ({
    ...pt,
    _id: pt.id,
    isPersonalTime: true
  }));

  const convertedDefaultSchedule = defaultSchedule.map((ds, index) => ({
    ...ds,
    _id: `default-${ds.dayOfWeek}-${index}`,
    isDefaultSchedule: true,
    title: `우선순위 ${ds.priority}`
  }));

  return [...exceptions, ...convertedPersonalTimes, ...convertedDefaultSchedule];
};
