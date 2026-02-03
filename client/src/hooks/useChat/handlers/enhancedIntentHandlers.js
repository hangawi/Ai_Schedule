/**
 * ===================================================================================================
 * enhancedIntentHandlers.js - 강화된 AI 응답의 인텐트를 기반으로 적절한 핸들러를 호출하는 라우팅 및 AI 프롬프트 처리 유틸리티
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks/useChat/handlers/enhancedIntentHandlers.js
 *
 * 🎯 주요 기능:
 *    - `createEnhancedIntentRouter`: AI 모델이 파악한 복합적인 사용자 의도(intent) 및 액션 배열에 따라
 *      미리 정의된 핸들러 함수들을 동적으로 호출합니다. 선호시간, 반복 선호시간, 개인시간 추가 등 강화된 인텐트를 처리합니다.
 *    - `routeSingleAction`: 단일 액션을 처리하기 위해 개별 인텐트별 핸들러를 호출합니다.
 *    - `processEnhancedAIPrompt`: 사용자 메시지와 컨텍스트를 기반으로 강화된 AI 프롬프트를 생성하고,
 *      Google Gemini AI 모델에 요청하여 응답을 파싱합니다.
 *    - `validateApiKey`: Gemini API 키의 유효성을 검증합니다.
 *    - `handleError`: AI 응답 처리 중 발생할 수 있는 다양한 오류를 처리합니다.
 *
 * 🔗 연결된 파일:
 *    - client/src/hooks/useChat/enhanced.js - `useChatEnhanced` 훅에서 이 파일의 함수들을 사용하여 강화된 AI 채팅 로직을 구현합니다.
 *    - client/src/hooks/useChat/hooks/enhanced/*.js - 강화된 인텐트에 대한 실제 처리 로직을 담고 있는 훅 파일들.
 *    - client/src/hooks/useChat/prompts/unifiedPrompt.js - 강화된 AI 프롬프트 생성을 위한 템플릿 (`generateEnhancedPrompt`).
 *    - client/src/utils/index.js - AI 응답 파싱 유틸리티 (`parseAIResponse`).
 *
 * 💡 UI 위치:
 *    - 직접적인 UI 요소는 없지만, 채팅 UI (`client/src/components/chat/ChatBox.js`)에서 사용자 메시지 처리 로직의 핵심 부분으로 사용됩니다.
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: 강화된 AI 채팅 기능의 사용자 의도 파악 및 응답 처리 방식이 변경됩니다.
 *    - 새로운 강화된 인텐트 추가: `routeSingleAction` 내에 해당 인텐트에 대한 `if` 문과 핸들러 호출 로직을 추가합니다.
 *    - 복합 명령어 처리 로직 개선: `createEnhancedIntentRouter` 내 `chatResponse.actions` 처리 로직을 수정합니다.
 *    - AI 모델 변경 또는 프롬프트 개선: `processEnhancedAIPrompt` 함수 내의 `model` 설정 또는 `generateEnhancedPrompt` 호출 로직을 수정합니다.
 *
 * 📝 참고사항:
 *    - 이 핸들러는 `useChat/index.js`의 `createIntentHandlers.js`보다 더 복합적인 인텐트와 액션 처리를 지원합니다.
 *    - 복합 명령어의 경우, 개별 액션의 성공/실패 여부를 추적하고 통합된 응답을 생성합니다.
 *    - 개발 및 테스트 시 콘솔 로그 (`[복합 명령어]`, `[액션]`, `[강화 LLM 응답 시간]`)를 통해 내부 동작을 추적할 수 있습니다.
 *
 * ===================================================================================================
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { parseAIResponse } from '../../../utils';
import { generateEnhancedPrompt } from '../prompts/unifiedPrompt';

/**
 * createEnhancedIntentRouter
 *
 * @description AI 모델이 파악한 `chatResponse`의 `intent` 또는 `actions` 배열을 기반으로
 *              적절한 핸들러 함수를 호출하는 강화된 라우터 함수를 생성합니다.
 *              복합 명령어를 지원하여 여러 개의 액션을 순차적으로 처리할 수 있습니다.
 * @param {Object} handlers - 각 인텐트별로 실행될 비동기 핸들러 함수들을 담고 있는 객체.
 *                            예: `{ handlePreferredTimeAdd, handleRecurringEventAdd, handleEventAdd, ... }`
 * @returns {Function} `(chatResponse, context, message) => Promise<Object>` 형태의 비동기 라우터 함수를 반환합니다.
 *                     이 함수는 AI 응답의 인텐트 또는 액션들을 분석하여 해당 핸들러를 실행하고 그 결과를 반환합니다.
 *
 * @example
 * // 사용 예시
 * const enhancedIntentRouter = createEnhancedIntentRouter({
 *   handlePreferredTimeAdd: (response, ctx) => { ... },
 *   handleEventAdd: (response, ctx) => { ... }
 * });
 * // 단일 액션 처리
 * const result1 = await enhancedIntentRouter(singleAiResponse, currentContext, userMessage);
 * // 복합 액션 처리
 * const result2 = await enhancedIntentRouter(multiActionAiResponse, currentContext, userMessage);
 *
 * @note
 * - `chatResponse.actions` 배열이 존재하는 경우, 각 액션을 `routeSingleAction`을 통해 개별적으로 처리합니다.
 * - 각 액션의 성공/실패 여부를 추적하여 최종적으로 통합된 응답을 생성합니다.
 * - `chatResponse`는 AI 모델로부터 파싱된 응답 객체이며, `intent` 또는 `actions` 필드를 포함해야 합니다.
 * - `context`는 현재 애플리케이션의 상태 정보를 제공하며, `message`는 원본 사용자 메시지입니다.
 */
