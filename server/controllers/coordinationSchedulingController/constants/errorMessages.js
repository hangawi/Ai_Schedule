// 에러 메시지 상수
const ERROR_MESSAGES = {
  ROOM_NOT_FOUND: '방을 찾을 수 없습니다.',
  OWNER_ONLY: '방장만 이 기능을 사용할 수 있습니다.',
  OWNER_NO_SCHEDULE: (ownerName) => `방장(${ownerName})이 선호시간표를 설정하지 않았습니다. 내프로필에서 선호시간표를 설정해주세요.`,
  MEMBERS_NO_SCHEDULE: (memberNames) => `다음 멤버들이 선호시간표를 설정하지 않았습니다: ${memberNames}. 각 멤버는 내프로필에서 선호시간표를 설정해야 합니다.`,
  INVALID_HOURS_PER_WEEK: '주당 최소 할당 시간은 10분-10시간 사이여야 합니다.',
  ALREADY_CONFIRMED: '이미 확정된 스케줄입니다',
  INVALID_TRAVEL_MODE: '유효하지 않은 이동 모드입니다.',
  NO_SCHEDULE_DATA: '스케줄 데이터가 없습니다.',
  TIMER_NOT_RUNNING: '확정 타이머가 실행 중이 아닙니다.',
  INVALID_DURATION: '유효하지 않은 기간입니다. 1-168 사이의 값을 입력하세요.',
};

// HTTP 상태 코드
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
};

module.exports = {
  ERROR_MESSAGES,
  HTTP_STATUS,
};
