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
      console.log(`Fetching room details for roomId: ${roomId}`);
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found.');

      const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}`, {
        headers: { 'x-auth-token': token },
      });
      
      console.log(`Response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
        console.error('Response error data:', errData);
        throw new Error(errData.msg || `HTTP ${response.status}: Failed to fetch room details.`);
      }
      const data = await response.json();
      
      console.log('=== ROOM OWNER DEBUG ===');
      console.log('Your User ID:', localStorage.getItem('userId') || 'not found in localStorage');
      console.log('Room Owner ID:', data.owner);
      console.log('Room Owner Object:', typeof data.owner, data.owner);
      console.log('Owner _id:', data.owner?._id);
      console.log('Room Master ID:', data.roomMasterId);
      console.log('Are they equal?', data.owner === localStorage.getItem('userId'));
      console.log('Are _ids equal?', data.owner?._id === localStorage.getItem('userId'));
      console.log('=== END DEBUG ===');
      
      // Only update if the data has actually changed
      console.log('setCurrentRoom 호출 - 새로운 방 데이터 설정');
      setCurrentRoom(data);
      console.log('currentRoom 상태 업데이트 완료');
      
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
      if (currentRoom && currentRoom._id) {
        await fetchRoomDetails(currentRoom._id);
      }
      alert('시간표가 성공적으로 제출되었습니다!');
    } catch (err) {
      setError(err.message);
      alert(`시간표 제출 실패: ${err.message}`);
      console.error('Error submitting time slots:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentRoom, fetchRoomDetails]);

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
      alert('요청이 성공적으로 생성되었습니다!');
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
      if (currentRoom && currentRoom._id) {
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
  }, [currentRoom, fetchRoomDetails]);

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
    createRequest,
    handleRequest,
  };
};
