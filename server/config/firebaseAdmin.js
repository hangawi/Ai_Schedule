// Firebase Admin SDK configuration for server-side authentication
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccount = require(path.join(__dirname, '..', 'firebase-service-account.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'ai-schedule-23cb8'
});

// Export auth instance for use in middleware and controllers
const auth = admin.auth();

module.exports = { admin, auth };
