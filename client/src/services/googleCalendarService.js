/**
 * Google Calendar Service
 * 서버의 Google Calendar API를 래핑하는 클라이언트 서비스
 */

import { auth } from '../config/firebaseConfig';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL
  ? process.env.REACT_APP_API_BASE_URL.trim().replace(/^"|"$/g, '')
  : 'http://localhost:5000';

const getAuthHeader = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('인증이 필요합니다.');
  const token = await currentUser.getIdToken();
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
};

/**
 * 구글 캘린더 이벤트 조회 (FullCalendar 형식으로 변환)
 */
export const getEvents = async (timeMin, timeMax) => {
  const headers = await getAuthHeader();
  const params = new URLSearchParams();
  if (timeMin) params.append('timeMin', timeMin);
  if (timeMax) params.append('timeMax', timeMax);

  const res = await fetch(`${API_BASE_URL}/api/calendar/events?${params}`, { headers });
  if (!res.ok) throw new Error('구글 캘린더 이벤트 조회 실패');

  const events = await res.json();
  return events.map(event => ({
    id: `google-${event.id}`,
    googleEventId: event.id,
    title: event.summary || '(제목 없음)',
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
    description: event.description || '',
    location: event.location || null,
    backgroundColor: '#3b82f6',  // 모든 구글 일정 파란색
    borderColor: '#2563eb',
    textColor: '#ffffff',
    display: 'block',
    isGoogleEvent: true,
    etag: event.etag,
    // 🆕 확정 일정 관련 속성 추가
    extendedProperties: event.extendedProperties || null,
    suggestionId: event.extendedProperties?.private?.suggestionId || null,
    roomId: event.extendedProperties?.private?.roomId || null,
    isCoordinationConfirmed: event.extendedProperties?.private?.isCoordinationConfirmed === 'true',
  }));
};

/**
 * 구글 캘린더 이벤트 생성
 */
export const createEvent = async (title, description, startDateTime, endDateTime) => {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE_URL}/api/calendar/events/google`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title, description, startDateTime, endDateTime }),
  });
  if (!res.ok) throw new Error('구글 캘린더 이벤트 생성 실패');
  return res.json();
};

/**
 * 구글 캘린더 이벤트 수정
 */
export const updateEvent = async (eventId, title, description, startDateTime, endDateTime, etag) => {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE_URL}/api/calendar/events/${eventId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ title, description, startDateTime, endDateTime, etag }),
  });
  if (!res.ok) throw new Error('구글 캘린더 이벤트 수정 실패');
  return res.json();
};

/**
 * 구글 캘린더 이벤트 삭제
 */
export const deleteEvent = async (eventId) => {
  const headers = await getAuthHeader();
  const res = await fetch(`${API_BASE_URL}/api/calendar/events/${eventId}`, {
    method: 'DELETE',
    headers,
  });

  // 204 No Content는 성공
  if (res.status === 204) {
    return true;
  }

  if (!res.ok) {
    let errorMsg = '구글 캘린더 이벤트 삭제 실패';
    try {
      const errorData = await res.json();
      errorMsg = errorData.msg || errorData.error || errorMsg;
    } catch (e) {
      // 응답 파싱 실패
    }
    throw new Error(errorMsg);
  }
  return true;
};
