/**
 * 에러 메시지 상수 정의
 */

const ERROR_MESSAGES = {
  // 입력 검증 에러
  INVALID_MEMBERS_DATA: 'Invalid members data provided to scheduling algorithm',
  INVALID_OWNER_DATA: 'Invalid owner data provided to scheduling algorithm',
  MISSING_MEMBERS: 'Members array is required',
  MISSING_OWNER: 'Owner object is required',
  MISSING_OWNER_ID: 'Owner must have an _id field',

  // 데이터 무결성 에러
  SLOT_NOT_FOUND: 'Slot not found in timetable',
  INVALID_DATE_KEY: 'Invalid date key format',
  INVALID_TIME_FORMAT: 'Invalid time format',

  // 비즈니스 로직 에러
  NO_AVAILABLE_SLOTS: 'No available slots found for member',
  ASSIGNMENT_OVERFLOW: 'Cannot assign more slots than required',
  CONFLICT_RESOLUTION_FAILED: 'Failed to resolve conflicts',

  // 이월 관련 에러
  CARRY_OVER_INTERVENTION_NEEDED: '2주 이상 연속 이월',

  // 타임테이블 생성 에러
  TIMETABLE_CREATION_FAILED: 'Failed to create timetable',
  INVALID_SCHEDULE_RANGE: 'Invalid schedule date range'
};

module.exports = {
  ERROR_MESSAGES
};
