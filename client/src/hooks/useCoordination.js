import { useState, useCallback, useEffect } from 'react';
import { coordinationService } from '../services/coordinationService';

export const useCoordination = (userId, onRefreshExchangeCount, onRefreshSentRequests, showAlert) => {
  const [currentRoomState, setCurrentRoomState] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [myRooms, setMyRooms] = useState([]);

  // currentRoom을 설정할 때 localStorage에도 저장
  const setCurrentRoom = useCallback((room) => {
    setCurrentRoomState(room);
    if (room) {
      localStorage.setItem('currentRoomId', room._id);
      localStorage.setItem('currentRoomData', JSON.stringify(room));
    } else {
      localStorage.removeItem('currentRoomId');
      localStorage.removeItem('currentRoomData');
    }
  }, []);

  // 페이지 로드 시 저장된 방 정보 복원
  useEffect(() => {
    const restoreCurrentRoom = async () => {
      if (!userId) {
        // 사용자가 없으면 방 상태 클리어
        setCurrentRoomState(null);
        localStorage.removeItem('currentRoomId');
        localStorage.removeItem('currentRoomData');
        return;
      }

      const savedRoomId = localStorage.getItem('currentRoomId');
      const savedUserId = localStorage.getItem('savedUserId');

      // 사용자가 변경되었으면 방 상태 클리어
      if (savedUserId && savedUserId !== userId) {
        setCurrentRoomState(null);
        localStorage.removeItem('currentRoomId');
        localStorage.removeItem('currentRoomData');
        localStorage.setItem('savedUserId', userId);
        return;
      }

      // 사용자 ID 저장
      localStorage.setItem('savedUserId', userId);

      if (savedRoomId) {
        try {
          // 실제 서버에서 최신 방 정보 가져오기 및 접근 권한 확인
          const data = await coordinationService.fetchRoomDetails(savedRoomId);

          // 사용자가 해당 방에 접근할 수 있는지 확인
          const isOwner = data.owner && data.owner._id === userId;
          const isMember = data.members && data.members.some(m => m.user._id === userId);

          if (isOwner || isMember) {
            // Force a deep copy to break memoization in child components
            const newRoomState = JSON.parse(JSON.stringify(data));
            setCurrentRoomState(newRoomState);
            localStorage.setItem('currentRoomData', JSON.stringify(data));
          } else {
            // 접근 권한이 없으면 방 상태 클리어
            setCurrentRoomState(null);
            localStorage.removeItem('currentRoomId');
            localStorage.removeItem('currentRoomData');
          }
        } catch (err) {
          // Failed to restore room - silently handle error
          // 서버에서 가져오기 실패시 저장된 데이터 삭제
          setCurrentRoomState(null);
          localStorage.removeItem('currentRoomId');
          localStorage.removeItem('currentRoomData');
        }
      }
    };

    restoreCurrentRoom();
  }, [userId]);

  const fetchRoomDetails = useCallback(async (roomId, silent = false) => {
    if (!silent) setError(null);

    try {
      const data = await coordinationService.fetchRoomDetails(roomId);
      // Force a deep copy to break memoization in child components
      const newRoomState = JSON.parse(JSON.stringify(data));
      setCurrentRoom(newRoomState);
    } catch (err) {
      // fetchRoomDetails error - silently handle error
      if (!silent) {
        setError(err.message);
        setCurrentRoom(null);
      }
      throw err;
    }
  }, [setCurrentRoom]);

  const fetchMyRooms = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!userId) {
        setMyRooms([]);
        setIsLoading(false);
        return;
      }

      const data = await coordinationService.fetchMyRooms();
      setMyRooms(data);
    } catch (err) {
      // fetchMyRooms error - silently handle error
      setError(err.message);
      setMyRooms([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const createRoom = useCallback(async (roomData) => {
    setError(null);
    try {
      const newRoom = await coordinationService.createRoom(roomData);
      // Force a deep copy to break memoization in child components
      const newRoomState = JSON.parse(JSON.stringify(newRoom));
      setCurrentRoom(newRoomState);
      return newRoom;
    } catch (err) {
      // createRoom error - silently handle error
      setError(err.message);
      throw err;
    }
  }, [setCurrentRoom]);

  const joinRoom = useCallback(async (inviteCode) => {
    setError(null);
    try {
      const joinedRoom = await coordinationService.joinRoom(inviteCode);
      // Force a deep copy to break memoization in child components
      const newRoomState = JSON.parse(JSON.stringify(joinedRoom));
      setCurrentRoom(newRoomState);
      return joinedRoom;
    } catch (err) {
      // joinRoom error - silently handle error
      setError(err.message);
      throw err;
    }
  }, [setCurrentRoom]);

  const updateRoom = useCallback(async (roomId, updateData) => {
    setError(null);
    try {
      const updatedRoom = await coordinationService.updateRoom(roomId, updateData);
      // Force a deep copy to break memoization in child components
      const newRoomState = JSON.parse(JSON.stringify(updatedRoom));
      setCurrentRoom(newRoomState);
      return updatedRoom;
    } catch (err) {
      // updateRoom error - silently handle error
      setError(err.message);
      throw err;
    }
  }, [setCurrentRoom]);

  const deleteRoom = useCallback(async (roomId) => {
    setError(null);
    try {
      await coordinationService.deleteRoom(roomId);
      setCurrentRoom(null);
      // 방 삭제 후 방 목록을 다시 가져옴
      await fetchMyRooms();
    } catch (err) {
      // deleteRoom error - silently handle error
      setError(err.message);
      throw err;
    }
  }, [setCurrentRoom, fetchMyRooms]);

  const submitTimeSlots = useCallback(async (roomId, slots) => {
    setError(null);
    try {
      await coordinationService.submitTimeSlots(roomId, slots);
      await fetchRoomDetails(roomId, true);
    } catch (err) {
      // submitTimeSlots error - silently handle error
      setError(err.message);
      throw err;
    }
  }, [fetchRoomDetails]);

  const removeTimeSlot = useCallback(async (roomId, day, startTime, endTime) => {
    setError(null);
    try {
      await coordinationService.removeTimeSlot(roomId, day, startTime, endTime);
      await fetchRoomDetails(roomId, true);
    } catch (err) {
      // removeTimeSlot error - silently handle error
      setError(err.message);
      throw err;
    }
  }, [fetchRoomDetails]);

  const assignTimeSlot = useCallback(async (roomId, day, startTime, endTime, userId) => {
    setError(null);
    try {
      await coordinationService.assignTimeSlot(roomId, day, startTime, endTime, userId);
      await fetchRoomDetails(roomId, true);
    } catch (err) {
      // assignTimeSlot error - silently handle error
      setError(err.message);
      throw err;
    }
  }, [fetchRoomDetails]);

  const createRequest = useCallback(async (requestData) => {
    setError(null);
    try {
      await coordinationService.createRequest(requestData);
      await fetchRoomDetails(requestData.roomId, true);
      // 교환 요청 생성 후 전역 카운트 새로고침
      if (onRefreshExchangeCount) {
        onRefreshExchangeCount();
      }
      // 보낸 요청 목록 즉시 업데이트
      if (onRefreshSentRequests) {
        onRefreshSentRequests();
      }
    } catch (err) {
      // createRequest error - silently handle error

      // 방장 교환요청 제한 에러인 경우 모달로 표시
      if (err.message.includes('방장은 시간표 교환요청을 할 수 없습니다')) {
        if (showAlert) {
          showAlert('방장은 시간표 교환요청을 할 수 없습니다.', 'error');
        }
        throw err;
      }

      // 중복 요청 오류인 경우 에러를 다시 throw해서 상위 컴포넌트에서 처리하도록 함
      if (err.isDuplicate || err.message.includes('동일한 요청이 이미 존재합니다')) {
        // Don't set global error state for duplicate requests, but still throw for parent handling
        throw err; // 상위 컴포넌트에서 처리하도록 에러를 전달
      } else {
        setError(err.message);
        throw err; // 다른 에러는 정상적으로 처리
      }
    }
  }, [fetchRoomDetails, onRefreshExchangeCount, onRefreshSentRequests, showAlert]);

  const handleRequest = useCallback(async (requestId, action) => {
    setError(null);
    try {
      await coordinationService.handleRequest(requestId, action);
      if (currentRoomState) {
        await fetchRoomDetails(currentRoomState._id, true);
      }
      // 교환 요청 처리 후 전역 카운트 새로고침
      if (onRefreshExchangeCount) {
        onRefreshExchangeCount();
      }
    } catch (err) {
      // handleRequest error - silently handle error
      setError(err.message);
      throw err;
    }
  }, [currentRoomState, fetchRoomDetails, onRefreshExchangeCount]);

  const cancelRequest = useCallback(async (requestId) => {
    setError(null);
    try {
      await coordinationService.cancelRequest(requestId);
      if (currentRoomState) {
        await fetchRoomDetails(currentRoomState._id, true);
      }
      // 요청 취소/삭제 후 전역 카운트 및 보낸 요청 목록 새로고침
      if (onRefreshExchangeCount) {
        onRefreshExchangeCount();
      }
      if (onRefreshSentRequests) {
        onRefreshSentRequests();
      }
    } catch (err) {
      // cancelRequest error - silently handle error
      setError(err.message);
      throw err;
    }
  }, [currentRoomState, fetchRoomDetails, onRefreshExchangeCount, onRefreshSentRequests]);


  useEffect(() => {
    if (userId) {
      fetchMyRooms();
    }
  }, [userId, fetchMyRooms]);

  return {
    currentRoom: currentRoomState,
    setCurrentRoom,
    isLoading,
    error,
    myRooms,
    fetchRoomDetails,
    fetchMyRooms,
    createRoom,
    joinRoom,
    updateRoom,
    deleteRoom,
    submitTimeSlots,
    removeTimeSlot,
    assignTimeSlot,
    createRequest,
    handleRequest,
    cancelRequest
  };
};