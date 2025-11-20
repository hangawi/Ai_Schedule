/**
 * 최적 조합 생성 유틸리티
 */

import { detectConflicts } from './conflictUtils';

/**
 * 충돌 없는 최적 조합 생성
 * @param {Array} schedules - 시간표 배열
 * @param {number} maxCombinations - 최대 조합 개수
 * @returns {Array} - 최적 조합들의 배열
 */
export const generateOptimalCombinations = (schedules, maxCombinations = 5) => {
  if (!schedules || schedules.length === 0) return [];

  // 스케줄 제한 제거 - 모든 스케줄 처리
  const limitedSchedules = schedules;

  // 모든 가능한 조합 생성
  const allCombinations = [];
  let iterationCount = 0;
  const MAX_ITERATIONS = 10000; // 무한 루프 방지

  // 재귀적으로 조합 생성
  const generateCombos = (current, remaining, index) => {
    iterationCount++;

    // 무한 루프 방지
    if (iterationCount > MAX_ITERATIONS) {
      return;
    }

    // 이미 충분한 조합을 찾았으면 중단
    if (allCombinations.length >= maxCombinations * 10) {
      return;
    }

    // 현재 조합에 충돌이 있는지 확인
    const conflicts = detectConflicts(current);

    // 충돌이 없으면 저장
    if (conflicts.length === 0 && current.length > 0) {
      allCombinations.push([...current]);
    }

    // 더 많은 스케줄 추가 시도
    for (let i = index; i < remaining.length; i++) {
      const newSchedule = remaining[i];
      const testCombination = [...current, newSchedule];

      // 이 스케줄을 추가했을 때 충돌 확인
      const testConflicts = detectConflicts(testCombination);

      if (testConflicts.length === 0) {
        generateCombos(testCombination, remaining, i + 1);
      }
    }
  };

  generateCombos([], limitedSchedules, 0);

  // 중복 제거: 같은 스케줄 ID 조합인지 확인
  const uniqueCombinations = [];
  const seenSignatures = new Set();

  for (const combo of allCombinations) {
    // 조합의 ID들을 정렬해서 시그니처 생성
    const signature = combo
      .map(s => `${s.title}_${s.startTime}_${s.days?.join('')}`)
      .sort()
      .join('|');

    if (!seenSignatures.has(signature)) {
      seenSignatures.add(signature);
      uniqueCombinations.push(combo);
    }
  }

  // 조합들을 스케줄 개수 기준으로 정렬 (많은 것부터)
  uniqueCombinations.sort((a, b) => b.length - a.length);

  // 상위 N개 반환
  return uniqueCombinations.slice(0, maxCombinations);
};
