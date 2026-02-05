/**
 * API 요청 본문 생성 유틸리티
 */

import { toDateString, toTimeString, calculateDuration } from './dateUtils';

/**
 * Google Calendar 이벤트 데이터 생성
 * @param {Object} chatResponse
 * @param {string} date - YYYY-MM-DD
 * @returns {Object}
 */
export const createGoogleEventData = (chatResponse, date) => {
  return {
    title: chatResponse.title || '일정',
    description: chatResponse.description || '',
    startTime: `${date}T${chatResponse.startTime}:00+09:00`,
    endTime: `${date}T${chatResponse.endTime}:00+09:00`
  };
};

/**
 * Local 이벤트 데이터 생성 (나의 일정 탭)
 * @param {Object} chatResponse
 * @param {string} date - YYYY-MM-DD
 * @returns {Object}
 */
export const createLocalEventData = (chatResponse, date) => {
  const durationMinutes = calculateDuration(chatResponse.startTime, chatResponse.endTime);
  return {
    title: chatResponse.title || '일정',
    description: chatResponse.description || '',
    location: chatResponse.location || '',
    date: date,
    time: chatResponse.startTime,
    duration: durationMinutes
  };
};

/**
 * Profile Personal Time 이벤트 생성
 * @param {Object} chatResponse
 * @param {string} specificDate - YYYY-MM-DD
 * @returns {Object}
 */
export const createProfilePersonalTime = (chatResponse, specificDate) => {
  return {
    id: Date.now(),
    title: chatResponse.title || '일정',
    type: 'event',
    startTime: chatResponse.startTime,
    endTime: chatResponse.endTime,
    days: [],
    isRecurring: false,
    specificDate: specificDate,
    color: '#ef4444' // 빨간색
  };
};

/**
 * Profile 스케줄 업데이트 요청 본문 생성
 * @param {Object} currentSchedule
 * @param {Array} newPersonalTimes
 * @returns {Object}
 */
export const createProfileScheduleUpdateBody = (currentSchedule, newPersonalTimes = null) => {
  return {
    defaultSchedule: currentSchedule.defaultSchedule || [],
    scheduleExceptions: currentSchedule.scheduleExceptions || [],
    personalTimes: newPersonalTimes !== null ? newPersonalTimes : (currentSchedule.personalTimes || [])
  };
};

/**
 * Profile에서 단일 일정 추가를 위한 personalTime 생성
 * @param {Object} eventData
 * @param {string} specificDate
 * @param {string} startTime
 * @param {string} endTime
 * @returns {Object}
 */
export const createSingleProfilePersonalTime = (eventData, specificDate, startTime, endTime) => {
  return {
    id: Date.now(),
    title: eventData.title,
    type: 'event',
    startTime: startTime,
    endTime: endTime,
    location: eventData.location || '',
    days: [],
    isRecurring: false,
    specificDate: specificDate,
    color: 'bg-gray-500'
  };
};

/**
 * 일정 수정을 위한 요청 본문 생성 (Local 탭)
 * @param {Object} oldEvent
 * @param {Object} chatResponse
 * @returns {Object}
 */
export const createLocalEventUpdateBody = (oldEvent, chatResponse) => {
  const oldStartTime = new Date(oldEvent.startTime);
  const oldEndTime = new Date(oldEvent.endTime);

  let newStartTime = new Date(oldStartTime);
  let newEndTime = new Date(oldEndTime);

  if (chatResponse.newDate) {
    newStartTime = new Date(`${chatResponse.newDate}T${oldStartTime.toTimeString().substring(0, 5)}:00+09:00`);
    newEndTime = new Date(`${chatResponse.newDate}T${oldEndTime.toTimeString().substring(0, 5)}:00+09:00`);
  }

  if (chatResponse.newStartTime) {
    const [hour, min] = chatResponse.newStartTime.split(':');
    newStartTime.setHours(parseInt(hour), parseInt(min));
  }

  if (chatResponse.newEndTime) {
    const [hour, min] = chatResponse.newEndTime.split(':');
    newEndTime.setHours(parseInt(hour), parseInt(min));
  }

  return {
    title: chatResponse.newTitle || oldEvent.title,
    date: toDateString(newStartTime),
    time: toTimeString(newStartTime),
    duration: (newEndTime - newStartTime) / (60 * 1000),
    description: oldEvent.description
  };
};

/**
 * Google 일정 수정을 위한 요청 본문 생성
 * @param {Object} oldEvent
 * @param {Object} chatResponse
 * @returns {Object}
 */
export const createGoogleEventUpdateBody = (oldEvent, chatResponse) => {
  const oldStart = new Date(oldEvent.start.dateTime || oldEvent.start.date);
  const oldEnd = new Date(oldEvent.end.dateTime || oldEvent.end.date);

  let newStart = new Date(oldStart);
  let newEnd = new Date(oldEnd);

  if (chatResponse.newDate) {
    newStart = new Date(`${chatResponse.newDate}T${oldStart.toTimeString().substring(0, 5)}:00+09:00`);
    newEnd = new Date(`${chatResponse.newDate}T${oldEnd.toTimeString().substring(0, 5)}:00+09:00`);
  }

  if (chatResponse.newStartTime) {
    const [hour, min] = chatResponse.newStartTime.split(':');
    newStart.setHours(parseInt(hour), parseInt(min));
  }

  if (chatResponse.newEndTime) {
    const [hour, min] = chatResponse.newEndTime.split(':');
    newEnd.setHours(parseInt(hour), parseInt(min));
  }

  return {
    title: chatResponse.newTitle || oldEvent.summary,
    description: oldEvent.description,
    startDateTime: newStart.toISOString(),
    endDateTime: newEnd.toISOString(),
    etag: oldEvent.etag
  };
};
