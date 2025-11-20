// Request utility functions for CoordinationTab

import { days } from '../../../../utils/coordinationUtils';
import { getDayIndex, getRequestDate } from './dateUtils';
import { calculateEndTime } from '../../../../utils/coordinationUtils';

/**
 * Create release request data
 * @param {string} roomId - Room ID
 * @param {Object} slotToChange - Slot data
 * @param {string} dayKey - Day key
 * @param {string} requestDate - Request date
 * @param {string} message - Request message
 * @returns {Object} - Request data
 */
export const createReleaseRequestData = (roomId, slotToChange, dayKey, requestDate, message) => {
  return {
    roomId,
    type: 'slot_release',
    timeSlot: {
      day: dayKey,
      date: requestDate,
      startTime: slotToChange.startTime || slotToChange.time,
      endTime: slotToChange.endTime || calculateEndTime(slotToChange.time),
    },
    message: message || '시간을 취소합니다.',
  };
};

/**
 * Create time request data
 * @param {string} roomId - Room ID
 * @param {Object} slotToChange - Slot data
 * @param {string} dayKey - Day key
 * @param {string} requestDate - Request date
 * @param {string} message - Request message
 * @returns {Object} - Request data
 */
export const createTimeRequestData = (roomId, slotToChange, dayKey, requestDate, message) => {
  const startTime = slotToChange.startTime || slotToChange.time;
  const endTime = slotToChange.endTime || (slotToChange.isBlockRequest && slotToChange.targetSlot
    ? slotToChange.targetSlot.endTime
    : calculateEndTime(slotToChange.time));

  return {
    roomId,
    type: 'time_request',
    timeSlot: {
      day: dayKey,
      date: requestDate,
      startTime: startTime,
      endTime: endTime,
    },
    targetUserId: slotToChange.targetUserId,
    message: message || (slotToChange.isBlockRequest ? '블록 자리를 요청합니다.' : '자리를 요청합니다.'),
    isBlockRequest: slotToChange.isBlockRequest,
  };
};

/**
 * Get day key from slot data
 * @param {Object} slotToChange - Slot data
 * @returns {string} - Day key
 */
export const getDayKey = (slotToChange) => {
  return slotToChange.date
    ? days[getDayIndex(slotToChange.date)]
    : days[slotToChange.dayIndex - 1];
};

/**
 * Build change request data
 * @param {string} roomId - Room ID
 * @param {Object} slotToChange - Slot data
 * @param {string} message - Request message
 * @param {string} requestType - Type of request
 * @returns {Object} - Request data
 */
export const buildChangeRequestData = (roomId, slotToChange, message, requestType) => {
  const dayKey = getDayKey(slotToChange);
  const requestDate = getRequestDate(slotToChange);
  const actionType = requestType || slotToChange.action || 'request';

  if (actionType === 'release') {
    return createReleaseRequestData(roomId, slotToChange, dayKey, requestDate, message);
  } else {
    return createTimeRequestData(roomId, slotToChange, dayKey, requestDate, message);
  }
};

/**
 * Build slot request data for RequestSlotModal
 * @param {string} roomId - Room ID
 * @param {Object} slotToRequest - Slot to request
 * @param {string} message - Request message
 * @returns {Object} - Request data
 */
export const buildSlotRequestData = (roomId, slotToRequest, message) => {
  const requestDate = getRequestDate(slotToRequest);

  return {
    roomId,
    type: 'time_request',
    timeSlot: {
      day: days[slotToRequest.dayIndex - 1],
      date: requestDate,
      startTime: slotToRequest.time,
      endTime: calculateEndTime(slotToRequest.time),
    },
    message: message
  };
};

/**
 * Get requester name from request data
 * @param {Object} requesterData - Requester data
 * @returns {string} - Requester name
 */
export const getRequesterName = (requesterData) => {
  return `${requesterData?.firstName || ''} ${requesterData?.lastName || ''}`.trim() || '알 수 없음';
};

/**
 * Get target user name from request data
 * @param {Object} targetUserData - Target user data
 * @returns {string} - Target user name
 */
export const getTargetUserName = (targetUserData) => {
  return `${targetUserData?.firstName || ''} ${targetUserData?.lastName || ''}`.trim() || '방장';
};
