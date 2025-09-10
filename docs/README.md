# AI Meeting Scheduler

AI 기반 미팅 스케줄링 시스템

## 프로젝트 구조

```
AI_sound/
├── client/          # React 프론트엔드
├── server/          # Express.js 백엔드
├── package.json     # 루트 패키지 설정
├── Procfile         # 헤로쿠 배포 설정
└── README.md
```

## 설치 및 실행

### 전체 설치
```bash
npm run install:all
```

### 개발 모드 실행
```bash
npm run dev
```

### 프로덕션 실행
```bash
npm start
```

## 환경 설정

`server/.env` 파일에 다음 환경변수를 설정하세요:

```
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000
REACT_APP_API_BASE_URL=http://localhost:5000
```

## 주요 기능

- AI 기반 미팅 스케줄링
- Google Calendar 연동
- 사용자 인증 (JWT)
- 실시간 캘린더 관리

## 기술 스택

### Frontend
- React 19.1.0
- React Router DOM
- React Big Calendar
- Tailwind CSS
- Lucide React Icons

### Backend
- Node.js / Express.js
- MongoDB / Mongoose
- JWT 인증
- Google APIs
- Helmet, CORS, Compression

## 배포

헤로쿠 배포가 설정되어 있습니다.

```bash
git push heroku main
```