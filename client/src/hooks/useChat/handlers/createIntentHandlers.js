/**
 * ===================================================================================================
 * createIntentHandlers.js - AI 응답의 인텐트를 기반으로 적절한 핸들러를 호출하는 라우팅 및 AI 프롬프트 처리 유틸리티
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/hooks/useChat/handlers/createIntentHandlers.js
 *
 * 🎯 주요 기능:
 *    - `createIntentRouter`: AI 모델이 파악한 사용자 의도(intent)에 따라 미리 정의된 핸들러 함수를 동적으로 호출합니다.
 *    - `processAIPrompt`: 사용자 메시지와 컨텍스트를 기반으로 AI 프롬프트를 생성하고, Gemini AI 모델에 요청하여 응답을 파싱합니다.
 *    - `validateApiKey`: Gemini API 키의 유효성을 검증합니다.
 *    - `handleError`: AI 응답 처리 중 발생할 수 있는 다양한 오류(API 키 오류, 응답 형식 오류 등)를 처리합니다.
 *
 * 🔗 연결된 파일:
 *    - client/src/hooks/useChat/index.js - `useChat` 훅에서 이 파일의 함수들을 사용하여 AI 채팅 로직을 구현합니다.
 *    - client/src/hooks/useChat/hooks/*.js - 다양한 인텐트에 대한 실제 처리 로직을 담고 있는 훅 파일들.
 *    - client/src/hooks/useChat/utils/index.js - AI 프롬프트 생성 및 파싱 유틸리티 (`generateAIPrompt`, `parseAIResponse`).
 *    - server/controllers/chatbotController.js - 백엔드 챗봇 컨트롤러 (관련될 수 있음).
 *
 * 💡 UI 위치:
 *    - 직접적인 UI 요소는 없지만, 채팅 UI (`client/src/components/chat/ChatBox.js`)에서 사용자 메시지 처리 로직의 핵심 부분으로 사용됩니다.
 *
 * ✏️ 수정 가이드:
 *    - 이 파일을 수정하면: AI 채팅 기능의 사용자 의도 파악 및 응답 처리 방식이 변경됩니다.
 *    - 새로운 인텐트 추가: `createIntentRouter` 내에 해당 인텐트에 대한 `if` 문과 핸들러 호출 로직을 추가합니다.
 *    - AI 모델 변경 또는 프롬프트 개선: `processAIPrompt` 함수 내의 `model` 설정 또는 `generateAIPrompt` 호출 로직을 수정합니다.
 *    - 에러 처리 로직 확장: `handleError` 함수에 새로운 에러 유형 및 처리 로직을 추가합니다.
 *
 * 📝 참고사항:
 *    - `processAIPrompt` 함수는 Gemini AI 모델 (`gemini-2.0-flash`)을 사용하며, 응답 시간 초과를 방지하기 위한 `Promise.race`가 적용되어 있습니다.
 *    - AI 응답이 올바른 JSON 형식이 아닐 경우를 대비한 기본적인 유효성 검사 로직이 포함되어 있습니다.
 *
 * ===================================================================================================
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateAIPrompt, parseAIResponse } from '../../../utils';

/**
 * createIntentRouter
 *
 * @description AI 모델이 파악한 `chatResponse`의 `intent`에 따라 미리 정의된 핸들러 함수를 호출하는 라우터 함수를 생성합니다.
 *              각 인텐트에 해당하는 로직을 중앙에서 관리하고 분배하는 역할을 합니다.
 * @param {Object} handlers - 각 인텐트별로 실행될 비동기 핸들러 함수들을 담고 있는 객체.
 *                            예: `{ handleRecurringEventAdd, handleRangeDeletion, handleEventAdd, ... }`
 * @returns {Function} `(chatResponse, context, message) => Promise<Object>` 형태의 비동기 라우터 함수를 반환합니다.
 *                     이 함수는 AI 응답의 인텐트를 분석하여 해당 핸들러를 실행하고 그 결과를 반환합니다.
 *
 * @example
 * // 사용 예시
 * const intentRouter = createIntentRouter({
 *   handleRecurringEventAdd: (response, ctx) => { ... },
 *   handleEventAdd: (response, ctx) => { ... }
 * });
 * const result = await intentRouter(aiResponse, currentContext, userMessage);
 *
 * @note
 * - 인텐트 처리 순서가 중요할 수 있으며, 현재는 특정 인텐트에 대해 우선적으로 처리하도록 구성되어 있습니다.
 * - `chatResponse`는 AI 모델로부터 파싱된 응답 객체이며, `intent` 필드를 포함해야 합니다.
 * - `context`는 현재 애플리케이션의 상태 정보를 제공하며, `message`는 원본 사용자 메시지입니다.
 */
