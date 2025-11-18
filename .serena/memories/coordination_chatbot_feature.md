# 일정맞추기 탭 채팅봇 기능 정리

## 개요
일정맞추기(Coordination) 탭에서 조원이 자동배정된 시간을 **채팅으로 변경**할 수 있는 기능

## 핵심 파일 위치

### 1. 프론트엔드
- **ChatBox.js**: `client/src/components/chat/ChatBox.js`
  - 모든 탭에서 사용되는 메인 채팅 UI 컴포넌트
  - 오른쪽 하단에 고정 버튼으로 표시
  - 헤더: "AI 일정 도우미"

- **useChat.js**: `client/src/hooks/useChat.js`
  - **핵심 로직이 있는 파일**
  - `context.context === 'coordination' && context.roomId` 조건에서 시간 변경 기능 활성화
  - Gemini AI로 자연어 파싱 → smart-exchange API 호출

- **CoordinationChatBot.js**: `client/src/components/coordination/chat/CoordinationChatBot.js`
  - **사용되지 않는 파일** (UI에 통합되지 않음)
  - 별도의 채팅봇 컴포넌트로 만들어졌지만 실제로는 useChat.js 훅에서 처리

### 2. 백엔드
- **coordinationExchangeController.js**: `server/controllers/coordinationExchangeController.js`
  - `parseExchangeRequest`: Gemini로 자연어 메시지 파싱
  - `smartExchange`: 시간 변경/교환 실행

## API 엔드포인트
- `POST /api/coordination/rooms/:roomId/parse-exchange-request` - 메시지 파싱
- `POST /api/coordination/rooms/:roomId/smart-exchange` - 교환 실행

## 기능 상세

### 조원이 채팅으로 할 수 있는 것:
1. **시간 변경 요청**
   - "수요일로 바꿔줘"
   - "월요일 9시로 바꿔줘"
   - "금요일로 이동해줘"

2. **확인/거절**
   - "네" / "예" / "응" → 확인
   - "아니요" / "취소" → 거절

### 동작 방식:
1. 사용자가 메시지 입력
2. Gemini AI가 의도 파싱 (time_change, confirm, reject)
3. smart-exchange API 호출
4. **즉시 교환** (목표 시간이 비어있는 경우)
5. 또는 **교환 요청 생성** (목표 시간에 다른 사람이 있는 경우)

## 탭별 채팅봇 기능 차이

| 탭 | 서브타이틀 | 주요 기능 |
|---|---|---|
| profile | 내 프로필 일정 관리 | 개인 일정 추가/수정/삭제 |
| events | 나의 일정 관리 | 일정 추가/수정/삭제 |
| googleCalendar | Google 캘린더 관리 | Google 연동 일정 관리 |
| coordination | 일정 추가, 수정, 삭제를 도와드립니다 | **배정 시간 변경** (useChat.js에서 context로 구분) |

## 주의사항
- `CoordinationChatBot.js`는 별도 컴포넌트로 존재하지만 **실제로 사용되지 않음**
- 실제 기능은 **ChatBox.js + useChat.js 조합**으로 작동
- context에 `{ context: 'coordination', roomId }` 전달 필요

## 관련 이벤트
- `coordinationUpdate`: 시간 변경 성공 시 발생하는 이벤트
  ```javascript
  window.dispatchEvent(new CustomEvent('coordinationUpdate', {
     detail: { type: 'timeSwap', roomId: context.roomId }
  }));
  ```
