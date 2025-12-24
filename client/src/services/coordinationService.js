import { auth } from '../config/firebaseConfig';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const getAuthToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('No authenticated user found.');
  return await currentUser.getIdToken();
};

export const coordinationService = {
  // 방 세부 정보 가져오기
  async fetchRoomDetails(roomId) {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || `HTTP ${response.status}: Failed to fetch room details.`);
    }
    
    return await response.json();
  },

  // 내 방 목록 가져오기
  async fetchMyRooms() {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/my-rooms`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || `HTTP ${response.status}: Failed to fetch rooms.`);
    }
    
    return await response.json();
  },

  // 방 생성
  async createRoom(roomData) {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
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
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${inviteCode}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
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
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
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
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to delete room');
    }
    
    return await response.json();
  },

  // 시간표 전체 삭제
  async deleteAllTimeSlots(roomId) {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/time-slots`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to delete all time slots');
    }
    
    return await response.json();
  },

  // 타임슬롯 제출
  async submitTimeSlots(roomId, slots) {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/slots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
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
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/slots/remove`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
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
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
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
    const token = await getAuthToken();

    const response = await fetch(`${API_BASE_URL}/api/coordination/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
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
    console.log('🔍 [coordinationService.handleRequest] requestId:', requestId, 'action:', action);
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/requests/${requestId}/${action}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      console.error('🔍 [coordinationService.handleRequest] Error:', errData);
      throw new Error(errData.msg || `Failed to ${action} request`);
    }

    const result = await response.json();
    console.log('🔍 [coordinationService.handleRequest] Response:', result);
    // 🔍 DEBUG: 응답에서 요청 상태 확인
    if (result.requests) {
      result.requests.forEach(req => {
        console.log('🔍 [handleRequest] Request in response:', req._id, 'status:', req.status);
      });
    }
    return result;
  },

  // 교환 요청 수 가져오기
  async getExchangeRequestsCount() {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/exchange-requests-count`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to get exchange requests count');
    }

    return await response.json();
  },

  // 교환 요청 응답 (승인/거절)
  async respondToExchangeRequest(roomId, requestId, action) {
    const token = await getAuthToken();

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
        'Authorization': `Bearer ${token}`
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
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/exchange-counts`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to get room exchange counts');
    }
    
    return await response.json();
  },

  // 보낸 교환 요청 내역 가져오기
  async getSentRequests() {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/sent-requests`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to get sent requests');
    }

    return await response.json();
  },

  // 받은 교환 요청 내역 가져오기
  async getReceivedRequests() {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/received-requests`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to get received requests');
    }

    return await response.json();
  },

  // 요청 취소
  async cancelRequest(requestId) {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/requests/${requestId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to cancel request');
    }
    
    return await response.json();
  },

  // AI로 공통 시간 찾기
  async findCommonSlots(roomId, constraints) {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/find-common-slots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
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
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/run-schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || `Failed to run auto-schedule (${response.status})`);
    }

    return await response.json();
  },

  async resetAllMemberStats(roomId) {
    const token = await getAuthToken();
    const res = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/reset-all-stats`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to reset all stats');
    }

    return await res.json();
  },

  async clearCarryOverHistory(roomId, memberId) {
    const token = await getAuthToken();
    const res = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/members/${memberId}/carry-over-history`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to clear carry-over history');
    }

    return await res.json();
  },

  /**
   * 자동배정된 시간을 각 조원과 방장의 개인일정으로 확정
   * @param {string} roomId - 방 ID
   * @param {string} travelMode - 현재 선택된 이동수단 모드 (normal, transit, driving, bicycling, walking)
   */
  async confirmSchedule(roomId, travelMode = 'normal') {
    const token = await getAuthToken();
    const res = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/confirm-schedule`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ travelMode }) // 이동수단 모드 전달
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to confirm schedule');
    }

    return await res.json();
  },

  async clearAllCarryOverHistories(roomId) {
    const token = await getAuthToken();
    const res = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/all-carry-over-history`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to clear all carry-over histories');
    }

    return await res.json();
  },

  // ========== 연쇄 교환 요청 API (4.txt: A → B → C) ==========

  // 대기 중인 연쇄 교환 요청 가져오기
  async getPendingChainExchangeRequests() {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/coordination/chain-exchange-requests/pending`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || 'Failed to get pending chain exchange requests');
    }

    return await response.json();
  },

  // 연쇄 교환 요청 응답 (승인/거절)
  async respondToChainExchangeRequest(roomId, requestId, action) {
    const token = await getAuthToken();

    // 'approved' → 'accept', 'rejected' → 'reject' 변환
    const serverAction = action === 'approved' ? 'accept' : action === 'rejected' ? 'reject' : action;

    console.log('🔗 [coordinationService] Calling respondToChainExchangeRequest API');
    console.log('   Room ID:', roomId);
    console.log('   Request ID:', requestId);
    console.log('   Action:', action, '→', serverAction);

    const response = await fetch(`${API_BASE_URL}/api/coordination/rooms/${roomId}/chain-exchange-requests/${requestId}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ action: serverAction })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.message || errData.msg || `Failed to ${action} chain exchange request`);
    }

    return await response.json();
  },

  /**
   * 조원이 선택 가능한 시간대 조회 (이동시간 고려)
   * @param {string} roomId - 방 ID
   * @param {string} date - 조회할 날짜 (YYYY-MM-DD)
   * @param {object} memberLocation - 조원의 위치 정보 { type, address, coordinates, description }
   * @returns {Promise<object>} { date, slots: [{ startTime, endTime, available }], travelMode }
   */
  async getAvailableSlots(roomId, date, memberLocation) {
    const token = await getAuthToken();

    const params = new URLSearchParams({
      date,
      memberLocation: JSON.stringify(memberLocation)
    });

    const response = await fetch(
      `${API_BASE_URL}/api/coordination/rooms/${roomId}/available-slots?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || '가능한 시간대 조회에 실패했습니다.');
    }

    return await response.json();
  },

  /**
   * 이동수단 선택 시 자동 확정 타이머 시작
   * @param {string} roomId - 방 ID
   * @param {string} travelMode - 선택한 이동수단 (normal, transit, driving, bicycling, walking)
   * @returns {Promise<object>} { msg, autoConfirmAt, travelMode, hoursRemaining }
   */
  async startConfirmationTimer(roomId, travelMode) {
    const token = await getAuthToken();

    const response = await fetch(
      `${API_BASE_URL}/api/coordination/rooms/${roomId}/start-confirmation-timer`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ travelMode })
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || '타이머 시작에 실패했습니다.');
    }

    return await response.json();
  },

  /**
   * 이동시간 포함 스케줄을 서버에 저장
   * @param {string} roomId - 방 ID
   * @param {string} travelMode - 선택한 이동수단
   * @param {Array} enhancedSchedule - 이동시간 포함 스케줄
   * @returns {Promise<object>} { success, travelMode, timeSlotsCount }
   */
  async applyTravelMode(roomId, travelMode, enhancedSchedule) {
    const token = await getAuthToken();

    // 🔍 디버깅: 전송 전 데이터 확인
    console.log('🔍 [applyTravelMode] 전송 전 enhancedSchedule.timeSlots 첫 3개:',
      enhancedSchedule.timeSlots?.slice(0, 3).map(s => ({
        startTime: s.startTime,
        endTime: s.endTime,
        subject: s.subject,
        date: s.date
      }))
    );

    const payload = { travelMode, enhancedSchedule };
    const jsonString = JSON.stringify(payload);

    // 🔍 디버깅: JSON 변환 후 다시 파싱해서 확인
    const parsed = JSON.parse(jsonString);
    console.log('🔍 [applyTravelMode] JSON 변환 후 timeSlots 첫 3개:',
      parsed.enhancedSchedule.timeSlots?.slice(0, 3).map(s => ({
        startTime: s.startTime,
        endTime: s.endTime,
        subject: s.subject
      }))
    );

    const response = await fetch(
      `${API_BASE_URL}/api/coordination/rooms/${roomId}/apply-travel-mode`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: jsonString
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || '이동시간 모드 적용에 실패했습니다.');
    }

    return await response.json();
  },

  /**
   * 이동시간 모드를 확정합니다 (조원들에게 표시)
   * @param {string} roomId - 방 ID
   * @param {string} travelMode - 확정할 이동수단 모드
   * @returns {Promise<object>} { success, confirmedTravelMode, confirmedAt }
   */
  async confirmTravelMode(roomId, travelMode) {
    const token = await getAuthToken();

    const response = await fetch(
      `${API_BASE_URL}/api/coordination/rooms/${roomId}/confirm-travel-mode`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ travelMode })
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || '이동시간 모드 확정에 실패했습니다.');
    }

    return await response.json();
  },

  /**
   * 자동 확정 타이머 시간 설정
   * @param {string} roomId - 방 ID
   * @param {number} duration - 타이머 시간 (분 단위)
   * @returns {Promise<object>} { success, duration, msg }
   */
  async setAutoConfirmDuration(roomId, duration) {
    const token = await getAuthToken();

    const response = await fetch(
      `${API_BASE_URL}/api/coordination/rooms/${roomId}/auto-confirm-duration`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ duration })
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(errData.msg || '타이머 설정에 실패했습니다.');
    }

    return await response.json();
  },
};