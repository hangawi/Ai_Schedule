/**
 * Gemini AI 프롬프트 템플릿
 */

const { getTypeText, getDifficultyText, getGradeText } = require('./typeMapping');

/**
 * Bingo 게임용 문제 생성 프롬프트
 */
function getBingoPrompt(difficulty, type) {
  const diffText = getDifficultyText(difficulty);
  const typeText = getTypeText(type);

  return `당신은 초등학교 수학 교사입니다.
${diffText} 난이도의 ${typeText} 문제를 1개 생성해주세요.

반드시 다음 JSON 형식으로만 답변하세요:
{"question": "문제내용", "answer": "정답"}

예시: {"question": "5 + 3 = ?", "answer": "8"}`;
}

/**
 * Voca 게임용 문제 생성 프롬프트
 */
function getVocaPrompt(difficulty, type) {
  const gradeText = getGradeText(difficulty);

  if (type === 'korean_word') {
    return `당신은 초등학교 국어 교사입니다.
${gradeText} 수준의 국어 단어 뜻을 묻는 문제를 1개 생성해주세요.

반드시 다음 JSON 형식으로만 답변하세요:
{"question": "다음 단어의 뜻은? '단어'", "answer": "뜻 설명"}

예시: {"question": "다음 단어의 뜻은? '기쁘다'", "answer": "즐겁고 흐뭇한 느낌이다"}`;
  }

  if (type === 'english_word') {
    return `당신은 초등학교 영어 교사입니다.
${gradeText} 수준의 영어 단어 뜻을 묻는 문제를 1개 생성해주세요.

반드시 다음 JSON 형식으로만 답변하세요:
{"question": "What does 'word' mean?", "answer": "한글 뜻"}

예시: {"question": "What does 'happy' mean?", "answer": "기쁜, 행복한"}`;
  }

  if (type === 'synonym') {
    return `당신은 초등학교 국어 교사입니다.
${gradeText} 수준의 유의어 찾기 문제를 1개 생성해주세요.

반드시 다음 JSON 형식으로만 답변하세요:
{"question": "'단어'의 유의어는?", "answer": "유의어"}

예시: {"question": "'즐겁다'의 유의어는?", "answer": "기쁘다"}`;
  }

  if (type === 'antonym') {
    return `당신은 초등학교 국어 교사입니다.
${gradeText} 수준의 반의어 찾기 문제를 1개 생성해주세요.

반드시 다음 JSON 형식으로만 답변하세요:
{"question": "'단어'의 반의어는?", "answer": "반의어"}

예시: {"question": "'크다'의 반의어는?", "answer": "작다"}`;
  }

  return '';
}

/**
 * WhoAmI 게임용 문제 생성 프롬프트
 */
function getWhoAmIPrompt(difficulty, type) {
  const diffText = getDifficultyText(difficulty);

  if (type === 'person') {
    return `당신은 초등학교 교사입니다.
${diffText} 난이도의 인물 추리 문제를 1개 생성해주세요.

반드시 다음 JSON 형식으로만 답변하세요:
{"question": "나는 누구일까요? 힌트: (인물 특징)", "answer": "인물 이름"}

예시: {"question": "나는 누구일까요? 힌트: 한국의 위대한 과학자, 거북선을 만들었어요", "answer": "이순신"}`;
  }

  if (type === 'animal') {
    return `당신은 초등학교 교사입니다.
${diffText} 난이도의 동물 추리 문제를 1개 생성해주세요.

반드시 다음 JSON 형식으로만 답변하세요:
{"question": "나는 누구일까요? 힌트: (동물 특징)", "answer": "동물 이름"}

예시: {"question": "나는 누구일까요? 힌트: 목이 길고 점무늬가 있어요", "answer": "기린"}`;
  }

  if (type === 'object') {
    return `당신은 초등학교 교사입니다.
${diffText} 난이도의 사물 추리 문제를 1개 생성해주세요.

반드시 다음 JSON 형식으로만 답변하세요:
{"question": "나는 무엇일까요? 힌트: (사물 특징)", "answer": "사물 이름"}

예시: {"question": "나는 무엇일까요? 힌트: 시간을 알려주고, 손목에 차요", "answer": "시계"}`;
  }

  return '';
}

/**
 * 맞춤형 문제 생성 프롬프트 (약점 보완용)
 */
function getPersonalizedPrompt(difficulty, weakType) {
  const diffText = getDifficultyText(difficulty);
  const typeText = getTypeText(weakType);

  return `당신은 초등학교 수학 교사입니다.
이 학생은 ${typeText} 문제에 약점이 있습니다.
${diffText} 난이도의 ${typeText} 문제를 1개 생성해주세요.

학생의 약점을 보완할 수 있도록 명확하고 이해하기 쉬운 문제를 만들어주세요.

반드시 다음 JSON 형식으로만 답변하세요:
{"question": "문제내용", "answer": "정답"}

예시: {"question": "5 + 3 = ?", "answer": "8"}`;
}

/**
 * 학습 분석 프롬프트
 */
function getAnalysisPrompt(stats) {
  const { totalQuestions, correctAnswers, incorrectAnswers, accuracy, typeStats, incorrectQuestions } = stats;

  const typeStatsText = Object.keys(typeStats).map(type => {
    const stat = typeStats[type];
    const typeAcc = ((stat.correct / stat.total) * 100).toFixed(1);
    return `- ${type}: ${stat.total}문제 (정답률 ${typeAcc}%)`;
  }).join('\n');

  const incorrectQuestionsText = incorrectQuestions.map((q, i) =>
    `${i+1}. ${q.questionData.question} (정답: ${q.questionData.answer}, 학생 답: ${q.studentAnswer})`
  ).join('\n');

  return `당신은 초등학교 수학 교육 전문가입니다.
다음 학생의 학습 데이터를 분석하고, 약점과 개선 방향을 제시해주세요.

**학습 통계:**
- 총 문제 수: ${totalQuestions}개
- 정답: ${correctAnswers}개
- 오답: ${incorrectAnswers}개
- 정답률: ${accuracy}%

**유형별 통계:**
${typeStatsText}

**최근 틀린 문제들:**
${incorrectQuestionsText}

다음 형식으로 분석해주세요:
1. 전체적인 학습 수준 평가
2. 주요 약점 (어떤 유형의 문제를 어려워하는지)
3. 틀린 문제들의 공통 패턴
4. 구체적인 개선 방향 및 학습 전략
5. 다음에 집중해야 할 문제 유형

간결하고 구체적으로 작성해주세요.`;
}

/**
 * 게임 타입별 프롬프트 생성
 */
function getPromptByGameType(game_type, difficulty, type) {
  if (game_type === 'voca') {
    return getVocaPrompt(difficulty, type);
  }

  if (game_type === 'whoami') {
    return getWhoAmIPrompt(difficulty, type);
  }

  // bingo
  return getBingoPrompt(difficulty, type);
}

module.exports = {
  getBingoPrompt,
  getVocaPrompt,
  getWhoAmIPrompt,
  getPersonalizedPrompt,
  getAnalysisPrompt,
  getPromptByGameType
};
