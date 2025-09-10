// 영어 요일을 한글로 변환하는 함수
export const translateEnglishDays = (text) => {
   const dayMap = {
      'monday': '월요일',
      'tuesday': '화요일', 
      'wednesday': '수요일',
      'thursday': '목요일',
      'friday': '금요일',
      'saturday': '토요일',
      'sunday': '일요일'
   };

   let translatedText = text;
   Object.keys(dayMap).forEach(englishDay => {
      const regex = new RegExp(`\\b${englishDay}\\b`, 'gi');
      translatedText = translatedText.replace(regex, dayMap[englishDay]);
   });

   return translatedText;
};

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
   const diff = result.getDate() - day + (day === 0 ? -6 : 1); // 월요일 시작
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

// ✅ 주차 오프셋을 지원하는 요일 계산
// dayOfWeek: 월=1 ... 일=7
// weekOffset: 0=이번주, 1=다음주, -1=저번주, 2=다다음주 ...
const getWeekday = (date, dayOfWeek, weekOffset = 0) => {
   const result = new Date(startOfWeek(date));
   result.setDate(result.getDate() + (dayOfWeek - 1) + weekOffset * 7);
   result.setHours(0, 0, 0, 0);
   return result;
};

// 🔊 음성 출력
export const speak = text => {
   if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 1.2;
      window.speechSynthesis.speak(utterance);
   }
};

// 🧠 AI 프롬프트 생성
export const generateAIPrompt = command => {
   const now = new Date();

   return [
      `오늘 = ${formatDate(now, 'YYYY-MM-DD dddd')} (${formatDate(now, 'MM월 DD일')})`,
      `현재 시간 = ${formatDate(now, 'YYYY-MM-DD HH:mm:ss')}`,
      `명령어: "${command}"`,
      ``,
      `**정확한 날짜 계산 (오늘 기준):**`,
      `어제 = ${formatDate(addDays(now, -1))}`,
      `오늘 = ${formatDate(now)}`,
      `내일 = ${formatDate(addDays(now, 1))}`,
      `모레 = ${formatDate(addDays(now, 2))}`,
      `글피 = ${formatDate(addDays(now, 3))}`,
      ``,
      `절대 설명하지 마! JSON만 출력!`,
      ``,
      `**이번주 날짜:**`,
      `이번주 월요일 = ${formatDate(getWeekday(now, 1, 0))}`,
      `이번주 목요일 = ${formatDate(getWeekday(now, 4, 0))}`,
      ``,
      `**정확한 주차 계산:**`,
      `저저번주 = ${formatDate(startOfWeek(addWeeks(now, -2)))} ~ ${formatDate(endOfWeek(addWeeks(now, -2)))}`,
      `저번주 = ${formatDate(startOfWeek(addWeeks(now, -1)))} ~ ${formatDate(endOfWeek(addWeeks(now, -1)))}`,
      `이번주 = ${formatDate(startOfWeek(now))} ~ ${formatDate(endOfWeek(now))}`,
      `다음주 = ${formatDate(startOfWeek(addWeeks(now, 1)))} ~ ${formatDate(endOfWeek(addWeeks(now, 1)))}`,
      `다다음주 = ${formatDate(startOfWeek(addWeeks(now, 2)))} ~ ${formatDate(endOfWeek(addWeeks(now, 2)))}`,
      ``,
      `**요일별 정확한 날짜:**`,
      `저번주 목요일 = ${formatDate(getWeekday(now, 4, -1))}`,
      `이번주 목요일 = ${formatDate(getWeekday(now, 4, 0))}`,
      `다음주 목요일 = ${formatDate(getWeekday(now, 4, 1))}`,
      `다다음주 목요일 = ${formatDate(getWeekday(now, 4, 2))}`,
      ``,
      `**중요: 일정=약속=미팅=회의=모임 (동일 의미)**`,
      ``,
      `**필수 JSON 형식:**`,
      `{"intent": "add_event", "title": "일정", "startDateTime": "2025-09-08T16:00:00+09:00", "endDateTime": "2025-09-08T17:00:00+09:00", "response": "추가!"}`,
      ``,
      `{"intent": "delete_event", "title": "일정", "startDateTime": "2025-09-08T09:00:00+09:00", "endDateTime": "2025-09-08T10:00:00+09:00", "response": "삭제!"}`,
      ``,
      `{"intent": "delete_range", "title": "일정", "startDateTime": "2025-09-01T00:00:00+09:00", "endDateTime": "2025-09-07T23:59:59+09:00", "response": "삭제!"}`,
      ``,
      `**삭제 예시:**`,
      `"다음주 목요일 약속 삭제" -> {"intent": "delete_event", "title": "약속", "startDateTime": "${formatDate(getWeekday(now, 4, 1))}T00:00:00+09:00", "endDateTime": "${formatDate(getWeekday(now, 4, 1))}T23:59:59+09:00", "response": "삭제!"}`,
      `"이번주 일정 전부 삭제" -> {"intent": "delete_range", "title": "일정", "startDateTime": "${formatDate(startOfWeek(now))}T00:00:00+09:00", "endDateTime": "${formatDate(endOfWeek(now))}T23:59:59+09:00", "response": "삭제!"}`,
      ``,
      `**매우 중요:** 일정 관련이 아닌 단순 대화일 경우 → {"intent": "clarification", "response": "안녕하세요! 일정 관리를 도와드릴까요?"}`,
   ].join('\n');
};

// 📝 AI 응답 파싱
export const parseAIResponse = text => {
   let jsonString = text.replace(/```json\n|\n```/g, '').trim();
   const jsonStart = jsonString.indexOf('{');
   const jsonEnd = jsonString.lastIndexOf('}');
   if (jsonStart !== -1 && jsonEnd !== -1) {
      jsonString = jsonString.substring(jsonStart, jsonEnd + 1);
   }
   jsonString = jsonString.replace(/\/\/.*$/gm, '').trim();

   const eventData = JSON.parse(jsonString);

   if (!eventData.title) eventData.title = '약속';
   if (!eventData.endDateTime && eventData.startDateTime) {
      const start = new Date(eventData.startDateTime);
      start.setHours(start.getHours() + 1);
      eventData.endDateTime = start.toISOString();
   }

   return eventData;
};
