/**
 * ===================================================================================================
 * fixedScheduleAPI.js - 챗봇을 통한 고정 일정(fixed schedule) 관련 API 호출을 처리하는 모듈
 * ===================================================================================================
 *
 * 📍 위치: 프론트엔드 > client/src/services/fixedSchedule/fixedScheduleAPI.js
 *
 * 🎯 주요 기능:
 *    - 사용자 인증 토큰을 관리하고 API 요청에 포함 (`getAuthToken`).
 *    - 챗봇 메시지를 기반으로 고정 일정 추가를 요청 (`addFixedSchedule`).
 *    - 고정 일정 추가 시 발생하는 충돌 해결을 요청 (`resolveFixedConflict`).
 *    - 여러 일정 옵션 중 사용자가 선택한 일정을 서버에 전송 (`selectFixedOption`).
 *
 * 🔗 연결된 파일:
 *    - ../../config/firebaseConfig.js: Firebase 인증 객체 `auth` 사용.
 *    - ../../hooks/useChat/enhanced.js: 챗봇과의 대화에서 고정 일정 관련 인텐트 처리 시 이 API 함수들을 호출.
 *
 * 💡 UI 위치:
 *    - 직접적인 UI 요소는 없으나, 챗봇을 통해 "고정 일정 추가해줘"와 같은 명령어를 입력했을 때, 백그라운드에서 서버와 통신하는 로직을 담당.
 *
 * ✏️ 수정 가이드:
 *    - 고정 일정 관련 API 엔드포인트(`fixed-intent`, `resolve-fixed-conflict`, `select-fixed-option`)가 변경될 경우: 각 함수 내의 `fetch` URL을 수정.
 *    - API 요청에 필요한 데이터(`body`)의 구조가 변경될 경우: 각 함수의 `body: JSON.stringify({...})` 부분을 수정.
 *    - 인증 방식이 변경될 경우: `getAuthToken` 함수를 수정.
 *
 * 📝 참고사항:
 *    - 이 파일의 함수들은 모두 비동기(`async`)로 구현되어 있으며, `fetch` API를 사용하여 서버와 통신.
 *    - 요청 실패 시 HTTP 상태 코드를 포함한 에러를 발생시킴.
 *
 * ===================================================================================================
 */

import { auth } from '../../config/firebaseConfig';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

/**
 * getAuthToken
 * @description 현재 로그인된 사용자의 인증 토큰을 비동기적으로 가져옵니다.
 * @returns {Promise<string>} Firebase 인증 토큰.
 * @throws {Error} 인증된 사용자가 없을 경우 에러를 발생시킵니다.
 */
const getAuthToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('No authenticated user found.');
  return await currentUser.getIdToken();
};

/**
 * addFixedSchedule
 * @description 챗봇 메시지와 현재 스케줄 정보를 기반으로 고정 일정 추가를 서버에 요청합니다.
 * @param {string} message - 사용자가 입력한 챗봇 메시지.
 * @param {Array} currentSchedules - 현재 사용자의 전체 스케줄 목록.
 * @param {Array} schedulesByImage - 이미지에서 추출된 스케줄 목록.
 * @param {Array} fixedSchedules - 현재 고정된 일정 목록.
 * @returns {Promise<object>} 서버의 응답 데이터를 포함하는 JSON 객체.
 * @throws {Error} API 요청 실패 시 에러 발생.
 */
export async function addFixedSchedule(message, currentSchedules, schedulesByImage, fixedSchedules) {
  const token = await getAuthToken();

  const response = await fetch(`${API_BASE_URL}/api/schedule/fixed-intent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      message,
      currentSchedules,
      schedulesByImage,
      fixedSchedules
    })
  });

  if (!response.ok) {
    throw new Error(`고정 일정 추가 실패: ${response.status}`);
  }

  return await response.json();
}

/**
 * resolveFixedConflict
 * @description 고정 일정 추가 시 발생한 충돌을 해결하기 위해 사용자의 선택(resolution)을 서버에 전송합니다.
 * @param {string} resolution - 사용자의 충돌 해결 선택 ('keep_new', 'keep_existing' 등).
 * @param {Object} pendingFixed - 추가 대기 중인 고정 일정.
 * @param {Object} conflictingFixed - 충돌이 발생한 기존 고정 일정.
 * @param {Array} allSchedules - 현재 사용자의 전체 스케줄 목록.
 * @param {Array} existingFixedSchedules - 현재 고정된 일정 목록.
 * @returns {Promise<object>} 서버의 응답 데이터를 포함하는 JSON 객체.
 * @throws {Error} API 요청 실패 시 에러 발생.
 */
export async function resolveFixedConflict(resolution, pendingFixed, conflictingFixed, allSchedules, existingFixedSchedules) {
  const token = await getAuthToken();

  const response = await fetch(`${API_BASE_URL}/api/schedule/resolve-fixed-conflict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      resolution,
      pendingFixed,
      conflictingFixed,
      allSchedules,
      existingFixedSchedules
    })
  });

  if (!response.ok) {
    throw new Error(`충돌 해결 실패: ${response.status}`);
  }

  return await response.json();
}

/**
 * selectFixedOption
 * @description 서버가 제시한 여러 고정 일정 옵션 중 사용자가 선택한 항목을 서버에 전송합니다.
 * @param {Object} selectedSchedule - 사용자가 선택한 스케줄 객체.
 * @param {Array} fixedSchedules - 현재 고정된 일정 목록.
 * @param {Array} allSchedules - 현재 사용자의 전체 스케줄 목록.
 * @param {Array} schedulesByImage - 이미지에서 추출된 스케줄 목록.
 * @returns {Promise<object>} 서버의 응답 데이터를 포함하는 JSON 객체.
 * @throws {Error} API 요청 실패 시 에러 발생.
 */
export async function selectFixedOption(selectedSchedule, fixedSchedules, allSchedules, schedulesByImage) {
  const token = await getAuthToken();

  const response = await fetch(`${API_BASE_URL}/api/schedule/select-fixed-option`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      selectedSchedule,
      fixedSchedules,
      allSchedules,
      schedulesByImage
    })
  });

  if (!response.ok) {
    throw new Error(`옵션 선택 실패: ${response.status}`);
  }

  return await response.json();
}
