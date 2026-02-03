# Google Calendar 연동 개발 문서

## 개요
- **일반 로그인**: 기존 캘린더 (서버 DB) 그대로 사용
- **구글 로그인**: 구글 캘린더로 **완전 대체** (DB 스케줄 사용 안 함, 구글 캘린더 일정만 표시)
- 구글 로그인 직후 캘린더 권한 자동 요청
- 채팅으로 일정 추가 시 구글 사용자는 구글 캘린더에 직접 생성

---

## 이벤트 색상 구분

| 종류 | 색상 | 설명 |
|------|------|------|
| 선호시간 (가능) | 파란색 `#60a5fa` | 자동 스케줄링 가능 시간 |
| 개인시간 | 빨간색 `#ef4444` | 스케줄링 제외 시간 |
| 예외 스케줄 | 보라색 `#a855f7` | 특수 일정 |
| 구글 캘린더 일정 | 초록색 `#22c55e` | 구글 캘린더에서 가져온 일정 |

---

## 구현 단계

### 1단계: 서버 - Google OAuth 동의 흐름 추가
**상태**: ✅ 완료

**파일:**
- `server/controllers/authController.js` — `getCalendarConsentUrl`, `calendarCallback` 추가
- `server/routes/auth.js` — 2개 라우트 등록
- `server/.env` — `GOOGLE_CALENDAR_REDIRECT_URI` 추가

**구현 내용:**
- `GET /api/auth/google/calendar-consent` — calendar scope로 OAuth URL 생성, state에 userId
- `GET /api/auth/google/calendar-callback` — code → token 교환, refreshToken 저장, 클라이언트로 redirect
- 에러 시 쿼리 파라미터로 에러 전달

**버그/이슈:**
- (없음)

---

### 2단계: 클라이언트 - 로그인 후 캘린더 권한 요청
**상태**: ✅ 완료

**파일:**
- `client/src/components/auth/LoginForm.js`

**구현 내용:**
- `useEffect`로 callback 복귀 감지 (`calendarConnected` 쿼리 파라미터)
- `pendingGoogleUser`를 localStorage에 임시 저장 → 복귀 후 `onLoginSuccess` 호출
- `handleGoogleLogin`에서 refreshToken 없으면 consent URL로 redirect
- 에러 시에도 로그인은 진행 (캘린더 없이)

**버그/이슈:**
- (없음)

---

### 3단계: 클라이언트 - Google Calendar 서비스 생성
**상태**: ✅ 완료

**파일 (신규):**
- `client/src/services/googleCalendarService.js`

**구현 내용:**
- `getEvents(timeMin, timeMax)` — 구글 캘린더 이벤트를 FullCalendar 형식으로 변환 (초록색)
- `createEvent(title, desc, start, end)` — POST
- `updateEvent(eventId, ...)` — PUT (etag 포함)
- `deleteEvent(eventId)` — DELETE
- 각 이벤트에 `isGoogleEvent: true`, `googleEventId` 속성 추가

**버그/이슈:**
- (없음)

---

### 4단계: MobileCalendarView 수정 — 구글 캘린더 완전 대체
**상태**: ✅ 완료

**파일:**
- `client/src/components/mobile/MobileCalendarView.js`
- `client/src/SchedulingSystem.js`
- `client/src/components/mobile/MobileScheduleView.js`

**구현 내용:**
- 구글 사용자: DB 스케줄 fetch 완전 스킵, 구글 캘린더 이벤트만 표시
- 구글 사용자: 편집 모드 버튼 숨김 (개인정보 수정만 표시)
- 일반 사용자: 기존 로직 그대로 (DB 캘린더)
- SchedulingSystem, MobileScheduleView도 동일하게 구글 사용자 분기 처리

**버그/이슈:**
- (없음)

---

### 5단계: 채팅 연동 분기
**상태**: ✅ 완료 (기존 코드에서 이미 동작)

**파일:**
- `client/src/hooks/useChat/hooks/useEventAdd.js`

**구현 내용:**
- 기존 코드가 이미 `context.tabType === 'google'`일 때 `/api/calendar/events/google`으로 요청
- 별도 수정 불필요

**버그/이슈:**
- (없음)

---

### 6단계: 구글 캘린더 일정 상세 모달 + 삭제
**상태**: ✅ 완료

**파일:**
- `client/src/components/mobile/MobileCalendarView.js`

**구현 내용:**
- `handleDeleteScheduleEvent`에서 `event.isGoogleEvent` 체크 → `googleCalendarService.deleteEvent()` 호출
- 구글 이벤트는 `events.find()`로 매칭 시 `isGoogleEvent`, `googleEventId` 자동 포함
- 삭제 후 `fetchSchedule()` 재호출로 UI 갱신

**버그/이슈:**
- (없음)

---

## 핵심 파일 목록

