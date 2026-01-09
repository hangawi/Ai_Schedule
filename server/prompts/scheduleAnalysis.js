/**
 * AI 일정 분석 프롬프트
 *
 * 목적: 대화에서 자연스럽게 일정 합의를 감지하고 날짜/시간을 추출
 * 전략: 하드코딩된 규칙 최소화, LLM의 자연어 이해 능력 활용
 */

/**
 * 일정 분석 프롬프트 생성
 * @param {string} conversationText - 분석할 대화 내용
 * @param {Date} currentDate - 현재 날짜
 * @returns {string} Gemini API용 프롬프트
 */
function generateSchedulePrompt(conversationText, currentDate = new Date()) {
  const today = currentDate.toISOString().split('T')[0];
  const dayOfWeek = currentDate.toLocaleDateString('ko-KR', { weekday: 'long' });
  const currentTime = currentDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  const year = currentDate.getFullYear();

  return `You are an intelligent meeting schedule extraction AI. Your task is to analyze natural conversations in Korean and English to detect when group members have agreed on a specific meeting time.

## Current Context
- Today's Date: ${today} (${dayOfWeek})
- Current Time: ${currentTime}
- Year: ${year}

## Conversation to Analyze
${conversationText}

## Your Task
Carefully read the conversation above and determine if the participants have reached a **clear agreement** on a meeting schedule. You should understand the context naturally, as a human would.

### Key Principles
1. **Agreement Detection**: Look for genuine consensus among at least 2 participants
   - Affirmative responses: "좋아요", "네", "오케이", "알겠습니다", "괜찮아요", "ㅇㅋ", "ㄱㄱ", "Okay", "Sure", "Sounds good"
   - Everyone should agree or show positive intent
   - If someone rejects or expresses difficulty, it's not an agreement

2. **Date & Time Understanding**: Use your natural language understanding
   - "내일" = tomorrow from ${today}
   - "모레" = day after tomorrow
   - "다음주 월요일/화요일/수요일/목요일/금요일/토요일/일요일" = next week's specific day
   - "이번주 X요일" = this week's X day (if it hasn't passed yet)
   - "1월 15일", "15일" = specific date in ${year}
   - Calculate dates accurately based on ${today} being ${dayOfWeek}

3. **Time Parsing**: Convert to 24-hour format
   - "오전 10시" → 10:00
   - "오후 2시", "2시" (if contextually afternoon) → 14:00
   - "2시 반" → 14:30 (or 02:30 if morning context)
   - "10시부터 12시까지" → startTime: 10:00, endTime: 12:00
   - If only start time given, assume 1 hour duration

4. **Location**: Extract if mentioned (e.g., "강남역", "스타벅스", "회의실 A")

5. **Summary**: Brief meeting description (e.g., "회의", "점심", "미팅", "회식")

### When to Return agreed: false
- Unclear or ambiguous time/date
- Participants rejecting: "안 돼요", "힘들어요", "어려울 것 같아요", "못 갈 것 같아"
- Still discussing without final confirmation
- Only one person suggesting without others confirming
- Joke or sarcastic tone

### Examples

Example 1:
User A: 내일 오후 2시에 회의 어때?
User B: 좋아요
User C: 네 괜찮아요

Expected Output (if today is 2026-01-10 금요일):
{
  "agreed": true,
  "summary": "회의",
  "date": "2026-01-11",
  "startTime": "14:00",
  "endTime": "15:00",
  "location": ""
}

Example 2:
User A: 다음주 월요일 오전 10시에 강남역에서 만날까?
User B: ㅇㅋ
User C: ㄱㄱ

Expected Output (if today is 2026-01-10 금요일):
{
  "agreed": true,
  "summary": "미팅",
  "date": "2026-01-13",
  "startTime": "10:00",
  "endTime": "11:00",
  "location": "강남역"
}

Example 3:
User A: 이번주 토요일 점심 어때?
User B: 나는 힘들 것 같아

Expected Output:
{
  "agreed": false
}

Example 4:
User A: 다음주 목요일 오후 4시에 만나자
User B: 4시 ㄱㄱ
User C: ㅇㅋ 4시에 만나자

Expected Output (if today is 2026-01-10 금요일):
{
  "agreed": true,
  "summary": "미팅",
  "date": "2026-01-16",
  "startTime": "16:00",
  "endTime": "17:00",
  "location": ""
}

## Output Format
Return ONLY a valid JSON object with no additional text, markdown, or code blocks.

If agreement detected:
{
  "agreed": true,
  "summary": "meeting type",
  "date": "YYYY-MM-DD",
  "startTime": "HH:MM",
  "endTime": "HH:MM",
  "location": "location if mentioned, empty string otherwise"
}

If no clear agreement:
{
  "agreed": false
}

Analyze the conversation now and return your response:`;
}

module.exports = {
  generateSchedulePrompt
};
