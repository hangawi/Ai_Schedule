/**
 * ===================================================================================================
 * apiClient.js - Firebase 인증 토큰을 자동으로 포함하여 API 서버에 요청을 보내는 `fetch` 래퍼 및 헬퍼 함수 모음
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/utils/apiClient.js
 *
 * 🎯 주요 기능:
 *    - Firebase 인증 토큰을 가져와 `Authorization` 헤더에 자동으로 추가하는 `authenticatedFetch` 함수 제공.
 *    - `GET`, `POST`, `PUT`, `DELETE`, `PATCH` 등 각 HTTP 메소드에 대한 헬퍼 함수(`apiGet`, `apiPost`, 등)를 제공하여 API 호출을 간소화.
 *    - 상대 경로와 절대 경로 URL을 모두 처리.
 *
 * 🔗 연결된 파일:
 *    - ../config/firebaseConfig.js: Firebase 인증 객체 `auth` 사용.
 *    - ../services/*: 모든 서비스 파일에서 API 호출을 위해 이 클라이언트의 함수들을 사용.
 *
 * 💡 UI 위치:
 *    - 직접적인 UI 요소는 없으나, 애플리케이션의 거의 모든 부분에서 서버와 통신이 필요할 때 백그라운드에서 사용되는 핵심 네트워크 모듈.
 *
 * ✏️ 수정 가이드:
 *    - 인증 헤더의 형식이 변경될 경우: `authenticatedFetch` 함수 내의 `options.headers` 부분을 수정.
 *    - API 기본 URL(`API_BASE_URL`)을 변경할 경우: `.env` 파일을 수정하거나 `API_BASE_URL` 변수를 업데이트.
 *    - 새로운 HTTP 메소드에 대한 헬퍼 함수가 필요할 경우: `apiGet`, `apiPost`와 유사한 형식으로 새 함수를 추가.
 *    - `fetch` 요청에 대한 공통적인 옵션(예: `credentials`, `mode`)을 추가해야 할 경우: `authenticatedFetch` 함수 내의 `fetch` 호출 부분을 수정.
 *
 * 📝 참고사항:
 *    - 이 모듈을 사용하면 개별 API 호출 함수에서 인증 토큰을 관리할 필요가 없어짐.
 *    - `authenticatedFetch`는 요청 실패 시 에러를 콘솔에 기록하고 다시 `throw`하여, 호출한 쪽에서 에러를 처리할 수 있도록 함.
 *
 * ===================================================================================================
 */
import { auth } from '../config/firebaseConfig';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

/**
 * authenticatedFetch
 * @description Firebase ID 토큰을 `Authorization` 헤더에 자동으로 추가하여 API 요청을 수행하는 fetch 래퍼 함수입니다.
 * @param {string} url - 요청을 보낼 API 엔드포인트 URL.
 * @param {object} [options={}] - `fetch` 함수에 전달될 요청 옵션.
 * @returns {Promise<Response>} `fetch` API의 응답(Response) 객체.
 * @throws {Error} 인증 토큰 획득 또는 fetch 요청 실패 시 에러 발생.
 */
export const authenticatedFetch = async (url, options = {}) => {
  try {
    // Get current Firebase user
    const currentUser = auth.currentUser;

    if (currentUser) {
      // Get fresh ID token
      const idToken = await currentUser.getIdToken();

      // Add Authorization header
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${idToken}`
      };
    }

    // Make the request
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    const response = await fetch(fullUrl, options);

    return response;
  } catch (error) {
    console.error('[authenticatedFetch] Error:', error);
    throw error;
  }
};

/**
 * apiGet
 * @description `authenticatedFetch`를 사용한 GET 요청 헬퍼 함수입니다.
 * @param {string} url - GET 요청을 보낼 API 엔드포인트 URL.
 * @returns {Promise<Response>} `fetch` API의 응답(Response) 객체.
 */
export const apiGet = async (url) => {
  return authenticatedFetch(url, { method: 'GET' });
};

/**
 * apiPost
 * @description `authenticatedFetch`를 사용한 POST 요청 헬퍼 함수입니다.
 * @param {string} url - POST 요청을 보낼 API 엔드포인트 URL.
 * @param {object} data - 요청 본문에 포함할 데이터 객체 (JSON으로 변환됨).
 * @returns {Promise<Response>} `fetch` API의 응답(Response) 객체.
 */
export const apiPost = async (url, data) => {
  return authenticatedFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
};

/**
 * apiPut
 * @description `authenticatedFetch`를 사용한 PUT 요청 헬퍼 함수입니다.
 * @param {string} url - PUT 요청을 보낼 API 엔드포인트 URL.
 * @param {object} data - 요청 본문에 포함할 데이터 객체 (JSON으로 변환됨).
 * @returns {Promise<Response>} `fetch` API의 응답(Response) 객체.
 */
export const apiPut = async (url, data) => {
  return authenticatedFetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
};

/**
 * apiDelete
 * @description `authenticatedFetch`를 사용한 DELETE 요청 헬퍼 함수입니다.
 * @param {string} url - DELETE 요청을 보낼 API 엔드포인트 URL.
 * @returns {Promise<Response>} `fetch` API의 응답(Response) 객체.
 */
export const apiDelete = async (url) => {
  return authenticatedFetch(url, { method: 'DELETE' });
};

/**
 * apiPatch
 * @description `authenticatedFetch`를 사용한 PATCH 요청 헬퍼 함수입니다.
 * @param {string} url - PATCH 요청을 보낼 API 엔드포인트 URL.
 * @param {object} data - 요청 본문에 포함할 데이터 객체 (JSON으로 변환됨).
 * @returns {Promise<Response>} `fetch` API의 응답(Response) 객체.
 */
export const apiPatch = async (url, data) => {
  return authenticatedFetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
};
