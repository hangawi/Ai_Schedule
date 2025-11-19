/**
 * ============================================================================
 * timeRecommendation.js - 시간 추천 알고리즘
 * ============================================================================
 */

import { SEARCH_OFFSETS, TIME_CONSTRAINTS, MAX_RECOMMENDATIONS } from '../constants/chatConstants';

/**
 * 대체 시간 추천 생성
 */
export const generateAlternativeTimeRecommendations = (
  pendingEvent,
  existingEvents = []
) => {
  const requestedStart = new Date(pendingEvent.startTime);
  const requestedEnd = new Date(pendingEvent.endTime);
  const duration = (requestedEnd - requestedStart) / (60 * 1000); // 분 단위 계산
  const recommendations = [];

  for (const offset of SEARCH_OFFSETS) {
    const candidateStart = new Date(requestedStart.getTime() + offset * 60 * 1000);
    const candidateEnd = new Date(candidateStart.getTime() + duration * 60 * 1000);

    // 시간 제약 확인
    if (candidateStart.getHours() < TIME_CONSTRAINTS.MIN_HOUR ||
        candidateStart.getHours() >= TIME_CONSTRAINTS.MAX_HOUR) continue;

    // 같은 날짜인지 확인
    if (candidateStart.getDate() !== requestedStart.getDate()) continue;

    // 충돌 확인
    const hasConflict = existingEvents.some(event => {
      const eventStart = new Date(event.startTime || event.start?.dateTime);
      const eventEnd = new Date(event.endTime || event.end?.dateTime);
      return candidateStart < eventEnd && candidateEnd > eventStart;
    });

    if (hasConflict) continue;

    // 시간 라벨 생성
    const hourLabel = candidateStart.getHours();
    const minuteLabel = candidateStart.getMinutes();
    const timeLabel = `${hourLabel}시${minuteLabel > 0 ? ` ${minuteLabel}분` : ''}`;

    recommendations.push({
      startTime: candidateStart.toISOString(),
      endTime: candidateEnd.toISOString(),
      display: `${timeLabel} (${candidateStart.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} - ${candidateEnd.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})`
    });

    if (recommendations.length >= MAX_RECOMMENDATIONS) break;
  }

  return recommendations;
};

/**
 * 기존 일정을 옮길 시간 추천 생성
 */
export const generateRescheduleTimeRecommendations = (
  conflictingEvent,
  existingEvents = []
) => {
  const originalStart = new Date(conflictingEvent.startTime);
  const duration = (new Date(conflictingEvent.endTime) - originalStart) / (60 * 1000);
  const recommendations = [];

  for (const offset of SEARCH_OFFSETS) {
    const candidateStart = new Date(originalStart.getTime() + offset * 60 * 1000);
    const candidateEnd = new Date(candidateStart.getTime() + duration * 60 * 1000);

    // 시간 제약 확인
    if (candidateStart.getHours() < TIME_CONSTRAINTS.MIN_HOUR ||
        candidateStart.getHours() >= TIME_CONSTRAINTS.MAX_HOUR) continue;

    // 같은 날짜인지 확인
    if (candidateStart.getDate() !== originalStart.getDate()) continue;

    // 충돌 확인 (자기 자신은 제외)
    const hasConflict = existingEvents.some(event => {
      if (event.id === conflictingEvent.id) return false;
      const eventStart = new Date(event.startTime || event.start?.dateTime);
      const eventEnd = new Date(event.endTime || event.end?.dateTime);
      return candidateStart < eventEnd && candidateEnd > eventStart;
    });

    if (hasConflict) continue;

    // 시간 라벨 생성
    const hourLabel = candidateStart.getHours();
    const minuteLabel = candidateStart.getMinutes();
    const timeLabel = `${hourLabel}시${minuteLabel > 0 ? ` ${minuteLabel}분` : ''}`;

    recommendations.push({
      startTime: candidateStart.toISOString(),
      endTime: candidateEnd.toISOString(),
      display: `${timeLabel} (${candidateStart.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} - ${candidateEnd.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})`
    });

    if (recommendations.length >= MAX_RECOMMENDATIONS) break;
  }

  return recommendations;
};

/**
 * 추천 메시지 생성
 */
export const createRecommendationMessage = (recommendations, conflictingEvent = null) => {
  if (recommendations.length === 0) {
    return '죄송합니다. 해당 날짜에 추천할 만한 시간이 없습니다.';
  }

  if (conflictingEvent) {
    const originalStart = new Date(conflictingEvent.startTime);
    const originalTimeStr = `${originalStart.getHours()}시${originalStart.getMinutes() > 0 ? ` ${originalStart.getMinutes()}분` : ''}`;
    return `"${conflictingEvent.title}" (${originalTimeStr})을 언제로 옮기시겠어요?\n\n${recommendations.map((r, i) => `${i + 1}. ${r.display}`).join('\n')}`;
  }

  return `그 시간엔 약속이 있으니, 이 시간은 어떠세요?\n\n${recommendations.map((r, i) => `${i + 1}. ${r.display}`).join('\n')}`;
};
