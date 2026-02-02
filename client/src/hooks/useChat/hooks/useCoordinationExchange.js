/**
 * ===================================================================================================
 * useCoordinationExchange.js - 챗봇을 통한 조율 시간 교환/변경 처리를 위한 커스텀 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks/useChat/hooks/useCoordinationExchange.js
 *
 * 🎯 주요 기능:
 *    - 사용자의 채팅 메시지를 백엔드 API로 보내 시간 변경/날짜 변경 요청을 파싱.
 *    - 파싱된 요청(`time_change` 또는 `date_change`)을 즉시 실행.
 *    - 'smart-exchange' API를 호출하여 실제 시간 교환/변경 로직을 수행.
 *    - 교환 성공 시 'coordinationUpdate' 이벤트를 발생시켜 조율 캘린더 UI를 갱신.
 *
 * 🔗 연결된 파일:
 *    - client/src/hooks/useChat/index.js: 이 훅을 사용하여 채팅 메시지로부터 시간 변경 관련 인텐트를 처리.
 *    - client/src/utils/coordinationModeUtils.js: 'smart-exchange' API에 필요한 `viewMode`와 `currentWeekStartDate` 정보를 가져옴.
 *    - server/routes/coordination.js: '/api/coordination/rooms/:roomId/parse-exchange-request' 및 '/smart-exchange' 라우트와 통신.
 *
 * 💡 UI 위치:
 *    - 직접적인 UI 요소는 없으나, 조율 탭의 채팅 기능을 통해 사용자의 시간 변경 요청을 처리하는 핵심 로직.
 *
 * ✏️ 수정 가이드:
 *    - 백엔드 파싱 API 엔드포인트 변경 시: `parseResponse`의 fetch URL을 수정.
 *    - 시간 교환 API 엔드포인트 변경 시: `exchangeResponse`의 fetch URL을 수정.
 *    - API 요청에 필요한 추가 데이터가 있을 경우: `body` 객체에 해당 데이터를 추가.
 *
 * 📝 참고사항:
 *    - 이 훅은 2단계 프로세스로 동작합니다: 1) 메시지 파싱, 2) 파싱 결과로 실제 동작 수행.
 *    - 사용자의 확인을 거치지 않고 파싱된 결과를 즉시 실행하는 구조.
 *    - 레거시 'confirm', 'reject' 타입 핸들러는 현재 사용되지 않음.
 *
 * ===================================================================================================
 */
import { useCallback } from 'react';
import { auth } from '../../../config/firebaseConfig';
import { API_BASE_URL } from '../constants/apiConstants';
import { getViewMode, getCurrentWeekStartDate } from '../../../utils/coordinationModeUtils';

/**
 * useCoordinationExchange
 *
 * @description 챗봇을 통해 조율(Coordination) 시간 변경/교환 요청을 처리하는 로직을 관리하는 커스텀 훅.
 * @returns {{handleCoordinationExchange: Function}} 채팅 메시지와 컨텍스트를 받아 시간 교환을 처리하는 `handleCoordinationExchange` 함수를 포함하는 객체.
 *
 * @example
 * const { handleCoordinationExchange } = useCoordinationExchange();
 * // useChat 훅 등에서 호출됨
 * const result = await handleCoordinationExchange("원래 시간에서 2시간 뒤로 옮겨줘", context);
 */
export const useCoordinationExchange = () => {
  /**
   * handleCoordinationExchange
   * @description 채팅 메시지를 백엔드로 보내 파싱하고, 그 결과에 따라 시간 변경/교환 API를 호출합니다.
   * @param {string} message - 사용자가 입력한 채팅 메시지.
   * @param {Object} context - 현재 방 ID(`roomId`), 최근 메시지 등 필요한 컨텍스트 정보.
   * @returns {Promise<Object>} 작업 성공 여부와 사용자에게 보여줄 메시지가 담긴 객체를 반환합니다.
   */
  const handleCoordinationExchange = useCallback(async (message, context) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, message: '인증 토큰이 없습니다.' };
    }

    try {
      // Parse the message using backend Gemini API
      const parseResponse = await fetch(`${API_BASE_URL}/api/coordination/rooms/${context.roomId}/parse-exchange-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await currentUser.getIdToken()}`
        },
        body: JSON.stringify({
          message,
          recentMessages: context.recentMessages || []
        })
      });

      if (!parseResponse.ok) {
        const errorData = await parseResponse.json();
        return { success: false, message: errorData.error || '요청을 이해하지 못했습니다.' };
      }

      const { parsed } = await parseResponse.json();

      // Handle different message types
      if (parsed.type === 'time_change' || parsed.type === 'date_change') {
        // Execute immediately without confirmation

        // Call smart-exchange API directly with viewMode info
        const viewMode = getViewMode();
        const currentWeekStartDate = getCurrentWeekStartDate();

        const exchangeResponse = await fetch(`${API_BASE_URL}/api/coordination/rooms/${context.roomId}/smart-exchange`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await currentUser.getIdToken()}`
          },
          body: JSON.stringify({
            ...parsed,
            viewMode,
            currentWeekStartDate: currentWeekStartDate.toISOString()
          })
        });

        if (!exchangeResponse.ok) {
          const errorData = await exchangeResponse.json();
          return { success: false, message: errorData.message || '시간 변경에 실패했습니다.' };
        }

        const result = await exchangeResponse.json();

        // Trigger calendar update if swap was successful
        if (result.success && result.immediateSwap) {
          window.dispatchEvent(new CustomEvent('coordinationUpdate', {
            detail: { type: 'timeSwap', roomId: context.roomId }
          }));
        }

        return {
          success: true,
          message: result.message,
          immediateSwap: result.immediateSwap
        };
      } else if (parsed.type === 'confirm') {
        // Legacy confirm handler (no longer used)
        return { success: true, message: '네, 알겠습니다! 👍' };
      } else if (parsed.type === 'reject') {
        // Legacy reject handler (no longer used)
        return { success: true, message: '알겠습니다.' };
      }

      // Fallback for unknown types
      return { success: true, message: '요청을 처리했습니다.' };

    } catch (error) {
      return { success: false, message: `오류가 발생했습니다: ${error.message}` };
    }
  }, []);

  return { handleCoordinationExchange };
};