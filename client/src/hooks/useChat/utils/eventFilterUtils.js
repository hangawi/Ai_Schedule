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
  if (event.isPersonalTime) {
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
  if (context.tabType === 'google') {
    return event.summary;
  }
  return event.title;
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
  return events.filter(event => {
    if (!event) return false;

    let eventDate;
    let eventTitle;

    if (context.context === 'profile' && context.tabType === 'local') {
      eventDate = getEventDateForProfile(event, targetDate);
      eventTitle = event.title;
    } else if (context.tabType === 'local') {
      eventDate = getEventDateForLocal(event);
      eventTitle = event.title;
    } else {
      eventDate = getEventDateForGoogle(event);
      eventTitle = event.summary;
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
  return events.filter(event => {
    if (!event) return false;

    let eventDate;
    let eventTitle;

    if (context.context === 'profile' && context.tabType === 'local') {
      if (event.isPersonalTime) {
        eventTitle = event.title;
        eventDate = startDate; // TODO: 실제로는 더 정교한 로직 필요
      } else {
        if (!event.startTime) return false;
        eventDate = new Date(event.startTime);
        eventTitle = event.title;
      }
    } else if (context.tabType === 'local') {
      if (!event.startTime) return false;
      eventDate = new Date(event.startTime);
      eventTitle = event.title;
    } else {
      if (!event.start) return false;
      eventDate = new Date(event.start.dateTime || event.start.date);
      eventTitle = event.summary;
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
  const convertedPersonalTimes = personalTimes.map(pt => ({
    ...pt,
    _id: pt.id,
    isPersonalTime: true
  }));
  return [...exceptions, ...convertedPersonalTimes];
};
