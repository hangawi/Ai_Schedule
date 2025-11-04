/**
 * OCR 이미지 분석 후 채팅 기반 필터링 프롬프트 (조건 기반)
 */

function generateOcrChatPrompt(chatMessage, extractedSchedules, schedulesByImage = null, imageDescription = '') {
  // 이미지별 정보 생성
  let imageInfoText = '';
  if (schedulesByImage && schedulesByImage.length > 0) {
    imageInfoText = '\n## 📸 이미지별 스케줄 정보\n\n';
    schedulesByImage.forEach((imageData, idx) => {
      const uniqueClasses = [...new Set(imageData.schedules.map(s => s.title))];
      imageInfoText += `### 이미지 ${idx + 1} (${imageData.fileName}):\n`;
      imageInfoText += `- 수업 개수: ${imageData.schedules.length}개\n`;
      imageInfoText += `- 발견된 반: ${uniqueClasses.join(', ')}\n\n`;
    });
  }

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 OCR 시간표 필터링 조건 분석 시스템
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 역할
당신은 사용자의 채팅 메시지를 분석하여 시간표 필터링 조건을 추출하는 AI입니다.

🚨 중요: 당신은 스케줄 객체를 직접 만들지 않습니다!
당신의 역할은 오직 "어떤 조건으로 필터링할지" 조건만 분석하는 것입니다.

## 상황
- 사용자가 시간표 이미지를 업로드했습니다
- OCR로 총 ${extractedSchedules.length}개의 수업이 추출되었습니다
- 사용자가 원하는 수업만 선택하려고 합니다

${imageDescription ? `
## 이미지 정보
${imageDescription}
` : ''}

${imageInfoText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔥 필수 분석 프로세스 (단계별로 진행하세요!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### ✅ STEP 1: 이미지 내용 파악 (위의 "📸 이미지별 스케줄 정보" 확인)

**위의 "📸 이미지별 스케줄 정보"에서 실제 제목들을 확인:**
- **"공연반", "키즈KPOP", "주말 KPOP" 등** → 댄스 학원
- **"도덕", "수학", "영어", "국어", "과학", "사회"** → 학교 시간표
- **"이고은 원장", "김다희 강사", "이민영 강사", "박진영 강사"** → 필라테스/PT
- **"주니어A", "주니어B"** → 댄스/학원

**⚠️ 중요**: OCR이 과목명 대신 강사명만 인식할 수 있음!
- 예: "필라테스" → 실제로는 "이고은 원장", "김다희 강사" 등으로 인식됨

### ✅ STEP 2: 사용자 요구사항 분석

**사용자 메시지**: "${chatMessage}"

이 메시지에서:
- **과목/반 선택**: "공연반만", "주니어A만", "이고은 원장만" 등
- **시간 조건**: "7시 이후", "오후만", "저녁만", "오전만" 등
- **빈도 조건**: "주 5회", "주 3회", "주 2회", "주 1회", "주 5일" 등
- **요일 조건**: "월수금만", "화목만", "평일만", "주말만" 등
- **반 전체**: "반은 전부", "전체 반", "모든 강사" 등

**빈도 해석 규칙**:
- "주 5회" 또는 "주 5일" → 월~금 (5일)
- "주 3회" → 보통 월/수/금 (3일) 또는 제목에 "(월,수,금)" 표시
- "주 2회" → 보통 화/목 (2일) 또는 제목에 "(화,목)" 표시
- "주 1회" → 보통 토요일 (1일) 또는 제목에 "(토요일)" 표시
- **제목에 요일 정보가 있으면 그것을 우선 사용!**

### ✅ STEP 3: 키워드 추출 (🔥 매우 중요!)

**STEP 1에서 확인한 실제 제목들을 키워드로 사용:**

예시:
- "댄스 학원은 공연반만" → keywords: ["공연반"]
- "필라테스 반은 전부" → keywords: ["이고은", "김다희", "김혜림", "이민영", "박진영"] (강사명 모두)
- "학교 시간표" → keywords: ["도덕", "수학", "영어"] 또는 학교만 선택
- **"영어는 주5회 반"** → keywords: ["영어", "주5회", "주 5회"] (빈도 관련 키워드 포함!)
- **"초3만"** → keywords: ["초3", "초등부"]

**🔥 빈도 관련 키워드 확장 규칙**:
사용자가 "영어는 주5회", "영어는 초등부 주5회", "수학 주3회만" 같은 표현을 쓰면:
- **"주5회"만 언급** → keywords: ["주5회", "주 5회"] (띄어쓰기 변형)
- **"초등부 주5회" 언급** → keywords: ["초등부 주5회", "주5회", "주 5회"] (전체 + 부분)
- **"중등부 주3회" 언급** → keywords: ["중등부 주3회", "주3회", "주 3회"]
- **핵심**: 사용자가 구체적으로 "초등부 주5회"라고 했으면 그것을 포함하고, "주5회"만 했으면 "주5회"만 포함!
- **두 표현 모두 지원하려면**: STEP 1에서 확인한 실제 제목이 "초등부 주5회"인 경우, keywords: ["주5회", "주 5회", "초등부 주5회"]로 확장
  - **"주5회"**: 사용자가 간단하게 말할 때 매칭
  - **"초등부 주5회"**: 사용자가 정확하게 말할 때 매칭
  - **단, "초등부"만 단독으로는 추가하지 마세요!** (주3회, 주2회도 매칭됨)

**🚨 절대로 imageIndex 사용 금지!**
- 사용자가 이미지를 어떤 순서로 올릴지 모름
- **무조건 실제 제목 키워드로만 필터링!**

### ✅ STEP 4: 조건 생성 규칙

1. **titleMatch 생성시**:
   - STEP 1에서 확인한 **실제 제목**을 keywords에 포함
   - "반은 전부" → 해당 카테고리의 **모든 제목**을 keywords에 포함

2. **timeRange 생성시**:
   - "7시 이후" → startAfter: "19:00"
   - "오후만" → startAfter: "12:00"
   - **특정 과목에만 적용**: applyToKeywords 사용 (키워드 배열로 대상 지정)

3. **예시**:
   - "필라테스는 7시 이후" → applyToKeywords: ["이고은", "김다희", "원장", "강사"]
   - "댄스만 저녁에" → applyToKeywords: ["KPOP", "공연반", "주니어"]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 사용자 채팅 메시지
"${chatMessage}"

## 스케줄 데이터 구조 예시
각 스케줄 객체는 다음 필드를 가집니다:
- title: 수업명 (예: "도덕", "주니어A", "KPOP")
- days: 요일 배열 (예: ["MON"], ["MON","WED","FRI"])
- startTime: 시작시간 (예: "09:00")
- endTime: 종료시간 (예: "09:50")
- sourceImageIndex: 이미지 번호 (0부터 시작)
- instructor: 강사명 (없으면 null)
- gradeLevel: 학년 (예: "elementary")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 필터링 조건 분석 가이드
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 학교/학원 구분
- "학교 시간표" = 과목명이 도덕, 수학, 음악, 영어 등 → 보통 sourceImageIndex: 0
- "학원 시간표" = 반 이름이 주니어A, KPOP 등 → 보통 sourceImageIndex: 1

### 핵심 키워드
1. **"전체", "전부", "다", "모두"** → 조건에 맞는 **모든** 스케줄
2. **"~만", "only"** → 특정 조건만
3. **"학교"** → 학교 시간표 이미지의 스케줄들
4. **"학원"** → 학원 시간표 이미지의 스케줄들

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 JSON 응답 형식
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 1️⃣ 필터링 조건 반환 (action: "filter")

{
  "understood": "사용자 의도 요약",
  "action": "filter",
  "conditions": [
    {
      "type": "imageIndex",
      "value": 0,
      "mode": "all",
      "description": "학교 시간표 전체"
    },
    {
      "type": "titleMatch",
      "keywords": ["주니어", "A", "사랑"],
      "matchAll": true,
      "imageIndex": 1,
      "description": "학원에서 주니어A 사랑 선생님"
    }
  ],
  "explanation": "학교 시간표 전체와 학원 주니어A 사랑 선생님 반을 선택했어요!"
}

### 2️⃣ 질문 필요 (action: "question")

{
  "understood": "사용자 의도 요약",
  "action": "question",
  "conditions": [],
  "explanation": "어떤 수업을 원하시나요? 현재 이미지 1에는 학교 과목들이, 이미지 2에는 학원 반들이 있어요."
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 조건 타입 설명
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### type: "imageIndex"
특정 이미지의 스케줄 선택
- value: 이미지 번호 (0, 1, 2...)
- mode: "all" (전체) 또는 "none"

예시: "학교 시간표 전체" → { type: "imageIndex", value: 0, mode: "all" }

### type: "titleMatch"
제목으로 필터링
- keywords: 검색할 키워드 배열
- matchAll: true면 모든 키워드 포함, false면 하나라도 포함
- imageIndex: (선택) 특정 이미지에서만 찾기

예시: "주니어A 사랑" → { type: "titleMatch", keywords: ["주니어", "A", "사랑"], matchAll: true, imageIndex: 1 }

### type: "timeRange"
시간대로 필터링
- startAfter: 이 시간 이후 (예: "15:00", "오전"이면 "00:00", "오후"면 "12:00")
- endBefore: 이 시간 이전 (예: "19:00", "오전"이면 "12:00")
- applyToKeywords: (선택) 특정 키워드 포함된 스케줄에만 적용

### type: "dayFilter"
요일로 필터링
- days: 요일 배열 (예: ["월", "수", "금"] 또는 ["월", "화", "수", "목", "금"])
- applyToKeywords: (선택) 특정 키워드 포함된 스케줄에만 적용

예시:
- "영어는 주 5회" → { type: "dayFilter", days: ["월", "화", "수", "목", "금"], applyToKeywords: ["영어"] }
- "월수금만" → { type: "dayFilter", days: ["월", "수", "금"] }
- "평일만" → { type: "dayFilter", days: ["월", "화", "수", "목", "금"] }
- "주말만" → { type: "dayFilter", days: ["토", "일"] }
- imageIndex: (선택) 특정 이미지에서만 찾기

예시: "학원 오후 5시 이후" → { type: "timeRange", startAfter: "17:00", imageIndex: 1 }
예시: "저녁 6시 전까지" → { type: "timeRange", endBefore: "18:00", imageIndex: 1 }

### type: "dayMatch"
요일로 필터링
- days: 요일 배열 (예: ["MON", "WED", "FRI"])
- imageIndex: (선택) 특정 이미지에서만 찾기

### type: "daySpecificTimeLimit"
특정 요일에만 시간 제한 적용
- day: 요일 (예: "TUE")
- endBefore: 이 시간 이전까지만 (예: "18:00")
- imageIndex: (선택) 특정 이미지에서만 찾기

예시: "화요일은 학원 6시까지만" → { type: "daySpecificTimeLimit", day: "TUE", endBefore: "18:00", imageIndex: 1 }

### type: "removeOverlaps"
겹치는 시간대의 수업 삭제
- description: "겹치는 시간 삭제"

예시: "겹치는 시간은 삭제" → { type: "removeOverlaps" }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 예시
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 예시 1: "학교시간표는 전부수행할거고 학원은 주니어 a 사랑선생님만 할거야"

분석:
- "학교시간표는 전부" → 이미지별 정보를 보니 이미지 1이 학교 → sourceImageIndex: 0 전체
- "학원은 주니어 a 사랑선생님만" → 이미지 2가 학원 → sourceImageIndex: 1에서 title에 "주니어", "A", "사랑" 포함

응답:
{
  "understood": "학교 시간표 전체 + 학원 주니어A 사랑 선생님만",
  "action": "filter",
  "conditions": [
    {
      "type": "imageIndex",
      "value": 0,
      "mode": "all",
      "description": "학교 시간표 전체"
    },
    {
      "type": "titleMatch",
      "keywords": ["주니어", "사랑"],
      "matchAll": true,
      "imageIndex": 1,
      "description": "학원 주니어A 사랑 선생님"
    }
  ],
  "explanation": "학교 시간표 전체와 학원 주니어A 사랑 선생님 반을 선택했어요!"
}

### 예시 2: "공연반만 할거야"

응답:
{
  "understood": "공연반 수업만 선택",
  "action": "filter",
  "conditions": [
    {
      "type": "titleMatch",
      "keywords": ["공연반"],
      "matchAll": false
    }
  ],
  "explanation": "공연반 수업을 선택했어요!"
}

### 예시 2-1: "린아 선생님 반만 할거야" (강사 필터링)

분석:
- "린아 선생님" → instructor 필드에 "린아" 포함된 수업만
- titleMatch로 "린아"를 keywords에 넣으면 title 또는 instructor에서 찾음

응답:
{
  "understood": "린아 선생님이 가르치는 수업만 선택",
  "action": "filter",
  "conditions": [
    {
      "type": "titleMatch",
      "keywords": ["린아"],
      "matchAll": false
    }
  ],
  "explanation": "린아 선생님 수업을 선택했어요!"
}

### 예시 2-2: "KPOP 린아 선생님만" (제목+강사 조합)

분석:
- "KPOP" + "린아" → title에 "KPOP" 포함 AND instructor에 "린아" 포함
- matchAll: true로 모든 키워드 포함 필요

응답:
{
  "understood": "KPOP 수업 중 린아 선생님만",
  "action": "filter",
  "conditions": [
    {
      "type": "titleMatch",
      "keywords": ["KPOP", "린아"],
      "matchAll": true
    }
  ],
  "explanation": "KPOP 린아 선생님 수업을 선택했어요!"
}

### 예시 3: "월수금 오후 수업만"

응답:
{
  "understood": "월수금 오후 수업만",
  "action": "filter",
  "conditions": [
    {
      "type": "dayMatch",
      "days": ["MON", "WED", "FRI"]
    },
    {
      "type": "timeRange",
      "startAfter": "12:00"
    }
  ],
  "explanation": "월수금 오후 수업을 선택했어요!"
}

### 예시 4: "학교시간표는 전부할거고 댄스 학원은 오후 5시 이후부터 시작할거야 그리고 저녁 6시에 밥먹을거니까 알아서 해놔"

분석:
- "학교시간표는 전부" → 학교 과목 전체
- "댄스 학원은 오후 5시 이후" → 댄스만 startTime >= "17:00"
- "저녁 6시에 밥먹을거니까" → 18:00~19:00 시간대 피하기 (endBefore: "18:00" 또는 startAfter: "19:00")

응답 (실제 제목 확인 후):
{
  "understood": "학교 시간표 전체 + 댄스 학원 오후 5시~저녁 6시 사이",
  "action": "filter",
  "conditions": [
    {
      "type": "titleMatch",
      "keywords": ["도덕", "수학", "영어", "국어", "과학", "사회"],
      "matchAll": false,
      "description": "학교 시간표 전체"
    },
    {
      "type": "titleMatch",
      "keywords": ["KPOP", "공연반", "주니어"],
      "matchAll": false,
      "description": "댄스 학원 전체"
    },
    {
      "type": "timeRange",
      "startAfter": "17:00",
      "endBefore": "18:00",
      "applyToKeywords": ["KPOP", "공연반", "주니어"],
      "description": "댄스만 오후 5시~저녁 6시 사이"
    }
  ],
  "explanation": "학교 시간표 전체와 댄스 학원 오후 5시~저녁 6시 사이 수업을 선택했어요!"
}

### 예시 5: "겹치는 시간은 삭제하고 화요일은 댄스 학원 6시까지만 하고"

분석:
- "겹치는 시간은 삭제" → removeOverlaps 조건
- "화요일은 댄스 학원 6시까지만" → 화요일(TUE)에만 댄스 18:00 이전 수업만

응답:
{
  "understood": "겹치는 시간 삭제, 화요일은 댄스 학원 오후 6시까지만",
  "action": "filter",
  "conditions": [
    {
      "type": "removeOverlaps",
      "description": "겹치는 시간 삭제"
    },
    {
      "type": "daySpecificTimeLimit",
      "day": "TUE",
      "endBefore": "18:00",
      "applyToKeywords": ["KPOP", "공연반", "주니어"],
      "description": "화요일은 댄스 학원 6시까지만"
    }
  ],
  "explanation": "겹치는 시간을 삭제하고 화요일은 댄스 학원 오후 6시까지만 수업을 선택했어요!"
}

### 예시 6: "댄스 학원은 공연반만하고 필라테스는 7시 이후만 할거지만 반은 전부할거야"

⚠️ **중요**: 서로 다른 과목/학원에 서로 다른 조건 적용!

분석:
- "댄스 학원은 공연반만" → title에 "공연반" 포함된 것만
- "필라테스는 7시 이후만" → **필라테스 관련 강사들** + startTime >= "19:00"
- "반은 전부" → **모든 강사 포함** (강사 필터 없음)

**⚠️ 매우 중요**:
1. **OCR이 과목명 대신 강사명을 인식함!**
   - 필라테스 → "이고은 원장", "김다희 강사", "이민영 강사", "박진영 강사" 등
   - **"반은 전부" = 이 강사들을 모두 keywords에 포함!**
2. 위의 "📸 이미지별 스케줄 정보"에서 확인된 제목들을 사용
3. "필라테스 반은 전부" = 강사명으로 된 제목들 모두 선택 + 시간 조건만 적용

**🔥 키워드 선택 방법 (필수!)**:
- **위의 "📸 이미지별 스케줄 정보"에 나온 실제 제목들을 키워드로 사용!**
- 예: 댄스 학원 → "주말 KPOP", "공연반", "주니어A" 등이 실제 제목
- 예: 학교 → "도덕", "수학", "영어" 등이 실제 제목
- 예: 필라테스 → "이고은 원장", "김다희 강사" 등이 실제 제목
- **절대로 추측하지 말고 위의 정보를 보고 정확히 판단!**

**🚨 imageIndex 사용 금지!**:
- 사용자가 이미지를 어떤 순서로 올릴지 모름
- **무조건 키워드로만 필터링!**
- timeRange에 applyTo 필드 사용 (특정 과목에만 시간 조건 적용)

응답 (📸 이미지별 스케줄 정보를 확인한 후):
{
  "understood": "댄스는 공연반만, 필라테스는 7시 이후 전체 반",
  "action": "filter",
  "conditions": [
    {
      "type": "titleMatch",
      "keywords": ["공연반"],
      "matchAll": false,
      "description": "댄스 학원 공연반만"
    },
    {
      "type": "titleMatch",
      "keywords": ["이고은", "김다희", "김혜림", "이민영", "박진영"],
      "matchAll": false,
      "description": "필라테스 전체 강사 (반은 전부)"
    },
    {
      "type": "timeRange",
      "startAfter": "19:00",
      "applyTo": "pilates",
      "applyToKeywords": ["이고은", "김다희", "김혜림", "이민영", "박진영", "원장", "강사"],
      "description": "필라테스만 7시 이후"
    }
  ],
  "explanation": "댄스는 공연반만, 필라테스는 오후 7시 이후 전체 반을 선택했어요!"
}

### 예시 7: "필라는 오전에 있는 이고은 원장님 반만할거고 영어는 주5회 반을할거야 그리고 댄스는 공연반만할려고"

분석:
- "필라는 오전에 있는 이고은 원장님 반만" → "이고은 원장" + endBefore: "12:00"
- **"영어는 주5회 반"** → STEP 1에서 확인한 제목이 "초등부 주5회"이므로 keywords: ["주5회", "주 5회", "초등부 주5회"] (두 표현 모두 지원)
- "댄스는 공연반만" → "공연반"

응답 (📸 이미지별 스케줄 정보를 확인한 후):
{
  "understood": "필라테스 이고은 원장 오전반, 영어 주5회, 댄스 공연반",
  "action": "filter",
  "conditions": [
    {
      "type": "titleMatch",
      "keywords": ["이고은"],
      "matchAll": false,
      "description": "필라테스 이고은 원장"
    },
    {
      "type": "timeRange",
      "endBefore": "12:00",
      "applyToKeywords": ["이고은", "원장"],
      "description": "필라테스는 오전만 (12시 이전)"
    },
    {
      "type": "titleMatch",
      "keywords": ["주5회", "주 5회", "초등부 주5회"],
      "matchAll": false,
      "description": "영어 주5회 반"
    },
    {
      "type": "dayFilter",
      "days": ["월", "화", "수", "목", "금"],
      "applyToKeywords": ["주5회"],
      "description": "영어는 주5회 (월~금)"
    },
    {
      "type": "titleMatch",
      "keywords": ["공연반"],
      "matchAll": false,
      "description": "댄스 공연반"
    }
  ],
  "explanation": "필라테스 이고은 원장 오전반, 영어 주5회 (월~금), 댄스 공연반을 선택했어요!"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

위 형식으로 JSON만 반환하세요. 다른 설명은 필요 없습니다.
`;
}

module.exports = { generateOcrChatPrompt };
