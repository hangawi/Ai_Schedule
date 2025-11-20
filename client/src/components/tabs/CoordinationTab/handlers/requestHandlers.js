// Request-related handler factories

import { days, calculateEndTime } from '../../../../utils/coordinationUtils';
import {
  handleCancelRequest,
  handleRequestWithUpdate
} from '../../../../utils/coordinationHandlers';
import { buildSlotRequestData, buildChangeRequestData } from '../utils/requestUtils';
import { getRequestDate } from '../utils/dateUtils';

/**
 * Create handler for request slot
 */
export const createHandleRequestSlot = (
  currentRoom,
  createRequest,
  fetchRoomDetails,
  loadSentRequests,
  showAlert,
  closeChangeRequestModal
) => {
  return async (requestData) => {
    if (!currentRoom) {
      return;
    }

    try {
      const result = await createRequest(requestData);

      await fetchRoomDetails(currentRoom._id);
      await loadSentRequests();

      if (requestData.type === 'slot_swap') {
        showAlert('자리 교환 요청을 보냈습니다!');
      } else if (requestData.type === 'time_request') {
        showAlert('자리 요청을 보냈습니다!');
      } else if (requestData.type === 'slot_release') {
        showAlert('시간 취소 요청을 보냈습니다!');
      } else {
        showAlert('요청을 보냈습니다!');
      }

      closeChangeRequestModal();
    } catch (error) {
      if (error.isDuplicate || error.message.includes('동일한 요청이 이미 존재합니다')) {
        showAlert('이미 이 시간대에 대한 자리 요청을 보냈습니다. 기존 요청이 처리될 때까지 기다려주세요.');
      } else {
        showAlert(`요청 전송에 실패했습니다: ${error.message}`, 'error');
      }

      setTimeout(() => {
        closeChangeRequestModal();
      }, 500);

      return;
    }
  };
};

/**
 * Create handler for cancel request
 */
export const createHandleCancelRequest = (
  setSentRequests,
  setReceivedRequests,
  cancelRequest,
  loadSentRequests,
  loadReceivedRequests,
  onRefreshExchangeCount,
  showAlert
) => {
  return async (requestId) => {
    await handleCancelRequest(
      requestId,
      setSentRequests,
      setReceivedRequests,
      cancelRequest,
      loadSentRequests,
      loadReceivedRequests,
      onRefreshExchangeCount,
      showAlert
    );
  };
};

/**
 * Create handler for request with update
 */
export const createHandleRequestWithUpdate = (
  handleRequest,
  currentRoom,
  fetchRoomDetails,
  loadReceivedRequests,
  loadSentRequests,
  loadRoomExchangeCounts,
  onRefreshExchangeCount,
  showAlert
) => {
  return async (requestId, action, request) => {
    try {
      await handleRequestWithUpdate(
        requestId,
        action,
        request,
        handleRequest,
        currentRoom,
        fetchRoomDetails,
        loadReceivedRequests,
        loadSentRequests,
        loadRoomExchangeCounts,
        onRefreshExchangeCount,
        showAlert
      );
    } catch (error) {
      // Silent error handling
    }
  };
};

/**
 * Create handler for RequestSlotModal onRequest
 */
export const createHandleRequestFromModal = (currentRoom, slotToRequest, handleRequestSlot, closeRequestModal) => {
  return (message) => {
    const requestData = buildSlotRequestData(currentRoom._id, slotToRequest, message);
    handleRequestSlot(requestData);
    closeRequestModal();
  };
};

/**
 * Create handler for ChangeRequestModal onRequestChange
 */
export const createHandleChangeRequest = (currentRoom, slotToChange, handleRequestSlot) => {
  return (message, requestType) => {
    const requestData = buildChangeRequestData(currentRoom._id, slotToChange, message, requestType);
    handleRequestSlot(requestData);
  };
};

/**
 * Create handler for negotiation refresh
 */
export const createHandleNegotiationRefresh = (currentRoom, fetchRoomDetails) => {
  return async () => {
    if (currentRoom?._id) {
      await fetchRoomDetails(currentRoom._id);
    }
  };
};
