/**
 * ============================================================================
 * useChat - 채팅 메시지 처리 훅 (리팩터링 버전)
 * ============================================================================
 *
 * 🔴 중요: 일정맞추기(Coordination) 탭의 시간 변경 기능이 여기에 구현되어 있음!
 *
 * [일정맞추기 탭 채팅 기능]
 * - 조건: context.context === 'coordination' && context.roomId
 * - 기능: 조원이 채팅으로 배정 시간 변경 가능
 * - 예시: "수요일로 바꿔줘", "월요일 9시로 바꿔줘"
 * - API: /api/coordination/rooms/:roomId/parse-exchange-request
 *        /api/coordination/rooms/:roomId/smart-exchange
 *
 * [다른 탭 기능]
 * - profile, events, googleCalendar: 일반 일정 추가/수정/삭제
 *
 * 관련 파일:
 * - UI: client/src/components/chat/ChatBox.js
 * - 백엔드: server/controllers/coordinationExchangeController.js
 * ============================================================================
 */

import { useCallback } from 'react';

// Hooks
import { useCoordinationExchange } from './hooks/useCoordinationExchange';
import { useDirectEventDeletion } from './hooks/useDirectEventDeletion';
import { useRecurringEventAdd } from './hooks/useRecurringEventAdd';
import { useEventAdd } from './hooks/useEventAdd';
import { useEventDelete } from './hooks/useEventDelete';
import { useRangeDeletion } from './hooks/useRangeDeletion';
import { useEventEdit } from './hooks/useEventEdit';

// Handlers
import {
  createIntentRouter,
  processAIPrompt,
  validateApiKey,
  handleError
} from './handlers/createIntentHandlers';

/**
 * 채팅 메시지 처리 훅
 * @param {boolean} isLoggedIn - 로그인 여부
 * @param {Function} setEventAddedKey - 이벤트 갱신 함수
 * @param {Object} eventActions - 이벤트 액션 객체
 * @returns {Object} { handleChatMessage }
 */
export const useChat = (isLoggedIn, setEventAddedKey, eventActions) => {
  // ===== 기능별 훅 초기화 =====
  const { handleCoordinationExchange } = useCoordinationExchange();
  const { handleDirectDeletion } = useDirectEventDeletion(setEventAddedKey);
  const { handleRecurringEventAdd } = useRecurringEventAdd(eventActions, setEventAddedKey);
  const { handleEventAdd } = useEventAdd(eventActions, setEventAddedKey);
  const { handleEventDelete } = useEventDelete(setEventAddedKey);
  const { handleRangeDeletion } = useRangeDeletion(setEventAddedKey);
  const { handleEventEdit } = useEventEdit(setEventAddedKey);

  /**
   * 채팅 메시지 처리 함수
   * @param {string|Object} message - 메시지 또는 메시지 객체
   * @param {Object} context - 컨텍스트 정보
   * @returns {Object} 처리 결과
   */
  const handleChatMessage = useCallback(async (message, context = {}) => {
    // 🔧 Coordination room time change request
    if (context.context === 'coordination' && context.roomId) {
      return await handleCoordinationExchange(message, context);
    }

    // Direct deletion intent, bypassing AI
    if (typeof message === 'object' && message.intent === 'delete_specific_event' && message.eventId) {
      return await handleDirectDeletion(message, context);
    }

    // ===== 로그인 및 API 키 검증 =====
    if (!isLoggedIn) {
      return { success: false, message: '로그인이 필요합니다.' };
    }

    const API_KEY = process.env.REACT_APP_MY_GOOGLE_KEY || 'AIzaSyCzHlB4yeFRas3uDGVjJcwxo3npR784txc';
    const apiKeyError = validateApiKey(API_KEY);
    if (apiKeyError) {
      return apiKeyError;
    }

    try {
      // ===== AI 프롬프트 처리 =====
      const chatResponse = await processAIPrompt(message, context, API_KEY);

      // ===== Intent별 핸들러 라우팅 =====
      const intentRouter = createIntentRouter({
        handleRecurringEventAdd,
        handleRangeDeletion,
        handleEventAdd,
        handleEventDelete,
        handleEventEdit
      });

      return await intentRouter(chatResponse, context, message);

    } catch (error) {
      return handleError(error);
    }
  }, [
    isLoggedIn,
    handleCoordinationExchange,
    handleDirectDeletion,
    handleRecurringEventAdd,
    handleRangeDeletion,
    handleEventAdd,
    handleEventDelete,
    handleEventEdit
  ]);

  return { handleChatMessage };
};
