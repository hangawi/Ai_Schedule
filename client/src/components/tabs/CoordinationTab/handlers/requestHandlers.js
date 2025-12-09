/**
 * ===================================================================================================
 * [파일명] requestHandlers.js - 요청 관련 이벤트 핸들러 생성 팩토리
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > [client/src/components/tabs/CoordinationTab/handlers/requestHandlers.js]
 *
 * 🎯 주요 기능:
 *    - 'CoordinationTab' 컴포넌트에서 사용될 다양한 요청(request) 관련 이벤트 핸들러 함수들을 생성.
 *    - "핸들러 팩토리(Handler Factory)" 패턴을 사용하여, 복잡한 비동기 로직과 의존성을 메인 컴포넌트로부터 분리.
 *    - 생성된 핸들러는 API 호출, 상태 업데이트, 알림 표시 등 일련의 작업을 캡슐화.
 *
 * 🔗 연결된 파일:
 *    - ../index.js (CoordinationTab): 이 파일의 팩토리 함수들을 호출하여 실제 이벤트 핸들러를 생성하고 사용.
 *    - ../../../../utils/coordinationHandlers.js: 보다 일반적인 핸들러 로직을 포함하며, 이 파일에서 재사용됨.
 *    - ../utils/requestUtils.js: API 요청에 필요한 데이터 객체를 구성하는 유틸리티 함수.
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 자리 요청, 교환, 취소 등과 관련된 사용자 액션의 세부 동작이 변경됩니다.
 *    - 예를 들어, `createHandleRequestSlot` 내부 로직을 수정하면 모든 종류의 요청 생성 후의 공통 동작(예: 데이터 새로고침, 알림 메시지)을 변경할 수 있습니다.
 *
 * 📝 참고사항:
 *    - 이 파일의 함수들은 이벤트 핸들러를 직접 export하는 대신, 이벤트 핸들러를 '반환하는 함수(팩토리)'를 export합니다.
 *    - 이 패턴은 `CoordinationTab`의 수많은 상태(state)와 함수(function)들을 직접 props로 전달하지 않고, 핸들러 생성 시점에 필요한 의존성만 주입하여 코드의 복잡도를 낮추는 데 도움을 줍니다. (의존성 주입 패턴)
 *
 * ===================================================================================================
 */
import { days, calculateEndTime } from '../../../../utils/coordinationUtils';
import {
  handleCancelRequest,
  handleRequestWithUpdate
} from '../../../../utils/coordinationHandlers';
import { buildSlotRequestData, buildChangeRequestData } from '../utils/requestUtils';
import { getRequestDate } from '../utils/dateUtils';

/**
 * [createHandleRequestSlot]
 * @description 시간 슬롯에 대한 요청(자리 요청, 교환 등)을 생성하는 이벤트 핸들러를 생성하는 팩토리 함수.
 *              생성된 핸들러는 API 호출, 데이터 새로고침, 성공/실패 알림 표시 등의 로직을 포함합니다.
 * @param {object} currentRoom - 현재 방 정보.
 * @param {function} createRequest - 요청 생성 API 호출 함수.
 * @param {function} fetchRoomDetails - 방 상세 정보 새로고침 함수.
 * @param {function} loadSentRequests - 보낸 요청 목록 새로고침 함수.
 * @param {function} showAlert - 사용자에게 알림을 표시하는 함수.
 * @param {function} closeChangeRequestModal - 관련 모달을 닫는 함수.
 * @returns {function} 요청 데이터를 인자로 받아 처리하는 이벤트 핸들러 함수.
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
 * [createHandleCancelRequest]
 * @description 보낸 요청을 '취소'하는 이벤트 핸들러를 생성하는 팩토리 함수.
 * @param {...function} dependencies - 요청 취소 로직에 필요한 다양한 상태 업데이트 및 API 호출 함수들.
 * @returns {function} 취소할 요청의 ID를 인자로 받아 처리하는 이벤트 핸들러 함수.
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
 * [createHandleRequestWithUpdate]
 * @description 받은 요청을 '승인' 또는 '거절'하는 이벤트 핸들러를 생성하는 팩토리 함수.
 * @param {...function} dependencies - 요청 처리 로직에 필요한 다양한 상태 업데이트 및 API 호출 함수들.
 * @returns {function} 요청 ID와 액션('approved'/'rejected') 등을 인자로 받아 처리하는 이벤트 핸들러 함수.
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
 * [createHandleRequestFromModal]
 * @description 'RequestSlotModal'에서 사용될 '요청하기' 버튼의 이벤트 핸들러를 생성하는 팩토리 함수.
 *              모달에서 입력된 메시지를 받아 완전한 요청 데이터 객체를 구성하고, `handleRequestSlot`을 호출합니다.
 * @param {...*} dependencies - 요청 데이터 구성 및 전송에 필요한 인자들.
 * @returns {function} 메시지 문자열을 인자로 받는 이벤트 핸들러 함수.
 */
export const createHandleRequestFromModal = (currentRoom, slotToRequest, handleRequestSlot, closeRequestModal) => {
  return (message) => {
    const requestData = buildSlotRequestData(currentRoom._id, slotToRequest, message);
    handleRequestSlot(requestData);
    closeRequestModal();
  };
};

/**
 * [createHandleChangeRequest]
 * @description 'ChangeRequestModal'에서 사용될 '요청하기' 버튼의 이벤트 핸들러를 생성하는 팩토리 함수.
 *              메시지와 요청 타입을 받아 완전한 요청 데이터 객체를 구성하고, `handleRequestSlot`을 호출합니다.
 * @param {...*} dependencies - 요청 데이터 구성 및 전송에 필요한 인자들.
 * @returns {function} 메시지와 요청 타입을 인자로 받는 이벤트 핸들러 함수.
 */
export const createHandleChangeRequest = (currentRoom, slotToChange, handleRequestSlot) => {
  return (message, requestType) => {
    const requestData = buildChangeRequestData(currentRoom._id, slotToChange, message, requestType);
    handleRequestSlot(requestData);
  };
};