export const createEnhancedIntentRouter = (handlers) => {
  return async (chatResponse, context, message) => {
    // 🆕 복합 명령어 처리 (actions 배열)
    if (chatResponse.actions && Array.isArray(chatResponse.actions)) {
      console.log('🔀 [복합 명령어] 감지:', chatResponse.actions.length, '개 액션');

      const results = [];
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < chatResponse.actions.length; i++) {
        const action = chatResponse.actions[i];
        console.log(`\n📌 [액션 ${i + 1}/${chatResponse.actions.length}]`, action.intent);

        try {
          // 각 액션을 개별적으로 처리
          const actionResult = await routeSingleAction(action, context, message, handlers);
          results.push(actionResult);

          if (actionResult.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error(`❌ [액션 ${i + 1}] 오류:`, error);
          failCount++;
          results.push({ success: false, message: error.message });
        }
      }

      console.log(`\n✅ [복합 명령어 완료] 성공: ${successCount}개, 실패: ${failCount}개`);

      // 통합 응답 생성
      if (successCount === chatResponse.actions.length) {
        return {
          success: true,
          message: chatResponse.response || `${successCount}개의 일정을 처리했어요!`,
          data: { results, successCount, failCount }
        };
      } else if (successCount > 0) {
        return {
          success: true,
          message: `${successCount}개는 성공했지만, ${failCount}개는 실패했어요.`,
          data: { results, successCount, failCount }
        };
      } else {
        return {
          success: false,
          message: '모든 액션이 실패했어요.',
          data: { results, successCount, failCount }
        };
      }
    }

    // 단일 명령어 처리 (기존 로직)
    return await routeSingleAction(chatResponse, context, message, handlers);
  };
};

/**
 * 단일 액션 라우팅
 * @param {Object} action - 액션 객체
 * @param {Object} context - 컨텍스트
 * @param {string} message - 원본 메시지
 * @param {Object} handlers - 핸들러 객체
 * @returns {Object} 처리 결과
 */
/**
 * routeSingleAction
 *
 * @description AI 모델이 파악한 단일 액션(`action` 객체)의 `intent`에 따라
 *              미리 정의된 핸들러 함수를 호출합니다.
 *              선호시간, 반복 선호시간, 개인시간 추가 등 강화된 인텐트와 기존 인텐트를 모두 처리합니다.
 * @param {Object} action - AI 모델로부터 파싱된 단일 액션 객체. `intent` 필드를 포함해야 합니다.
 * @param {Object} context - 현재 애플리케이션의 상태 및 사용자 컨텍스트.
 * @param {string} message - 사용자가 입력한 원본 채팅 메시지.
 * @param {Object} handlers - 각 인텐트별로 실행될 비동기 핸들러 함수들을 담고 있는 객체.
 * @returns {Promise<Object>} 액션 처리 결과를 포함하는 객체를 반환합니다.
 *
 * @example
 * // 사용 예시 (createEnhancedIntentRouter 내부에서 호출됨)
 * const actionResult = await routeSingleAction(
 *   { intent: 'add_preferred_time', startDateTime: '...' },
 *   currentContext,
 *   userMessage,
 *   handlers
 * );
 *
 * @note
 * - `handlers` 객체는 `useChatEnhanced` 훅에서 초기화된 모든 핸들러 함수들을 포함합니다.
 * - `add_preferred_time`, `add_recurring_preferred_time`, `add_personal_time` 등 새로운 인텐트들을 우선적으로 검사합니다.
 * - `clarification` 인텐트나 `error` 인텐트가 감지되면, 해당 응답 메시지를 즉시 반환합니다.
 * - `originalDate`나 `startDateTime`이 없는 `edit_event`는 처리하지 않습니다.
 */
