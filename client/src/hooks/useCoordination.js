import { useState, useCallback, useEffect } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export const useCoordination = (userId) => {
  const [currentRoom, setCurrentRoom] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [myRooms, setMyRooms] = useState([]);

  const fetchRoomDetails = useCallback(async (roomId, silent = false) => {
    if (!silent) setError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found.');

      const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}`, {
        headers: { 'x-auth-token': token },
      });
      
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
        console.error('Response error data:', errData);
        throw new Error(errData.msg || `HTTP ${response.status}: Failed to fetch room details.`);
      }
      const data = await response.json();
      
      // Only update if the data has actually changed
      setCurrentRoom(data);
      
    } catch (err) {
      console.error('fetchRoomDetails error details:', {
        roomId,
        error: err.message,
        stack: err.stack
      });
      
      if (!silent) {
        setError(err.message);
        setCurrentRoom(null);
      }
      throw err; // Re-throw so handleRoomClick can catch it
    }
  }, []);

  const fetchMyRooms = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found.');

      const response = await fetch(`${API_BASE_URL}/api/coordination/my-rooms`, {
        headers: { 'x-auth-token': token },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.msg || 'Failed to fetch my rooms.');
      }
      const data = await response.json();
      setMyRooms(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching my rooms:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let intervalId;
    if (currentRoom && currentRoom._id) {
      // Don't fetch immediately if we already have full room data
      const hasCompleteData = currentRoom.members && currentRoom.timeSlots !== undefined;
      
      if (!hasCompleteData) {
        setIsLoading(true);
        fetchRoomDetails(currentRoom._id).then(() => setIsLoading(false));
      }

      // Set up periodic refresh only for rooms with complete data
      if (hasCompleteData) {
        intervalId = setInterval(() => {
          fetchRoomDetails(currentRoom._id, true); // Silent mode to avoid UI flicker
        }, 30000); // Increased to 30 seconds to reduce server load
      }
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [currentRoom?._id]); // Only depend on room ID, not the entire room object

  const createRoom = useCallback(async (roomData) => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found.');

      const response = await fetch(`${API_BASE_URL}/api/coordination/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
        },
        body: JSON.stringify(roomData),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.msg || 'Failed to create room.');
      }
      const data = await response.json();
      setCurrentRoom(data);
      console.log('Room created and currentRoom set:', data);
      alert('방이 성공적으로 생성되었습니다!');
    } catch (err) {
      setError(err.message);
      alert(`방 생성 실패: ${err.message}`);
      console.error('Error creating room:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const joinRoom = useCallback(async (inviteCode) => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found.');

      const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${inviteCode}/join`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
        },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.msg || 'Failed to join room.');
      }
      const data = await response.json();
      setCurrentRoom(data);
      if (data.message) {
        alert(data.message);
      } else {
        alert('방에 성공적으로 참여했습니다!');
      }
    } catch (err) {
      setError(err.message);
      alert(`방 참여 실패: ${err.message}`);
      console.error('Error joining room:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const submitTimeSlots = useCallback(async (roomId, slots) => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found.');

      const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/slots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
        },
        body: JSON.stringify({ slots }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.msg || 'Failed to submit time slots.');
      }
      const data = await response.json();
      setCurrentRoom(data); // Use the response data directly
      alert('시간표가 성공적으로 제출되었습니다!');
    } catch (err) {
      setError(err.message);
      alert(`시간표 제출 실패: ${err.message}`);
      console.error('Error submitting time slots:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchRoomDetails, setCurrentRoom]);

  const assignTimeSlot = useCallback(async (roomId, day, startTime, endTime, userId) => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found.');

      const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/assign-slot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
        },
        body: JSON.stringify({ day, startTime, endTime, userId }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.msg || 'Failed to assign time slot.');
      }
      const data = await response.json();
      setCurrentRoom(data); // Refresh room details
      alert('시간이 성공적으로 배정되었습니다!');
    } catch (err) {
      setError(err.message);
      alert(`시간 배정 실패: ${err.message}`);
      console.error('Error assigning time slot:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchRoomDetails, setCurrentRoom]);

  const autoAssignSlots = useCallback(async (roomId) => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found.');

      const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/auto-assign`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
        },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.msg || 'Failed to auto-assign slots.');
      }
      if (currentRoom && currentRoom._id) {
        await fetchRoomDetails(currentRoom._id); // Refresh room details
      }
      alert('시간이 자동으로 배정되었습니다!');
    } catch (err) {
      setError(err.message);
      alert(`자동 배정 실패: ${err.message}`);
      console.error('Error auto-assigning slots:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchRoomDetails]);

  const removeTimeSlot = useCallback(async (roomId, day, startTime, endTime) => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found.');

      const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/slots`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
        },
        body: JSON.stringify({ day, startTime, endTime }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.msg || 'Failed to remove time slot.');
      }
      const data = await response.json();
      setCurrentRoom(data);
      alert('시간이 성공적으로 삭제되었습니다!');
    } catch (err) {
      setError(err.message);
      alert(`시간 삭제 실패: ${err.message}`);
      console.error('Error removing time slot:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createRequest = useCallback(async (requestData) => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found.');

      const response = await fetch(`${API_BASE_URL}/api/coordination/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
        },
        body: JSON.stringify(requestData),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.msg || 'Failed to create request.');
      }
      const data = await response.json();
      if (requestData.type === 'time_swap' || requestData.type === 'slot_swap') {
        alert('교환요청이 상대방에게 전송되었습니다! 상대방이 승인하면 시간이 교환됩니다.');
      } else {
        alert('요청이 성공적으로 생성되었습니다!');
      }
      return data;
    } catch (err) {
      setError(err.message);
      alert(`요청 생성 실패: ${err.message}`);
      console.error('Error creating request:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRequest = useCallback(async (requestId, status) => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found.');

      const response = await fetch(`${API_BASE_URL}/api/coordination/requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.msg || 'Failed to handle request.');
      }
      
      // Get the updated room data directly from server response
      const responseData = await response.json();
      if (responseData.room) {
        setCurrentRoom(responseData.room);
      } else if (currentRoom && currentRoom._id) {
        await fetchRoomDetails(currentRoom._id);
      }
      
      alert(`요청이 ${status === 'approved' ? '승인' : '거절'}되었습니다!`);
    } catch (err) {
      setError(err.message);
      alert(`요청 처리 실패: ${err.message}`);
      console.error('Error handling request:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchRoomDetails]);

  const updateRoom = useCallback(async (roomId, roomData) => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found.');

      const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
        },
        body: JSON.stringify(roomData),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.msg || 'Failed to update room.');
      }
      const data = await response.json();
      setCurrentRoom(data);
      alert('방 정보가 성공적으로 수정되었습니다!');
      return data;
    } catch (err) {
      setError(err.message);
      alert(`방 수정 실패: ${err.message}`);
      console.error('Error updating room:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteRoom = useCallback(async (roomId) => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found.');

      const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}`, {
        method: 'DELETE',
        headers: {
          'x-auth-token': token,
        },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.msg || 'Failed to delete room.');
      }
      setCurrentRoom(null);
      await fetchMyRooms(); // Refresh the room list
      alert('방이 성공적으로 삭제되었습니다!');
    } catch (err) {
      setError(err.message);
      alert(`방 삭제 실패: ${err.message}`);
      console.error('Error deleting room:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchMyRooms]);

  return {
    currentRoom,
    setCurrentRoom,
    myRooms,
    isLoading,
    error,
    fetchRoomDetails,
    fetchMyRooms,
    createRoom,
    updateRoom,
    deleteRoom,
    joinRoom,
    submitTimeSlots,
    removeTimeSlot,
    createRequest,
    handleRequest,
    assignTimeSlot,
    autoAssignSlots,
  };
};
