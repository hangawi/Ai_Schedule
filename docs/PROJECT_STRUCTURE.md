# 프로젝트 구조

## 개요
AI 스케줄러는 AI 기반의 일정 관리 및 조율 시스템입니다.

## 폴더 구조

```
Ai_Schedule/
├── client/                 # React 프론트엔드
│   ├── src/
│   │   ├── components/     # UI 컴포넌트들
│   │   │   ├── auth/       # 인증 관련 컴포넌트
│   │   │   ├── calendar/   # 캘린더 컴포넌트
│   │   │   ├── chat/       # 채팅 컴포넌트
│   │   │   ├── modals/     # 모달 컴포넌트들
│   │   │   └── timetable/  # 시간표 컴포넌트
│   │   ├── hooks/          # React 커스텀 훅들
│   │   └── services/       # API 서비스 레이어
│   └── archive/            # 사용하지 않는 클라이언트 파일들
├── server/                 # Node.js 백엔드
│   ├── controllers/        # 컨트롤러 (비즈니스 로직)
│   ├── models/            # 데이터베이스 모델들
│   ├── routes/            # API 라우트 정의
│   ├── services/          # 서비스 레이어
│   ├── utils/             # 유틸리티 함수들
│   └── config/            # 설정 파일들
├── docs/                  # 문서들
├── legacy/                # 레거시 코드 및 사용하지 않는 파일들
└── archive/               # 사용하지 않는 테스트 파일들
```

## 주요 기능

### 클라이언트 (React)
- **인증**: JWT 기반 사용자 인증
- **일정 관리**: 개인 캘린더 및 이벤트 관리
- **조율 시스템**: 그룹 시간표 조율
- **AI 기능**: 
  - 클립보드 텍스트 자동 일정 인식 (LLM)
  - 백그라운드 대화 녹음 및 요약
  - 음성 명령 인식

### 서버 (Node.js)
- **인증 API**: 회원가입, 로그인, JWT 토큰 관리
- **이벤트 API**: 개인 일정 CRUD
- **조율 API**: 그룹 방 생성, 참가, 시간표 관리
- **AI 분석 API**: LLM 기반 텍스트 및 음성 분석
- **사용자 API**: 사용자 정보 관리

## 색상 시스템
- **방장**: `#DC2626` (진한 빨간색) + 👑 아이콘
- **멤버들**: 20가지 구분 가능한 색상 중 자동 할당 (중복 방지)

## 데이터베이스 모델
- **User**: 사용자 정보
- **Event**: 개인 일정
- **Room**: 조율 방 정보 (멤버, 색상, 시간표 포함)

## API 엔드포인트

### 인증
- `POST /api/auth/login` - 로그인
- `POST /api/auth/register` - 회원가입

### 이벤트
- `GET /api/events` - 일정 목록
- `POST /api/events` - 일정 생성
- `PUT /api/events/:id` - 일정 수정
- `DELETE /api/events/:id` - 일정 삭제

### 조율
- `GET /api/coordination/my-rooms` - 내 방 목록
- `POST /api/coordination/rooms` - 방 생성
- `POST /api/coordination/rooms/:code/join` - 방 참가
- `POST /api/coordination/rooms/:id/slots` - 시간표 제출

### AI 분석
- `POST /api/call-analysis/analyze-clipboard` - 클립보드 텍스트 분석
- `POST /api/call-analysis/analyze` - 대화 내용 분석

## 환경 변수
```
# 서버 설정
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/aischedule

# JWT 시크릿
JWT_SECRET=your_jwt_secret

# AI API 키
GEMINI_API_KEY=your_gemini_api_key
```

## 개발 명령어

### 클라이언트
```bash
cd client
npm start          # 개발 서버 시작
npm run build      # 프로덕션 빌드
```

### 서버
```bash
cd server
npm run dev        # 개발 서버 시작 (nodemon)
npm start          # 프로덕션 서버 시작
```

### 전체 프로젝트
```bash
npm run dev        # 클라이언트 + 서버 동시 실행
npm run build      # 전체 빌드
```

## 기술 스택
- **Frontend**: React, Tailwind CSS, Lucide Icons
- **Backend**: Node.js, Express, MongoDB, Mongoose
- **AI**: Google Gemini API
- **인증**: JWT
- **기타**: Web Speech API, Clipboard API