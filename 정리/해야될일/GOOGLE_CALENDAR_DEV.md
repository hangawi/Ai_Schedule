# Google Calendar 연동 개발 문서

## 개요
- **일반 로그인**: 기존 캘린더 (서버 DB) 그대로 사용
- **구글 로그인**: 구글 캘린더 일정 + 서버 DB의 선호시간/개인시간을 함께 표시 (하이브리드)
- 구글 로그인 직후 캘린더 권한 자동 요청

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
**상태**: 🔲 미착수

**파일:**
- `server/controllers/authController.js` — 2개 엔드포인트 추가
- `server/routes/auth.js` — 라우트 등록

**작업 내용:**
- `GET /api/auth/google/calendar-consent` — Google OAuth URL 생성
  - calendar scope, access_type=offline, prompt=consent
  - state에 userId 포함
- `GET /api/auth/google/calendar-callback` — 인증 코드 → 토큰 교환
  - `user.google.refreshToken` 저장
  - 클라이언트로 redirect
- `.env`에 `GOOGLE_REDIRECT_URI` 확인/추가

**버그/이슈:**
- (없음)

---

### 2단계: 클라이언트 - 로그인 후 캘린더 권한 요청
**상태**: 🔲 미착수

**파일:**
- `client/src/components/auth/LoginForm.js`

**작업 내용:**
- Google 로그인 성공 후 `user.google.refreshToken` 없으면
  → 서버에서 consent URL 받아 `window.location.href`로 이동
- callback 후 돌아오면 정상 앱 진입

**버그/이슈:**
- (없음)

---

### 3단계: 클라이언트 - Google Calendar 서비스 생성
**상태**: 🔲 미착수

**파일 (신규):**
- `client/src/services/googleCalendarService.js`

**작업 내용:**
- 기존 서버 API (`/api/calendar/events`) 래핑
- `getEvents(timeMin, timeMax)` — 구글 캘린더 이벤트를 FullCalendar 형식으로 변환
- `createEvent(title, desc, start, end)` — POST
- `updateEvent(eventId, ...)` — PUT
- `deleteEvent(eventId)` — DELETE

**버그/이슈:**
- (없음)

---

### 4단계: MobileCalendarView 수정 — 하이브리드 표시
**상태**: 🔲 미착수

**파일:**
- `client/src/components/mobile/MobileCalendarView.js`

**작업 내용:**
- `loginMethod` 확인하여 구글 사용자일 경우:
  - `fetchSchedule`에서 기존 DB 데이터(선호시간/개인시간) + 구글 캘린더 이벤트 모두 fetch
  - `convertScheduleToEvents`에서 기존 blue(선호)/red(개인) 이벤트 생성 + 구글 캘린더 이벤트(별도 색상) 합쳐서 표시
- 일반 사용자: 기존 로직 그대로
- 편집 모드: 구글 사용자도 선호시간/개인시간 편집 가능 (DB 저장), 구글 일정은 편집모드와 무관

**버그/이슈:**
- (없음)

---

### 5단계: 채팅 연동 분기
**상태**: 🔲 미착수

**파일:**
- `client/src/hooks/useChat/hooks/useEventAdd.js`

**작업 내용:**
- `loginMethod === 'google'`이면 `googleCalendarService.createEvent()` 호출
- 일반 사용자: 기존 로직 (프로필 personalTimes 또는 /api/events)
- 삭제/수정도 동일하게 분기

**버그/이슈:**
- (없음)

---

### 6단계: 구글 캘린더 일정 상세 모달
**상태**: 🔲 미착수

**파일:**
- `client/src/components/mobile/MobileCalendarView.js` (eventClick 핸들러)

**작업 내용:**
- 구글 캘린더 이벤트 클릭 시 기존 EventDetailModal에 표시
- 삭제 버튼 → `googleCalendarService.deleteEvent()` 호출

**버그/이슈:**
- (없음)

---

## 핵심 파일 목록

| # | 파일 | 역할 |
|---|------|------|
| 1 | `server/controllers/authController.js` | OAuth 동의 엔드포인트 |
| 2 | `server/routes/auth.js` | 라우트 등록 |
| 3 | `server/controllers/calendarController.js` | 기존 구글 캘린더 CRUD (검증) |
| 4 | `client/src/services/googleCalendarService.js` | 신규 서비스 |
| 5 | `client/src/components/auth/LoginForm.js` | 로그인 후 권한 요청 |
| 6 | `client/src/components/mobile/MobileCalendarView.js` | 하이브리드 표시 |
| 7 | `client/src/hooks/useChat/hooks/useEventAdd.js` | 채팅 일정 추가 분기 |

---

## 검증 체크리스트
- [ ] 일반 로그인 → 기존과 동일하게 동작
- [ ] 구글 로그인 → 캘린더 권한 동의 화면 → 승인 → 앱 복귀
- [ ] 구글 사용자 캘린더에 구글 일정(초록) + 선호시간(파랑) + 개인시간(빨강) 함께 표시
- [ ] 채팅으로 "내일 3시 회의" → 구글 캘린더에 일정 생성 확인
- [ ] 구글 일정 클릭 → 상세 보기 → 삭제 → 구글 캘린더에서도 삭제 확인
- [ ] 편집 모드에서 선호시간/개인시간 수정 → 저장 → 정상 반영

---

## 버그 로그

| # | 단계 | 내용 | 원인 | 해결 | 상태 |
|---|------|------|------|------|------|
| - | - | - | - | - | - |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-03 | 문서 작성, 구현 시작 |
