const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const config = require('config');

// 입력 검증 미들웨어
const registerValidation = [
  body('firstName')
    .notEmpty()
    .withMessage('이름은 필수입니다.')
    .isLength({ min: 2, max: 50 })
    .withMessage('이름은 2-50자 사이여야 합니다.')
    .trim()
    .escape(),
  body('lastName')
    .notEmpty()
    .withMessage('성은 필수입니다.')
    .isLength({ min: 1, max: 50 })
    .withMessage('성은 1-50자 사이여야 합니다.')
    .trim()
    .escape(),
  body('email')
    .isEmail()
    .withMessage('유효한 이메일 주소를 입력해주세요.')
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage('이메일은 100자를 초과할 수 없습니다.'),
  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('비밀번호는 6-128자 사이여야 합니다.')
];

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('유효한 이메일 주소를 입력해주세요.')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('비밀번호는 필수입니다.')
    .isLength({ min: 1, max: 128 })
    .withMessage('비밀번호 길이가 유효하지 않습니다.')
];

// 검증 결과 확인 미들웨어
const checkValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      msg: '입력값이 유효하지 않습니다.',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value ?? null
      }))
    });
  }
  next();
};

// 요청 로깅 미들웨어
const logRequest = (endpoint) => (req, res, next) => {
  next();
};

// 라우트들
router.post('/register', logRequest('회원가입'), registerValidation, checkValidation, authController.register);
router.post('/login', logRequest('로그인'), auth, authController.login);
router.get('/', auth, authController.getLoggedInUser);
router.post('/google', auth, authController.googleAuth);
router.delete('/delete-account', auth, authController.deleteAccount);

// Health check
router.get('/health', (req, res) => {
  const jwtSecret = config.get('jwtSecret');
  res.json({
    service: 'Authentication Service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    config: {
      jwtConfigured: !!jwtSecret,
      jwtSecretLength: jwtSecret ? jwtSecret.length : 0,
      nodeEnv: process.env.NODE_ENV || 'development'
    },
    endpoints: {
      '/register': 'POST - 사용자 회원가입',
      '/login': 'POST - 사용자 로그인',
      '/': 'GET - 로그인된 사용자 정보 (인증 필요)',
      '/google': 'POST - Google OAuth 인증',
      '/health': 'GET - 서비스 상태 확인'
    }
  });
});

// 에러 처리 미들웨어
router.use((err, req, res, next) => {

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, msg: '유효하지 않은 토큰입니다.', error: 'INVALID_TOKEN' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, msg: '토큰이 만료되었습니다.', error: 'TOKEN_EXPIRED' });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      msg: '입력값 검증 실패',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      success: false,
      msg: `${field === 'email' ? '이메일' : field}이 이미 사용 중입니다.`,
      error: 'DUPLICATE_FIELD'
    });
  }

  res.status(500).json({
    success: false,
    msg: '인증 서비스에서 서버 오류가 발생했습니다.',
    ...(process.env.NODE_ENV === 'development' && { error: err.message, stack: err.stack })
  });
});

module.exports = router;
