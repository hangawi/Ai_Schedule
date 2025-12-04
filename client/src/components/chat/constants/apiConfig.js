/**
 * ===================================================================================================
 * [apiConfig.js] - API 요청의 기본 URL 설정
 * ===================================================================================================
 *
 * 📍 위치: [프론트엔드] > client/src/components/chat/constants/apiConfig.js
 *
 * 🎯 주요 기능:
 *    - 애플리케이션의 백엔드 API 기본 URL을 정의
 *    - 환경 변수 `REACT_APP_API_BASE_URL`이 설정되어 있으면 해당 값을 사용
 *    - 환경 변수가 없으면 로컬 개발 환경을 위한 기본값으로 `http://localhost:5000`을 사용
 *
 * 🔗 연결된 파일:
 *    - 다양한 서비스 및 핸들러 파일에서 백엔드 API 요청을 보낼 때 이 상수를 참조
 *    - 예: `client/src/services/coordinationService.js`, `client/src/components/chat/handlers/messageHandlers.js`
 *
 * 📝 참고사항:
 *    - 개발 환경과 운영 환경에서 API URL을 유연하게 관리하기 위한 설정 파일입니다.
 *    - 클라이언트 측에서 직접 API 엔드포인트를 하드코딩하는 대신 이 파일을 통해 일관된 URL을 사용합니다.
 *
 * ===================================================================================================
 */

/**
 * @constant {string} API_BASE_URL - 백엔드 API의 기본 URL. 환경 변수 `REACT_APP_API_BASE_URL`이 설정되어 있으면 해당 값을 사용하고, 그렇지 않으면 `http://localhost:5000`을 기본값으로 사용합니다.
 */
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';