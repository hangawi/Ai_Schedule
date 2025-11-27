// 키워드 패턴 상수

const REDO_KEYWORDS = ['되돌리기 취소', '취소 취소', 'redo', '다시 실행', '되살려'];

const UNDO_KEYWORDS = ['되돌려', '돌려', '취소', 'undo'];

const STEP_BACK_KEYWORDS = ['방금전', '방금', '바로 전', '직전', '한 단계 전', '아까'];

const FULL_UNDO_KEYWORDS = ['맨 처음', '맨처음', '원본', '롤백', '처음', '초기', 'reset', '시간표 롤백'];

const CONFIRMATION_KEYWORDS = ['ㅇㅇ', '응', '웅', '그래', '해줘', 'ㅇ', 'ㅇㄱ', '오케이', 'ok'];

const GENERIC_SCHEDULE_TERMS = [
  '일정', '약속', '새로운', '개인', '기타', '할일',
  'schedule', 'todo', 'event', '미정', '기록'
];

module.exports = {
  REDO_KEYWORDS,
  UNDO_KEYWORDS,
  STEP_BACK_KEYWORDS,
  FULL_UNDO_KEYWORDS,
  CONFIRMATION_KEYWORDS,
  GENERIC_SCHEDULE_TERMS
};
