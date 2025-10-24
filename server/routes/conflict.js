const express = require('express');
const router = express.Router();
const conflictController = require('../controllers/conflictResolutionController');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

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

// @route   POST /api/conflict/detect
// @desc    일정 충돌 감지
// @access  Private
router.post('/detect', auth, [
   body('date').notEmpty().isDate().withMessage('날짜는 필수입니다.'),
   body('time').notEmpty().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('시간은 필수입니다.'),
   body('title').notEmpty().withMessage('제목은 필수입니다.'),
   checkValidation
], conflictController.detectConflict);

// @route   POST /api/conflict/recommend-alternative
// @desc    새 일정을 위한 대체 시간 추천
// @access  Private
router.post('/recommend-alternative', auth, conflictController.recommendAlternativeTime);

// @route   POST /api/conflict/recommend-reschedule
// @desc    기존 일정 재조정 시간 추천
// @access  Private
router.post('/recommend-reschedule', auth, conflictController.recommendRescheduleTime);

// @route   POST /api/conflict/confirm-alternative
// @desc    대체 시간 선택 및 새 일정 생성
// @access  Private
router.post('/confirm-alternative', auth, conflictController.confirmAlternativeTime);

// @route   POST /api/conflict/confirm-reschedule
// @desc    기존 일정 재조정 및 새 일정 생성 확정
// @access  Private
router.post('/confirm-reschedule', auth, conflictController.confirmReschedule);

module.exports = router;
