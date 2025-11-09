/**
 * 고정 일정 API 클라이언트
 */

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

/**
 * 고정 일정 추가 요청
 */
export async function addFixedSchedule(message, currentSchedules, schedulesByImage, fixedSchedules) {
  const token = localStorage.getItem('token');

  const response = await fetch(`${API_BASE_URL}/api/schedule/fixed-intent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-token': token
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
  const token = localStorage.getItem('token');

  const response = await fetch(`${API_BASE_URL}/api/schedule/resolve-fixed-conflict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-token': token
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
