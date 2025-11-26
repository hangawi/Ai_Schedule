/**
 * 랭킹 계산 헬퍼 함수
 */

const { isThisWeek, isThisMonth } = require('../utils/dateUtils');
const { calculateStreak } = require('../utils/streakCalculator');

/**
 * 학생 랭킹 계산
 */
function calculateRankings(learningHistoryMap, period = 'all') {
  const rankings = [];

  // 모든 학생의 데이터 수집
  for (const [studentId, history] of learningHistoryMap.entries()) {
    if (history.length === 0) continue;

    // 기간별 필터링
    let filteredHistory = history;
    if (period === 'week') {
      filteredHistory = history.filter(r => isThisWeek(new Date(r.timestamp)));
    } else if (period === 'month') {
      filteredHistory = history.filter(r => isThisMonth(new Date(r.timestamp)));
    }

    if (filteredHistory.length === 0) continue;

    const totalQuestions = filteredHistory.length;
    const correctAnswers = filteredHistory.filter(h => h.correct).length;
    const accuracy = (correctAnswers / totalQuestions) * 100;
    const totalTime = filteredHistory.reduce((sum, h) => sum + (h.timeSpent || 0), 0);
    const avgTime = totalTime / totalQuestions;
    const streak = calculateStreak(history);

    // 종합 점수 계산 (정답률 70% + 문제수 20% + 연속일 10%)
    const score = (accuracy * 0.7) + (Math.min(totalQuestions / 100, 1) * 100 * 0.2) + (Math.min(streak / 30, 1) * 100 * 0.1);

    rankings.push({
      studentId,
      studentName: studentId.replace('student', '학생 '),
      totalQuestions,
      correctAnswers,
      accuracy: accuracy.toFixed(1),
      avgTime: Math.round(avgTime),
      streak,
      score: Math.round(score)
    });
  }

  // 종합 점수로 정렬
  rankings.sort((a, b) => b.score - a.score);

  // 랭킹 번호 추가
  rankings.forEach((rank, index) => {
    rank.rank = index + 1;
  });

  return rankings;
}

module.exports = {
  calculateRankings
};