async function routeSingleAction(action, context, message, handlers) {
    const { intent } = action;

    // 🔄 구글 캘린더 사용자: 모든 추가 intent를 handleEventAdd로 라우팅 (구글 캘린더에 저장)
    const isGoogleCalendarUser = context.tabType === 'google';
    if (isGoogleCalendarUser) {
      // 단일 일정 추가 (선호시간/개인시간/일반 일정 모두 구글 캘린더로)
      if (action.startDateTime &&
          (intent === 'add_preferred_time' || intent === 'add_personal_time' || intent === 'add_event')) {
        console.log(`[Google Calendar] ${intent} → handleEventAdd로 리다이렉트`);
        return await handlers.handleEventAdd(action, context);
      }
      // 반복 선호시간도 반복 일정으로 라우팅 (handleRecurringEventAdd는 이미 구글 캘린더 지원)
      if (intent === 'add_recurring_preferred_time' && action.dates) {
        console.log(`[Google Calendar] ${intent} → handleRecurringEventAdd로 리다이렉트`);
        return await handlers.handleRecurringEventAdd(action, context);
      }
    }

    // 🆕 선호시간 추가
    if (intent === 'add_preferred_time' && action.startDateTime) {
      return await handlers.handlePreferredTimeAdd(action, context);
    }

    // 🆕 반복 선호시간 추가
    if (intent === 'add_recurring_preferred_time' && action.dates) {
      return await handlers.handleRecurringPreferredTimeAdd(action, context);
    }

    // 🆕 개인시간 추가
    if (intent === 'add_personal_time' && action.startDateTime) {
      return await handlers.handlePersonalTimeAdd(action, context);
    }

    // 기존 반복 일정 추가
    if (intent === 'add_recurring_event' && action.dates && action.dates.length > 0) {
      return await handlers.handleRecurringEventAdd(action, context);
    }

    // 기존 범위 삭제
    if (intent === 'delete_range' && action.startDate && action.endDate) {
      return await handlers.handleRangeDeletion(action, context);
    }

    // 기존 일정 추가
    if (intent === 'add_event' && action.startDateTime) {
      return await handlers.handleEventAdd(action, context);
    }

    // 기존 일정 삭제
    if ((intent === 'delete_event' || intent === 'delete_range') && (action.startDateTime || action.date)) {
      return await handlers.handleEventDelete(action, context, message);
    }

    // 기존 일정 수정
    if (intent === 'edit_event' && (action.originalDate || action.startDateTime)) {
      return await handlers.handleEventEdit(action, context, message);
    }

    // 명확화 요청
    if (intent === 'clarification') {
      return { success: true, message: action.response };
    }

    // 오류 처리
    if (intent === 'error') {
      return { success: false, message: action.response };
    }

    // 기본 응답
    return {
      success: true,
      message: action.response || '처리했어요!',
      data: action
    };
}

/**
 * processEnhancedAIPrompt
 *
 * @description 사용자 메시지와 현재 컨텍스트를 기반으로 강화된 AI 프롬프트를 생성하고,
 *              Google Gemini AI 모델(`gemini-2.0-flash`)에 요청하여 응답을 받아 파싱합니다.
 *              응답 시간 제한(5초)을 두어 장시간 대기를 방지하며, LLM 응답 시간과 원본 응답을 로깅합니다.
 * @param {string} message - 사용자가 입력한 원본 채팅 메시지.
 * @param {Object} context - 현재 애플리케이션의 상태 및 사용자 컨텍스트 (예: 로그인 여부, 활성 탭 등).
 * @param {string} apiKey - Google Gemini AI 접근을 위한 API 키.
 * @returns {Promise<Object>} AI 모델로부터 파싱된 응답 객체를 반환합니다. 이 객체는 `intent`, `actions` 및 관련 데이터 필드를 포함합니다.
 * @throws {Error} API 키가 유효하지 않거나, AI 응답 시간이 초과되거나, 응답 형식이 올바르지 않은 경우 오류를 발생시킵니다.
 *
 * @example
 * // 사용 예시
 * const aiResponse = await processEnhancedAIPrompt("내일 오전 9시부터 11시까지 개인 시간 추가해줘", { userId: '123' }, "YOUR_GEMINI_API_KEY");
 * console.log(aiResponse.actions[0].intent); // 'add_personal_time'
 *
 * @note
 * - `generateEnhancedPrompt` 함수는 별도의 유틸리티에서 강화된 프롬프트 템플릿을 생성합니다.
 * - `parseAIResponse` 함수는 AI의 텍스트 응답을 JSON 객체로 변환합니다.
 * - 응답 시간이 5초를 초과하면 요청이 자동으로 취소됩니다.
 * - AI 응답의 `intent` 필드가 없거나, `date`, `deleted` 필드만 있는 경우 잘못된 응답으로 간주하고 오류를 발생시킵니다.
 * - 콘솔에 `[강화 LLM 응답 시간]`과 `[강화 LLM 원본 응답]`이 로깅되어 디버깅에 유용합니다.
 */
