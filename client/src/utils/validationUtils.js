/**
 * ===================================================================================================
 * validationUtils.js - 클라이언트 사이드 입력 및 데이터 검증 유틸리티
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/utils > validationUtils.js
 * 🎯 주요 기능:
 *    - 사용자의 조작(교환 요청, 슬롯 선택 등)이 논리적으로 타당한지 검증하는 다양한 로직 제공.
 *    - 중복된 교환 요청이 이미 존재하는지 확인하여 불필요한 API 호출 방지.
 *    - 특정 슬롯의 소유권 확인, 선택된 슬롯 리스트 내 포함 여부 판단.
 *    - 모달 입력 데이터(날짜, 시간, 액션 등)의 필수 여부 및 형식(Format) 유효성 검사.
 *    - 배정 대상 멤버 선택의 정당성 확인 및 디바운스(Debounce) 기반의 요청 빈도 제어 지원.
 *
 * 🔗 연결된 파일:
 *    - ./dateUtils.js - 날짜 비교를 위해 참조.
 *    - ../components/modals/ - 각종 모달 컴포넌트에서 사용자 입력 검증 시 사용.
 *    - ../hooks/useCoordination.js - 조율 로직 중 중복 요청 체크 시 활용.
 *
 * ✏️ 수정 가이드:
 *    - 새로운 요청 타입(예: 취소 요청 등)을 추가하려면 hasExistingSwapRequest 내의 조건식 수정.
 *    - 시간 형식을 더 정밀하게 체크하려면 isValidTimeFormat 정규식 수정.
 *    - 모달별 검증 항목을 추가하려면 validateModalInput의 switch 문 확장.
 *
 * 📝 참고사항:
 *    - 이 모듈은 서버 부하를 줄이고 프론트엔드에서의 데이터 무결성을 보장하는 1차 방어선 역할을 수행함.
 *
 * ===================================================================================================
 */

import { safeDateToISOString } from './dateUtils';

/**
 * hasExistingSwapRequest
 * @description 현재 사용자가 동일한 날짜와 시간대에 대해 이미 보낸 대기 중인 교환 요청이 있는지 확인합니다.
 * @param {Array} requests - 방의 전체 요청 리스트.
 * @param {Object} currentUser - 현재 로그인된 사용자 객체.
 * @param {Date} date - 클릭한 날짜 객체.
 * @param {string} time - 클릭한 시간 문자열.
 * @param {string} targetUserId - 교환 대상 사용자 ID.
 * @returns {boolean} 중복 요청이 존재하면 true, 아니면 false.
 */
export const hasExistingSwapRequest = (requests, currentUser, date, time, targetUserId) => {
  

  if (!requests || !currentUser || !date || !time || !targetUserId) {
    return false;
  }

  // Ensure date is valid
  const inputDate = new Date(date);
  if (isNaN(inputDate.getTime())) {
    return false;
  }

  const result = requests.some(request => {
    const requesterId = request.requester?.id || request.requester?._id || request.requester;

    // Check if this request is from the current user
    const isCurrentUserRequest = requesterId === currentUser?.id ||
                                 requesterId === currentUser?._id ||
                                 requesterId?.toString() === currentUser?.id?.toString() ||
                                 requesterId?.toString() === currentUser?._id?.toString();
    if (!isCurrentUserRequest) {
      return false;
    }

    // Check request status and type
    if (request.status !== 'pending') {
      return false;
    }
    if (!(request.type === 'slot_swap' || request.type === 'time_request')) {
      return false;
    }

    // Check target user (for time_request and slot_swap types)
    if (request.type === 'time_request' || request.type === 'slot_swap') {
      const requestTargetUserId = request.targetUser?._id || request.targetUser?.id || request.targetUser;
      const normalizedTargetUserId = targetUserId?._id || targetUserId?.id || targetUserId;

      if (requestTargetUserId?.toString() !== normalizedTargetUserId?.toString()) {
        return false;
      }
    }

    // Safely handle request date
    if (!request.timeSlot?.date) {
      return false;
    }
    const requestDate = new Date(request.timeSlot.date);
    if (isNaN(requestDate.getTime())) {
      return false;
    }

    // Check if dates match
    if (requestDate.toISOString().split('T')[0] !== inputDate.toISOString().split('T')[0]) {
      return false;
    }

    // Check time overlap
    const [requestStartHour, requestStartMinute] = request.timeSlot.startTime.split(':').map(Number);
    const [requestEndHour, requestEndMinute] = request.timeSlot.endTime.split(':').map(Number);
    const [clickedHour, clickedMinute] = time.split(':').map(Number);

    const requestStartMinutes = requestStartHour * 60 + requestStartMinute;
    const requestEndMinutes = requestEndHour * 60 + requestEndMinute;
    const clickedMinutes = clickedHour * 60 + clickedMinute;

    // Check if clicked time falls within the existing request time range
    const overlaps = clickedMinutes >= requestStartMinutes && clickedMinutes < requestEndMinutes;
    return overlaps;
  });
  return result;
};

/**
 * isSlotOwnedByCurrentUser
 * @description 해당 슬롯의 소유자가 현재 로그인된 사용자인지 확인합니다.
 */
export const isSlotOwnedByCurrentUser = (ownerInfo, currentUser) => {
  if (!ownerInfo || !currentUser) return false;

  return ownerInfo.userId === currentUser.id ||
         ownerInfo.userId === currentUser.email ||
         ownerInfo.userId === currentUser._id;
};

/**
 * isSlotInSelectedSlots
 * @description 특정 슬롯이 현재 선택된 슬롯 배열에 포함되어 있는지 확인합니다.
 */
export const isSlotInSelectedSlots = (selectedSlots, dayKey, time) => {
  if (!selectedSlots || !dayKey || !time) return false;

  return selectedSlots.some(s => s.day === dayKey && s.startTime === time);
};

/**
 * findExistingSlot
 * @description 슬롯 리스트에서 특정 날짜, 시간, 사용자에 해당하는 슬롯 객체를 찾아 반환합니다.
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
 * validateModalInput
 * @description 모달 창을 통해 입력된 데이터의 정합성을 검증합니다.
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
 * validateMemberSelection
 * @description 수동 배정 시 선택된 멤버가 유효한지 확인합니다 (자기 자신 배정 방지 등).
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
 * isValidTimeFormat
 * @description 문자열이 유효한 HH:MM 형식인지 확인합니다.
 */
export const isValidTimeFormat = (timeString) => {
  if (!timeString || typeof timeString !== 'string') return false;

  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeString);
};

/**
 * isValidDate
 * @description 객체가 유효한 Date 타입인지 확인합니다.
 */
export const isValidDate = (date) => {
  return date instanceof Date && !isNaN(date.getTime());
};

/**
 * isRequestTooRecent
 * @description 특정 요청이 디바운스 세트(recentRequests) 내에 있는지 확인하여 중복 발송을 방지합니다.
 */
export const isRequestTooRecent = (recentRequests, requestKey) => {
  if (!recentRequests || !requestKey) return false;
  return recentRequests.has(requestKey);
};