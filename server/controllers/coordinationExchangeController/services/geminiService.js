/**
 * Gemini AI 서비스
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const { validateTimeChangeParams, validateDateChangeParams } = require('../validators/dayValidator');
const { validateTime } = require('../validators/timeRangeValidator');

/**
 * 대화 컨텍스트 생성
 * @param {Array} recentMessages - 최근 메시지 배열
 * @returns {string} - 대화 컨텍스트 문자열
 */
function buildConversationContext(recentMessages) {
  if (!recentMessages || recentMessages.length === 0) {
    return '';
  }

  let context = '\n최근 대화 기록:\n';
  recentMessages.forEach((msg, index) => {
    context += `${index + 1}. ${msg.sender === 'user' ? '사용자' : 'AI'}: "${msg.text}"\n`;
  });
  context += '\n위 대화 맥락을 참고하여, 사용자의 최신 메시지에서 누락된 정보(날짜, 요일, 시간 등)를 이전 대화에서 찾아 채워주세요.\n';

  return context;
}

/**
 * Gemini 프롬프트 생성
 * @param {string} message - 사용자 메시지
 * @param {string} conversationContext - 대화 컨텍스트
 * @returns {string} - 완성된 프롬프트
 */
function buildPrompt(message, conversationContext) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][now.getDay()];

  // 긴 프롬프트는 원본에서 그대로 가져옴
  return `
다음 메시지의 의도를 파악해주세요.
${conversationContext}
현재 메시지: "${message}"

다음 JSON 형식으로 응답해주세요:
{
  "type": "응답 타입 (time_change, date_change, confirm, reject 중 하나)",
  "sourceWeekOffset": "소스 주 오프셋 (지지난주=-2, 저번주=-1, 이번주=0, 다음주=1. 소스가 명시되지 않으면 null)",
  "sourceDay": "소스 요일/날짜 (time_change: 요일 문자열 예: '월요일'. date_change: 숫자 예: 11)",
  "sourceTime": "소스 시간 (시간이 명시된 경우, HH:00 형식, 예: '1시' → '13:00'. 명시되지 않으면 null)",
  "targetDay": "목표 요일 (time_change일 때만, 예: 월요일~금요일. date_change일 때는 null)",
  "targetTime": "타겟 시간 (HH:00 형식, 예: 14:00. 명시되지 않으면 null)",
  "weekNumber": "주차 (1~5. 명시되지 않으면 null)",
  "weekOffset": "목표 주 오프셋 (이번주=0, 다음주=1, 다다음주=2. 명시되지 않으면 null)",
  "sourceMonth": "출발 월 (예: 11. 명시되지 않으면 null)",
  "targetMonth": "목표 월 (예: 11. 명시되지 않으면 null)",
  "targetDate": "목표 일 (date_change일 때만, 예: 14)"
}

**🚨 타입 판단 최우선 규칙 (반드시 준수!):**

타겟(목표)에 "월요일/화요일/수요일/목요일/금요일" 단어가 있으면 무조건 **time_change**!

**time_change** = 타겟에 **요일명** (월요일, 화요일, 수요일, 목요일, 금요일)
**date_change** = 타겟에 요일명 없이 **날짜만** (내일, 어제, 모레, 15일, 11월 20일 등)

핵심 예시:
- "어제 일정 **금요일**로" → time_change (타겟에 "금요일" 있음)
- "내일 일정 **11월 둘째주 월요일**로" → time_change (타겟에 "월요일" 있음!)
- "오늘 일정 **다음주 수요일**로" → time_change (타겟에 "수요일" 있음)
- "어제 일정 **내일**로" → date_change (타겟에 요일명 없음, "내일"=날짜)
- "어제 일정 **오늘**로" → date_change (타겟에 요일명 없음, "오늘"=날짜)
- "어제 일정 **오늘 오전 9시**로" → date_change (타겟에 요일명 없음, "오늘"=날짜)
- "저번주 월요일 일정 **15일**로" → date_change (타겟에 요일명 없음)

⚠️ 주의: 소스에 "내일/어제/저번주 월요일"이 있어도, 타겟에 요일명이 있으면 time_change!

**🔴 time_change vs date_change 상세 규칙:**

1. **time_change**: 타겟이 **요일명**
   - sourceDay는 요일 문자열 (예: "월요일", "화요일")
   - targetDay는 요일 문자열 (예: "금요일")
   - "어제/내일/오늘"이 소스면 해당 요일로 변환
     - 오늘=${['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][new Date().getDay()]}
     - 어제=${['토요일', '일요일', '월요일', '화요일', '수요일', '목요일', '금요일'][new Date().getDay()]}
     - 내일=${['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'][new Date().getDay()]}

2. **date_change**: 타겟이 **날짜/상대적 날짜**
   - sourceDay는 **숫자** (월의 며칠인지, 예: 11, 17, 19)
   - targetDate는 **숫자** (월의 며칠인지, 예: 14, 19, 20)
   - "어제/내일/모레/저번주 월요일" 등은 실제 날짜로 계산
   - 현재: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' })}

3. **confirm**: 긍정 ("네", "예", "응", "어", "웅", "ㅇㅇ", "그래", "좋아", "ok", "yes", "y")
4. **reject**: 부정 ("아니", "아니요", "싫어", "안돼", "no", "n", "취소")

**time_change 세부 규칙:**
1. **기본**: 요일만 언급하면 **이번주** (weekOffset=0)로 간주
   - "금요일로" → targetDay="금요일", weekOffset=0
2. "다음주", "이번주", "저번주" 등 목표 주 명시: weekOffset 사용 (지지난주=-2, 저번주=-1, 이번주=0, 다음주=1, 다다음주=2)
3. "저번주", "지지난주" 등 소스 주 명시: sourceWeekOffset 사용 (지지난주=-2, 저번주=-1, 이번주=0)
4. **"오늘/어제/내일 일정" 소스 처리**: sourceWeekOffset=0, sourceDay=해당요일로 변환
5. 소스 요일이 명시되면 sourceDay에 요일 추출 (예: "저번주 월요일" → sourceDay="월요일")
6. "둘째 주", "셋째 주" 등: weekNumber 사용 (1~5)
7. **월+주차 조합**: "11월 둘째주 월요일" → targetMonth=11, weekNumber=2, targetDay="월요일"
8. 시간은 24시간 형식 (오후 2시 → 14:00, 오전 9시 → 09:00)

**date_change 세부 규칙 (sourceDay와 targetDate는 반드시 숫자!):**
1. "11월 11일을 14일로" → sourceMonth=11, sourceDay=11, targetMonth=11, targetDate=14
2. "오늘 일정을 15일로" → sourceMonth=null, sourceDay=null, targetMonth=현재월, targetDate=15
3. 월이 명시되지 않으면 현재 월로 간주
4. 시간이 명시되면 sourceTime/targetTime에 HH:00 형식으로 저장 (1시→13:00, 오후 3시→15:00)

**date_change에서 상대적 표현을 실제 날짜로 계산:**
현재: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
이번주 월요일: ${new Date().getDate() - (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1)}일
저번주 월요일: ${new Date().getDate() - (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1) - 7}일
다음주 월요일: ${new Date().getDate() - (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1) + 7}일

- "오늘 일정" → sourceMonth=null, sourceDay=null (코드에서 처리)
- "어제 일정" → sourceMonth=${new Date().getMonth() + 1}, sourceDay=${new Date().getDate() - 1}
- "내일 일정" → sourceMonth=${new Date().getMonth() + 1}, sourceDay=${new Date().getDate() + 1}
- "모레 일정" → sourceMonth=${new Date().getMonth() + 1}, sourceDay=${new Date().getDate() + 2}
- "저번주 월요일 일정" → sourceMonth=${new Date().getMonth() + 1}, sourceDay=${new Date().getDate() - (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1) - 7}
- "저번주 화요일 일정" → sourceMonth=${new Date().getMonth() + 1}, sourceDay=${new Date().getDate() - (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1) - 6}
- "저번주 수요일 일정" → sourceMonth=${new Date().getMonth() + 1}, sourceDay=${new Date().getDate() - (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1) - 5}
- "이번주 월요일 일정" → sourceMonth=${new Date().getMonth() + 1}, sourceDay=${new Date().getDate() - (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1)}
- "다음주 월요일 일정" → sourceMonth=${new Date().getMonth() + 1}, sourceDay=${new Date().getDate() - (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1) + 7}
- "다음주 수요일 일정" → sourceMonth=${new Date().getMonth() + 1}, sourceDay=${new Date().getDate() - (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1) + 9}

**타겟 날짜 계산:**
- "어제로" → targetMonth=${new Date().getMonth() + 1}, targetDate=${new Date().getDate() - 1}
- "내일로" → targetMonth=${new Date().getMonth() + 1}, targetDate=${new Date().getDate() + 1}
- "모레로" → targetMonth=${new Date().getMonth() + 1}, targetDate=${new Date().getDate() + 2}

**대화 맥락 처리 예시:**
- 이전: "11월 6일 일정을 11월 19일로 옮겨줘" / 응답: "이미 일정이 있습니다"
  현재: "그럼 13시로 옮겨줄래?" -> {"type": "date_change", "sourceMonth": 11, "sourceDay": 6, "targetMonth": 11, "targetDate": 19, "targetTime": "13:00", ...}
  (이전 대화에서 11월 6일 → 11월 19일 이동 시도를 참고하여 날짜 정보 채움)

- 이전: "이번주 월요일 일정 다음주로" / 응답: "요일을 명확히 말씀해주세요"
  현재: "수요일로" -> {"type": "time_change", "sourceWeekOffset": 0, "sourceDay": "월요일", "targetDay": "수요일", "weekOffset": 1, ...}
  (이전 대화에서 이번주 월요일, 다음주 정보를 참고)

**📌 예시 (오늘=${new Date().getMonth() + 1}월 ${new Date().getDate()}일 ${['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()]}요일 기준):**

**time_change 예시 (타겟에 요일명 있음):**
- "수요일로 바꿔줘" -> {"type": "time_change", "targetDay": "수요일", "weekOffset": 0}
- "다음주 수요일로" -> {"type": "time_change", "targetDay": "수요일", "weekOffset": 1}
- "저번주 수요일로" -> {"type": "time_change", "targetDay": "수요일", "weekOffset": -1}
- "이번주 월요일 일정 저번주 수요일로" -> {"type": "time_change", "sourceWeekOffset": 0, "sourceDay": "월요일", "targetDay": "수요일", "weekOffset": -1}
- "저번주 월요일 일정 수요일로" -> {"type": "time_change", "sourceWeekOffset": -1, "sourceDay": "월요일", "targetDay": "수요일", "weekOffset": 0}
- "오늘 일정 금요일로" -> {"type": "time_change", "sourceWeekOffset": 0, "sourceDay": "${['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][new Date().getDay()]}", "targetDay": "금요일", "weekOffset": 0}
- "어제 일정 금요일 오전 9시로" -> {"type": "time_change", "sourceWeekOffset": 0, "sourceDay": "${['토요일', '일요일', '월요일', '화요일', '수요일', '목요일', '금요일'][new Date().getDay()]}", "targetDay": "금요일", "targetTime": "09:00", "weekOffset": 0}
- "내일 일정 목요일로" -> {"type": "time_change", "sourceWeekOffset": 0, "sourceDay": "${['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'][new Date().getDay()]}", "targetDay": "목요일", "weekOffset": 0}
- "11월 둘째주 월요일로" -> {"type": "time_change", "targetDay": "월요일", "targetMonth": 11, "weekNumber": 2}
- "내일 일정 11월 둘째주 월요일로" -> {"type": "time_change", "sourceWeekOffset": 0, "sourceDay": "${['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'][new Date().getDay()]}", "targetDay": "월요일", "targetMonth": 11, "weekNumber": 2}

**date_change 예시 (타겟이 날짜):**
- "11월 11일 일정 14일로" -> {"type": "date_change", "sourceMonth": 11, "sourceDay": 11, "targetMonth": 11, "targetDate": 14}
- "오늘 일정 15일로" -> {"type": "date_change", "sourceMonth": null, "sourceDay": null, "targetMonth": ${new Date().getMonth() + 1}, "targetDate": 15}
- "오늘 일정 내일로" -> {"type": "date_change", "sourceMonth": null, "sourceDay": null, "targetMonth": ${new Date().getMonth() + 1}, "targetDate": ${new Date().getDate() + 1}}
- "오늘 일정 어제로" -> {"type": "date_change", "sourceMonth": null, "sourceDay": null, "targetMonth": ${new Date().getMonth() + 1}, "targetDate": ${new Date().getDate() - 1}}
- "오늘 일정 어제 오전 9시로" -> {"type": "date_change", "sourceMonth": null, "sourceDay": null, "targetMonth": ${new Date().getMonth() + 1}, "targetDate": ${new Date().getDate() - 1}, "targetTime": "09:00"}
- "오늘 일정 내일 오후 3시로" -> {"type": "date_change", "sourceMonth": null, "sourceDay": null, "targetMonth": ${new Date().getMonth() + 1}, "targetDate": ${new Date().getDate() + 1}, "targetTime": "15:00"}
- "어제 일정 내일로" -> {"type": "date_change", "sourceMonth": ${new Date().getMonth() + 1}, "sourceDay": ${new Date().getDate() - 1}, "targetMonth": ${new Date().getMonth() + 1}, "targetDate": ${new Date().getDate() + 1}}
- "어제 일정 오늘로" -> {"type": "date_change", "sourceMonth": ${new Date().getMonth() + 1}, "sourceDay": ${new Date().getDate() - 1}, "targetMonth": ${new Date().getMonth() + 1}, "targetDate": ${new Date().getDate()}}
- "어제 일정 오늘 오전 9시로" -> {"type": "date_change", "sourceMonth": ${new Date().getMonth() + 1}, "sourceDay": ${new Date().getDate() - 1}, "targetMonth": ${new Date().getMonth() + 1}, "targetDate": ${new Date().getDate()}, "targetTime": "09:00"}
- "어제 일정 내일 오후 3시로" -> {"type": "date_change", "sourceMonth": ${new Date().getMonth() + 1}, "sourceDay": ${new Date().getDate() - 1}, "targetMonth": ${new Date().getMonth() + 1}, "targetDate": ${new Date().getDate() + 1}, "targetTime": "15:00"}
- "저번주 월요일 일정 내일로" -> {"type": "date_change", "sourceMonth": ${new Date().getMonth() + 1}, "sourceDay": ${new Date().getDate() - (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1) - 7}, "targetMonth": ${new Date().getMonth() + 1}, "targetDate": ${new Date().getDate() + 1}}
- "저번주 월요일 일정 어제로" -> {"type": "date_change", "sourceMonth": ${new Date().getMonth() + 1}, "sourceDay": ${new Date().getDate() - (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1) - 7}, "targetMonth": ${new Date().getMonth() + 1}, "targetDate": ${new Date().getDate() - 1}}
- "다음주 월요일 일정 12월 17일로" -> {"type": "date_change", "sourceMonth": ${new Date().getMonth() + 1}, "sourceDay": ${new Date().getDate() - (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1) + 7}, "targetMonth": 12, "targetDate": 17}
- "이번주 수요일 일정 11월 25일로" -> {"type": "date_change", "sourceMonth": ${new Date().getMonth() + 1}, "sourceDay": ${new Date().getDate() - (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1) + 2}, "targetMonth": 11, "targetDate": 25}

**confirm/reject:**
- "네" -> {"type": "confirm"}
- "아니" -> {"type": "reject"}

JSON만 반환하고 다른 텍스트는 포함하지 마세요.
`;
}

/**
 * Gemini로 자연어 메시지 파싱
 * @param {string} message - 사용자 메시지
 * @param {Array} recentMessages - 최근 메시지 배열
 * @returns {Object} - 파싱된 결과
 */
async function parseMessage(message, recentMessages = []) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const conversationContext = buildConversationContext(recentMessages);
  const prompt = buildPrompt(message, conversationContext);

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text().trim();

  // JSON 파싱
  const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(jsonText);

  // 타입 검증
  if (!parsed.type) {
    throw new Error('메시지 타입을 파악할 수 없습니다.');
  }

  // time_change 검증
  if (parsed.type === 'time_change') {
    validateTimeChangeParams(parsed);
    if (parsed.targetTime) {
      validateTime(parsed.targetTime);
    }
  }

  // date_change 검증
  if (parsed.type === 'date_change') {
    validateDateChangeParams(parsed);
  }

  return parsed;
}

module.exports = {
  parseMessage,
  buildConversationContext,
  buildPrompt
};
