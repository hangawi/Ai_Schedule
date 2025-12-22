/**
 * ===================================================================================================
 * firebaseAdmin.js - Firebase Admin SDK 서버 사이드 설정
 * ===================================================================================================
 *
 * 📍 위치: 백엔드 > server/config > firebaseAdmin.js
 * 🎯 주요 기능:
 *    - 서비스 계정 키(firebase-service-account.json)를 사용하여 Firebase Admin SDK 초기화.
 *    - 사용자 토큰 검증, 사용자 프로필 관리 등 서버 사이드에서 특권 권한이 필요한 작업 지원.
 *    - 시스템 전체에서 공용으로 사용할 Firebase Auth 인스턴스 제공.
 *
 * 🔗 연결된 파일:
 *    - server/middleware/auth.js - 클라이언트 토큰의 유효성을 검증할 때 이 모듈의 auth 인스턴스 사용.
 *    - server/controllers/authController.js - 회원가입 및 계정 삭제 로직에서 사용.
 *
 * ✏️ 수정 가이드:
 *    - Firebase 프로젝트를 변경하려면 projectId 값을 수정하고 새로운 서비스 계정 파일을 같은 경로에 배치.
 *
 * 📝 참고사항:
 *    - 보안을 위해 서비스 계정 키 파일은 외부에 노출되지 않도록 각별히 주의해야 함.
 *
 * ===================================================================================================
 */

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

