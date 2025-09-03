import moment from 'moment';

export const speak = text => {
   if ('speechSynthesis' in window) {
      // 이전에 진행 중이던 음성 출력이 있다면 취소
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 1.2; // 약간 빠르게
      window.speechSynthesis.speak(utterance);
   } else {
      console.warn('이 브라우저에서는 음성 합성을 지원하지 않습니다.');
   }
};

export const generateAIPrompt = (command) => {
   return [
      `오늘 = ${moment().format('YYYY-MM-DD dddd')} (${moment().format('MM월 DD일')})`,
      `현재 시간 = ${moment().format('YYYY-MM-DD HH:mm:ss')}`,
      `명령어: "${command}"`,
      ``,
      `**정확한 날짜 계산 (오늘 기준):**`,
      `어제 = ${moment().subtract(1, 'days').format('YYYY-MM-DD')}`,
      `오늘 = ${moment().format('YYYY-MM-DD')}`,
      `내일 = ${moment().add(1, 'days').format('YYYY-MM-DD')}`,
      `모레 = ${moment().add(2, 'days').format('YYYY-MM-DD')}`,
      `글피 = ${moment().add(3, 'days').format('YYYY-MM-DD')}`,
      ``,
      `절대 설명하지 마! JSON만 출력!`,
      ``,
      `**정확한 주차 계산 (과거/현재/미래 모두):**`,
      `저저저저번주 (4주 전) = ${moment().subtract(4, 'weeks').startOf('week').format('YYYY-MM-DD')} ~ ${moment().subtract(4, 'weeks').endOf('week').format('YYYY-MM-DD')}`,
      `저저저번주 (3주 전) = ${moment().subtract(3, 'weeks').startOf('week').format('YYYY-MM-DD')} ~ ${moment().subtract(3, 'weeks').endOf('week').format('YYYY-MM-DD')}`,
      `저저번주 (2주 전) = ${moment().subtract(2, 'weeks').startOf('week').format('YYYY-MM-DD')} ~ ${moment().subtract(2, 'weeks').endOf('week').format('YYYY-MM-DD')}`,
      `저번주 (1주 전) = ${moment().subtract(1, 'week').startOf('week').format('YYYY-MM-DD')} ~ ${moment().subtract(1, 'week').endOf('week').format('YYYY-MM-DD')}`,
      `이번주 (0주차) = ${moment().startOf('week').format('YYYY-MM-DD')} ~ ${moment().endOf('week').format('YYYY-MM-DD')}`,
      `다음주 (1주 후) = ${moment().add(1, 'week').startOf('week').format('YYYY-MM-DD')} ~ ${moment().add(1, 'week').endOf('week').format('YYYY-MM-DD')}`,
      `다다음주 (2주 후) = ${moment().add(2, 'weeks').startOf('week').format('YYYY-MM-DD')} ~ ${moment().add(2, 'weeks').endOf('week').format('YYYY-MM-DD')}`,
      `다다다음주 (3주 후) = ${moment().add(3, 'weeks').startOf('week').format('YYYY-MM-DD')} ~ ${moment().add(3, 'weeks').endOf('week').format('YYYY-MM-DD')}`,
      `다다다다음주 (4주 후) = ${moment().add(4, 'weeks').startOf('week').format('YYYY-MM-DD')} ~ ${moment().add(4, 'weeks').endOf('week').format('YYYY-MM-DD')}`,
      ``,
      `⚠️ 혼동 금지: "다다다음주(3주 후)" ≠ "다다음주(2주 후)"`,
      `⚠️ 혼동 금지: "저저저번주(3주 전)" ≠ "저저번주(2주 전)"`,
      ``,
      `**정확한 요일별 날짜 (과거/미래):**`,
      `저저저저번주 월요일 (4주 전) = ${moment().subtract(4, 'weeks').day(1).format('YYYY-MM-DD')}`,
      `저저저번주 화요일 (3주 전) = ${moment().subtract(3, 'weeks').day(2).format('YYYY-MM-DD')}`,
      `저저번주 수요일 (2주 전) = ${moment().subtract(2, 'weeks').day(3).format('YYYY-MM-DD')}`,
      `저번주 목요일 (1주 전) = ${moment().subtract(1, 'week').day(4).format('YYYY-MM-DD')}`,
      `이번주 금요일 = ${moment().day(5).format('YYYY-MM-DD')}`,
      `다음주 월요일 (1주 후) = ${moment().add(1, 'week').day(1).format('YYYY-MM-DD')}`,
      `다다음주 화요일 (2주 후) = ${moment().add(2, 'weeks').day(2).format('YYYY-MM-DD')}`,
      `다다다음주 수요일 (3주 후) = ${moment().add(3, 'weeks').day(3).format('YYYY-MM-DD')}`,
      `다다다다음주 목요일 (4주 후) = ${moment().add(4, 'weeks').day(4).format('YYYY-MM-DD')}`,
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
      `"다음주 월요일 약속 삭제" -> {"intent": "delete_event", "title": "약속", "startDateTime": "${moment().add(1, 'week').day(1).format('YYYY-MM-DD')}T00:00:00+09:00", "endDateTime": "${moment().add(1, 'week').day(1).format('YYYY-MM-DD')}T23:59:59+09:00", "response": "삭제!"}`,
      `"다음주 월요일 일정 전부 삭제" -> {"intent": "delete_range", "title": "일정", "startDateTime": "${moment().add(1, 'week').day(1).format('YYYY-MM-DD')}T00:00:00+09:00", "endDateTime": "${moment().add(1, 'week').day(1).format('YYYY-MM-DD')}T23:59:59+09:00", "response": "삭제!"}`,
      `"이번주 일정 전부 삭제" -> {"intent": "delete_range", "title": "일정", "startDateTime": "${moment().startOf('week').format('YYYY-MM-DD')}T00:00:00+09:00", "endDateTime": "${moment().endOf('week').format('YYYY-MM-DD')}T23:59:59+09:00", "response": "삭제!"}`,
      `"다음주 회의 모두 삭제" -> {"intent": "delete_range", "title": "회의", "startDateTime": "${moment().add(1, 'week').startOf('week').format('YYYY-MM-DD')}T00:00:00+09:00", "endDateTime": "${moment().add(1, 'week').endOf('week').format('YYYY-MM-DD')}T23:59:59+09:00", "response": "삭제!"}`,
      ``,
      `**매우 중요:** 사용자의 메시지가 일정 관리(추가, 삭제, 수정, 확인)와 전혀 관련 없는 단순 대화(예: "안녕", "뭐해", "밥 먹었어?")일 경우, 절대 일정을 생성하지 말고, 다음과 같은 JSON을 출력해: {"intent": "clarification", "response": "안녕하세요! 일정 관리를 도와드릴까요?"}`,
   ].join('\n');
};

export const parseAIResponse = (text) => {
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
