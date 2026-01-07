/**
 * ===================================================================================================
 * useCoordination.js - 협업 공간(방) 관련 상태 및 API 상호작용을 관리하는 React Hook
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks
 *
 * 🎯 주요 기능:
 *    - 사용자가 속한 방 목록(myRooms) 관리
 *    - 현재 선택된 방(currentRoom)의 상태 관리 및 로컬 스토리지 동기화
 *    - 방 생성, 참여, 업데이트, 삭제 등 CRUD 작업 수행
 *    - 타임슬롯 제출, 삭제, 배정 등 시간 관련 작업 처리
 *    - 시간 교환 요청 생성, 수락/거절, 취소 등 요청 관련 작업 처리
 *
 * 🔗 연결된 파일:
 *    - src/services/coordinationService.js - 실제 API 요청을 보내는 서비스
 *    - src/components/tabs/CoordinationTab/index.js - 협업 탭에서 방 관련 작업을 위해 이 훅을 사용
 *    - src/App.js - 전역적인 방 상태 접근 및 관리를 위해 사용될 수 있음
 *
 * ✏️ 수정 가이드:
 *    - 새로운 방 관련 API 기능 추가: coordinationService에 함수를 추가하고, 이 훅 내에서 해당 함수를 호출하는 새로운 콜백 함수를 정의
 *    - 방 상태(currentRoom) 구조 변경: API 응답 변경에 맞춰 setCurrentRoom 및 fetchRoomDetails의 데이터 처리 로직 수정
 *    - 로컬 스토리지 동작 변경: setCurrentRoom 및 페이지 로드 시의 useEffect 로직 수정
 *
 * 📝 참고사항:
 *    - 현재 방 정보는 새로고침 시에도 유지되도록 로컬 스토리지에 저장됩니다.
 *    - 대부분의 함수는 API 호출 후 자동으로 현재 방 상태를 최신화합니다.
 *    - 에러 처리는 대부분 훅 내부에서 처리되지만, 일부(joinRoom, createRequest)는 상위 컴포넌트에서 처리하도록 에러를 다시 throw합니다.
 *
 * ===================================================================================================
 */
import { useState, useCallback, useEffect } from 'react';
import { coordinationService } from '../services/coordinationService';

/**
 * useCoordination - 방 관련 로직을 캡슐화한 커스텀 훅
 *
 * @description 협업 공간(방) 생성, 참여, 데이터 조회 및 각종 상호작용(시간 제출, 교환 요청 등)을 위한 상태와 함수를 제공합니다.
 * @param {string} userId - 현재 로그인한 사용자의 ID
 * @param {Function} onRefreshExchangeCount - 교환 요청 개수가 변경될 때 호출될 콜백 함수
 * @param {Function} onRefreshSentRequests - 보낸 요청 목록이 변경될 때 호출될 콜백 함수
 * @param {Function} showAlert - 사용자에게 알림을 표시하기 위한 함수
 * @returns {object} 방 관련 상태 및 핸들러 함수들을 포함하는 객체
 * @property {object|null} currentRoom - 현재 사용자가 보고 있는 방의 상세 정보
 * @property {Function} setCurrentRoom - 현재 방 상태를 수동으로 설정하는 함수
 * @property {boolean} isLoading - 내 방 목록을 가져오는 중인지 여부
 * @property {string|null} error - 발생한 에러 메시지
 * @property {Array} myRooms - 사용자가 속한 모든 방의 목록
 * @property {Function} fetchRoomDetails - 특정 방의 상세 정보를 다시 불러오는 함수
 * @property {Function} fetchMyRooms - 사용자가 속한 모든 방 목록을 다시 불러오는 함수
 * @property {Function} createRoom - 새로운 방을 생성하는 함수
 * @property {Function} joinRoom - 초대 코드를 사용하여 방에 참여하는 함수
 * @property {Function} updateRoom - 방 정보를 업데이트하는 함수
 * @property {Function} deleteRoom - 방을 삭제하는 함수
 * @property {Function} submitTimeSlots - 사용자의 선호 시간을 제출하는 함수
 * @property {Function} removeTimeSlot - 특정 선호 시간 슬롯을 제거하는 함수
 * @property {Function} assignTimeSlot - 특정 시간 슬롯을 특정 사용자에게 할당하는 함수
 * @property {Function} createRequest - 시간 교환 요청을 생성하는 함수
 * @property {Function} handleRequest - 받은 요청을 수락하거나 거절하는 함수
 * @property {Function} cancelRequest - 보낸 요청을 취소하는 함수
 */
