/**
 * ===================================================================================================
 * timeRecommendation.js - 시간 추천 알고리즘 관련 유틸리티 함수들
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/components/chat/utils
 *
 * 🎯 주요 기능:
 *    - 새로운 일정 추가 시 충돌이 발생할 경우, 대체 가능한 다른 시간대를 추천
 *    - 기존 일정을 옮겨야 할 경우, 옮길 수 있는 다른 시간대를 추천
 *    - 생성된 추천 시간 목록을 바탕으로 사용자에게 보여줄 챗봇 메시지 생성
 *
 * 🔗 연결된 파일:
 *    - ../constants/chatConstants - 시간 제약, 검색 간격 등 알고리즘에 사용되는 상수
 *    - 이 유틸리티를 사용하는 챗봇 로직 또는 충돌 해결 로직
 *
 * 💡 UI 위치:
 *    - 이 파일은 UI를 직접 렌더링하지 않으나, 챗봇이 시간 충돌 시 사용자에게 제안하는
 *      '추천 시간 버튼'의 데이터를 생성하는 데 사용됩니다.
 *
 * ✏️ 수정 가이드:
 *    - 추천 시간 검색 로직 변경: `SEARCH_OFFSETS` 상수 또는 `generateAlternativeTimeRecommendations` 내의 반복문 로직 수정
 *    - 추천 가능한 시간대 제약 변경: `TIME_CONSTRAINTS` 상수 수정
 *    - 추천 메시지 형식 변경: `createRecommendationMessage` 함수 내의 문자열 템플릿 수정
 *
 * 📝 참고사항:
 *    - `generateAlternativeTimeRecommendations`와 `generateRescheduleTimeRecommendations` 함수는
 *      `SEARCH_OFFSETS`에 정의된 시간 간격(분)만큼 앞뒤로 탐색하며 빈 시간을 찾습니다.
 *    - 추천 시간은 `TIME_CONSTRAINTS`에 정의된 시간 범위(예: 오전 9시 ~ 오후 10시) 내에서만 생성됩니다.
 *
 * ===================================================================================================
 */

import { SEARCH_OFFSETS, TIME_CONSTRAINTS, MAX_RECOMMENDATIONS } from '../constants/chatConstants';

/**
 * generateAlternativeTimeRecommendations
 *
 * @description 새로 추가하려는 일정(`pendingEvent`)이 기존 일정과 충돌할 경우,
 *              추가할 수 있는 다른 대체 시간대를 추천 목록으로 생성합니다.
 * @param {Object} pendingEvent - 새로 추가하려는 일정 정보 { startTime, endTime }
 * @param {Array<Object>} [existingEvents=[]] - 사용자의 기존 일정 목록
 * @returns {Array<Object>} 추천 시간 목록. 각 객체는 { startTime, endTime, display } 형식을 가집니다.
 *
 * @example
 * const pending = { startTime: '2025-12-05T10:00:00Z', endTime: '2025-12-05T11:00:00Z' };
 * const existing = [{ startTime: '2025-12-05T10:30:00Z', endTime: '2025-12-05T11:30:00Z' }];
 * const recommendations = generateAlternativeTimeRecommendations(pending, existing);
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
 * generateRescheduleTimeRecommendations
 *
 * @description 기존 일정(`conflictingEvent`)을 다른 시간으로 옮겨야 할 경우,
 *              옮길 수 있는 대체 시간대를 추천 목록으로 생성합니다.
 * @param {Object} conflictingEvent - 옮기려는 기존 일정 정보 { id, startTime, endTime }
 * @param {Array<Object>} [existingEvents=[]] - 사용자의 전체 기존 일정 목록
 * @returns {Array<Object>} 추천 시간 목록. 각 객체는 { startTime, endTime, display } 형식을 가집니다.
 *
 * @note
 * - 충돌 확인 시, 옮기려는 자기 자신(`conflictingEvent`)은 충돌 검사에서 제외됩니다.
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
 * createRecommendationMessage
 *
 * @description 생성된 추천 시간 목록을 바탕으로 사용자에게 보여줄 챗봇 메시지를 생성합니다.
 * @param {Array<Object>} recommendations - `generate...Recommendations` 함수로 생성된 추천 시간 목록
 * @param {Object | null} [conflictingEvent=null] - 옮기려는 기존 일정이 있는 경우 해당 일정 객체
 * @returns {string} 사용자에게 보여줄 완전한 챗봇 메시지 문자열
 *
 * @example
 * // 새 일정 추가 시 충돌
 * const msg1 = createRecommendationMessage(recommendations);
 * // "그 시간엔 약속이 있으니, 이 시간은 어떠세요?..."
 *
 * // 기존 일정 이동 시
 * const msg2 = createRecommendationMessage(recommendations, conflictingEvent);
 * // ""오후 3시 회의"을(를) 언제로 옮기시겠어요?..."
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
