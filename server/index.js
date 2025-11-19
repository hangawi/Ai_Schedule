const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });
process.env.NODE_CONFIG_DIR = path.join(__dirname, 'config');

const connectDB = require('./config/db');
const config = require('config');

const app = express();

connectDB();

// Environment validation
if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is required');
  process.exit(1);
}

// JWT_SECRET is no longer required (using Firebase Authentication)
// if (!process.env.JWT_SECRET) {
//   console.error('JWT_SECRET is required');
//   process.exit(1);
// }

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : [
    'http://localhost:3000', 'http://127.0.0.1:3000',
    'http://localhost:3001', 'http://127.0.0.1:3001',
    'http://localhost:5000', 'http://127.0.0.1:5000'
  ];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);

    // console.log('CORS origin check:', { origin, allowedOrigins });

    // In development, be more permissive
    if (process.env.NODE_ENV !== 'production') {
      // Allow localhost on any port
      if (origin && origin.includes('localhost')) {
        return callback(null, true);
      }
      // Allow 127.0.0.1 on any port
      if (origin && origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
      // Allow local network IPs (for laptop access)
      if (origin && origin.match(/^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/)) {
        return callback(null, true);
      }
      if (origin && origin.match(/^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/)) {
        return callback(null, true);
      }
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS rejected origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'X-Requested-With'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
};

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
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  // Development request logging middleware (disabled in production)
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    next();
  });
}

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
app.use('/api/nview', require('./routes/nview')); // AI 학습 시스템
app.use('/api/admin', require('./routes/admin')); // 관리자 API

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'build')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'client', 'build', 'index.html'));
  });
}

app.get('/', (req, res) => {
  res.json({ message: 'MeetAgent API Server is running!' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  
  // Security fix: Don't expose error details in production
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({ 
    message: 'Something went wrong!', 
    error: isProduction ? 'Internal server error' : err.message 
  });
});

app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`MeetAgent Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});