/**
 * ===================================================================================================
 * firebaseConfig.js - Firebase 클라이언트 설정 파일
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/config
 *
 * 🎯 주요 기능:
 *    - Firebase 앱 초기화 및 설정
 *    - Firebase Authentication 인스턴스 생성 및 내보내기
 *    - Google Auth Provider 인스턴스 생성 및 내보내기
 *
 * 🔗 연결된 파일:
 *    - ../components/auth/SocialLoginButtons.js - Google 로그인을 위해 `auth`와 `googleProvider`를 사용
 *    - ../hooks/useAuth.js - 인증 상태 변경을 감지하기 위해 `auth`를 사용
 *
 * ✏️ 수정 가이드:
 *    - Firebase 프로젝트 변경 시: `firebaseConfig` 객체의 모든 값을 새 프로젝트의 값으로 교체해야 합니다.
 *    - 이 파일의 설정은 클라이언트 측 인증(Google 로그인 등)에만 사용됩니다.
 *
 * 📝 참고사항:
 *    - 이 설정 파일은 클라이언트 측에 노출되어도 안전한 값들을 포함하고 있습니다.
 *    - 서버 측 Firebase Admin SDK 설정은 `server/config/firebaseAdmin.js`에 있습니다.
 *    - API 키와 같은 민감한 정보는 소스 코드에 직접 하드코딩하는 대신 환경 변수를 사용하는 것이 권장됩니다.
 *
 * ===================================================================================================
 */
// Firebase configuration for client-side authentication
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCPnP6VeECcYP5IcFmwjvc_Tum9tHZYz18",
  authDomain: "ai-schedule-23cb8.firebaseapp.com",
  projectId: "ai-schedule-23cb8",
  storageBucket: "ai-schedule-23cb8.firebasestorage.app",
  messagingSenderId: "883727972092",
  appId: "1:883727972092:web:30963d897ebcc335730979",
  measurementId: "G-J8H11WCKYV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

export default app;
