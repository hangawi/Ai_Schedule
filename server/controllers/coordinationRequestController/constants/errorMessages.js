// 에러 메시지 상수

const ERROR_MESSAGES = {
  REQUIRED_FIELDS_MISSING: '필수 필드가 누락되었습니다.',
  ROOM_NOT_FOUND: '방을 찾을 수 없습니다.',
  REQUEST_NOT_FOUND: '요청을 찾을 수 없습니다.',
  OWNER_CANNOT_REQUEST: '방장은 시간표 교환요청을 할 수 없습니다.',
  DUPLICATE_REQUEST: '동일한 요청이 이미 존재합니다.',
  INVALID_ACTION: '유효하지 않은 액션입니다. approved 또는 rejected만 허용됩니다.',
  NO_PERMISSION: '이 요청을 처리할 권한이 없습니다.',
  ALREADY_PROCESSED: '이미 처리된 요청입니다.',
  NO_DELETE_PERMISSION: '요청을 삭제할 권한이 없습니다.',
  PENDING_REQUESTER_ONLY: '대기 중인 요청은 요청자만 취소할 수 있습니다.',
  NO_ALTERNATIVE_SLOT: 'D가 이동할 빈 시간이 없어 조정이 실패했습니다.',
  NO_D_SLOT: 'D의 슬롯을 찾을 수 없습니다.',
  CHAIN_ADJUSTMENT_FAILED: '연쇄 조정 실패 - D가 이동할 빈 시간 없음',
  CHAIN_REJECTED: '연쇄 조정 거절됨',
  SERVER_ERROR: 'Server error'
};

module.exports = { ERROR_MESSAGES };
