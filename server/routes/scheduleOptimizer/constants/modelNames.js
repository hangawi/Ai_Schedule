// Gemini AI 모델 리스트

const GEMINI_MODEL_NAMES_LEGACY = [
  'gemini-2.0-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash-002',
  'gemini-1.5-flash-001',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro'
];

const GEMINI_MODEL_NAMES_CHAT = [
  'gemini-2.0-flash',
  'gemini-1.5-flash'
];

const GENERATION_CONFIG = {
  maxOutputTokens: 2048,
  temperature: 0.1
};

module.exports = {
  GEMINI_MODEL_NAMES_LEGACY,
  GEMINI_MODEL_NAMES_CHAT,
  GENERATION_CONFIG
};
