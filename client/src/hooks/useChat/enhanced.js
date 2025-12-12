/**
 * ===================================================================================================
 * enhanced.js - 강화된 채팅 메시지 처리 및 일정 관리 로직을 통합한 커스텀 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks/useChat/enhanced.js
 *
 * 🎯 주요 기능:
 *    - `useChat` 훅의 강화된 버전으로, 선호시간, 반복 선호시간, 개인시간 추가 기능을 제공합니다.
 *    - Gemini LLM을 활용한 자연어 이해를 개선하여 복합적인 사용자 명령을 처리합니다.
 *    - 반복 패턴 인식 및 처리를 강화하여 유연한 일정 관리를 지원합니다.
 *    - 기존 `useChat`의 모든 기능(일정 추가/삭제/수정, 반복 일정, 범위 삭제, Coordination 시간 변경)을 포함합니다.
 *
 * 🔗 연결된 파일:
 *    - ./hooks/enhanced/usePreferredTimeAdd.js - 선호시간 추가 로직
 *    - ./hooks/enhanced/useRecurringPreferredTimeAdd.js - 반복 선호시간 추가 로직
 *    - ./hooks/enhanced/usePersonalTimeAdd.js - 개인시간 추가 로직
 *    - ./hooks/useCoordinationExchange.js - 일정맞추기 탭 교환 로직
 *    - ./handlers/enhancedIntentHandlers.js - AI 응답 기반 인텐트 처리 핸들러
 *    - client/src/components/chat/ChatBox.js - 채팅 UI 컴포넌트
 *    - server/controllers/coordinationExchangeController.js - 백엔드 일정 교환 컨트롤러
 *
 * 💡 UI 위치:
 *    - "일정맞추기" 탭의 채팅 입력창 (강화된 기능 포함)
 *    - "일반 채팅" 탭 (profile, events, googleCalendar)의 채팅 입력창 (강화된 기능 포함)
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 채팅을 통한 일정 관리 및 조율 기능 전반에 영향을 미치며, 특히 새로운 강화된 기능의 동작에 영향을 줍니다.
 *    - 새로운 강화된 인텐트(의도) 처리 추가: `createEnhancedIntentRouter`에 새로운 핸들러 및 로직 추가.
 *    - 선호/개인 시간 관련 로직 변경: 해당 `use<Type>TimeAdd` 훅 내부 로직 수정.
 *    - LLM 프롬프트 처리 방식 변경: `processEnhancedAIPrompt` 함수 로직 수정.
 *
 * 📝 참고사항:
 *    - 이 훅은 `useChat` 훅과 유사하지만, 더 많은 기능을 제공하며 `processEnhancedAIPrompt`를 통해
 *      Gemini LLM과 직접적으로 상호작용하여 사용자 발화를 해석하고 처리합니다.
 *    - 개발 및 테스트 시 콘솔 로그 (`[강화 채팅]`)를 통해 내부 동작을 추적할 수 있습니다.
 *
 * ===================================================================================================
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
 * useChatEnhanced
 *
 * @description 강화된 채팅 메시지 처리 및 일정 관리 로직을 통합한 커스텀 훅.
 *              기존 useChat 훅의 모든 기능과 더불어 선호시간, 개인시간, 반복 선호시간 추가 등의
 *              강화된 기능을 제공합니다. 사용자의 복합적인 자연어 명령을 처리하여
 *              다양한 일정 관리 액션을 실행합니다.
 * @param {boolean} isLoggedIn - 사용자의 로그인 여부. 로그인 상태에 따라 특정 기능이 제한될 수 있습니다.
 * @param {Function} setEventAddedKey - 이벤트가 추가되거나 변경되었을 때 캘린더를 갱신하기 위한 상태 업데이트 함수.
 * @param {Object} eventActions - 이벤트 관련 액션 (예: addEvent, updateEvent, deleteEvent 등)을 포함하는 객체.
 * @returns {Object} { handleChatMessage } - 강화된 채팅 메시지를 처리하는 비동기 함수 `handleChatMessage`를 반환합니다.
 *
 * @example
 * // 컴포넌트 내에서 useChatEnhanced 훅 사용 예시
 * const { handleChatMessage } = useChatEnhanced(isLoggedIn, setEventAddedKey, eventActions);
 * // 채팅 메시지 처리 (예: 선호시간 추가)
 * handleChatMessage("매주 월요일 9시부터 12시까지 선호시간으로 추가해줘", { context: 'profile' });
 *
 * @note
 * - `handleChatMessage`는 `useCallback`으로 메모이제이션되어 있어, 불필요한 렌더링을 방지합니다.
 * - `context` 객체를 통해 현재 어떤 탭(예: 'coordination', 'profile')에서 채팅이 이루어지는지 판단하여,
 *   그에 맞는 특정 로직(예: 조율 요청, 선호시간 관리)을 실행합니다.
 * - 로그인 상태와 Google API 키 유효성이 먼저 검증됩니다.
 * - 이 훅은 `useChat/index.js`의 기능을 포함하며 확장합니다.
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
   * handleChatMessage
   *
   * @description 사용자로부터 받은 채팅 메시지를 처리하고, 메시지의 컨텍스트와 내용을 기반으로 적절한
   *              강화된 일정 관리 작업을 수행합니다. 여기에는 일정 맞추기 요청, 직접 이벤트 삭제,
   *              AI 기반의 일정 추가/수정/삭제, 선호시간/개인시간 추가 등이 포함됩니다.
   * @param {string|Object} message - 사용자의 채팅 메시지. 문자열일 수도 있고, 특정 인텐트가 포함된 객체일 수도 있습니다.
   * @param {Object} context - 현재 채팅이 이루어지는 환경에 대한 정보 (예: `context: 'coordination'`, `roomId: 'abc'`).
   * @returns {Promise<Object>} 메시지 처리 결과를 포함하는 객체 (성공 여부, 메시지 등).
   *
   * @example
   * // 선호시간 추가 요청 처리
   * const result = await handleChatMessage("이번주 화요일 10시부터 12시까지 선호시간으로 추가해줘", { context: 'profile' });
   * console.log(result); // { success: true, message: "선호시간이 성공적으로 추가되었습니다." }
   *
   * // Coordination 룸에서 시간 변경 요청 처리
   * const coordinationResult = await handleChatMessage("목요일 오전 9시로 시간 변경해줘", { context: 'coordination', roomId: 'room456' });
   * console.log(coordinationResult);
   *
   * @note
   * - `context.context === 'coordination'`인 경우, `handleCoordinationExchange`를 통해 조율 관련 로직을 우선 처리합니다.
   * - `message`가 특정 `intent`와 `eventId`를 포함하는 객체인 경우, AI를 거치지 않고 `handleDirectDeletion`으로 직접 삭제를 시도합니다.
   * - 로그인 상태 및 `REACT_APP_MY_GOOGLE_KEY` 환경 변수의 유효성을 검증하여 권한 및 기능 제한을 관리합니다.
   * - `processEnhancedAIPrompt`를 통해 Gemini LLM 모델과 통신하여 사용자 발화의 인텐트를 파악합니다.
   * - `createEnhancedIntentRouter`를 사용하여 AI가 파악한 인텐트에 따라 적절한 강화된 훅(예: `handlePreferredTimeAdd`, `handlePersonalTimeAdd`)을 호출합니다.
   * - `console.log`를 통해 요청 및 AI 응답, 최종 결과를 추적할 수 있습니다.
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
