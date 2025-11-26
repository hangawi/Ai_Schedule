/**
 * Gemini AI 서비스
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getPromptByGameType, getPersonalizedPrompt, getAnalysisPrompt } = require('../constants/promptTemplates');

// Gemini API 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

/**
 * AI 응답에서 JSON 파싱
 */
function parseAIResponse(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('JSON 형식을 찾을 수 없습니다');
  }
  return JSON.parse(jsonMatch[0]);
}

/**
 * AI로 문제 생성
 */
async function generateQuestionWithAI(game_type, difficulty, type) {
  const prompt = getPromptByGameType(game_type, difficulty, type);
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return parseAIResponse(text);
}

/**
 * AI로 맞춤형 문제 생성 (약점 보완)
 */
async function generatePersonalizedQuestionWithAI(difficulty, weakType) {
  const prompt = getPersonalizedPrompt(difficulty, weakType);
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return parseAIResponse(text);
}

/**
 * AI로 학습 분석 리포트 생성
 */
async function generateAnalysisWithAI(stats) {
  const prompt = getAnalysisPrompt(stats);
  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * 일일 문제 5개 생성 (배치)
 */
async function generateDailyQuestionsWithAI(difficulty = 'medium') {
  const questionTypes = ['addition', 'subtraction', 'multiplication', 'division'];
  const generatedQuestions = [];

  for (let i = 0; i < 5; i++) {
    const type = questionTypes[i % questionTypes.length];

    try {
      const questionData = await generateQuestionWithAI('bingo', difficulty, type);
      generatedQuestions.push({
        ...questionData,
        type,
        difficulty,
        questionIndex: i
      });
    } catch (error) {
      // AI 실패 시 null 반환 (fallback은 호출하는 쪽에서 처리)
      throw error;
    }
  }

  return generatedQuestions;
}

module.exports = {
  parseAIResponse,
  generateQuestionWithAI,
  generatePersonalizedQuestionWithAI,
  generateAnalysisWithAI,
  generateDailyQuestionsWithAI
};
