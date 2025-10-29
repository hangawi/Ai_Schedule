# 🏗️ AI Schedule Optimizer Architecture

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                         사용자 (User)                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   TimetableUploadBox                             │
│  • 이미지 업로드                                                  │
│  • OCR 처리 (extractSchedulesFromImages)                         │
│  • 진행률 표시                                                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              ScheduleOptimizationModal                           │
│  • 최적 조합 표시                                                 │
│  • 주간 시간표 그리드                                             │
│  • 채팅 기반 수정 (삭제/추가/변경)                                │
│  • [AI 자동 최적화] 버튼 ← NEW!                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              ScheduleOptimizerModal (NEW!)                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Step 1: Intro                                          │    │
│  │  • 충돌 요약 표시                                        │    │
│  │  • 전체 일정 개수                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Step 2: Questions                                      │    │
│  │  • 하교 시간                                            │    │
│  │  • 취침 시간                                            │    │
│  │  • 이동 시간                                            │    │
│  │  • 우선순위 과목                                        │    │
│  │  • 우선순위 순위                                        │    │
│  │  • 휴식 요일                                            │    │
│  │  • 저녁 식사 시간                                       │    │
│  │  • 숙제 시간                                            │    │
│  │  • [GPT 사용] 토글                                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Step 3: Processing                                     │    │
│  │  • AI 처리 중 애니메이션                                │    │
│  │  • 로딩 메시지                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Step 4: Result                                         │    │
│  │  • 최적화된 스케줄                                       │    │
│  │  • AI 설명                                              │    │
│  │  • 통계 (총 시간, 요일별 분포)                           │    │
│  │  • 대안 제시                                            │    │
│  │  • 실용적인 팁                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                scheduleOptimizer.js (Utils)                      │
│  • detectConflicts(schedules)                                    │
│  • generateOptimizationQuestions(schedules, conflicts)           │
│  • optimizeScheduleWithGPT(schedules, conflicts, answers)        │
│  • generateAutoSchedule(schedules, preferences)                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend API (Express)                         │
│  POST /api/schedule/optimize                                     │
│  • 구조화된 프롬프트 생성                                         │
│  • Gemini AI 호출                                                │
│  • JSON 응답 파싱                                                │
│  • 통계 계산                                                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Gemini AI (Google)                            │
│  Model: gemini-2.0-flash-exp                                     │
│  • 스케줄 분석                                                    │
│  • 충돌 해결                                                     │
│  • 최적 조합 생성                                                 │
│  • 대안 제시                                                     │
│  • 설명 생성                                                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      최적화 결과 반환                             │
│  {                                                               │
│    optimizedSchedule: [...],                                     │
│    explanation: "...",                                           │
│    conflictsResolved: 12,                                        │
│    alternatives: [...],                                          │
│    tips: [...],                                                  │
│    weeklyStructure: {...},                                       │
│    statistics: {...}                                             │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

## 데이터 흐름

### 1. 입력 단계
```javascript
// 사용자 업로드
Images[] → OCR → Schedules[]

// 스케줄 구조
{
  title: "영어학원",
  days: ["MON", "WED", "FRI"],
  startTime: "16:00",
  endTime: "17:00",
  duration: 60,
  gradeLevel: "elementary"
}
```

### 2. 충돌 감지
```javascript
// detectConflicts()
Schedules[] → Analysis → Conflicts[]

// 충돌 구조
{
  day: "TUE",
  schedule1: {...},
  schedule2: {...},
  overlapMinutes: 30
}
```

### 3. 질문 생성
```javascript
// generateOptimizationQuestions()
Schedules[] + Conflicts[] → Questions[]

// 질문 구조
{
  id: "school_end_time",
  question: "하교 시간은 언제인가요?",
  type: "time",
  required: true,
  defaultValue: "15:00"
}
```

### 4. AI 최적화
```javascript
// optimizeScheduleWithGPT()
{
  schedules: [...],
  conflicts: [...],
  userPreferences: {
    school_end_time: "15:00",
    bedtime: "22:00",
    travel_time: 10,
    priority_subjects: ["영어", "댄스", "축구"],
    priority_ranking: ["영어", "축구", "댄스"],
    preferred_rest_days: ["수요일"],
    dinner_time: { start: "18:00", end: "19:00" },
    homework_time: 30
  }
}
→ Gemini API
→ Optimized Result
```

### 5. 결과 적용
```javascript
// ScheduleOptimizationModal
OptimizedResult → Update Combination → Display

// 채팅 메시지로 표시
"✨ AI 최적화 완료!

{AI 설명}

12건의 충돌이 해결되었습니다."
```

## API 엔드포인트

### POST /api/schedule/optimize

**Request:**
```json
{
  "schedules": [
    {
      "title": "영어학원",
      "days": ["MON", "WED", "FRI"],
      "startTime": "16:00",
      "endTime": "17:00",
      "duration": 60
    }
  ],
  "conflicts": [
    {
      "day": "TUE",
      "schedule1": {...},
      "schedule2": {...}
    }
  ],
  "userPreferences": {
    "school_end_time": "15:00",
    "bedtime": "22:00",
    ...
  }
}
```

**Response:**
```json
{
  "success": true,
  "optimizedSchedule": [...],
  "alternatives": [...],
  "explanation": "화요일 영어를 제거하여...",
  "conflictsResolved": 12
}
```

## 주요 컴포넌트 관계

```
TimetableUploadBox
  ├── extractSchedulesFromImages()
  └── onSchedulesExtracted()
        │
        ▼
ChatBox
  └── handleSchedulesExtracted()
        │
        ▼
ScheduleOptimizationModal
  ├── ScheduleGridSelector (시각화)
  ├── Chat Interface (수정)
  └── [AI 자동 최적화] 버튼
        │
        ▼
ScheduleOptimizerModal
  ├── detectConflicts()
  ├── generateOptimizationQuestions()
  └── optimizeScheduleWithGPT()
        │
        ▼
Backend API
  └── POST /api/schedule/optimize
        │
        ▼
Gemini AI
  └── gemini-2.0-flash-exp
```

## 파일 의존성

```
ScheduleOptimizationModal.js
  ├── import ScheduleOptimizerModal from './ScheduleOptimizerModal'
  ├── import { detectConflicts } from '../../utils/scheduleOptimizer'
  └── import { Sparkles } from 'lucide-react'

ScheduleOptimizerModal.js
  ├── import { detectConflicts } from '../../utils/scheduleOptimizer'
  ├── import { generateOptimizationQuestions } from '../../utils/scheduleOptimizer'
  └── import { optimizeScheduleWithGPT } from '../../utils/scheduleOptimizer'

scheduleOptimizer.js (utils)
  └── axios.post('/api/schedule/optimize')

scheduleOptimizer.js (routes)
  ├── require('@google/generative-ai')
  └── require('../middleware/auth')
```

## 상태 관리

### ScheduleOptimizationModal
- `currentIndex`: 현재 조합 인덱스
- `modifiedCombinations`: 수정된 조합들
- `chatMessages`: 채팅 메시지 배열
- `showOptimizer`: AI 최적화 모달 표시 여부 (NEW!)

### ScheduleOptimizerModal
- `currentStep`: 현재 단계 (intro/questions/processing/result)
- `questions`: 생성된 질문 배열
- `answers`: 사용자 답변
- `useGPT`: GPT 사용 여부
- `result`: 최적화 결과

## 에러 핸들링

1. **API 타임아웃** (180초)
   - 처리: 원본 스케줄 반환
   - 메시지: "처리 시간이 너무 오래 걸립니다"

2. **JSON 파싱 에러**
   - 처리: fallback to original schedules
   - 로깅: console.error()

3. **충돌 없음**
   - 처리: 질문 단계 스킵
   - 직접 규칙 기반 최적화

4. **필수 질문 미답변**
   - 처리: 다음 단계 진행 불가
   - 에러 메시지 표시

## 보안

- ✅ JWT 인증 (auth middleware)
- ✅ GEMINI_API_KEY 환경 변수
- ✅ 타임아웃 설정
- ✅ 입력 검증

## 성능

- ⚡ AI 응답 캐싱 (예정)
- ⚡ 병렬 충돌 감지
- ⚡ 질문 동적 생성
- ⚡ 프론트엔드 상태 최적화
