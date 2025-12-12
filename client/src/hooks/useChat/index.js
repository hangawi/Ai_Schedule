/**
 * ===================================================================================================
 * useChat/index.js - 채팅 메시지 처리 및 일정 관리 로직을 통합한 커스텀 훅
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks/useChat/index.js
 *
 * 🎯 주요 기능:
 *    - 사용자의 채팅 메시지를 분석하고 적절한 일정 관리 액션 (추가, 수정, 삭제) 실행
 *    - "일정맞추기(Coordination)" 탭에서의 시간 변경 요청 처리
 *    - 일반 탭 (profile, events, googleCalendar)에서의 일정 추가/수정/삭제 처리
 *    - 직접 삭제 요청 (AI 개입 없이) 처리
 *    - 로그인 및 API 키 유효성 검사
 *    - Gemini AI를 활용한 자연어 처리 및 인텐트 라우팅
 *
 * 🔗 연결된 파일:
 *    - ./hooks/useCoordinationExchange.js - 일정맞추기 탭 교환 로직
 *    - ./hooks/useDirectEventDeletion.js - 직접 이벤트 삭제 로직
 *    - ./hooks/useRecurringEventAdd.js - 반복 이벤트 추가 로직
 *    - ./hooks/useEventAdd.js - 이벤트 추가 로직
 *    - ./hooks/useEventDelete.js - 이벤트 삭제 로직
 *    - ./hooks/useRangeDeletion.js - 범위 삭제 로직
 *    - ./hooks/useEventEdit.js - 이벤트 수정 로직
 *    - ./hooks/enhanced/usePreferredTimeAdd.js - 선호 시간 추가 로직
 *    - ./hooks/enhanced/usePersonalTimeAdd.js - 개인 시간 추가 로직
 *    - ./hooks/enhanced/useRecurringPreferredTimeAdd.js - 반복 선호 시간 추가 로직
 *    - ./handlers/enhancedIntentHandlers.js - AI 응답 기반 인텐트 처리 핸들러
 *    - client/src/components/chat/ChatBox.js - 채팅 UI 컴포넌트
 *    - server/controllers/coordinationExchangeController.js - 백엔드 일정 교환 컨트롤러
 *
 * 💡 UI 위치:
 *    - "일정맞추기" 탭의 채팅 입력창
 *    - "일반 채팅" 탭 (profile, events, googleCalendar)의 채팅 입력창
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 채팅을 통한 일정 관리 및 조율 기능 전반에 영향을 미침.
 *    - 새로운 인텐트(의도) 처리 추가: `createEnhancedIntentRouter`에 새로운 핸들러 및 로직 추가.
 *    - 기존 인텐트 로직 변경: 해당 `use<Intent>Add/Delete/Edit` 훅 내부 로직 수정.
 *    - `handleChatMessage` 함수 내의 조건부 로직을 수정하여 특정 컨텍스트(예: `coordination`)에 대한 처리 방식을 변경.
 *
 * 📝 참고사항:
 *    - 🔴 중요: 일정맞추기(Coordination) 탭의 시간 변경 기능이 여기에 구현되어 있음.
 *    - 일정맞추기 탭의 채팅은 `/api/coordination/rooms/:roomId/parse-exchange-request` 및 `/api/coordination/rooms/:roomId/smart-exchange` API를 사용.
 *    - 로그인하지 않은 경우 또는 API 키가 유효하지 않은 경우, 메시지 처리가 제한됨.
 *    - 복합 명령어(Enhanced)를 지원하여 사용자 의도를 더 정확하게 파악하고 처리함.
 *
 * ===================================================================================================
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

// 🆕 Enhanced Hooks (선호시간/개인시간)
import { usePreferredTimeAdd } from './hooks/enhanced/usePreferredTimeAdd';
import { usePersonalTimeAdd } from './hooks/enhanced/usePersonalTimeAdd';
import { useRecurringPreferredTimeAdd } from './hooks/enhanced/useRecurringPreferredTimeAdd';

// Handlers (신버전 - 복합 명령어 지원)
import {
  createEnhancedIntentRouter,
  processEnhancedAIPrompt,
  validateApiKey,
  handleError
} from './handlers/enhancedIntentHandlers';

/**
 * useChat
 *
 * @description 채팅 메시지 처리 및 일정 관리 로직을 통합한 커스텀 훅.
 *              사용자의 입력에 따라 일정 추가/수정/삭제 및 조율 관련 기능을 수행합니다.
 * @param {boolean} isLoggedIn - 사용자의 로그인 여부. 로그인 상태에 따라 특정 기능이 제한될 수 있습니다.
 * @param {Function} setEventAddedKey - 이벤트가 추가되거나 변경되었을 때 캘린더를 갱신하기 위한 상태 업데이트 함수.
 * @param {Object} eventActions - 이벤트 관련 액션 (예: addEvent, updateEvent, deleteEvent 등)을 포함하는 객체.
 * @returns {Object} { handleChatMessage } - 채팅 메시지를 처리하는 비동기 함수 `handleChatMessage`를 반환합니다.
 *
 * @example
 * // 컴포넌트 내에서 useChat 훅 사용 예시
 * const { handleChatMessage } = useChat(isLoggedIn, setEventAddedKey, eventActions);
 * // 채팅 메시지 처리
 * handleChatMessage("내일 오후 3시에 회의 추가해줘", { context: 'events' });
 *
 * @note
 * - `handleChatMessage`는 `useCallback`으로 메모이제이션되어 있어, 불필요한 렌더링을 방지합니다.
 * - `context` 객체를 통해 현재 어떤 탭(예: 'coordination', 'profile')에서 채팅이 이루어지는지 판단하여,
 *   그에 맞는 특정 로직(예: 조율 요청, 일반 일정 관리)을 실행합니다.
 * - 로그인 상태와 Google API 키 유효성이 먼저 검증됩니다.
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

  // 🆕 Enhanced 훅 초기화 (선호시간/개인시간)
  const { handlePreferredTimeAdd } = usePreferredTimeAdd(setEventAddedKey);
  const { handlePersonalTimeAdd } = usePersonalTimeAdd(setEventAddedKey);
  const { handleRecurringPreferredTimeAdd } = useRecurringPreferredTimeAdd(setEventAddedKey);

  /**
   * handleChatMessage
   *
   * @description 사용자로부터 받은 채팅 메시지를 처리하고, 메시지의 컨텍스트와 내용을 기반으로 적절한
   *              일정 관리 작업을 수행합니다. 여기에는 일정 맞추기 요청, 직접 이벤트 삭제,
   *              AI 기반의 일정 추가/수정/삭제 등이 포함됩니다.
   * @param {string|Object} message - 사용자의 채팅 메시지. 문자열일 수도 있고, 특정 인텐트가 포함된 객체일 수도 있습니다.
   * @param {Object} context - 현재 채팅이 이루어지는 환경에 대한 정보 (예: `context: 'coordination'`, `roomId: 'abc'`).
   * @returns {Promise<Object>} 메시지 처리 결과를 포함하는 객체 (성공 여부, 메시지 등).
   *
   * @example
   * // 일반적인 텍스트 메시지 처리
   * const result = await handleChatMessage("내일 오후 2시에 미팅 추가해줘");
   * console.log(result); // { success: true, message: "일정이 성공적으로 추가되었습니다." }
   *
   * // 특정 컨텍스트(예: 조율 룸)에서의 메시지 처리
   * const coordinationResult = await handleChatMessage("수요일로 바꿔줘", { context: 'coordination', roomId: 'room123' });
   * console.log(coordinationResult);
   *
   * // 직접 삭제 인텐트 메시지 처리
   * const deletionResult = await handleChatMessage({ intent: 'delete_specific_event', eventId: 'event456' }, {});
   * console.log(deletionResult);
   *
   * @note
   * - `context.context === 'coordination'`인 경우, `handleCoordinationExchange`를 통해 조율 관련 로직을 우선 처리합니다.
   * - `message`가 특정 `intent`와 `eventId`를 포함하는 객체인 경우, AI를 거치지 않고 `handleDirectDeletion`으로 직접 삭제를 시도합니다.
   * - 로그인 상태 및 `REACT_APP_MY_GOOGLE_KEY` 환경 변수의 유효성을 검증하여 권한 및 기능 제한을 관리합니다.
   * - `processEnhancedAIPrompt`를 통해 Gemini AI 모델과 통신하여 사용자 발화의 인텐트를 파악합니다.
   * - `createEnhancedIntentRouter`를 사용하여 AI가 파악한 인텐트에 따라 적절한 훅(예: `handleEventAdd`, `handlePreferredTimeAdd`)을 호출합니다.
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

    const API_KEY = process.env.REACT_APP_MY_GOOGLE_KEY;
    const apiKeyError = validateApiKey(API_KEY);
    if (apiKeyError) {
      return apiKeyError;
    }

    try {
      // ===== AI 프롬프트 처리 (Enhanced) =====
      const chatResponse = await processEnhancedAIPrompt(message, context, API_KEY);

      // ===== Intent별 핸들러 라우팅 (Enhanced - 복합 명령어 지원) =====
      const intentRouter = createEnhancedIntentRouter({
        handleRecurringEventAdd,
        handleRangeDeletion,
        handleEventAdd,
        handleEventDelete,
        handleEventEdit,
        // 🆕 선호시간/개인시간 핸들러
        handlePreferredTimeAdd,
        handlePersonalTimeAdd,
        handleRecurringPreferredTimeAdd
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
    handleEventEdit,
    // 🆕 Enhanced 핸들러
    handlePreferredTimeAdd,
    handlePersonalTimeAdd,
    handleRecurringPreferredTimeAdd
  ]);

  return { handleChatMessage };
};
