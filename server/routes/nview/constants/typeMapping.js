/**
 * 문제 타입 및 난이도 텍스트 매핑
 */

// 문제 타입 → 한글 변환
const TYPE_TO_KOREAN = {
  addition: '덧셈',
  subtraction: '뺄셈',
  multiplication: '곱셈',
  division: '나눗셈',
  korean_word: '국어 단어',
  english_word: '영어 단어',
  synonym: '유의어',
  antonym: '반의어',
  person: '인물',
  animal: '동물',
  object: '사물'
};

// 난이도 → 한글 변환
const DIFFICULTY_TO_KOREAN = {
  easy: '쉬운',
  medium: '중간',
  hard: '어려운'
};

// 난이도 → 학년 수준 변환
const DIFFICULTY_TO_GRADE = {
  easy: '초등 1~2학년',
  medium: '초등 3~4학년',
  hard: '초등 5~6학년'
};

/**
 * 문제 타입을 한글로 변환
 */
function getTypeText(type) {
  return TYPE_TO_KOREAN[type] || type;
}

/**
 * 난이도를 한글로 변환
 */
function getDifficultyText(difficulty) {
  return DIFFICULTY_TO_KOREAN[difficulty] || '중간';
}

/**
 * 난이도를 학년 수준으로 변환
 */
function getGradeText(difficulty) {
  return DIFFICULTY_TO_GRADE[difficulty] || '초등 3~4학년';
}

module.exports = {
  TYPE_TO_KOREAN,
  DIFFICULTY_TO_KOREAN,
  DIFFICULTY_TO_GRADE,
  getTypeText,
  getDifficultyText,
  getGradeText
};