| # | 파일 | 역할 | 변경 내용 |
|---|------|------|-----------|
| 1 | `server/controllers/authController.js` | OAuth 동의 엔드포인트 | `getCalendarConsentUrl`, `calendarCallback` 추가 |
| 2 | `server/routes/auth.js` | 라우트 등록 | 2개 GET 라우트 추가 |
| 3 | `server/.env` | 환경변수 | `GOOGLE_CALENDAR_REDIRECT_URI` 추가 |
| 4 | `client/src/services/googleCalendarService.js` | 신규 서비스 | 전체 신규 생성 |
| 5 | `client/src/components/auth/LoginForm.js` | 로그인 후 권한 요청 | useEffect + handleGoogleLogin 수정 |
| 6 | `client/src/components/mobile/MobileCalendarView.js` | 구글 캘린더 대체 | fetchSchedule 구글 전용 분기, 편집 버튼 숨김, 삭제 분기 |
| 7 | `client/src/SchedulingSystem.js` | 구글 캘린더 대체 | fetchEvents, fetchPersonalTimes 구글 전용 분기 |
| 8 | `client/src/components/mobile/MobileScheduleView.js` | 구글 캘린더 대체 | fetchEvents, fetchPersonalTimes 구글 전용 분기 |
| 9 | `client/src/hooks/useChat/hooks/useEventAdd.js` | 채팅 일정 추가 | 수정 없음 (기존 동작) |

---

## 검증 체크리스트
- [ ] 일반 로그인 → 기존과 동일하게 동작
- [ ] 구글 로그인 → 캘린더 권한 동의 화면 → 승인 → 앱 복귀
- [ ] 구글 사용자 캘린더에 구글 일정(초록)만 표시 (DB 스케줄 없음)
- [ ] 채팅으로 "내일 3시 회의" → 구글 캘린더에 일정 생성 확인
- [ ] 구글 일정 클릭 → 상세 보기 → 삭제 → 구글 캘린더에서도 삭제 확인
- [ ] 구글 사용자: 편집 모드 버튼 숨김 확인 (개인정보 수정만 표시)
- [ ] 일반 사용자: 편집 모드에서 선호시간/개인시간 수정 → 저장 → 정상 반영

---

## 버그 로그

| # | 단계 | 내용 | 원인 | 해결 | 상태 |
|---|------|------|------|------|------|
| 1 | 2단계 | callback 복귀 시 user.google.refreshToken이 없음 | pendingGoogleUser는 동의 전 데이터라 refreshToken 미포함 | callback 성공 시 서버에서 최신 user 재조회 (POST /api/auth/google) | ✅ 해결 |
| 2 | 2단계 | callback 복귀 시 Firebase auth.currentUser가 null | 페이지 이동 후 Firebase 초기화 미완료 | onAuthStateChanged를 Promise로 감싸 초기화 완료 대기 | ✅ 해결 |
| 3 | 2단계 | callback redirect 후 LoginForm이 마운트 안 됨 | callback이 `/`로 redirect → isLoggedIn=true → `/auth`로 안 감 → LoginForm useEffect 미실행 | callback redirect를 `/auth?calendarConnected=true`로 변경 + App.js에서 calendarCallback 쿼리 있으면 Navigate 방지 | ✅ 해결 |
| 4 | 4단계 | 모바일에서 구글 사용자 채팅 일정이 로컬 DB에 저장됨 | `handleChatMessage`에서 `tabType: 'local'` 하드코딩 | loginMethod/refreshToken 확인 후 구글 사용자면 `tabType: 'google'`으로 분기 | ✅ 해결 |
| 5 | 추가 | 조율방 확정 일정이 구글 캘린더에 동기화 안 됨 | `confirmScheduleService.js`가 DB personalTimes에만 저장 | `syncToGoogleCalendar` 함수 추가, 확정 시 구글 사용자는 구글 캘린더에도 이벤트 생성 | ✅ 해결 |
| 6 | 기존 | 구글 로그인 시 모든 API 500 에러 (Failed to create user account) | auth 미들웨어에서 구글 displayName에 공백이 없으면(한국어 이름 등) `lastName`이 `''` → Mongoose `required: true` 검증 실패 → 사용자 생성 불가 | `lastName` 빈 문자열 시 `'-'` 기본값 설정 (server/middleware/auth.js) | ✅ 해결 |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-03 | 문서 작성, 구현 시작 |
| 2026-02-03 | 1~6단계 전체 구현 완료 |
| 2026-02-03 | 1차 점검: refreshToken 미반영, Firebase 초기화 대기 버그 수정 |
| 2026-02-03 | 2차 점검: callback redirect 경로 버그 수정 (/ → /auth), App.js Navigate 조건 수정 |
| 2026-02-03 | 3차 점검: 모바일 채팅 일정 추가 시 구글 사용자 분기 누락 수정 |
| 2026-02-03 | 조율방 확정 → 구글 캘린더 동기화 구현 (confirmScheduleService.js) |
| 2026-02-03 | 구글 로그인 500 에러 수정: auth 미들웨어 lastName 빈 문자열 처리 |
| 2026-02-03 | **설계 변경**: 하이브리드 → 구글 캘린더 완전 대체 (MobileCalendarView, SchedulingSystem, MobileScheduleView) |
