/**
 * ============================================================================
 * 강화된 Intent 핸들러 (Enhanced Intent Handlers)
 * ============================================================================
 *
 * 신규 기능들을 위한 Intent 라우팅:
 * - add_preferred_time: 선호시간 추가
 * - add_recurring_preferred_time: 반복 선호시간 추가
 * - add_personal_time: 개인시간 추가
 * - 기존 기능들도 지원 (하위 호환성)
 * ============================================================================
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { parseAIResponse } from '../../../utils';
import { generateEnhancedPrompt } from '../prompts/unifiedPrompt';

/**
 * 강화된 Intent 핸들러 생성
 * @param {Object} handlers - 각 intent별 핸들러 함수들
 * @returns {Function} intent 라우팅 함수
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
async function routeSingleAction(action, context, message, handlers) {
    const { intent } = action;

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
      return await handlers.handleEventEdit(action, context);
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
 * 강화된 AI 프롬프트 처리 및 응답 파싱
 * @param {string} message - 사용자 메시지
 * @param {Object} context - 컨텍스트
 * @param {string} apiKey - Gemini API 키
 * @returns {Object} 파싱된 AI 응답
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
 * API 키 검증
 * @param {string} apiKey
 * @returns {Object|null} 에러 객체 또는 null
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
 * 에러 처리
 * @param {Error} error
 * @returns {Object} 에러 응답
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
