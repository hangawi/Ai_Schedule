const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GEMINI_MODEL_NAMES_LEGACY, GEMINI_MODEL_NAMES_CHAT, GENERATION_CONFIG } = require('../constants/modelNames');

// Gemini AI 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Gemini AI 호출 (여러 모델 시도)
 */
async function callGeminiAI(prompt, modelNames = GEMINI_MODEL_NAMES_LEGACY, config = null) {
  let aiResponse = null;
  let lastError = null;

  for (const modelName of modelNames) {
    try {
      const modelConfig = config ? { model: modelName, generationConfig: config } : { model: modelName };
      const model = genAI.getGenerativeModel(modelConfig);
      const result = await model.generateContent(prompt);
      const response = await result.response;
      aiResponse = response.text();
      break;
    } catch (error) {
      lastError = error;
      continue;
    }
  }

  if (!aiResponse) {
    throw lastError || new Error('모든 모델 시도 실패');
  }

  return aiResponse;
}

/**
 * Chat용 Gemini AI 호출
 */
async function callGeminiChat(prompt) {
  return callGeminiAI(prompt, GEMINI_MODEL_NAMES_CHAT, GENERATION_CONFIG);
}

module.exports = {
  callGeminiAI,
  callGeminiChat
};