export const createIntentRouter = (handlers) => {
  return async (chatResponse, context, message) => {
    const { intent } = chatResponse;

    // 반복 일정 추가
    if (intent === 'add_recurring_event' && chatResponse.dates && chatResponse.dates.length > 0) {
      return await handlers.handleRecurringEventAdd(chatResponse, context);
    }

    // 범위 삭제
    if (intent === 'delete_range' && chatResponse.startDate && chatResponse.endDate) {
      return await handlers.handleRangeDeletion(chatResponse, context);
    }

    // 일정 추가
    if (intent === 'add_event' && chatResponse.startDateTime) {
      return await handlers.handleEventAdd(chatResponse, context);
    }

    // 일정 삭제
    if ((intent === 'delete_event' || intent === 'delete_range') && chatResponse.startDateTime) {
      return await handlers.handleEventDelete(chatResponse, context, message);
    }

    // 일정 수정
    if (intent === 'edit_event') {
      return await handlers.handleEventEdit(chatResponse, context);
    }

    // 명확화 요청
    if (intent === 'clarification') {
      return { success: true, message: chatResponse.response };
    }

    // 기본 응답
    return {
      success: true,
      message: chatResponse.response || '처리했어요!',
      data: chatResponse
    };
  };
};

/**
 * processAIPrompt
 *
 * @description 사용자 메시지와 현재 컨텍스트를 기반으로 AI 프롬프트를 생성하고,
 *              Google Gemini AI 모델(`gemini-2.0-flash`)에 요청하여 응답을 받아 파싱합니다.
 *              응답 시간 제한(5초)을 두어 장시간 대기를 방지합니다.
 * @param {string} message - 사용자가 입력한 원본 채팅 메시지.
 * @param {Object} context - 현재 애플리케이션의 상태 및 사용자 컨텍스트 (예: 로그인 여부, 활성 탭 등).
 * @param {string} apiKey - Google Gemini API 접근을 위한 API 키.
 * @returns {Promise<Object>} AI 모델로부터 파싱된 응답 객체를 반환합니다. 이 객체는 `intent` 및 관련 데이터 필드를 포함합니다.
 * @throws {Error} API 키가 유효하지 않거나, AI 응답 시간이 초과되거나, 응답 형식이 올바르지 않은 경우 오류를 발생시킵니다.
 *
 * @example
 * // 사용 예시
 * const aiResponse = await processAIPrompt("내일 오후 3시에 회의 있어", { userId: '123' }, "YOUR_GEMINI_API_KEY");
 * console.log(aiResponse.intent); // 'add_event'
 *
 * @note
 * - `generateAIPrompt` 함수는 별도의 유틸리티에서 프롬프트 템플릿을 생성합니다.
 * - `parseAIResponse` 함수는 AI의 텍스트 응답을 JSON 객체로 변환합니다.
 * - 응답 시간이 5초를 초과하면 요청이 자동으로 취소됩니다.
 * - AI 응답의 `intent` 필드가 없거나, `date`, `deleted` 필드만 있는 경우 잘못된 응답으로 간주하고 오류를 발생시킵니다.
 */
export const processAIPrompt = async (message, context, apiKey) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = generateAIPrompt(message, context);

  const startTime = performance.now();
  const result = await Promise.race([
    model.generateContent(prompt),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('응답 시간이 너무 길어 요청을 취소했습니다. 다시 시도해주세요.')), 5000)
    )
  ]);
  const endTime = performance.now();

  if (result instanceof Error) {
    throw result;
  }

  const response = await result.response;
  const text = response.text();
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
