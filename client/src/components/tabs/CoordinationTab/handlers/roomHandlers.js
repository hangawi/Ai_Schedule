/**
 * ===================================================================================================
 * [파일명] roomHandlers.js - 방(Room) 관련 이벤트 핸들러 생성 팩토리
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > [client/src/components/tabs/CoordinationTab/handlers/roomHandlers.js]
 *
 * 🎯 주요 기능:
 *    - 'CoordinationTab'에서 사용되는 방(Room) 관련 액션(생성, 참여, 선택, 나가기 등)에 대한 이벤트 핸들러를 생성.
 *    - 핸들러 팩토리 패턴을 사용하여, 각 핸들러가 필요로 하는 의존성(상태 업데이트 함수, API 호출 함수 등)을 주입받아 완전한 기능의 함수를 생성.
 *
 * 🔗 연결된 파일:
 *    - ../index.js (CoordinationTab): 이 파일의 팩토리 함수들을 호출하여 실제 이벤트 핸들러를 생성하고 UI 컴포넌트에 props로 전달.
 *    - ../../../../services/coordinationService.js: 방 관련 API를 직접 호출.
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 방 생성, 참여, 나가기 등 방과 관련된 핵심적인 사용자 액션의 동작 방식이 변경됩니다.
 *    - 방 나가기 로직 변경: `createHandleLeaveRoom` 함수 내부의 `fetch` 호출 및 후처리 로직을 수정합니다.
 *    - 방 선택 시 동작 변경: `createHandleRoomClick` 함수 내부의 `fetchRoomDetails` 또는 `history.pushState` 로직을 수정합니다.
 *
 * 📝 참고사항:
 *    - `requestHandlers.js`와 마찬가지로, 이 파일은 핸들러 팩토리 패턴을 적극적으로 사용하여 `CoordinationTab`의 복잡도를 낮추고 코드의 관심사를 분리합니다.
 *    - `createHandleRoomClick`와 `createHandleBackToRoomList`에서는 `window.history.api`를 사용하여, 사용자가 브라우저의 뒤로가기/앞으로가기 버튼을 사용할 수 있도록 UX를 개선합니다.
 *
 * ===================================================================================================
 */
import { auth } from '../../../../config/firebaseConfig';
import { coordinationService } from '../../../../services/coordinationService';

/**
 * [createHandleCreateRoom]
 * @description '방 생성' 핸들러를 생성하는 팩토리 함수.
 * @returns {function} roomData를 인자로 받아 방 생성, 모달 닫기, 방 목록 새로고침을 수행하는 핸들러.
 */
export const createHandleCreateRoom = (createRoom, closeCreateRoomModal, fetchMyRooms) => {
  return async (roomData) => {
    await createRoom(roomData);
    closeCreateRoomModal();
    fetchMyRooms();
  };
};

/**
 * [createHandleJoinRoom]
 * @description '방 참여' 핸들러를 생성하는 팩토리 함수.
 * @returns {function} inviteCode를 인자로 받아 방 참여, 모달 닫기, 방 목록 새로고침을 수행하는 핸들러.
 */
export const createHandleJoinRoom = (joinRoom, closeJoinRoomModal, fetchMyRooms, showAlert) => {
  return async (inviteCode) => {
    try {
      await joinRoom(inviteCode);
      closeJoinRoomModal();
      fetchMyRooms();
    } catch (error) {
      showAlert(error.message || '방 참여에 실패했습니다.');
    }
  };
};

/**
 * [createHandleRoomClick]
 * @description '방 목록'에서 특정 방을 클릭했을 때의 핸들러를 생성하는 팩토리 함수.
 * @returns {function} room 객체를 인자로 받아 해당 방의 상세 정보를 불러오고, 브라우저 history를 업데이트하는 핸들러.
 */
export const createHandleRoomClick = (fetchRoomDetails, setCurrentRoom, showAlert) => {
  return async (room) => {
    if (room._id) {
      try {
        await fetchRoomDetails(room._id);
        window.history.pushState({
          tab: 'coordination',
          roomState: 'inRoom',
          roomId: room._id
        }, '', '#coordination-room');
      } catch (error) {
        showAlert(`방 접근 실패: ${error.message || error}`);
      }
    } else {
      setCurrentRoom(room);
      window.history.pushState({
        tab: 'coordination',
        roomState: 'inRoom',
        roomId: room._id
      }, '', '#coordination-room');
    }
  };
};

/**
 * [createHandleLeaveRoom]
 * @description '방 나가기' 핸들러를 생성하는 팩토리 함수.
 * @returns {function} 사용자에게 확인을 받은 후, 방 나가기 API를 호출하고 관련 상태를 업데이트하는 핸들러.
 */
export const createHandleLeaveRoom = (currentRoom, setCurrentRoom, fetchMyRooms) => {
  return async () => {
    if (window.confirm("정말로 이 방을 나가시겠습니까? 배정된 모든 시간이 삭제됩니다.")) {
      try {
        const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
        const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${currentRoom._id}/leave`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.msg || 'Failed to leave room');
        }

        alert("방에서 나갔습니다.");
        setCurrentRoom(null);
        fetchMyRooms();

        window.history.pushState({
          tab: 'coordination',
          roomState: null
        }, '', '#coordination');

      } catch (error) {
        alert(`방 나가기 실패: ${error.message}`);
      }
    }
  };
};

/**
 * [createHandleBackToRoomList]
 * @description '방 목록으로 돌아가기' 핸들러를 생성하는 팩토리 함수.
 * @returns {function} 현재 방 선택 상태를 초기화하고 브라우저 history를 업데이트하는 핸들러.
 */
export const createHandleBackToRoomList = (setCurrentRoom) => {
  return () => {
    setCurrentRoom(null);
    window.history.pushState({
      tab: 'coordination',
      roomState: null
    }, '', '#coordination');
  };
};

/**
 * [createHandleExecuteDeleteAllSlots]
 * @description '모든 시간표 삭제' 핸들러를 생성하는 팩토리 함수.
 * @returns {function} 현재 방의 모든 시간표를 삭제하는 API를 호출하고 UI를 업데이트하는 핸들러.
 */
export const createHandleExecuteDeleteAllSlots = (currentRoom, setCurrentRoom, setShowDeleteConfirm, showAlert) => {
  return async () => {
    if (!currentRoom?._id) return;
    try {
      const updatedRoom = await coordinationService.deleteAllTimeSlots(currentRoom._id);
      setCurrentRoom(updatedRoom);
      showAlert('시간표가 모두 삭제되었습니다.');
    } catch (error) {
      showAlert(`시간표 삭제에 실패했습니다: ${error.message}`);
    }
    setShowDeleteConfirm(false);
  };
};

/**
 * [createHandleOpenLogsModal]
 * @description '로그 보기' 버튼 클릭 핸들러를 생성하는 팩토리 함수.
 * @returns {function} 방 관리 모달을 '로그' 탭이 선택된 상태로 여는 핸들러.
 */
export const createHandleOpenLogsModal = (setRoomModalDefaultTab, openManageRoomModal) => {
  return () => {
    setRoomModalDefaultTab('logs');
    openManageRoomModal();
  };
};

/**
 * [createHandleCloseManageRoomModal]
 * @description '방 관리 모달 닫기' 핸들러를 생성하는 팩토리 함수.
 * @returns {function} 모달을 닫고 기본 탭 상태를 초기화하는 핸들러.
 */
export const createHandleCloseManageRoomModal = (closeManageRoomModal, setRoomModalDefaultTab) => {
  return () => {
    closeManageRoomModal();
    setRoomModalDefaultTab('info');
  };
};