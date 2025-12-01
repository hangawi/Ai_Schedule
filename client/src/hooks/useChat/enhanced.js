/**
 * ============================================================================
 * useChatEnhanced - 강화된 채팅 메시지 처리 훅
 * ============================================================================
 *
 * 🆕 신규 기능:
 * - 선호시간 추가 (add_preferred_time)
 * - 반복 선호시간 추가 (add_recurring_preferred_time)
 * - 개인시간 추가 (add_personal_time)
 * - 강화된 LLM 프롬프트 (자연어 이해 개선)
 * - 반복 패턴 지원 강화
 *
 * 🔧 기존 기능:
 * - 일정 추가/삭제/수정
 * - 반복 일정
 * - 범위 삭제
 * - Coordination 시간 변경
 *
 * ============================================================================
 */

import { useCallback } from 'react';

// 신규 Enhanced 훅들
import { usePreferredTimeAdd } from './hooks/enhanced/usePreferredTimeAdd';
import { useRecurringPreferredTimeAdd } from './hooks/enhanced/useRecurringPreferredTimeAdd';
import { usePersonalTimeAdd } from './hooks/enhanced/usePersonalTimeAdd';

// 기존 훅들 (재사용)
import { useCoordinationExchange } from './hooks/useCoordinationExchange';
import { useDirectEventDeletion } from './hooks/useDirectEventDeletion';
import { useRecurringEventAdd } from './hooks/useRecurringEventAdd';
import { useEventAdd } from './hooks/useEventAdd';
import { useEventDelete } from './hooks/useEventDelete';
import { useRangeDeletion } from './hooks/useRangeDeletion';
import { useEventEdit } from './hooks/useEventEdit';

// 강화된 핸들러들
import {
  createEnhancedIntentRouter,
  processEnhancedAIPrompt,
  validateApiKey,
  handleError
} from './handlers/enhancedIntentHandlers';

/**
 * 강화된 채팅 메시지 처리 훅
 * @param {boolean} isLoggedIn - 로그인 여부
 * @param {Function} setEventAddedKey - 이벤트 갱신 함수
 * @param {Object} eventActions - 이벤트 액션 객체
 * @returns {Object} { handleChatMessage }
 */
export const useChatEnhanced = (isLoggedIn, setEventAddedKey, eventActions) => {
  // ===== 신규 기능별 훅 초기화 =====
  const { handlePreferredTimeAdd } = usePreferredTimeAdd(setEventAddedKey);
  const { handleRecurringPreferredTimeAdd } = useRecurringPreferredTimeAdd(setEventAddedKey);
  const { handlePersonalTimeAdd } = usePersonalTimeAdd(setEventAddedKey);

  // ===== 기존 기능별 훅 초기화 =====
  const { handleCoordinationExchange } = useCoordinationExchange();
  const { handleDirectDeletion } = useDirectEventDeletion(setEventAddedKey);
  const { handleRecurringEventAdd } = useRecurringEventAdd(eventActions, setEventAddedKey);
  const { handleEventAdd } = useEventAdd(eventActions, setEventAddedKey);
  const { handleEventDelete } = useEventDelete(setEventAddedKey);
  const { handleRangeDeletion } = useRangeDeletion(setEventAddedKey);
  const { handleEventEdit } = useEventEdit(setEventAddedKey);

  /**
   * 강화된 채팅 메시지 처리 함수
   * @param {string|Object} message - 메시지 또는 메시지 객체
   * @param {Object} context - 컨텍스트 정보
   * @returns {Object} 처리 결과
   */
  const handleChatMessage = useCallback(async (message, context = {}) => {
    console.log('[강화 채팅] 요청:', message, context);

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

    const API_KEY = process.env.REACT_APP_MY_GOOGLE_KEY;
    const apiKeyError = validateApiKey(API_KEY);
    if (apiKeyError) {
      return apiKeyError;
    }

    try {
      // ===== 강화된 AI 프롬프트 처리 =====
      const chatResponse = await processEnhancedAIPrompt(message, context, API_KEY);

      console.log('[강화 채팅] AI 응답:', chatResponse);

      // ===== 강화된 Intent별 핸들러 라우팅 =====
      const intentRouter = createEnhancedIntentRouter({
        // 신규 핸들러들
        handlePreferredTimeAdd,
        handleRecurringPreferredTimeAdd,
        handlePersonalTimeAdd,
        // 기존 핸들러들
        handleRecurringEventAdd,
        handleRangeDeletion,
        handleEventAdd,
        handleEventDelete,
        handleEventEdit
      });

      const result = await intentRouter(chatResponse, context, message);

      console.log('[강화 채팅] 최종 결과:', result);

      return result;

    } catch (error) {
      console.error('[강화 채팅] 오류:', error);
      return handleError(error);
    }
  }, [
    isLoggedIn,
    handleCoordinationExchange,
    handleDirectDeletion,
    handlePreferredTimeAdd,
    handleRecurringPreferredTimeAdd,
    handlePersonalTimeAdd,
    handleRecurringEventAdd,
    handleRangeDeletion,
    handleEventAdd,
    handleEventDelete,
    handleEventEdit
  ]);

  return { handleChatMessage };
};
