// 날짜 유틸리티 함수들
const formatDate = (date, format = 'YYYY-MM-DD') => {
   const d = new Date(date);
   const year = d.getFullYear();
   const month = String(d.getMonth() + 1).padStart(2, '0');
   const day = String(d.getDate()).padStart(2, '0');
   const hour = String(d.getHours()).padStart(2, '0');
   const minute = String(d.getMinutes()).padStart(2, '0');
   const second = String(d.getSeconds()).padStart(2, '0');

   const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
   const dayName = dayNames[d.getDay()];

   switch (format) {
      case 'YYYY-MM-DD dddd':
         return `${year}-${month}-${day} ${dayName}`;
      case 'MM월 DD일':
         return `${month}월 ${day}일`;
      case 'YYYY-MM-DD HH:mm:ss':
         return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
      default:
         return `${year}-${month}-${day}`;
   }
};

const addDays = (date, days) => {
   const result = new Date(date);
   result.setDate(result.getDate() + days);
   return result;
};

const addWeeks = (date, weeks) => {
   return addDays(date, weeks * 7);
};

const startOfWeek = date => {
   const result = new Date(date);
   const day = result.getDay();
   const diff = result.getDate() - day + (day === 0 ? -6 : 1); // 월요일을 주의 시작으로
   result.setDate(diff);
   result.setHours(0, 0, 0, 0);
   return result;
};

const endOfWeek = date => {
   const result = startOfWeek(date);
   result.setDate(result.getDate() + 6);
   result.setHours(23, 59, 59, 999);
   return result;
};

const getWeekday = (date, dayOfWeek) => {
   const result = new Date(startOfWeek(date));
   result.setDate(result.getDate() + (dayOfWeek - 1)); // 월요일=1, 화요일=2, ..., 일요일=7
   return result;
};

export const speak = text => {
   if ('speechSynthesis' in window) {
      // 이전에 진행 중이던 음성 출력이 있다면 취소
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 1.2; // 약간 빠르게
      window.speechSynthesis.speak(utterance);
   } else {
      // 이 브라우저에서는 음성 합성을 지원하지 않습니다
   }
};