export const processEnhancedAIPrompt = async (message, context, apiKey) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // 강화된 프롬프트 사용
  const prompt = generateEnhancedPrompt(message, context);

  const startTime = performance.now();
  const result = await Promise.race([
    model.generateContent(prompt),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('응답 시간이 너무 길어 요청을 취소했습니다. 다시 시도해주세요.')), 5000)
    )
  ]);
  const endTime = performance.now();

  console.log(`[강화 LLM 응답 시간] ${(endTime - startTime).toFixed(0)}ms`);

  if (result instanceof Error) {
    throw result;
  }

  const response = await result.response;
  const text = response.text();

  console.log('[강화 LLM 원본 응답]', text);

  const chatResponse = parseAIResponse(text);

  // 잘못된 JSON 형식 감지 및 수정
  if (!chatResponse.intent && (chatResponse.date || chatResponse.deleted)) {
    throw new Error('AI 응답 형식이 올바르지 않습니다. 다시 시도해주세요.');
  }

  return chatResponse;
};

/**
 * validateApiKey
 *
 * @description Google Gemini API 키의 유효성을 검증합니다.
 *              API 키가 존재하고 최소 길이를 만족하는지 확인합니다.
 * @param {string} apiKey - 검증할 Google Gemini API 키.
 * @returns {Object|null} API 키가 유효하지 않으면 에러 메시지가 포함된 객체를 반환하고, 유효하면 `null`을 반환합니다.
 *
 * @example
 * // 사용 예시
 * const error = validateApiKey(process.env.REACT_APP_MY_GOOGLE_KEY);
 * if (error) {
 *   console.error(error.message); // "Gemini API Key가 설정되지 않았습니다." 또는 "AI 서비스 설정에 문제가 있습니다..."
 * } else {
 *   console.log("API Key 유효함.");
 * }
 *
 * @note
 * - API 키는 비어 있거나 공백만으로 구성되어서는 안 됩니다.
 * - 현재는 30자 미만의 길이를 가진 API 키를 유효하지 않다고 판단합니다.
 * - 이 함수는 클라이언트 측에서 AI 서비스 호출 전에 기본적인 유효성 검사를 수행하여 불필요한 API 요청을 방지합니다.
 */
export const validateApiKey = (apiKey) => {
  if (!apiKey || apiKey.trim().length === 0) {
    return { success: false, message: 'Gemini API Key가 설정되지 않았습니다.' };
  }

  if (apiKey.length < 30) {
    return { success: false, message: 'AI 서비스 설정에 문제가 있습니다. 관리자에게 문의해주세요.' };
  }

  return null;
};

/**
 * handleError
 *
 * @description AI 응답 처리 과정에서 발생할 수 있는 다양한 에러를 분류하고,
 *              사용자에게 친숙한 에러 메시지를 반환합니다.
 * @param {Error} error - 발생한 에러 객체. `Error` 인스턴스여야 합니다.
 * @returns {Object} `success: false`와 에러 메시지를 포함하는 객체를 반환합니다.
 *
 * @example
 * // 사용 예시
 * try {
 *   // ... AI 프롬프트 처리 로직 ...
 * } catch (error) {
 *   const errorResponse = handleError(error);
 *   console.error(errorResponse.message); // "AI 서비스에 문제가 있습니다. 관리자에게 문의해주세요."
 * }
 *
 * @note
 * - API 키 관련 에러, AI 응답의 `SyntaxError`, 일반적인 에러를 구분하여 처리합니다.
 * - 특정 키워드(예: 'API key not valid')를 포함하는 에러 메시지를 통해 AI 서비스 관련 문제를 감지합니다.
 * - 이 함수는 사용자 경험을 개선하기 위해 기술적인 에러 메시지를 일반적이고 이해하기 쉬운 메시지로 변환합니다.
 */
export const handleError = (error) => {
  if (error.message.includes('API key not valid') ||
      error.message.includes('API_KEY_INVALID') ||
      error.message.includes('invalid API key') ||
      error.message.includes('Unauthorized')) {
    return {
      success: false,
      message: 'AI 서비스에 문제가 있습니다. 관리자에게 문의해주세요.'
    };
  }

  if (error instanceof SyntaxError) {
    return { success: false, message: 'AI 응답 형식 오류입니다. 다시 시도해주세요.' };
  }

  return { success: false, message: `오류: ${error.message}` };
};
