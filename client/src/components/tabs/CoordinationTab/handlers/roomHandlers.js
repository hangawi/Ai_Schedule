// Room-related handler factories

import { auth } from '../../../../config/firebaseConfig';
import { coordinationService } from '../../../../services/coordinationService';

/**
 * Create handler for room creation
 */
export const createHandleCreateRoom = (createRoom, closeCreateRoomModal, fetchMyRooms) => {
  return async (roomData) => {
    await createRoom(roomData);
    closeCreateRoomModal();
    fetchMyRooms();
  };
};

/**
 * Create handler for room join
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
 * Create handler for room click
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
 * Create handler for leaving room
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
 * Create handler for going back to room list
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
 * Create handler for deleting all slots
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
 * Create handler for opening logs modal
 */
export const createHandleOpenLogsModal = (setRoomModalDefaultTab, openManageRoomModal) => {
  return () => {
    setRoomModalDefaultTab('logs');
    openManageRoomModal();
  };
};

/**
 * Create handler for closing manage room modal
 */
export const createHandleCloseManageRoomModal = (closeManageRoomModal, setRoomModalDefaultTab) => {
  return () => {
    closeManageRoomModal();
    setRoomModalDefaultTab('info');
  };
};
