import { useState, useCallback, useEffect } from 'react';
import { coordinationService } from '../services/coordinationService';

export const useCoordination = (userId, onRefreshExchangeCount) => {
  const [currentRoom, setCurrentRoom] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [myRooms, setMyRooms] = useState([]);

  const fetchRoomDetails = useCallback(async (roomId, silent = false) => {
    if (!silent) setError(null);
    
    try {
      const data = await coordinationService.fetchRoomDetails(roomId);
      setCurrentRoom(data);
    } catch (err) {
      console.error('fetchRoomDetails error:', err);
      if (!silent) {
        setError(err.message);
        setCurrentRoom(null);
      }
      throw err;
    }
  }, []);

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
      console.error('fetchMyRooms error:', err);
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
      setCurrentRoom(newRoom);
      return newRoom;
    } catch (err) {
      console.error('createRoom error:', err);
      setError(err.message);
      throw err;
    }
  }, []);

  const joinRoom = useCallback(async (inviteCode) => {
    setError(null);
    try {
      const joinedRoom = await coordinationService.joinRoom(inviteCode);
      setCurrentRoom(joinedRoom);
      return joinedRoom;
    } catch (err) {
      console.error('joinRoom error:', err);
      setError(err.message);
      throw err;
    }
  }, []);

  const updateRoom = useCallback(async (roomId, updateData) => {
    setError(null);
    try {
      const updatedRoom = await coordinationService.updateRoom(roomId, updateData);
      setCurrentRoom(updatedRoom);
      return updatedRoom;
    } catch (err) {
      console.error('updateRoom error:', err);
      setError(err.message);
      throw err;
    }
  }, []);

  const deleteRoom = useCallback(async (roomId) => {
    setError(null);
    try {
      await coordinationService.deleteRoom(roomId);
      setCurrentRoom(null);
    } catch (err) {
      console.error('deleteRoom error:', err);
      setError(err.message);
      throw err;
    }
  }, []);

  const submitTimeSlots = useCallback(async (roomId, slots) => {
    setError(null);
    try {
      await coordinationService.submitTimeSlots(roomId, slots);
      await fetchRoomDetails(roomId, true);
    } catch (err) {
      console.error('submitTimeSlots error:', err);
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
      console.error('removeTimeSlot error:', err);
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
      console.error('assignTimeSlot error:', err);
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
    } catch (err) {
      console.error('createRequest error:', err);
      
      // 중복 요청 오류인 경우 더 친화적인 메시지로 표시
      if (err.isDuplicate) {
        alert('⚠️ 이미 동일한 시간표에 대한 교환요청을 보냈습니다.\n\n기존 요청이 처리된 후 다시 시도해주세요.');
      } else {
        setError(err.message);
      }
      throw err;
    }
  }, [fetchRoomDetails, onRefreshExchangeCount]);

  const handleRequest = useCallback(async (requestId, action) => {
    setError(null);
    try {
      await coordinationService.handleRequest(requestId, action);
      if (currentRoom) {
        await fetchRoomDetails(currentRoom._id, true);
      }
      // 교환 요청 처리 후 전역 카운트 새로고침
      if (onRefreshExchangeCount) {
        onRefreshExchangeCount();
      }
    } catch (err) {
      console.error('handleRequest error:', err);
      setError(err.message);
      throw err;
    }
  }, [currentRoom, fetchRoomDetails, onRefreshExchangeCount]);


  useEffect(() => {
    if (userId) {
      fetchMyRooms();
    }
  }, [userId, fetchMyRooms]);

  return {
    currentRoom,
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
    handleRequest
  };
};