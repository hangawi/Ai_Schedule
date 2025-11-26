/**
 * 통계 계산 헬퍼 함수
 */

const { isToday, isThisWeek, isThisMonth } = require('../utils/dateUtils');
const { calculateStreak } = require('../utils/streakCalculator');

/**
 * 유형별 통계 계산
 */
function calculateTypeStats(history) {
  const typeStats = {};

  history.forEach(record => {
    const type = record.questionData.type;

    if (!typeStats[type]) {
      typeStats[type] = { total: 0, correct: 0, incorrect: 0 };
    }

    typeStats[type].total++;
    if (record.correct) {
      typeStats[type].correct++;
    } else {
      typeStats[type].incorrect++;
    }
  });

  return typeStats;
}

/**
 * 난이도별 통계 계산
 */
function calculateDifficultyStats(history) {
  const difficultyStats = {};

  history.forEach(record => {
    const difficulty = record.questionData.difficulty;

    if (!difficultyStats[difficulty]) {
      difficultyStats[difficulty] = { total: 0, correct: 0, incorrect: 0 };
    }

    difficultyStats[difficulty].total++;
    if (record.correct) {
      difficultyStats[difficulty].correct++;
    } else {
      difficultyStats[difficulty].incorrect++;
    }
  });

  return difficultyStats;
}

/**
 * 대시보드 KPI 계산
 */
function calculateKPI(filteredHistory) {
  const totalQuestions = filteredHistory.length;
  const correctAnswers = filteredHistory.filter(h => h.correct).length;
  const accuracy = totalQuestions > 0 ? ((correctAnswers / totalQuestions) * 100).toFixed(1) : 0;
  const totalTime = filteredHistory.reduce((sum, h) => sum + (h.timeSpent || 0), 0);
  const avgTime = totalQuestions > 0 ? Math.round(totalTime / totalQuestions) : 0;

  return {
    totalQuestions,
    correctAnswers,
    incorrectAnswers: totalQuestions - correctAnswers,
    accuracy: parseFloat(accuracy),
    totalTime,
    avgTime
  };
}

/**
 * 유형별 상세 통계 계산 (정답률, 평균 시간 포함)
 */
function calculateDetailedTypeStats(filteredHistory) {
  const typeStats = {};
  const types = ['addition', 'subtraction', 'multiplication', 'division'];

  types.forEach(type => {
    const typeRecords = filteredHistory.filter(r => r.questionData.type === type);
    const typeCorrect = typeRecords.filter(r => r.correct).length;

    typeStats[type] = {
      total: typeRecords.length,
      correct: typeCorrect,
      incorrect: typeRecords.length - typeCorrect,
      accuracy: typeRecords.length > 0 ? ((typeCorrect / typeRecords.length) * 100).toFixed(1) : 0,
      avgTime: typeRecords.length > 0 ? Math.round(typeRecords.reduce((sum, r) => sum + (r.timeSpent || 0), 0) / typeRecords.length) : 0
    };
  });

  return typeStats;
}

/**
 * 기간별 학습 이력 필터링
 */
function filterHistoryByPeriod(history, period) {
  if (period === 'day') {
    return history.filter(r => isToday(new Date(r.timestamp)));
  } else if (period === 'week') {
    return history.filter(r => isThisWeek(new Date(r.timestamp)));
  } else if (period === 'month') {
    return history.filter(r => isThisMonth(new Date(r.timestamp)));
  }
  return history;
}

/**
 * 최근 오답 추출
 */
function getRecentWrong(filteredHistory, limit = 10) {
  return filteredHistory
    .filter(h => !h.correct)
    .reverse()
    .slice(0, limit)
    .map(h => ({
      question: h.questionData.question,
      answer: h.questionData.answer,
      studentAnswer: h.studentAnswer,
      type: h.questionData.type,
      difficulty: h.questionData.difficulty,
      timeSpent: h.timeSpent,
      timestamp: h.timestamp
    }));
}

/**
 * 일별 학습 추이 계산
 */
function calculateDailyTrends(history, days = 7) {
  const trends = [];

  for (let i = parseInt(days) - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const dayRecords = history.filter(r => {
      const recordDate = new Date(r.timestamp);
      return recordDate.toDateString() === date.toDateString();
    });

    const correct = dayRecords.filter(r => r.correct).length;

    trends.push({
      date: date.toISOString().split('T')[0],
      label: ['일', '월', '화', '수', '목', '금', '토'][date.getDay()],
      total: dayRecords.length,
      correct,
      incorrect: dayRecords.length - correct,
      accuracy: dayRecords.length > 0 ? ((correct / dayRecords.length) * 100).toFixed(1) : 0,
      avgTime: dayRecords.length > 0 ? Math.round(dayRecords.reduce((sum, r) => sum + (r.timeSpent || 0), 0) / dayRecords.length) : 0
    });
  }

  return trends;
}

/**
 * 전체 대시보드 데이터 생성
 */
function generateDashboardData(studentId, history, period = 'week') {
  if (history.length === 0) {
    return {
      studentId,
      hasData: false,
      message: '학습 데이터가 없습니다.'
    };
  }

  const filteredHistory = filterHistoryByPeriod(history, period);
  const kpi = calculateKPI(filteredHistory);
  const typeStats = calculateDetailedTypeStats(filteredHistory);
  const recentWrong = getRecentWrong(filteredHistory);
  const streak = calculateStreak(history);

  return {
    studentId,
    hasData: true,
    period,
    kpi: { ...kpi, streak },
    typeStats,
    recentWrong,
    lastUpdated: new Date()
  };
}

module.exports = {
  calculateTypeStats,
  calculateDifficultyStats,
  calculateKPI,
  calculateDetailedTypeStats,
  filterHistoryByPeriod,
  getRecentWrong,
  calculateDailyTrends,
  generateDashboardData
};
