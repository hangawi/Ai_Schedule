/**
 * 에러 메시지 템플릿
 */

const ERROR_MESSAGES = {
  // 일반 에러
  NO_MESSAGE: '메시지를 입력해주세요.',
  ROOM_NOT_FOUND: '방을 찾을 수 없습니다.',
  NOT_MEMBER: '방 멤버만 이 기능을 사용할 수 있습니다.',
  SERVER_ERROR: '서버 오류가 발생했습니다.',
  PARSE_FAILED: '요청을 이해하지 못했습니다. 다시 시도해주세요.',

  // 타입 파싱 에러
  TYPE_NOT_FOUND: '메시지 타입을 파악할 수 없습니다.',
  INVALID_DAY: '요일을 명확히 말씀해주세요. (월요일~금요일)',
  INVALID_TIME_FORMAT: '시간 형식이 올바르지 않습니다. (예: 14:00)',
  INVALID_TARGET_DATE: '목표 날짜를 명확히 말씀해주세요. (예: 15일)',

  // 날짜/시간 검증 에러
  WEEKEND_NOT_ALLOWED: (month, day) => `${month}월 ${day}일은 주말입니다. 평일(월~금)로만 이동할 수 있습니다.`,
  NO_SLOTS_ON_DATE: (month, day) => `${month}월 ${day}일에 배정된 일정이 없습니다.`,
  INVALID_DAY_TYPE: '유효하지 않은 요일입니다.',

  // 스케줄 검증 에러
  NOT_OWNER_PREFERRED_DAY: (day) => `${day}는 방장의 선호 시간이 아닙니다. 방장이 설정한 선호 요일로만 변경할 수 있습니다.`,
  NOT_MEMBER_PREFERRED_DAY: (day) => `${day}는 당신의 선호 시간이 아닙니다. 본인이 설정한 선호 요일로만 변경할 수 있습니다.`,
  NO_OVERLAP_WITH_OWNER: (day) => `${day}에 방장과 당신의 선호 시간이 겹치지 않습니다. 겹치는 시간대로만 변경할 수 있습니다.`,
  TIME_NOT_IN_OVERLAP: (day, startTime, endTime, availableRanges) =>
    `${day} ${startTime}-${endTime}는 사용할 수 없습니다. 방장과 겹치는 가능한 시간: ${availableRanges}`,
  NOT_MEMBER_PREFERRED_TIME: (startTime, endTime, scheduleRanges) =>
    `${startTime}-${endTime}는 회원님의 선호 시간대가 아닙니다. 회원님의 선호 시간대: ${scheduleRanges}`,

  // 슬롯 관련 에러
  NO_CURRENT_SLOTS: '현재 배정된 시간이 없습니다. 먼저 자동 배정을 받으세요.',
  NO_SLOTS_IN_SOURCE_WEEK: (weekName, dayName) => `${weekName} ${dayName}에 배정된 일정이 없습니다.`,
  ALREADY_AT_TARGET: (day, startTime, endTime) => `이미 ${day} ${startTime}-${endTime}에 배정되어 있습니다.`,
  SLOT_OVERLAP_EXISTS: (month, day, startTime, endTime, existingTimes) =>
    `${month}월 ${day}일 ${startTime}-${endTime} 시간대에 이미 일정이 있습니다.\n기존 일정: ${existingTimes}`,

  // 뷰 모드 제한 에러
  OUT_OF_WEEK_RANGE: (weekStart, weekEnd) =>
    `주간 모드에서는 이번 주(${weekStart} ~ ${weekEnd}) 내에서만 이동할 수 있습니다. 다른 주로 이동하려면 월간 모드로 전환해주세요.`,
  OUT_OF_MONTH_RANGE: (monthName) =>
    `${monthName} 범위를 벗어나는 이동입니다. 다른 달로 이동하시겠습니까?`
};

const SUCCESS_MESSAGES = {
  // 즉시 변경 성공
  IMMEDIATE_SWAP: (month, day, startTime, endTime) =>
    `${month}월 ${day}일 ${startTime}-${endTime}로 즉시 변경되었습니다!`,
  AUTO_PLACED: (month, day, startTime, endTime) =>
    `${month}월 ${day}일 ${startTime}-${endTime}로 자동 배치되었습니다! (원래 시간대에 다른 일정이 있어서 가장 가까운 빈 시간으로 이동)`,

  // 요청 생성 성공
  REQUEST_CREATED: (month, day, startTime, endTime, userName) =>
    `${month}월 ${day}일 ${startTime}-${endTime} 시간대에 ${userName}님의 일정이 있습니다. 자리요청관리에 요청을 보냈습니다. 승인되면 자동으로 변경됩니다.`,
  YIELD_REQUEST_CREATED: (month, day, startTime, occupiedBy) =>
    `${month}월 ${day}일 ${startTime}에 ${occupiedBy}님이 사용 중입니다. 자리요청관리에 요청을 보냈습니다. 승인되면 자동으로 변경됩니다.`
};

module.exports = {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES
};
