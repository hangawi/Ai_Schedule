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

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is required');
  process.exit(1);
}

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    // Security fix: Don't allow wildcard with credentials
    if (allowedOrigins.includes('*') && process.env.NODE_ENV === 'production') {
      return callback(new Error('Wildcard CORS with credentials not allowed in production'));
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
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
app.use('/api/proposals', require('./routes/proposals'));
app.use('/api/agents', require('./routes/agents'));
app.use('/api/users', require('./routes/users'));
app.use('/api/external', require('./routes/external'));
app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/call-analysis', require('./routes/callAnalysis'));
app.use('/api/coordination', require('./routes/coordination'));

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