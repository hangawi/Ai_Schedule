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

      // 구체적인 에러 메시지 구성
      let errorMessage = errData.msg || 'Failed to create room';
      if (errData.errors && Array.isArray(errData.errors)) {
        errorMessage += '\n상세: ' + errData.errors.join(', ');
      }
      if (errData.details) {
        errorMessage += '\n상세: ' + errData.details;
      }

      throw new Error(errorMessage);
    }
    
    const newRoom = await response.json();
    return newRoom;
  },

  // 방 참가
  async joinRoom(inviteCode) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${inviteCode}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      },
      body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() }),
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
      throw new Error(errData.msg || errData.error || 'Failed to update room');
    }

    const result = await response.json();
    return result;
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

  // 시간표 전체 삭제
  async deleteAllTimeSlots(roomId) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/time-slots`, {
      method: 'DELETE',
      headers: { 'x-auth-token': token },
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to delete all time slots');
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

    const result = await response.json();
    return result;
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

  // 교환 요청 응답 (승인/거절)
  async respondToExchangeRequest(roomId, requestId, action) {
    const token = getAuthToken();

    // 'approved' → 'accept', 'rejected' → 'reject' 변환
    const serverAction = action === 'approved' ? 'accept' : action === 'rejected' ? 'reject' : action;

    console.log('📡 [coordinationService] Calling respondToExchangeRequest API');
    console.log('   Room ID:', roomId);
    console.log('   Request ID:', requestId);
    console.log('   Action:', action, '→', serverAction);

    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/exchange-requests/${requestId}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      },
      body: JSON.stringify({ action: serverAction })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || `Failed to ${action} exchange request`);
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

  // 받은 교환 요청 내역 가져오기
  async getReceivedRequests() {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/received-requests`, {
      headers: { 'x-auth-token': token },
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to get received requests');
    }

    return await response.json();
  },

  // 요청 취소
  async cancelRequest(requestId) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/requests/${requestId}`, {
      method: 'DELETE',
      headers: { 'x-auth-token': token },
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to cancel request');
    }
    
    return await response.json();
  },

  // AI로 공통 시간 찾기
  async findCommonSlots(roomId, constraints) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/find-common-slots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token,
      },
      body: JSON.stringify(constraints),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to find common slots with AI');
    }

    return await response.json();
  },

  // 자동 시간 배정 실행
  async runAutoSchedule(roomId, options) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/run-schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token,
      },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || `Failed to run auto-schedule (${response.status})`);
    }

    return await response.json();
  },


  // 협의 목록 가져오기
  async getNegotiations(roomId) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/negotiations`, {
      headers: { 'x-auth-token': token },
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to fetch negotiations');
    }

    return await response.json();
  },

  // 협의 메시지 추가
  async addNegotiationMessage(roomId, negotiationId, message) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/negotiations/${negotiationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token,
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to add negotiation message');
    }

    return await response.json();
  },

  // 협의 해결 (수동)
  async resolveNegotiation(roomId, negotiationId, assignedTo) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/negotiations/${negotiationId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token,
      },
      body: JSON.stringify({ assignedTo }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to resolve negotiation');
    }

    return await response.json();
  },

  // 타임아웃 협의 자동 해결
  async autoResolveTimeoutNegotiations(roomId, negotiationTimeoutHours = 24) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/negotiations/auto-resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token,
      },
      body: JSON.stringify({ negotiationTimeoutHours }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to auto-resolve negotiations');
    }

    return await response.json();
  },

  // 협의 강제 해결
  async forceResolveNegotiation(roomId, negotiationId, method = 'random') {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/negotiations/${negotiationId}/force-resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token,
      },
      body: JSON.stringify({ method }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to force resolve negotiation');
    }

    return await response.json();
  },

  // 협의 응답
  async respondToNegotiation(roomId, negotiationId, payload) {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/negotiations/${negotiationId}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token,
      },
      body: JSON.stringify(payload), // payload includes: response, yieldOption, alternativeSlots
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to respond to negotiation');
    }

    return await res.json();
  },

  async cancelNegotiationResponse(roomId, negotiationId) {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/negotiations/${negotiationId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to cancel negotiation response');
    }

    return await res.json();
  },

  async resetAllMemberStats(roomId) {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/reset-all-stats`, {
      method: 'POST',
      headers: {
        'x-auth-token': token,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to reset all stats');
    }

    return await res.json();
  },

  async clearCarryOverHistory(roomId, memberId) {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/members/${memberId}/carry-over-history`, {
      method: 'DELETE',
      headers: {
        'x-auth-token': token,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to clear carry-over history');
    }

    return await res.json();
  },

  async clearAllCarryOverHistories(roomId) {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/all-carry-over-history`, {
      method: 'DELETE',
      headers: {
        'x-auth-token': token,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to clear all carry-over histories');
    }

    return await res.json();
  },
};