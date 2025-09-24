/**
 * Validation utilities for input validation and safety checks
 */

import { safeDateToISOString } from './dateUtils';

/**
 * Check if a swap request already exists
 * @param {Array} requests - Array of requests
 * @param {Object} currentUser - Current user object
 * @param {Date} date - Date object
 * @param {string} time - Time string
 * @param {string} targetUserId - Target user ID
 * @returns {boolean} - Whether swap request exists
 */
export const hasExistingSwapRequest = (requests, currentUser, date, time, targetUserId) => {
  if (!requests || !currentUser || !date || !time || !targetUserId) return false;

  return requests.some(request => {
    const requesterId = request.requester?.id || request.requester?._id || request.requester;
    const requestDate = new Date(request.timeSlot?.date);
    return request.status === 'pending' &&
      request.type === 'slot_swap' &&
      (requesterId === currentUser?.id || requesterId?.toString() === currentUser?.id?.toString()) &&
      requestDate.toISOString().split('T')[0] === date.toISOString().split('T')[0] &&
      request.timeSlot?.startTime === time &&
      request.targetUserId === targetUserId;
  });
};

/**
 * Check if user owns the slot
 * @param {Object} ownerInfo - Slot owner info
 * @param {Object} currentUser - Current user object
 * @returns {boolean} - Whether user owns the slot
 */
export const isSlotOwnedByCurrentUser = (ownerInfo, currentUser) => {
  if (!ownerInfo || !currentUser) return false;

  return ownerInfo.userId === currentUser.id ||
         ownerInfo.userId === currentUser.email ||
         ownerInfo.userId === currentUser._id;
};

/**
 * Check if slot is selected in selectedSlots array
 * @param {Array} selectedSlots - Array of selected slots
 * @param {string} dayKey - Day key (e.g., 'monday')
 * @param {string} time - Time string
 * @returns {boolean} - Whether slot is selected
 */
export const isSlotInSelectedSlots = (selectedSlots, dayKey, time) => {
  if (!selectedSlots || !dayKey || !time) return false;

  return selectedSlots.some(s => s.day === dayKey && s.startTime === time);
};

/**
 * Find existing slot in timeSlots array
 * @param {Array} timeSlots - Array of time slots
 * @param {Date} date - Date object
 * @param {string} time - Time string
 * @param {string} userId - User ID
 * @returns {Object|null} - Existing slot or null
 */
export const findExistingSlot = (timeSlots, date, time, userId) => {
  if (!timeSlots || !date || !time || !userId) return null;

  return timeSlots.find(slot =>
    safeDateToISOString(slot.date)?.split('T')[0] === safeDateToISOString(date)?.split('T')[0] &&
    slot.startTime === time &&
    (slot.user === userId || slot.user?.toString() === userId)
  );
};

/**
 * Validate modal input data
 * @param {Object} modalData - Modal data object
 * @param {string} modalType - Type of modal (assign, request, change)
 * @returns {Object} - Validation result with isValid and errors
 */
export const validateModalInput = (modalData, modalType) => {
  const result = {
    isValid: true,
    errors: []
  };

  if (!modalData) {
    result.isValid = false;
    result.errors.push('Modal data is required');
    return result;
  }

  // Common validations
  if (!modalData.date || !(modalData.date instanceof Date)) {
    result.isValid = false;
    result.errors.push('Valid date is required');
  }

  if (!modalData.time || typeof modalData.time !== 'string') {
    result.isValid = false;
    result.errors.push('Valid time is required');
  }

  // Specific validations based on modal type
  switch (modalType) {
    case 'assign':
      // No additional validations for assign modal
      break;

    case 'request':
      // No additional validations for request modal
      break;

    case 'change_request':
      if (!modalData.action) {
        result.isValid = false;
        result.errors.push('Action is required for change request');
      }

      if (modalData.action === 'swap' && !modalData.targetUserId) {
        result.isValid = false;
        result.errors.push('Target user ID is required for swap action');
      }
      break;

    default:
      result.isValid = false;
      result.errors.push('Invalid modal type');
  }

  return result;
};

/**
 * Validate user selection for assignment
 * @param {string} memberId - Member ID to validate
 * @param {Array} members - Array of room members
 * @param {Object} currentUser - Current user object
 * @returns {Object} - Validation result
 */
export const validateMemberSelection = (memberId, members, currentUser) => {
  const result = {
    isValid: true,
    errors: []
  };

  if (!memberId) {
    result.isValid = false;
    result.errors.push('Member selection is required');
    return result;
  }

  if (!members || !Array.isArray(members)) {
    result.isValid = false;
    result.errors.push('Members list is not available');
    return result;
  }

  // Check if member exists and is not the current user (room owner)
  const member = members.find(m => {
    const memberDirectId = m._id || m.user?._id || m.id || m.user?.id;
    return memberDirectId === memberId;
  });

  if (!member) {
    result.isValid = false;
    result.errors.push('Selected member not found');
    return result;
  }

  // Check if trying to assign to current user (room owner)
  if (currentUser) {
    const currentUserId = currentUser.id || currentUser._id;
    const memberUserId = member._id || member.user?._id || member.id || member.user?.id;

    if (memberUserId === currentUserId) {
      result.isValid = false;
      result.errors.push('Cannot assign slot to yourself');
    }
  }

  return result;
};

/**
 * Validate time format
 * @param {string} timeString - Time string to validate (HH:MM format)
 * @returns {boolean} - Whether time format is valid
 */
export const isValidTimeFormat = (timeString) => {
  if (!timeString || typeof timeString !== 'string') return false;

  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeString);
};

/**
 * Validate date object
 * @param {Date} date - Date to validate
 * @returns {boolean} - Whether date is valid
 */
export const isValidDate = (date) => {
  return date instanceof Date && !isNaN(date.getTime());
};

/**
 * Check if request is within debounce period
 * @param {Set} recentRequests - Set of recent request keys
 * @param {string} requestKey - Current request key
 * @returns {boolean} - Whether request is too recent
 */
export const isRequestTooRecent = (recentRequests, requestKey) => {
  if (!recentRequests || !requestKey) return false;
  return recentRequests.has(requestKey);
};