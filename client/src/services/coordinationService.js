const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const getAuthToken = () => {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('No authentication token found.');
  return token;
};

export const coordinationService = {
  // 방 세부 정보 가져오기
  async fetchRoomDetails(roomId) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}`, {
      headers: { 'x-auth-token': token },
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || `HTTP ${response.status}: Failed to fetch room details.`);
    }
    
    return await response.json();
  },

  // 내 방 목록 가져오기
  async fetchMyRooms() {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/my-rooms`, {
      headers: { 'x-auth-token': token },
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || `HTTP ${response.status}: Failed to fetch rooms.`);
    }
    
    return await response.json();
  },

  // 방 생성
  async createRoom(roomData) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token,
      },
      body: JSON.stringify(roomData),
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to create room');
    }
    
    return await response.json();
  },

  // 방 참가
  async joinRoom(inviteCode) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${inviteCode}/join`, {
      method: 'POST',
      headers: { 'x-auth-token': token },
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to join room');
    }
    
    return await response.json();
  },

  // 방 수정
  async updateRoom(roomId, updateData) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token,
      },
      body: JSON.stringify(updateData),
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to update room');
    }
    
    return await response.json();
  },

  // 방 삭제
  async deleteRoom(roomId) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}`, {
      method: 'DELETE',
      headers: { 'x-auth-token': token },
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to delete room');
    }
    
    return await response.json();
  },

  // 타임슬롯 제출
  async submitTimeSlots(roomId, slots) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/slots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token,
      },
      body: JSON.stringify({ slots }),
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to submit time slots');
    }
    
    return await response.json();
  },

  // 타임슬롯 제거
  async removeTimeSlot(roomId, day, startTime, endTime) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/slots/remove`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token,
      },
      body: JSON.stringify({ day, startTime, endTime }),
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to remove time slot');
    }
    
    return await response.json();
  },

  // 타임슬롯 할당
  async assignTimeSlot(roomId, day, startTime, endTime, userId) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token,
      },
      body: JSON.stringify({ day, startTime, endTime, userId }),
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to assign time slot');
    }
    
    return await response.json();
  },

  // 요청 생성
  async createRequest(requestData) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token,
      },
      body: JSON.stringify(requestData),
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      const error = new Error(errData.msg || 'Failed to create request');
      error.isDuplicate = errData.duplicateRequest || false;
      throw error;
    }
    
    return await response.json();
  },

  // 요청 처리
  async handleRequest(requestId, action) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/requests/${requestId}/${action}`, {
      method: 'POST',
      headers: { 'x-auth-token': token },
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || `Failed to ${action} request`);
    }
    
    return await response.json();
  },

  // 교환 요청 수 가져오기
  async getExchangeRequestsCount() {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/exchange-requests-count`, {
      headers: { 'x-auth-token': token },
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to get exchange requests count');
    }
    
    return await response.json();
  },

  // 방별 교환 요청 수 가져오기
  async getRoomExchangeCounts() {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/exchange-counts`, {
      headers: { 'x-auth-token': token },
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to get room exchange counts');
    }
    
    return await response.json();
  },

  // 보낸 교환 요청 내역 가져오기
  async getSentRequests() {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/sent-requests`, {
      headers: { 'x-auth-token': token },
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to get sent requests');
    }
    
    return await response.json();
  },

};