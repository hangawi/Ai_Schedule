/**
 * 고정 일정 API 클라이언트
 */

import { auth } from '../../config/firebaseConfig';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const getAuthToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('No authenticated user found.');
  return await currentUser.getIdToken();
};

/**
 * 고정 일정 추가 요청
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
 * 고정 일정 충돌 해결
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
 * 사용자가 여러 옵션 중 하나를 선택
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
