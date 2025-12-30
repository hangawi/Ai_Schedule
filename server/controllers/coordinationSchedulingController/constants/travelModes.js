// 이동 모드 관련 상수
const TRAVEL_MODES = {
  NORMAL: 'normal',
  TRANSIT: 'transit',
  WALKING: 'walking',
  DRIVING: 'driving',
};

// 배정 모드
const ASSIGNMENT_MODES = {
  NORMAL: 'normal',
  FIRST_COME_FIRST_SERVED: 'first_come_first_served',
  FROM_TODAY: 'from_today',
};

const VALID_ASSIGNMENT_MODES = [
  ASSIGNMENT_MODES.NORMAL,
  ASSIGNMENT_MODES.FIRST_COME_FIRST_SERVED,
  ASSIGNMENT_MODES.FROM_TODAY,
];

// 슬롯 타입
const SLOT_TYPES = {
  AUTO_ASSIGNED: '자동 배정',
  NEGOTIATED: '협의',
  TRAVEL_TIME: 'TRAVEL_TIME',
};

module.exports = {
  TRAVEL_MODES,
  ASSIGNMENT_MODES,
  VALID_ASSIGNMENT_MODES,
  SLOT_TYPES,
};
