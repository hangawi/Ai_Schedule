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
- startAfter: 이 시간 이후 (예: "15:00")
- endBefore: 이 시간 이전 (예: "19:00")

### type: "dayMatch"
요일로 필터링
- days: 요일 배열 (예: ["MON", "WED", "FRI"])

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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

위 형식으로 JSON만 반환하세요. 다른 설명은 필요 없습니다.
`;
}

module.exports = { generateOcrChatPrompt };
