/**
 * API 응답 처리 유틸리티
 */

/**
 * 충돌 정보를 포함한 메시지 생성
 * @param {number} successCount
 * @param {number} failCount
 * @param {Array} conflictDates
 * @param {string} title
 * @param {string} startTime
 * @returns {Object}
 */
export const createConflictMessage = (successCount, failCount, conflictDates, title, startTime) => {
  let conflictMessage = `\n\n⚠️ ${conflictDates.length}일은 ${startTime}에 이미 일정이 있어서 건너뛰었어요:\n`;

  conflictDates.forEach(conflict => {
    conflictMessage += `\n📅 ${conflict.date} - "${conflict.conflictWith}"과(와) 겹침`;
    if (conflict.alternatives && conflict.alternatives.length > 0) {
      conflictMessage += `\n   추천 시간: `;
      conflict.alternatives.forEach((slot, idx) => {
        conflictMessage += `${slot.start}-${slot.end}`;
        if (idx < conflict.alternatives.length - 1) conflictMessage += ', ';
      });
    }
  });

  return {
    success: successCount > 0,
    message: successCount > 0
      ? `${title || '일정'}을 ${successCount}일간 추가했어요!${conflictMessage}`
      : `모든 날짜에서 충돌이 발생했습니다.${conflictMessage}`,
    suggestedTimes: conflictDates
      .filter(c => c.alternatives && c.alternatives.length > 0)
      .flatMap(alt => alt.alternatives.map(slot => ({
        date: alt.date,
        start: slot.start,
        end: slot.end
      })))
  };
};

/**
 * 성공 응답 생성
 * @param {string} message
 * @param {Object} data
 * @returns {Object}
 */
export const createSuccessResponse = (message, data = null) => {
  const response = { success: true, message };
  if (data) response.data = data;
  return response;
};

/**
 * 실패 응답 생성
 * @param {string} message
 * @param {Object} data
 * @returns {Object}
 */
export const createErrorResponse = (message, data = null) => {
  const response = { success: false, message };
  if (data) response.data = data;
  return response;
};

/**
 * 충돌 응답 생성 (일정 추가 시)
 * @param {string} conflictTitle
 * @param {Date} startTime
 * @param {Array} conflicts
 * @param {Object} pendingEvent
 * @returns {Object}
 */
export const createConflictResponse = (conflictTitle, startTime, conflicts, pendingEvent) => {
  const timeStr = startTime.toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return {
    success: false,
    hasConflict: true,
    message: `${timeStr}에 이미 "${conflictTitle}" 일정이 있습니다.\n\n어떻게 하시겠어요?`,
    conflictingEvents: conflicts.map(e => ({
      id: e._id || e.id,
      title: e.title || e.summary,
      startTime: e.startTime || e.start?.dateTime,
      endTime: e.endTime || e.end?.dateTime,
    })),
    pendingEvent: pendingEvent,
    actions: [
      { id: 1, label: '다른 시간 추천받기', action: 'recommend_alternative' },
      { id: 2, label: '기존 약속 변경하기', action: 'reschedule_existing' }
    ],
    _nextStep: 'await_user_choice'
  };
};
