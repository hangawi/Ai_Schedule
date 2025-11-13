const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// 입력 검증 미들웨어
const validateEvent = [
  body('title')
    .notEmpty()
    .withMessage('제목은 필수입니다.')
    .isLength({ max: 200 })
    .withMessage('제목은 200자를 초과할 수 없습니다.')
    .trim(),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('설명은 1000자를 초과할 수 없습니다.')
    .trim(),
  body('date')
    .notEmpty()
    .withMessage('날짜는 필수입니다.')
    .isDate()
    .withMessage('유효한 날짜 형식이어야 합니다.'),
  body('time')
    .notEmpty()
    .withMessage('시간은 필수입니다.')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('유효한 시간 형식(HH:MM)이어야 합니다.'),
  body('priority')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('우선순위는 1-5 사이의 숫자여야 합니다.'),
  body('category')
    .optional()
    .isIn(['general', 'meeting', 'personal', 'work', 'social', 'health', 'education'])
    .withMessage('유효하지 않은 카테고리입니다.'),
  body('isFlexible')
    .optional()
    .isBoolean()
    .withMessage('유연성 여부는 boolean 값이어야 합니다.'),
];

// 검증 결과 확인 미들웨어
const checkValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      msg: '입력값이 유효하지 않습니다.',
      errors: errors.array()
    });
  }
  next();
};

// @route   GET /api/events
// @desc    사용자의 모든 일정 조회
// @access  Private
router.get('/', auth, eventController.getEvents);

// @route   GET /api/events/range
// @desc    특정 기간 내 일정 조회
// @access  Private
router.get('/range', auth, [
  body('startDate').isDate().withMessage('시작 날짜가 유효하지 않습니다.'),
  body('endDate').isDate().withMessage('종료 날짜가 유효하지 않습니다.'),
  checkValidation
], eventController.getEventsByRange);

// @route   GET /api/events/conflicts
// @desc    충돌하는 일정 조회
// @access  Private
router.get('/conflicts', auth, [
  body('startTime').isISO8601().withMessage('시작 시간이 유효하지 않습니다.'),
  body('endTime').isISO8601().withMessage('종료 시간이 유효하지 않습니다.'),
  checkValidation
], eventController.getConflictingEvents);

// @route   POST /api/events/find
// @desc    일정 상세 정보로 조회
// @access  Private


// @route   GET /api/events/:id
// @desc    특정 일정 상세 조회
// @access  Private
router.get('/:id', auth, eventController.getEventById);

// @route   POST /api/events
// @desc    새 일정 생성
// @access  Private
router.post('/', auth, validateEvent, checkValidation, eventController.createEvent);

// @route   PUT /api/events/:id
// @desc    일정 수정
// @access  Private
router.put('/:id', auth, validateEvent, checkValidation, eventController.updateEvent);

// @route   PATCH /api/events/:id/status
// @desc    일정 상태 변경
// @access  Private
router.patch('/:id/status', auth, [
  body('status')
    .isIn(['draft', 'confirmed', 'cancelled', 'completed'])
    .withMessage('유효하지 않은 상태입니다.'),
  checkValidation
], eventController.updateEventStatus);

// @route   PATCH /api/events/:id/priority
// @desc    일정 우선순위 설정
// @access  Private
router.patch('/:id/priority', auth, [
  body('priority')
    .isInt({ min: 1, max: 5 })
    .withMessage('우선순위는 1-5 사이의 숫자여야 합니다.'),
  checkValidation
], eventController.setPriority);

// @route   POST /api/events/:id/participants
// @desc    참석자 추가
// @access  Private
router.post('/:id/participants', auth, [
  body('userId')
    .optional()
    .isMongoId()
    .withMessage('유효하지 않은 사용자 ID입니다.'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('유효한 이메일 주소를 입력해주세요.'),
  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('이름은 100자를 초과할 수 없습니다.'),
  body('isExternal')
    .isBoolean()
    .withMessage('외부 참석자 여부는 boolean 값이어야 합니다.'),
  checkValidation
], eventController.addParticipant);

// @route   PATCH /api/events/:id/participants/:participantId
// @desc    참석자 상태 업데이트
// @access  Private
router.patch('/:id/participants/:participantId', auth, [
  body('status')
    .isIn(['pending', 'accepted', 'declined', 'tentative'])
    .withMessage('유효하지 않은 참석 상태입니다.'),
  body('isExternal')
    .optional()
    .isBoolean()
    .withMessage('외부 참석자 여부는 boolean 값이어야 합니다.'),
  checkValidation
], eventController.updateParticipantStatus);

// @route   DELETE /api/events/:id/participants/:participantId
// @desc    참석자 제거
// @access  Private
router.delete('/:id/participants/:participantId', auth, eventController.removeParticipant);

// @route   DELETE /api/events/:id
// @desc    일정 삭제
// @access  Private
router.delete('/:id', auth, eventController.deleteEvent);

// @route   POST /api/events/:id/duplicate
// @desc    일정 복제
// @access  Private
router.post('/:id/duplicate', auth, [
  body('newDate')
    .optional()
    .isDate()
    .withMessage('새 날짜가 유효하지 않습니다.'),
  body('newTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('유효한 시간 형식(HH:MM)이어야 합니다.'),
  checkValidation
], eventController.duplicateEvent);

// @route   POST /api/events/recommend-alternative
// @desc    새 일정을 위한 대체 시간 추천 (충돌 해결)
// @access  Private
router.post('/recommend-alternative', auth, eventController.recommendAlternativeTime);

// @route   POST /api/events/recommend-reschedule
// @desc    기존 일정 재조정 시간 추천 (충돌 해결)
// @access  Private
router.post('/recommend-reschedule', auth, eventController.recommendRescheduleTime);

// @route   POST /api/events/confirm-reschedule
// @desc    기존 일정 재조정 및 새 일정 생성 확정
// @access  Private
router.post('/confirm-reschedule', auth, eventController.confirmReschedule);

// 에러 처리 미들웨어
router.use((err, req, res, next) => {
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      msg: '입력값 검증 실패',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({
      msg: '유효하지 않은 ID 형식입니다.'
    });
  }
  
  res.status(500).json({
    msg: '일정 처리 중 서버 오류가 발생했습니다.',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

module.exports = router;