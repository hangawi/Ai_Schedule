/**
 * ===================================================================================================
 * AI 일정 분석 프롬프트 - 한국어 자연어 이해 기반
 * ===================================================================================================
 *
 * 설계 철학:
 * - 하드코딩된 규칙 제거, LLM의 자연어 이해 능력에 전적으로 의존
 * - 기존 일정 상태를 인식하여 중복 생성 방지, 확장, 취소 판단
 * - 한국어 원어민 관점: 한국어 문화와 맥락을 자연스럽게 이해
 */

/**
 * 일정 분석 프롬프트 생성
 * @param {string} conversationText - 분석할 대화 내용
 * @param {Date} currentDate - 현재 날짜
 * @param {Array} existingSuggestions - 기존 활성 일정 목록
 * @returns {string} Gemini API용 프롬프트
 */
function generateSchedulePrompt(conversationText, currentDate = new Date(), existingSuggestions = []) {
  // 한국 시간대(KST, UTC+9) 기준으로 날짜 계산
  const kstDate = new Date(currentDate.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const year = kstDate.getFullYear();
  const month = kstDate.getMonth() + 1;
  const date = kstDate.getDate();
  const dayIndex = kstDate.getDay();
  const dayOfWeek = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][dayIndex];
  const today = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;

  // 이번주와 다음주의 요일별 날짜 계산
  const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  // 이번주 날짜들 (일요일부터 토요일까지)
  const thisWeekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(kstDate);
    d.setDate(kstDate.getDate() - dayIndex + i);
    thisWeekDates.push(`${dayNames[i]}=${formatDate(d)}`);
  }

  // 다음주 날짜들
  const nextWeekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(kstDate);
    d.setDate(kstDate.getDate() - dayIndex + 7 + i);
    nextWeekDates.push(`${dayNames[i]}=${formatDate(d)}`);
  }

  // 디버그 로그
  console.log(`📅 [Prompt] 오늘: ${today} (${dayOfWeek})`);
  console.log(`📅 [Prompt] 이번주: ${thisWeekDates.join(', ')}`);
  console.log(`📅 [Prompt] 다음주: ${nextWeekDates.join(', ')}`);

  // 기존 일정 정보 포맷팅
  let existingSchedulesText = '';
  if (existingSuggestions && existingSuggestions.length > 0) {
    existingSchedulesText = `
## 현재 이 채팅방에 등록된 일정들
${existingSuggestions.map((s, i) => {
  const acceptedCount = s.memberResponses?.filter(r => r.status === 'accepted').length || 0;
  const pendingCount = s.memberResponses?.filter(r => r.status === 'pending').length || 0;
  return `[일정 ${i + 1}] ID: ${s._id}
- 내용: ${s.summary}
- 날짜: ${s.date} ${s.startTime}~${s.endTime}
- 장소: ${s.location || '미정'}
- 제안자: ${s.suggestedBy?.firstName || '알 수 없음'}
- 수락: ${acceptedCount}명 / 대기: ${pendingCount}명`;
}).join('\n\n')}

**중요**: 위 일정들이 이미 존재합니다. 대화가 이 일정에 대한 것인지 판단하세요.
`;
  } else {
    existingSchedulesText = `
## 현재 이 채팅방에 등록된 일정
없음
`;
  }

  return `당신은 한국어 그룹 채팅에서 일정 관련 대화를 분석하는 전문 AI입니다.

## 현재 날짜 및 시간
오늘은 ${year}년 ${month}월 ${date}일, ${dayOfWeek}입니다. (${today})

## 이번주/다음주 달력
이번주: ${thisWeekDates.join(', ')}
다음주: ${nextWeekDates.join(', ')}
${existingSchedulesText}
## 분석할 대화
${conversationText}

## 당신의 임무
위 대화를 읽고 어떤 action을 취해야 하는지 판단하세요.
대화의 맥락, 기존 일정 상태, 참여자들의 의도를 종합적으로 고려하세요.

## Action 유형

### 1. "new" - 새로운 일정 생성
기존 일정과 관련 없는 **새로운** 약속이 합의되었을 때.
- 최소 2명 이상 참여 (제안 + 동의)
- 구체적인 날짜/시간이 합의됨
- 기존 일정과 다른 새로운 약속

### 2. "response" - 기존 일정에 대한 응답 (무시)
기존 일정에 대해 동의/응답하는 것일 때. 새 일정 생성 불필요.
- "ㅇㅋ", "ㄱㄱ", "나도 갈게" 등 기존 일정에 대한 동의
- 이미 등록된 일정과 같은 내용을 다시 언급

### 3. "extend" - 기존 일정 확장/수정
기존 일정에 **추가 활동**이 합의되었을 때.
- "밥 먹고 PC방 ㄱ?" → 기존 밥약속에 PC방 추가
- "그 다음에 노래방 가자" → 기존 일정 뒤에 추가
- 기존 일정의 시간/장소 변경 합의

### 4. "cancel" - 일정 취소 요청
제안자가 일정을 취소하려는 의도가 보일 때.
- "아 미안 일 생겼어", "ㅈㅅ 못 갈 것 같아"
- "그날 안 될 것 같아 취소하자"

### 5. "none" - 아무 action 없음
- 아직 합의가 안 됨
- 단순 잡담
- 불확실한 상황 ("보고 결정하자", "모르겠어")

## 판단 원칙

1. **기존 일정 우선 확인**: 대화가 기존 일정에 관한 것인지 먼저 판단
2. **중복 생성 금지**: 같은 내용의 일정을 또 만들지 않음
3. **맥락 이해**: 한국인이 자연스럽게 대화를 이해하듯이 판단
4. **불확실하면 none**: 애매하면 action 없음

## 한국어 시간 표현 이해

**날짜:**
- "내일" → 오늘 다음날
- "모레" → 오늘 다음다음날
- "금요일" → 가장 가까운 금요일
- "다음주 월요일" → 다음 주의 월요일

**시간 (맥락 중요):**
- "6시" + "밥/저녁/술" → 18:00 (저녁)
- "6시" + "아침" → 06:00
- "2시" + "점심" → 14:00
- "오후 3시" → 15:00 (명확)

## 출력 형식

JSON만 출력하세요. 설명 불필요.

**새 일정 생성 (action: "new"):**
{
  "action": "new",
  "data": {
    "summary": "밥약속",
    "date": "2026-01-28",
    "startTime": "18:00",
    "endTime": "19:00",
    "location": ""
  }
}

**기존 일정 응답 - 무시 (action: "response"):**
{
  "action": "response",
  "targetId": "기존일정ID",
  "reason": "기존 밥약속에 대한 동의"
}

**기존 일정 확장 (action: "extend"):**
{
  "action": "extend",
  "targetId": "기존일정ID",
  "data": {
    "summary": "밥약속 + PC방",
    "endTime": "21:00",
    "location": "강남"
  }
}

**일정 취소 (action: "cancel"):**
{
  "action": "cancel",
  "targetId": "기존일정ID",
  "reason": "제안자가 일정 취소 요청"
}

**아무것도 안 함 (action: "none"):**
{
  "action": "none",
  "reason": "아직 합의 안 됨"
}

## 분석 시작

대화를 분석하고 적절한 action을 JSON으로 출력하세요.
기존 일정이 있다면 그것과의 관계를 반드시 고려하세요.`;
}

module.exports = {
  generateSchedulePrompt
};
