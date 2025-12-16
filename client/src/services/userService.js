/**
 * ===================================================================================================
 * userService.js - 사용자 프로필 및 일정 관련 API 호출을 처리하는 서비스 모듈
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/services/userService.js
 *
 * 🎯 주요 기능:
 *    - 인증된 API 요청을 수행하는 `request` 헬퍼 함수.
 *    - 현재 로그인된 사용자의 스케줄 조회 (`getUserSchedule`).
 *    - 현재 로그인된 사용자의 스케줄 업데이트 (`updateUserSchedule`).
 *    - 특정 사용자 ID의 스케줄 조회 (`getUserScheduleById`).
 *    - 현재 로그인된 사용자의 프로필 정보 조회 (`getUserProfile`).
 *    - 현재 로그인된 사용자의 프로필 정보 업데이트 (`updateUserProfile`).
 *
 * 🔗 연결된 파일:
 *    - ../utils/apiClient.js: 인증된 `fetch` 요청을 수행하는 `authenticatedFetch` 함수 사용.
 *    - ../components/tabs/ProfileTab/: 프로필 탭에서 사용자 스케줄 및 프로필 정보 조회/업데이트에 사용.
 *    - ../components/modals/MemberScheduleModal.js: 다른 멤버의 스케줄 조회 시 사용.
 *
 * 💡 UI 위치:
 *    - '내 프로필' 탭 (`ProfileTab`)에서 사용자 정보 및 개인 시간, 선호 시간 관리.
 *    - 다른 멤버의 일정을 조회하는 모달 또는 페이지.
 *
 * ✏️ 수정 가이드:
 *    - 새로운 사용자 관련 기능(예: 알림 설정, 계정 관리 등)이 백엔드에 추가되면: 해당 API 엔드포인트에 맞춰 `userService` 객체 내에 새로운 비동기 함수를 추가.
 *    - 기존 API 엔드포인트나 요청/응답 데이터 형식이 변경되면: 해당 API 호출 함수(`request` 내부 또는 `userService` 메소드)를 수정.
 *    - 인증 방식이 `authenticatedFetch`와 다르게 변경될 경우: `request` 함수 또는 `authenticatedFetch`를 수정.
 *
 * 📝 참고사항:
 *    - 모든 요청은 `authenticatedFetch`를 통해 자동으로 인증 토큰을 포함하여 전송됨.
 *    - API 요청 실패 시 서버에서 제공하는 상세 에러 메시지를 우선적으로 사용하고, 그렇지 않을 경우 일반적인 에러 메시지를 반환함.
 *
 * ===================================================================================================
 */
import { authenticatedFetch } from '../utils/apiClient';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

/**
 * request
 * @description 인증 토큰을 포함하여 API 요청을 수행하는 헬퍼 함수.
 * @param {string} url - 요청을 보낼 API 엔드포인트 URL.
 * @param {object} options - `fetch` 함수에 전달될 요청 옵션 (메소드, 헤더, 본문 등).
 * @returns {Promise<object>} API 응답 데이터를 포함하는 JSON 객체.
 * @throws {Error} API 요청이 실패할 경우, 상세 에러 메시지와 함께 에러를 발생시킵니다.
 */
const request = async (url, options) => {
  const response = await authenticatedFetch(url, options);

  if (!response.ok) {
    const errorData = await response.json();
    const errorMsg = errorData.details || errorData.msg || 'API request failed';
    throw new Error(errorMsg);
  }

  return response.json();
};

export const userService = {
/**
 * getUserSchedule
 * @description 현재 로그인된 사용자의 전체 스케줄 정보를 가져옵니다.
 * @returns {Promise<object>} 사용자의 스케줄 데이터를 포함하는 JSON 객체.
 * @throws {Error} 스케줄 조회 실패 시 에러 발생.
 */
  getUserSchedule: () => {
    return request(`${API_BASE_URL}/api/users/profile/schedule`, { method: 'GET' });
  },

/**
 * updateUserSchedule
 * @description 현재 로그인된 사용자의 스케줄 정보를 업데이트합니다.
 * @param {object} scheduleData - 업데이트할 스케줄 데이터 (defaultSchedule, scheduleExceptions, personalTimes 등).
 * @returns {Promise<object>} 업데이트된 스케줄 데이터를 포함하는 JSON 객체.
 * @throws {Error} 스케줄 업데이트 실패 시 에러 발생.
 */
  updateUserSchedule: (scheduleData) => {
    return request(`${API_BASE_URL}/api/users/profile/schedule`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(scheduleData),
    });
  },

/**
 * getUserScheduleById
 * @description 특정 사용자 ID의 스케줄 정보를 가져옵니다.
 * @param {string} userId - 스케줄을 조회할 사용자의 ID.
 * @returns {Promise<object>} 특정 사용자의 스케줄 데이터를 포함하는 JSON 객체.
 * @throws {Error} 스케줄 조회 실패 시 에러 발생.
 */
  getUserScheduleById: (userId) => {
    return request(`${API_BASE_URL}/api/users/${userId}/schedule`, { method: 'GET' });
  },

/**
 * getUserProfile
 * @description 현재 로그인된 사용자의 프로필 정보를 가져옵니다.
 * @returns {Promise<object>} 사용자의 프로필 데이터를 포함하는 JSON 객체.
 * @throws {Error} 프로필 조회 실패 시 에러 발생.
 */
  getUserProfile: () => {
    return request(`${API_BASE_URL}/api/users/profile`, { method: 'GET' });
  },

/**
 * updateUserProfile
 * @description 현재 로그인된 사용자의 프로필 정보를 업데이트합니다.
 * @param {object} profileData - 업데이트할 프로필 데이터 (firstName, lastName, email, address 등).
 * @returns {Promise<object>} 업데이트된 프로필 데이터를 포함하는 JSON 객체.
 * @throws {Error} 프로필 업데이트 실패 시 에러 발생.
 */
  updateUserProfile: (profileData) => {
    return request(`${API_BASE_URL}/api/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(profileData),
    });
  },
};