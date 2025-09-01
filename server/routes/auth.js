const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

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
    .isLength({ min: 1, max: 5 })
    .withMessage('성은 1-5자 사이여야 합니다.')
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
    console.log('❌ 입력 검증 실패:', errors.array());
    return res.status(400).json({
      success: false,
      msg: '입력값이 유효하지 않습니다.',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// 요청 로깅 미들웨어
const logRequest = (endpoint) => (req, res, next) => {
  console.log(`\n🌐 ${endpoint} 요청:`, {
    method: req.method,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent')?.substring(0, 100),
    timestamp: new Date().toISOString()
  });
  next();
};

// @route   POST /api/auth/register
// @desc    사용자 회원가입
// @access  Public
router.post('/register', 
  logRequest('회원가입'),
  registerValidation, 
  checkValidation, 
  authController.register
);

// @route   POST /api/auth/login
// @desc    사용자 로그인 및 토큰 발급
// @access  Public
router.post('/login', 
  logRequest('로그인'),
  loginValidation, 
  checkValidation, 
  authController.login
);

// @route   GET /api/auth
// @desc    로그인된 사용자 정보 가져오기 (aisch와 동일)
// @access  Private
router.get('/', auth, authController.getLoggedInUser);

// @route   POST /api/auth/google
// @desc    Authenticate user with Google ID token
// @access  Public
router.post('/google', authController.googleAuth); // Google OAuth 라우트 추가

// @route   GET /api/auth/health
// @desc    인증 서비스 상태 확인
// @access  Public
router.get('/health', (req, res) => {
  console.log('🏥 인증 서비스 상태 확인 요청');
  
  const config = require('config');
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
      '/google': 'POST - Google OAuth 인증', // Google OAuth 엔드포인트 추가
      '/health': 'GET - 서비스 상태 확인'
    }
  });
});

// 에러 처리 미들웨어
router.use((err, req, res, next) => {
  console.error('❌ Auth 라우터 에러:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method
  });
  
  // JWT 관련 에러 처리
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      msg: '유효하지 않은 토큰입니다.',
      error: 'INVALID_TOKEN'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      msg: '토큰이 만료되었습니다.',
      error: 'TOKEN_EXPIRED'
    });
  }
  
  // 검증 에러 처리
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      msg: '입력값 검증 실패',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }
  
  // MongoDB 에러 처리
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      success: false,
      msg: `${field === 'email' ? '이메일' : field}이 이미 사용 중입니다.`, 
      error: 'DUPLICATE_FIELD'
    });
  }
  
  // 기본 서버 에러
  res.status(500).json({
    success: false,
    msg: '인증 서비스에서 서버 오류가 발생했습니다.',
    ...(process.env.NODE_ENV === 'development' && { 
      error: err.message,
      stack: err.stack 
    })
  });
});

module.exports = router;