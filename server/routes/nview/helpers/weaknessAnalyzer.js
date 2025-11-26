/**
 * 학생 약점 분석 헬퍼 함수
 */

const { getTypeText } = require('../constants/typeMapping');

/**
 * 약점 유형 찾기 (정답률 60% 미만)
 */
function findWeaknesses(typeStats) {
  const weaknesses = [];

  Object.keys(typeStats).forEach(type => {
    const stat = typeStats[type];
    const typeAccuracy = (stat.correct / stat.total) * 100;

    if (typeAccuracy < 60) {
      weaknesses.push({
        type,
        accuracy: typeAccuracy.toFixed(1),
        total: stat.total,
        correct: stat.correct,
        incorrect: stat.incorrect
      });
    }
  });

  return weaknesses;
}

/**
 * 가장 약한 유형 찾기 (맞춤형 문제 생성용)
 */
function findWeakestType(history) {
  if (history.length === 0) return null;

  const typeStats = {};

  history.forEach(record => {
    const type = record.questionData.type;
    if (!typeStats[type]) {
      typeStats[type] = { total: 0, correct: 0 };
    }
    typeStats[type].total++;
    if (record.correct) typeStats[type].correct++;
  });

  let lowestAccuracy = 100;
  let weakType = null;

  Object.keys(typeStats).forEach(type => {
    const stat = typeStats[type];
    const accuracy = (stat.correct / stat.total) * 100;

    if (accuracy < lowestAccuracy && stat.total >= 2) { // 최소 2문제 이상
      lowestAccuracy = accuracy;
      weakType = type;
    }
  });

  return weakType;
}

/**
 * 약점이 없을 때 랜덤 유형 선택
 */
function getRandomType() {
  const types = ['addition', 'subtraction', 'multiplication', 'division'];
  return types[Math.floor(Math.random() * types.length)];
}

/**
 * Fallback 분석 메시지 생성
 */
function generateFallbackAnalysis(accuracy, weaknesses) {
  let analysisText = '📊 학습 분석 (데모 모드)\n\n';

  // 1. 전체 학습 수준
  analysisText += `1️⃣ 전체 학습 수준: `;
  if (accuracy >= 80) {
    analysisText += '매우 우수합니다! 꾸준히 학습하고 있습니다.\n\n';
  } else if (accuracy >= 60) {
    analysisText += '잘 하고 있습니다. 조금 더 연습하면 더 좋아질 거예요!\n\n';
  } else {
    analysisText += '기초부터 차근차근 다시 학습해봅시다.\n\n';
  }

  // 2. 주요 약점
  analysisText += '2️⃣ 주요 약점: ';
  if (weaknesses.length > 0) {
    const weakTypeNames = {
      addition: '덧셈',
      subtraction: '뺄셈',
      multiplication: '곱셈',
      division: '나눗셈'
    };
    const weakTypes = weaknesses.map(w => weakTypeNames[w.type] || w.type).join(', ');
    analysisText += `${weakTypes} 문제에서 어려움을 겪고 있습니다.\n\n`;
  } else {
    analysisText += '모든 유형을 고르게 잘 풀고 있습니다.\n\n';
  }

  // 3. 개선 방향
  analysisText += '3️⃣ 개선 방향:\n';
  if (weaknesses.length > 0) {
    analysisText += `- ${weaknesses[0].type} 유형의 기본 문제부터 다시 연습해보세요\n`;
    analysisText += '- 천천히 정확하게 푸는 연습이 필요합니다\n';
  } else {
    analysisText += '- 현재 수준을 유지하면서 조금 더 어려운 문제에 도전해보세요\n';
    analysisText += '- 다양한 유형의 문제를 골고루 풀어보세요\n';
  }

  // 4. 학습 전략
  analysisText += '\n4️⃣ 학습 전략:\n';
  analysisText += '- 매일 10-15분씩 꾸준히 연습하세요\n';
  analysisText += '- 틀린 문제는 다시 한 번 풀어보세요\n';
  analysisText += '- 자신감을 가지고 문제를 풀어보세요!\n';

  return analysisText;
}

/**
 * 최근 틀린 문제 추출
 */
function getRecentIncorrect(history, limit = 5) {
  return history.filter(h => !h.correct).slice(-limit);
}

module.exports = {
  findWeaknesses,
  findWeakestType,
  getRandomType,
  generateFallbackAnalysis,
  getRecentIncorrect
};
