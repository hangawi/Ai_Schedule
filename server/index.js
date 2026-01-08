/**
 * ===================================================================================================
 * index.js - Ai_Schedule 백엔드 서버의 메인 엔트리 포인트
 * ===================================================================================================
 *
 * 📍 위치: 백엔드 > server/index.js
 *
 * 🎯 주요 기능:
 *    - Express.js 서버 초기화 및 실행
 *    - MongoDB 데이터베이스 연결 설정
 *    - 주요 미들웨어(CORS, Helmet, Compression 등) 설정
 *    - API 라우팅 정의 (인증, 이벤트, 사용자, 조율 등)
 *    - Socket.io를 이용한 실시간 통신 서버 설정
 *    - 프로덕션 환경에서 React 클라이언트 빌드 파일 제공
 *    - Cron Job(자동 확정 스케줄) 실행
 *
 * 🔗 연결된 파일:
 *    - ./config/db.js - 데이터베이스 연결 로직
 *    - ./routes/*.js - 모든 API 라우트 파일
 *    - ./jobs/autoConfirmSchedule.js - 자동 확정 스케줄링 작업
 *    - ../client/build/index.html - 프로덕션 환경에서 서빙되는 클라이언트 파일
 *
 * ✏️ 수정 가이드:
 *    - 새로운 API 라우트 추가: `app.use('/api/new-route', ...)` 형식으로 추가
 *    - CORS 정책 변경: `corsOptions` 객체 수정
 *    - 새로운 미들웨어 추가: `app.use(...)`를 사용하여 라우트 핸들러 이전에 추가
 *    - Socket.io 이벤트 추가: `io.on('connection', ...)` 블록 내에 이벤트 핸들러 추가
 *
 * 📝 참고사항:
 *    - `global.io`를 통해 다른 모듈에서도 Socket.io 인스턴스에 접근할 수 있습니다.
 *    - `SIGTERM`, `SIGINT` 시그널을 처리하여 우아한 종료(graceful shutdown)를 구현합니다.
 *    - 개발 환경에서는 요청 로깅 미들웨어가 활성화됩니다.
 *
 * ===================================================================================================
 */
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

// .env 파일과 설정 디렉토리 경로 설정
require('dotenv').config({ path: path.join(__dirname, '.env') });
process.env.NODE_CONFIG_DIR = path.join(__dirname, 'config');

const connectDB = require('./config/db');
const config = require('config');

const app = express();

// 데이터베이스 연결
connectDB();

// 환경 변수 유효성 검사
if (!process.env.MONGO_URI) {
  console.error('FATAL ERROR: MONGO_URI is not defined.');
  process.exit(1);
}

// 허용된 출처(origin) 목록 설정
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',') 
  : [
    'http://localhost:3000', 'http://127.0.0.1:3000',
    'http://localhost:3001', 'http://127.0.0.1:3001',
    'http://localhost:5000', 'http://127.0.0.1:5000'
  ];

// CORS 옵션 설정
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Postman 또는 모바일 앱과 같은 요청 허용

    if (process.env.NODE_ENV !== 'production') {
      // 개발 환경에서는 localhost, 127.0.0.1 및 로컬 네트워크 IP 허용
      if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.match(/^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/) || origin.match(/^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/)) {
        return callback(null, true);
      }
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS rejected origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'X-Requested-With'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
};

// =================================================================
// 미들웨어 설정
// =================================================================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "https://accounts.google.com/gsi/client"],
        "img-src": ["'self'", "data:", "https://img.icons8.com"],
        "connect-src": ["'self'", "https://accounts.google.com/gsi/", "https://generativelanguage.googleapis.com"],
      },
    },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression()); // 응답 압축
app.use(cors(corsOptions)); // CORS 설정 적용
app.use(express.json({ limit: '10mb' })); // JSON 요청 본문 파싱
app.use(express.urlencoded({ extended: true })); // URL-encoded 요청 본문 파싱

// 개발 환경에서만 요청 로깅
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    next();
  });
}

// =================================================================
// API 라우트 설정
// =================================================================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/users/profile', require('./routes/profile'));
app.use('/api/users', require('./routes/users'));
app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/call-analysis', require('./routes/callAnalysis'));
app.use('/api/coordination', require('./routes/coordination'));
app.use('/api/conflict', require('./routes/conflict'));
app.use('/api/ocr', require('./routes/ocr'));
app.use('/api/ocr-chat', require('./routes/ocrChat'));
app.use('/api/schedule', require('./routes/scheduleOptimizer'));
app.use('/api/schedule', require('./routes/fixedSchedule'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/nview', require('./routes/nview'));
app.use('/api/admin', require('./routes/admin'));

// =================================================================
// 프로덕션 환경 설정
// =================================================================
if (process.env.NODE_ENV === 'production') {
  // React 클라이언트의 정적 파일 제공
  app.use(express.static(path.join(__dirname, '..', 'client', 'build')));
  
  // 모든 알 수 없는 GET 요청에 대해 React 앱의 index.html 반환
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'client', 'build', 'index.html'));
  });
}

// 루트 경로 핸들러
app.get('/', (req, res) => {
  res.json({ message: 'MeetAgent API Server is running!' });
});

// =================================================================
// 에러 핸들링 미들웨어
// =================================================================
// 처리되지 않은 에러 공통 처리
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({ 
    message: 'Something went wrong!', 
    error: isProduction ? 'Internal server error' : err.message 
  });
});

// 404 Not Found 핸들러
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// =================================================================
// 백그라운드 작업 및 서버 시작
// =================================================================
// 자동 확정 스케줄 Cron Job 시작
const { startAutoConfirmJob } = require('./jobs/autoConfirmSchedule');
startAutoConfirmJob();

const PORT = process.env.PORT || 5000;

// HTTP 서버 생성
const httpServer = http.createServer(app);

// Socket.io 서버 설정
const io = new Server(httpServer, {
  cors: {
    origin: corsOptions.origin, // CORS 설정 재사용 (함수 전달)
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// 다른 모듈에서 io 객체를 사용할 수 있도록 전역으로 설정
global.io = io;

// Socket.io 연결 핸들링
io.on('connection', (socket) => {
  console.log(`📡 Client connected: ${socket.id}`);

  // 특정 방(room)에 조인
  socket.on('join-room', (roomId) => {
    socket.join(`room-${roomId}`);
    console.log(`📥 Client ${socket.id} joined room-${roomId}`);
  });

  // 특정 방(room)에서 떠남
  socket.on('leave-room', (roomId) => {
    socket.leave(`room-${roomId}`);
    console.log(`📤 Client ${socket.id} left room-${roomId}`);
  });

  // 연결 해제
  socket.on('disconnect', () => {
    console.log(`📡 Client disconnected: ${socket.id}`);
  });
});

// 서버 리스닝 시작
const server = httpServer.listen(PORT, () => {
  console.log(`✅ MeetAgent Server running on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
});

// =================================================================
// 프로세스 종료 처리 (Graceful Shutdown)
// =================================================================
const shutdown = (signal) => {
  console.log(`\n${signal} received, shutting down gracefully.`);
  server.close(() => {
    console.log('✅ Process terminated.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
