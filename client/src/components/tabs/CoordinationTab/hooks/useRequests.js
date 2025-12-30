/**
 * ===================================================================================================
 * useRequests.js - 조율 요청 관리 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/tabs/CoordinationTab/hooks
 *
 * 🎯 주요 기능:
 *    - 보낸 요청(sentRequests) 상태 관리 및 로드
 *    - 받은 요청(receivedRequests) 상태 관리 및 로드
 *    - 연쇄 교환 요청(chainExchangeRequests) 상태 관리 및 로드
 *    - 방별 교환 요청 개수 집계
 *
 * 🔗 연결된 파일:
 *    - ../../../../services/coordinationService.js - 조율 요청 API 서비스
 *    - ../index.js - CoordinationTab 메인 컴포넌트에서 사용
 *    - ../components/RequestSection.js - 요청 목록 UI 컴포넌트
 *
 * 💡 UI 위치:
 *    - 탭: 조율 탭 (CoordinationTab)
 *    - 섹션: 요청 관리 섹션 (보낸/받은/연쇄 교환 요청)
 *    - 경로: 앱 실행 > 조율 탭 > 요청 관리
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 조율 탭의 요청 관리 로직 변경
 *    - 새로운 요청 타입 추가: 새로운 state와 load 함수 추가
 *    - 요청 필터링 로직 변경: loadSentRequests/loadReceivedRequests 함수 수정
 *    - 자동 새로고침 추가: useEffect로 주기적 로드 로직 추가
 *
 * 📝 참고사항:
 *    - 요청 상태: 'pending'(대기), 'accepted'(수락), 'rejected'(거절)
 *    - 연쇄 교환 요청은 chainData 필드로 구분됨
 *    - 디버그 로그는 프로덕션에서 제거 권장 (console.log)
 *
 * ===================================================================================================
 */

import { useState, useCallback, useEffect } from 'react';
import { coordinationService } from '../../../../services/coordinationService';

/**
 * useRequests - 조율 요청 관리 훅
 *
 * @description 사용자의 보낸 요청, 받은 요청, 연쇄 교환 요청을 관리하는 커스텀 훅
 * @param {string} userId - 현재 사용자 ID
 * @returns {Object} 요청 상태 및 제어 함수
 * @returns {Array} returns.sentRequests - 보낸 요청 목록
 * @returns {Function} returns.setSentRequests - 보낸 요청 상태 설정 함수
 * @returns {Array} returns.receivedRequests - 받은 요청 목록
 * @returns {Function} returns.setReceivedRequests - 받은 요청 상태 설정 함수
 * @returns {Function} returns.loadSentRequests - 보낸 요청 로드 함수
 * @returns {Function} returns.loadReceivedRequests - 받은 요청 로드 함수
 * @returns {Array} returns.chainExchangeRequests - 연쇄 교환 요청 목록
 * @returns {Function} returns.setChainExchangeRequests - 연쇄 교환 요청 상태 설정 함수
 * @returns {Function} returns.loadChainExchangeRequests - 연쇄 교환 요청 로드 함수
 *
 * @example
 * const {
 *   sentRequests,
 *   receivedRequests,
 *   loadSentRequests,
 *   loadReceivedRequests
 * } = useRequests(userId);
 *
 * @note
 * - 요청 로드 실패 시 에러 로그만 출력하고 계속 진행
 * - 디버그 로그(🔍)는 개발 시에만 유용하며 프로덕션에서는 제거 권장
 */
export const useRequests = (userId) => {
  const [sentRequests, setSentRequests] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  // 4.txt: 연쇄 교환 요청 상태 추가
  const [chainExchangeRequests, setChainExchangeRequests] = useState([]);

  const loadSentRequests = useCallback(async () => {
    if (!userId) return;
    try {
      const result = await coordinationService.getSentRequests();
      if (result.requests) {
        result.requests.forEach(req => {
        });
      }
      if (result.success) {
        setSentRequests(result.requests);
      }
    } catch (error) {
    }
  }, [userId]);

  const loadReceivedRequests = useCallback(async () => {
    if (!userId) return;
    try {
      const result = await coordinationService.getReceivedRequests();
      // 🔍 DEBUG: 받은 요청 로드 확인
      if (result.requests) {
        result.requests.forEach(req => {
        });
      }
      if (result.success) {
        setReceivedRequests(result.requests);
      }
    } catch (error) {
    }
  }, [userId]);

  // 4.txt: 연쇄 교환 요청 로드 함수
  const loadChainExchangeRequests = useCallback(async () => {
    if (!userId) return;
    try {
      const result = await coordinationService.getPendingChainExchangeRequests();
      if (result.success) {
        setChainExchangeRequests(result.requests);
      }
    } catch (error) {
    }
  }, [userId]);

  return {
    sentRequests,
    setSentRequests,
    receivedRequests,
    setReceivedRequests,
    loadSentRequests,
    loadReceivedRequests,
    // 4.txt: 연쇄 교환 요청
    chainExchangeRequests,
    setChainExchangeRequests,
    loadChainExchangeRequests
  };
};

/**
 * useRoomExchangeCounts - 방별 교환 요청 개수 관리 훅
 *
 * @description 사용자가 속한 각 방별로 받은 교환 요청 개수를 집계하고 관리하는 커스텀 훅
 * @param {string} userId - 현재 사용자 ID
 * @param {Object} myRooms - 사용자의 방 목록 { owned: [], joined: [] }
 * @param {Array} receivedRequests - 받은 요청 목록
 * @returns {Object} 방별 요청 개수 상태 및 함수
 * @returns {Object} returns.roomExchangeCounts - 방 ID를 키로 하는 요청 개수 맵
 * @returns {Function} returns.getRoomRequestCount - 특정 방의 대기 중인 요청 개수 반환
 * @returns {Function} returns.loadRoomExchangeCounts - 모든 방의 요청 개수 로드
 *
 * @example
 * const { roomExchangeCounts, getRoomRequestCount } = useRoomExchangeCounts(
 *   userId,
 *   myRooms,
 *   receivedRequests
 * );
 * const count = getRoomRequestCount(roomId); // 특정 방의 요청 개수
 *
 * @note
 * - 'pending' 상태의 요청만 카운트
 * - receivedRequests가 변경될 때마다 자동으로 재계산
 * - 방 목록에 변화가 있을 때도 자동 업데이트
 */
export const useRoomExchangeCounts = (userId, myRooms, receivedRequests) => {
  const [roomExchangeCounts, setRoomExchangeCounts] = useState({});

  const getRoomRequestCount = useCallback((roomId) => {
    return receivedRequests.filter(req =>
      req.status === 'pending' && req.roomId === roomId
    ).length;
  }, [receivedRequests]);

  const loadRoomExchangeCounts = useCallback(async () => {
    if (!userId || !myRooms) return;

    const counts = {};
    const allRooms = [...(myRooms.owned || []), ...(myRooms.joined || [])];

    allRooms.forEach(room => {
      counts[room._id] = getRoomRequestCount(room._id);
    });

    setRoomExchangeCounts(counts);
  }, [userId, myRooms, getRoomRequestCount]);

  // Update counts when receivedRequests changes
  useEffect(() => {
    if (receivedRequests.length > 0 && myRooms) {
      loadRoomExchangeCounts();
    }
  }, [receivedRequests.length, myRooms?.owned?.length, myRooms?.joined?.length, loadRoomExchangeCounts]);

  return {
    roomExchangeCounts,
    getRoomRequestCount,
    loadRoomExchangeCounts
  };
};
