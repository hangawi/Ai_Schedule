# Ai_Mobile 프로젝트 생성 계획

> 생성일: 2026-02-13
> 목적: Ai_Schedule에서 모바일 전용 최종본을 Ai_Mobile로 복사 생성
> 대상: `C:\Users\예상\OneDrive\Desktop\프로젝트\Ai_Mobile`

---

## Phase 1: 전체 프로젝트 복사

- [ ] 1-1. node_modules, .git 제외하고 전체 복사
- [ ] 1-2. package.json 이름 변경 (root, client, server)

## Phase 2: 서버 nview 제거

- [ ] 2-1. `server/routes/nview.js` + `server/routes/nview/` 삭제
- [ ] 2-2. `server/index.js`에서 nview 라우트 제거
- [ ] 2-3. `client/public/nview/` 삭제

## Phase 3: 클라이언트 데스크톱 전용 코드 제거

- [ ] 3-1. `SchedulingSystem.js` 삭제
- [ ] 3-2. `components/layout/` 삭제 (Header, Sidebar, MainContent)
- [ ] 3-3. `components/admin/` 삭제
- [ ] 3-4. `components/forms/` 삭제
- [ ] 3-5. `components/indicators/` 삭제
- [ ] 3-6. `components/profile/` 삭제
- [ ] 3-7. `components/guides/` 삭제
- [ ] 3-8. `components/tabs/` 데스크톱 전용 탭 삭제 (CoordinationTab 유지)
- [ ] 3-9. `contexts/AdminContext.js` 삭제

## Phase 4: App.js 모바일 전용 라우팅 수정

- [ ] 4-1. 데스크톱 import 제거 (SchedulingSystem, AdminProvider, BackgroundGuide)
- [ ] 4-2. 라우팅을 모바일 전용으로 변경 (/ → MobileDashboard)
- [ ] 4-3. AdminProvider 래핑, BackgroundGuide 등 데스크톱 코드 제거

## Phase 5: 모바일 경로 업데이트

- [ ] 5-1. `/mobile/calendar` → `/calendar` (7개 파일)
- [ ] 5-2. `/mobile/schedule` → `/schedule`
- [ ] 5-3. `/mobile/groups` → `/groups`
- [ ] 5-4. `/mobile/settings` → `/settings`

## Phase 6: 설치 및 빌드 테스트

- [ ] 6-1. npm install:all
- [ ] 6-2. npm run build (빌드 에러 확인)
- [ ] 6-3. 빌드 에러 수정

## Phase 7: 최종 검증

- [ ] 7-1. dead import 검색 (SchedulingSystem, AdminProvider, /mobile/, nview)
- [ ] 7-2. 기능 동작 확인

---

## 삭제 대상 요약

| 디렉토리/파일 | 사유 |
|---|---|
| `server/routes/nview*` | 교육 게임 (제외) |
| `client/public/nview/` | 교육 게임 public |
| `client/src/SchedulingSystem.js` | 데스크톱 메인 |
| `client/src/contexts/AdminContext.js` | 데스크톱 관리자 |
| `components/layout/*` | 데스크톱 레이아웃 |
| `components/admin/*` | 데스크톱 관리자 |
| `components/forms/*` | 데스크톱 폼 |
| `components/indicators/*` | 데스크톱 인디케이터 |
| `components/profile/*` | 데스크톱 프로필 |
| `components/guides/*` | 데스크톱 가이드 |
| `components/tabs/*.js` (CoordinationTab 제외) | 데스크톱 탭 |

## 유지 대상 (모바일 의존성 체인)

| 디렉토리 | 사유 |
|---|---|
| `components/mobile/*` | 모바일 뷰 전체 |
| `components/auth/*` | 로그인/회원가입 |
| `components/chat/*` | ChatBox |
| `components/common/*` | AddressAutocomplete |
| `components/coordination/*` | CoordinationTab 의존 |
| `components/timetable/*` | CoordinationTab 의존 |
| `components/calendar/*` | CalendarView, CoordinationCalendarView |
| `components/scheduler/*` | AutoSchedulerPanel |
| `components/modals/*` | 다수 모달 공유 |
| `components/tabs/CoordinationTab/*` | MobileGroupsView 사용 |
| `hooks/*`, `services/*`, `utils/*` | 전체 유지 |
| `contexts/ToastContext.js` | 전역 알림 |
| `config/*`, `constants/*` | 설정/상수 |
