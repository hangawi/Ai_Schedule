/**
 * 학습 연속일 계산 유틸리티
 */

/**
 * 학습 이력을 기반으로 연속 학습일 계산
 */
function calculateStreak(history) {
  if (history.length === 0) return 0;

  const dates = [...new Set(history.map(h => new Date(h.timestamp).toDateString()))].sort();
  let streak = 1;
  let currentStreak = 1;

  for (let i = dates.length - 1; i > 0; i--) {
    const current = new Date(dates[i]);
    const previous = new Date(dates[i - 1]);
    const diffDays = Math.floor((current - previous) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      currentStreak++;
      streak = Math.max(streak, currentStreak);
    } else {
      break;
    }
  }

  return currentStreak;
}

module.exports = {
  calculateStreak
};