export const useCoordination = (userId, onRefreshExchangeCount, onRefreshSentRequests, showAlert, skipRestore = false) => {
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

  // 페이지 로드 시 또는 사용자 ID가 변경될 때 로컬 스토리지에서 현재 방 정보를 복원합니다.
  useEffect(() => {
    const restoreCurrentRoom = async () => {
      // 복원 건너뛰기 옵션이 켜져있으면 초기화만 하고 종료
      if (skipRestore) {
        setCurrentRoomState(null);
        localStorage.removeItem('currentRoomId');
        localStorage.removeItem('currentRoomData');
        return;
      }

      if (!userId) {
        // 사용자가 없으면 방 상태 클리어
        setCurrentRoomState(null);
        localStorage.removeItem('currentRoomId');
        localStorage.removeItem('currentRoomData');
        return;
      }

      const savedRoomId = localStorage.getItem('currentRoomId');
      const savedUserId = localStorage.getItem('savedUserId');

      // 다른 사용자로 로그인한 경우, 이전 방 상태를 클리어합니다.
      if (savedUserId && savedUserId !== userId) {
        setCurrentRoomState(null);
        localStorage.removeItem('currentRoomId');
        localStorage.removeItem('currentRoomData');
        localStorage.setItem('savedUserId', userId);
        return;
      }

      // 현재 사용자 ID를 저장합니다.
      localStorage.setItem('savedUserId', userId);

      if (savedRoomId) {
        try {
          // 서버에서 최신 방 정보를 가져와 접근 권한을 확인합니다.
          const data = await coordinationService.fetchRoomDetails(savedRoomId);

          // 사용자가 해당 방의 소유주 또는 멤버인지 확인합니다.
          const isOwner = data.owner && data.owner._id === userId;
          const isMember = data.members && data.members.some(m => m.user._id === userId);

          if (isOwner || isMember) {
            // 하위 컴포넌트의 메모이제이션을 깨기 위해 깊은 복사를 수행합니다.
            const newRoomState = JSON.parse(JSON.stringify(data));
            setCurrentRoomState(newRoomState);
            localStorage.setItem('currentRoomData', JSON.stringify(data));
          } else {
            // 접근 권한이 없으면 방 상태를 클리어합니다.
            setCurrentRoomState(null);
            localStorage.removeItem('currentRoomId');
            localStorage.removeItem('currentRoomData');
          }
        } catch (err) {
          // 방 정보 복원 실패 시 에러를 조용히 처리하고 로컬 스토리지를 비웁니다.
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
      // 하위 컴포넌트의 메모이제이션을 깨기 위해 깊은 복사를 수행합니다.
      const newRoomState = JSON.parse(JSON.stringify(data));
      setCurrentRoom(newRoomState);
      return newRoomState; // ✨ 업데이트된 방 정보를 반환
    } catch (err) {
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
      const newRoomState = JSON.parse(JSON.stringify(newRoom));
      setCurrentRoom(newRoomState);
      return newRoom;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [setCurrentRoom]);

  const joinRoom = useCallback(async (inviteCode) => {
    setError(null);
    try {
      const joinedRoom = await coordinationService.joinRoom(inviteCode);
      const newRoomState = JSON.parse(JSON.stringify(joinedRoom));
      setCurrentRoom(newRoomState);
      return joinedRoom;
    } catch (err) {
      // 모달에서 에러를 직접 처리하도록 에러를 throw합니다.
      throw err;
    }
  }, [setCurrentRoom]);

  const updateRoom = useCallback(async (roomId, updateData) => {
    setError(null);
    try {
      const updatedRoom = await coordinationService.updateRoom(roomId, updateData);
      const newRoomState = JSON.parse(JSON.stringify(updatedRoom));
      setCurrentRoom(newRoomState);
      return updatedRoom;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [setCurrentRoom]);

  const deleteRoom = useCallback(async (roomId) => {
    setError(null);
    try {
      await coordinationService.deleteRoom(roomId);
      setCurrentRoom(null);
      // 방 삭제 후 방 목록을 다시 가져옵니다.
      await fetchMyRooms();
    } catch (err) {
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
      // 방장이 교환 요청을 할 수 없는 경우, 알림을 표시합니다.
      if (err.message.includes('방장은 시간표 교환요청을 할 수 없습니다')) {
        if (showAlert) {
          showAlert('방장은 시간표 교환요청을 할 수 없습니다.', 'error');
        }
        throw err;
      }

      // 중복 요청 오류인 경우, 상위 컴포넌트에서 처리하도록 에러를 다시 throw합니다.
      if (err.isDuplicate || err.message.includes('동일한 요청이 이미 존재합니다')) {
        throw err;
      } else {
        setError(err.message);
        throw err;
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
      setError(err.message);
      throw err;
    }
  }, [currentRoomState, fetchRoomDetails, onRefreshExchangeCount, onRefreshSentRequests]);

  const setAutoConfirmDuration = useCallback(async (roomId, duration) => {
    setError(null);
    try {
      const result = await coordinationService.setAutoConfirmDuration(roomId, duration);
      // 방 정보 다시 불러오기 (silent mode)
      await fetchRoomDetails(roomId, true);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [fetchRoomDetails]);

  // 사용자 ID가 변경될 때마다 내 방 목록을 다시 가져옵니다.
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
    cancelRequest,
    setAutoConfirmDuration
  };
};