export const generateAIPrompt = command => {
   const now = new Date();

   return [
      `오늘 = ${formatDate(now, 'YYYY-MM-DD dddd')} (${formatDate(now, 'MM월 DD일')})`,
      `현재 시간 = ${formatDate(now, 'YYYY-MM-DD HH:mm:ss')}`,
      `명령어: "${command}"`, // Corrected: escaped quote within template literal
      ``,
      `**정확한 날짜 계산 (오늘 기준):**`,
      `어제 = ${formatDate(addDays(now, -1))}`,
      `오늘 = ${formatDate(now)}`,
      `내일 = ${formatDate(addDays(now, 1))}`,
      `모레 = ${formatDate(addDays(now, 2))}`,
      `글피 = ${formatDate(addDays(now, 3))}`,
      ``,
      `절대 설명하지 마! JSON만 출력!`, // Corrected: escaped quote within template literal
      ``,
      `**이번주 날짜 (This Week's Dates):**`,
      `이번주 월요일 = ${formatDate(getWeekday(now, 1))}`,
      `이번주 화요일 = ${formatDate(getWeekday(now, 2))}`,
      `이번주 수요일 = ${formatDate(getWeekday(now, 3))}`,
      `이번주 목요일 = ${formatDate(getWeekday(now, 4))}`,
      `이번주 금요일 = ${formatDate(getWeekday(now, 5))}`,
      `이번주 토요일 = ${formatDate(getWeekday(now, 6))}`,
      `이번주 일요일 = ${formatDate(getWeekday(now, 7))}`,
      ``,
      `**정확한 주차 계산 (과거/현재/미래 모두):**`,
      `저저번주 (2주 전) = ${formatDate(startOfWeek(addWeeks(now, -2)))} ~ ${formatDate(endOfWeek(addWeeks(now, -2)))}`,
      `저번주 (1주 전) = ${formatDate(startOfWeek(addWeeks(now, -1)))} ~ ${formatDate(endOfWeek(addWeeks(now, -1)))}`,
      `이번주 (0주차) = ${formatDate(startOfWeek(now))} ~ ${formatDate(endOfWeek(now))}`,
      `다음주 (1주 후) = ${formatDate(startOfWeek(addWeeks(now, 1)))} ~ ${formatDate(endOfWeek(addWeeks(now, 1)))}`,
      `다다음주 (2주 후) = ${formatDate(startOfWeek(addWeeks(now, 2)))} ~ ${formatDate(endOfWeek(addWeeks(now, 2)))}`,
      ``,
      `**정확한 요일별 날짜 (과거/미래):**`,
      `저번주 목요일 (1주 전) = ${formatDate(getWeekday(addWeeks(now, -1), 4))}`,
      `다음주 월요일 (1주 후) = ${formatDate(getWeekday(addWeeks(now, 1), 1))}`,
      `다다음주 화요일 (2주 후) = ${formatDate(getWeekday(addWeeks(now, 2), 2))}`,
      ``,
      `**중요: 일정=약속=미팅=회의=모임 (모두 같은 의미!)**`,
      ``,
      `**필수 JSON 형식 (이 형식 그대로!):**`,
      `일정/약속 추가:`,
      `{"intent": "add_event", "title": "일정", "startDateTime": "2025-09-08T16:00:00+09:00", "endDateTime": "2025-09-08T17:00:00+09:00", "response": "추가!"}`,
      ``,
      `일정/약속 삭제:`,
      ` {"intent": "delete_event", "title": "일정", "startDateTime": "2025-09-08T09:00:00+09:00", "endDateTime": "2025-09-08T10:00:00+09:00", "response": "삭제!"}`,
      ``,
      `범위 삭제:`,
      `{"intent": "delete_range", "title": "일정", "startDateTime": "2025-09-01T00:00:00+09:00", "endDateTime": "2025-09-07T23:59:59+09:00", "response": "삭제!"}`,
      ``,
      `"다음주 일정 삭제" = "다음주 약속 삭제" (완전히 같음)`,
      `"이번주 회의 삭제" = "이번주 미팅 삭제" (완전히 같음)`,
      ``,
      `**삭제 예시 (매우 중요!):**`,
      `"다음주 월요일 약속 삭제" -> {"intent": "delete_event", "title": "약속", "startDateTime": "${formatDate(getWeekday(addWeeks(now, 1), 1))}T00:00:00+09:00", "endDateTime": "${formatDate(getWeekday(addWeeks(now, 1), 1))}T23:59:59+09:00", "response": "삭제!"}`,
      `"이번주 일정 전부 삭제" -> {"intent": "delete_range", "title": "일정", "startDateTime": "${formatDate(startOfWeek(now))}T00:00:00+09:00", "endDateTime": "${formatDate(endOfWeek(now))}T23:59:59+09:00", "response": "삭제!"}`,
      ``,
      `**매우 중요:** 사용자의 메시지가 일정 관리(추가, 삭제, 수정, 확인)와 전혀 관련 없는 단순 대화(예: "안녕", "뭐해", "밥 먹었어?")일 경우, 절대 일정을 생성하지 말고, 다음과 같은 JSON을 출력해: {"intent": "clarification", "response": "안녕하세요! 일정 관리를 도와드릴까요?"}`,
   ].join('\n');
};

export const parseAIResponse = text => {
   let jsonString = text.replace(/```json\n|\n```/g, '').trim();

   // JSON 블록 찾기
   const jsonStart = jsonString.indexOf('{');
   const jsonEnd = jsonString.lastIndexOf('}');
   if (jsonStart !== -1 && jsonEnd !== -1) {
      jsonString = jsonString.substring(jsonStart, jsonEnd + 1);
   }

   // 주석 제거
   jsonString = jsonString.replace(/\/\/.*$/gm, '').trim();

   const eventData = JSON.parse(jsonString);

   // 기본값 설정
   if (!eventData.title) eventData.title = '약속';
   if (!eventData.endDateTime && eventData.startDateTime) {
      const start = new Date(eventData.startDateTime);
      start.setHours(start.getHours() + 1);
      eventData.endDateTime = start.toISOString();
   }

   return eventData;
};

