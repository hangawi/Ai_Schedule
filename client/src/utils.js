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

// 날짜 유틸리티 함수들 - 이미 한국 시간으로 변환된 Date 객체 처리
const formatDate = (date, format = 'YYYY-MM-DD') => {
   // 이미 한국 시간대로 변환된 Date 객체를 그대로 사용
   const d = date;
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

const startOfMonth = date => {
   const result = new Date(date);
   result.setDate(1);
   result.setHours(0, 0, 0, 0);
   return result;
};

const endOfMonth = date => {
   const result = new Date(date);
   result.setMonth(result.getMonth() + 1);
   result.setDate(0);
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
export const generateAIPrompt = (command, context = {}) => {
   // 현재 로컬 시간을 그대로 사용 (이미 시스템이 한국 시간대이므로)
   const now = new Date();

   console.log('🔍 [generateAIPrompt] 현재 시간 정보:', {
      localNow: now.toString(),
      formatToday: formatDate(now),
      formatTomorrow: formatDate(addDays(now, 1)),
      todayDayOfWeek: now.getDay() // 0=일요일, 1=월요일, 2=화요일...
   });

   // 탭별 컨텍스트 정보 추가
   let contextInfo = '';
   if (context.context) {
      switch (context.context) {
         case 'profile':
            contextInfo = '현재 위치: 내 프로필 탭 - 로컬 일정 관리';
            break;
         case 'events':
            contextInfo = '현재 위치: 나의 일정 탭 - 로컬 일정 관리';
            break;
         case 'googleCalendar':
            contextInfo = '현재 위치: Google 캘린더 탭 - Google 캘린더 연동';
            break;
         default:
            contextInfo = '현재 위치: 일반 탭';
      }
   }

   return [
      `명령어: "${command}"`,
      `오늘 = ${formatDate(now, 'YYYY-MM-DD dddd')} (${formatDate(now, 'MM월 DD일')})`,
      `현재 시간 = ${formatDate(now, 'YYYY-MM-DD HH:mm:ss')}`,
      contextInfo ? `${contextInfo}` : '',
      ``,
      `**매우 중요: intent 판단 규칙**`,
      `- "추가", "만들어", "생성", "넣어", "등록", "일정", "약속", "회의" = add_event`,
      `- "삭제", "제거", "없애", "지워" = delete_event`,
      `- 삭제 키워드가 없으면 무조건 add_event!`,
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
      `**중요: "추가", "만들어", "생성", "넣어", "등록" = add_event**`,
      `**중요: "삭제", "제거", "없애", "지워" = delete_event**`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🧠 **스마트 일정 생성 - 사람처럼 생각하세요! (매우 중요!)**`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `**현재 한국 시간: ${now.getHours()}시 ${now.getMinutes()}분 (${formatDate(now, 'YYYY-MM-DD dddd')})**`,
      ``,
      `**📌 핵심 원칙: 일정 유형에 맞는 시간대를 선택하세요!**`,
      ``,
      `🌅 **아침 시간대 (06:00-10:00)**`,
      `   - 아침식사/조식: 07:00-08:00 (1시간)`,
      `   - 모닝커피: 08:00-08:30 (30분)`,
      `   - 아침운동/조깅: 06:00-07:30 (1.5시간)`,
      `   - 출근미팅: 08:30-09:30 (1시간)`,
      ``,
      `☀️ **오전 시간대 (10:00-12:00)**`,
      `   - 회의/미팅: 10:00-11:00 또는 11:00-12:00 (1시간)`,
      `   - 업무/작업: 10:00-12:00 (2시간)`,
      `   - 병원/검진: 10:00-12:00 (2시간)`,
      ``,
      `🍱 **점심 시간대 (12:00-14:00)**`,
      `   - 점심/런치: 12:00-13:00 또는 12:30-13:30 (1시간)`,
      `   - 점심약속: 12:00-13:30 (1.5시간)`,
      ``,
      `🌤️ **오후 시간대 (14:00-18:00)**`,
      `   - 회의/미팅: 14:00-15:00, 15:00-16:00, 16:00-17:00 (1시간)`,
      `   - 커피/티타임: 15:00-15:30 또는 16:00-16:30 (30분)`,
      `   - 공부/작업/프로젝트: 14:00-17:00 (2-3시간)`,
      `   - 쇼핑: 15:00-17:00 (2시간)`,
      ``,
      `🌆 **저녁 시간대 (18:00-21:00) ⭐가장 많이 사용⭐**`,
      `   - 저녁/저녁식사/밥약속: 18:00-20:00 또는 18:30-20:30 (2시간)`,
      `   - 저녁약속/식사약속: 18:00-20:00 (2시간)`,
      `   - 술약속/회식: 19:00-22:00 (3시간)`,
      `   - 저녁운동/헬스: 18:00-19:30 (1.5시간)`,
      `   - 저녁모임: 19:00-21:00 (2시간)`,
      ``,
      `🌃 **밤 시간대 (19:00-23:00)**`,
      `   - 영화: 19:00-21:30 또는 20:00-22:30 (2.5시간)`,
      `   - 공연/콘서트: 19:00-21:30 (2.5시간)`,
      `   - 친구만남/데이트: 19:00-22:00 (3시간)`,
      `   - 야식/치맥: 21:00-23:00 (2시간)`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `❌ **절대 하지 말아야 할 것들!**`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `❌ 저녁/밥약속을 오전에 잡지 마세요! (18:00-20:00가 정상)`,
      `❌ 점심을 저녁에 잡지 마세요! (12:00-13:00가 정상)`,
      `❌ 아침식사를 오후에 잡지 마세요! (07:00-08:00가 정상)`,
      `❌ 회의를 저녁/밤에 잡지 마세요! (10:00-17:00가 정상)`,
      `❌ 술약속을 아침/오전에 잡지 마세요! (19:00-22:00가 정상)`,
      ``,
      `✅ **올바른 예시:**`,
      `✅ "금요일 저녁 6시 밥약속" → 18:00-20:00 (저녁 시간대!)`,
      `✅ "내일 점심약속" → 12:00-13:00 (점심 시간대!)`,
      `✅ "오늘 저녁 술약속" → 19:00-22:00 (저녁-밤 시간대!)`,
      `✅ "오후 회의" → 14:00-15:00 (오후 시간대!)`,
      `✅ "커피 한잔" → 15:00-15:30 (오후 시간대!)`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `⏰ **시간 범위 지정 (매우 중요!):**`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `사용자가 시간 범위를 지정하면 정확히 그 시간을 사용하세요!`,
      ``,
      `✅ "오후 4시부터 6시까지" → 16:00-18:00`,
      `✅ "4~6시" → 16:00-18:00 (오후로 추정)`,
      `✅ "저녁 6시부터 8시" → 18:00-20:00`,
      `✅ "오전 10시-12시" → 10:00-12:00`,
      `✅ "2시간 약속" → 사용자 의도에 맞는 시간대 (예: 14:00-16:00)`,
      ``,
      `❌ "4시부터 6시"를 18:00-20:00로 만들지 마세요!`,
      `❌ 사용자가 지정한 시간을 무시하지 마세요!`,
      ``,
      `**시간 표현 이해:**`,
      `- "4시" 단독 = 오후 4시 (16:00)`,
      `- "오후 4시" = 16:00`,
      `- "저녁 6시" = 18:00`,
      `- "밤 9시" = 21:00`,
      `- "오전 9시" = 09:00`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📋 **시간이 명시되지 않은 경우만 기본값 사용**`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `"밥약속" → 18:00-20:00 (2시간, 저녁)`,
      `"저녁약속" → 18:30-20:30 (2시간, 저녁)`,
      `"술약속" → 19:00-22:00 (3시간, 저녁-밤)`,
      `"점심약속" → 12:00-13:00 (1시간, 점심)`,
      `"커피" → 15:00-15:30 (30분, 오후)`,
      `"회의" → 14:00-15:00 (1시간, 오후)`,
      `"미팅" → 14:00-15:00 (1시간, 오후)`,
      `"운동" → 18:00-19:30 (1.5시간, 저녁)`,
      `"영화" → 19:00-21:30 (2.5시간, 밤)`,
      `"쇼핑" → 15:00-17:00 (2시간, 오후)`,
      `"병원" → 10:00-12:00 (2시간, 오전)`,
      ``,
      `**매우 중요: 정확한 날짜 계산!**`,
      `**현재 한국 시간: ${now.toString()}**`,
      `**오늘: ${formatDate(now, 'YYYY-MM-DD dddd')} (${formatDate(now)})**`,
      `**내일: ${formatDate(addDays(now, 1), 'YYYY-MM-DD dddd')} (${formatDate(addDays(now, 1))})**`,
      `**모레: ${formatDate(addDays(now, 2), 'YYYY-MM-DD dddd')} (${formatDate(addDays(now, 2))})**`,
      ``,
      `**중요: 모든 시간은 반드시 한국 시간(+09:00)으로 표기!**`,
      `- "내일"은 반드시 "${formatDate(addDays(now, 1))}" (절대 다른 날짜 안됨!)`,
      `- "오늘"은 반드시 "${formatDate(now)}" (절대 다른 날짜 안됨!)`,
      `- "모레"는 반드시 "${formatDate(addDays(now, 2))}" (절대 다른 날짜 안됨!)`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📝 **정확한 예시 (반드시 따라하세요!)**`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `**시간 범위 지정 예시 (정확히 따라하세요!):**`,
      `"토요일 오후 4시부터 6시까지 약속" → {"intent": "add_event", "title": "약속", "startDateTime": "${formatDate(getWeekday(now, 6, 0))}T16:00:00+09:00", "endDateTime": "${formatDate(getWeekday(now, 6, 0))}T18:00:00+09:00", "response": "약속을 추가했어요!"}`,
      `"내일 2시~4시 회의" → {"intent": "add_event", "title": "회의", "startDateTime": "${formatDate(addDays(now, 1))}T14:00:00+09:00", "endDateTime": "${formatDate(addDays(now, 1))}T16:00:00+09:00", "response": "회의를 추가했어요!"}`,
      `"금요일 저녁 6-8시 저녁약속" → {"intent": "add_event", "title": "저녁약속", "startDateTime": "${formatDate(getWeekday(now, 5, 0))}T18:00:00+09:00", "endDateTime": "${formatDate(getWeekday(now, 5, 0))}T20:00:00+09:00", "response": "저녁약속을 추가했어요!"}`,
      `"오전 10시-12시 병원" → {"intent": "add_event", "title": "병원", "startDateTime": "${formatDate(now)}T10:00:00+09:00", "endDateTime": "${formatDate(now)}T12:00:00+09:00", "response": "병원 일정을 추가했어요!"}`,
      ``,
      `**일반 예시:**`,
      `"금요일 오후 6시 밥약속" → {"intent": "add_event", "title": "밥약속", "startDateTime": "${formatDate(getWeekday(now, 5, 0))}T18:00:00+09:00", "endDateTime": "${formatDate(getWeekday(now, 5, 0))}T20:00:00+09:00", "response": "밥약속을 추가했어요!"}`,
      `"내일 저녁약속" → {"intent": "add_event", "title": "저녁약속", "startDateTime": "${formatDate(addDays(now, 1))}T18:00:00+09:00", "endDateTime": "${formatDate(addDays(now, 1))}T20:00:00+09:00", "response": "저녁약속을 추가했어요!"}`,
      `"오늘 술약속" → {"intent": "add_event", "title": "술약속", "startDateTime": "${formatDate(now)}T19:00:00+09:00", "endDateTime": "${formatDate(now)}T22:00:00+09:00", "response": "술약속을 추가했어요!"}`,
      `"내일 점심약속" → {"intent": "add_event", "title": "점심약속", "startDateTime": "${formatDate(addDays(now, 1))}T12:00:00+09:00", "endDateTime": "${formatDate(addDays(now, 1))}T13:00:00+09:00", "response": "점심약속을 추가했어요!"}`,
      `"내일 회의" → {"intent": "add_event", "title": "회의", "startDateTime": "${formatDate(addDays(now, 1))}T14:00:00+09:00", "endDateTime": "${formatDate(addDays(now, 1))}T15:00:00+09:00", "response": "회의 일정을 추가했어요!"}`,
      `"오후 3시 커피" → {"intent": "add_event", "title": "커피", "startDateTime": "${formatDate(now)}T15:00:00+09:00", "endDateTime": "${formatDate(now)}T15:30:00+09:00", "response": "커피 일정을 추가했어요!"}`,
      `"다음주 월요일 영화" → {"intent": "add_event", "title": "영화", "startDateTime": "${formatDate(getWeekday(now, 1, 1))}T19:00:00+09:00", "endDateTime": "${formatDate(getWeekday(now, 1, 1))}T21:30:00+09:00", "response": "영화 일정을 추가했어요!"}`,
      `"이번주 금요일 운동" → {"intent": "add_event", "title": "운동", "startDateTime": "${formatDate(getWeekday(now, 5, 0))}T18:00:00+09:00", "endDateTime": "${formatDate(getWeekday(now, 5, 0))}T19:30:00+09:00", "response": "운동 일정을 추가했어요!"}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🔁 **반복/범위 일정 추가 (매우 중요!)**`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `"전부" 키워드가 있으면 범위 내 모든 날짜/요일에 일정 추가!`,
      ``,
      `**범위 패턴:**`,
      `1️⃣ "이번주 전부" = 오늘부터 이번주 일요일까지 매일`,
      `2️⃣ "다음주 전부" = 다음주 월요일부터 일요일까지 매일`,
      `3️⃣ "이번달 전부" = 이번달 1일부터 마지막날까지 매일 (지난 날짜 포함)`,
      `4️⃣ "이번주 월요일 전부" = 이번주의 월요일만`,
      `5️⃣ "이번달 월요일 전부" = 이번달의 모든 월요일 (1일부터 계산, 지난 날짜 포함)`,
      `6️⃣ "다음달 금요일 전부" = 다음달의 모든 금요일 (1일부터 마지막날까지)`,
      ``,
      `**중요: 이번달/다음달 특정 요일 계산 방법:**`,
      `- "이번달 월요일 전부" → 10월 1일부터 10월 31일까지의 모든 월요일`,
      `- "이번달 목요일 전부" → 10월 1일부터 10월 31일까지의 모든 목요일`,
      `- 지난 날짜도 반드시 포함! (예: 오늘이 10월 20일이어도 10월 7일, 14일 월요일도 포함)`,
      ``,
      `**반복 일정 JSON 형식:**`,
      `{`,
      `  "intent": "add_recurring_event",`,
      `  "title": "일정제목",`,
      `  "startTime": "18:00",  // 시간만 (HH:MM)`,
      `  "endTime": "20:00",    // 시간만 (HH:MM)`,
      `  "dates": ["2025-10-21", "2025-10-22", "2025-10-23"],  // 적용할 모든 날짜`,
      `  "response": "응답메시지"`,
      `}`,
      ``,
      `**반복 일정 예시:**`,
      `"이번주 전부 저녁약속" → {"intent": "add_recurring_event", "title": "저녁약속", "startTime": "18:00", "endTime": "20:00", "dates": ["${formatDate(now)}", "${formatDate(addDays(now, 1))}", "${formatDate(addDays(now, 2))}"], "response": "이번주 전체에 저녁약속을 추가했어요!"}`,
      `"다음주 전부 운동" → {"intent": "add_recurring_event", "title": "운동", "startTime": "18:00", "endTime": "19:30", "dates": ["${formatDate(startOfWeek(addWeeks(now, 1)))}", "${formatDate(addDays(startOfWeek(addWeeks(now, 1)), 1))}", ...], "response": "다음주 전체에 운동을 추가했어요!"}`,
      `"이번달 월요일 전부 회의" → {"intent": "add_recurring_event", "title": "회의", "startTime": "14:00", "endTime": "15:00", "dates": ["월요일날짜들"], "response": "이번달 모든 월요일에 회의를 추가했어요!"}`,
      ``,
      `**중요:**`,
      `- "전부" 키워드 없으면 → intent: "add_event" (1회만)`,
      `- "전부" 키워드 있으면 → intent: "add_recurring_event" (범위 내 여러 날짜)`,
      `- dates 배열에는 YYYY-MM-DD 형식으로 모든 적용 날짜 포함`,
      `- startTime, endTime은 시간만 (HH:MM 형식)`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🗑️ **일정 삭제 (매우 중요!)**`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `**1️⃣ 범위 삭제 (전체 삭제):**`,
      `"전체 삭제", "전부 삭제" 키워드가 있으면 범위 내 모든 일정 삭제!`,
      ``,
      `**범위 삭제 JSON 형식:**`,
      `{`,
      `  "intent": "delete_range",`,
      `  "startDate": "2025-10-01",  // 시작 날짜 (YYYY-MM-DD)`,
      `  "endDate": "2025-10-31",    // 종료 날짜 (YYYY-MM-DD)`,
      `  "response": "응답메시지"`,
      `}`,
      ``,
      `**범위 삭제 예시:**`,
      `"이번주 전체 삭제" → {"intent": "delete_range", "startDate": "${formatDate(startOfWeek(now))}", "endDate": "${formatDate(endOfWeek(now))}", "response": "이번주 모든 일정을 삭제했어요!"}`,
      `"이번달 전체 삭제" → {"intent": "delete_range", "startDate": "${formatDate(startOfMonth(now))}", "endDate": "${formatDate(endOfMonth(now))}", "response": "이번달 모든 일정을 삭제했어요!"}`,
      `"다음주 전부 삭제" → {"intent": "delete_range", "startDate": "${formatDate(startOfWeek(addWeeks(now, 1)))}", "endDate": "${formatDate(endOfWeek(addWeeks(now, 1)))}", "response": "다음주 모든 일정을 삭제했어요!"}`,
      `"10월 전체 삭제" → {"intent": "delete_range", "startDate": "2025-10-01", "endDate": "2025-10-31", "response": "10월 모든 일정을 삭제했어요!"}`,
      ``,
      `**2️⃣ 단일/특정 일정 삭제:**`,
      `특정 제목이나 날짜의 일정만 삭제`,
      ``,
      `**단일 삭제 JSON 형식:**`,
      `{`,
      `  "intent": "delete_event",`,
      `  "title": "일정제목",  // 삭제할 일정 제목`,
      `  "date": "2025-10-23",  // 날짜 (YYYY-MM-DD)`,
      `  "time": "16:00",      // 선택적 - 시간 (HH:MM)`,
      `  "response": "응답메시지"`,
      `}`,
      ``,
      `**단일 삭제 예시:**`,
      `"금요일 약속 삭제" → {"intent": "delete_event", "title": "약속", "date": "${formatDate(getWeekday(now, 5, 0))}", "response": "약속을 삭제했어요!"}`,
      `"내일 회의 삭제" → {"intent": "delete_event", "title": "회의", "date": "${formatDate(addDays(now, 1))}", "response": "회의를 삭제했어요!"}`,
      `"오후 4시 일정 삭제" → {"intent": "delete_event", "date": "${formatDate(now)}", "time": "16:00", "response": "오후 4시 일정을 삭제했어요!"}`,
      ``,
      `**중요:**`,
      `- "전체", "전부", "모든" 등의 키워드 → intent: "delete_range"`,
      `- 특정 제목/시간 지정 → intent: "delete_event"`,
      ``,
      `**일정 충돌 시나리오:**`,
      `만약 시스템이 일정 충돌을 감지하면, 자동으로 대안 시간을 제시합니다.`,
      `당신은 JSON만 반환하면 됩니다. 충돌 감지는 시스템이 처리합니다.`,
      ``,
      `**기본 JSON 형식:**`,
      `{"intent": "add_event", "title": "일정", "startDateTime": "2025-09-08T16:00:00+09:00", "endDateTime": "2025-09-08T17:00:00+09:00", "response": "추가!"}`,
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

// 🔍 일정 충돌 감지 함수
export const checkScheduleConflict = (newStartDateTime, newEndDateTime, existingEvents) => {
   const newStart = new Date(newStartDateTime);
   const newEnd = new Date(newEndDateTime);

   const conflicts = existingEvents.filter(event => {
      let eventStart, eventEnd;

      // 이벤트 형식에 따라 시작/종료 시간 추출
      if (event.start && event.end) {
         // Google Calendar 형식
         eventStart = new Date(event.start.dateTime || event.start.date);
         eventEnd = new Date(event.end.dateTime || event.end.date);
      } else if (event.startTime && event.endTime) {
         // Local event 형식 (ISO 형식)
         eventStart = new Date(event.startTime);
         eventEnd = new Date(event.endTime);
      } else if (event.date && event.time) {
         // 나의 일정 형식 (date + time + duration)
         const duration = event.duration || 60; // 기본 1시간
         eventStart = new Date(`${event.date}T${event.time}:00+09:00`);
         eventEnd = new Date(eventStart.getTime() + duration * 60 * 1000);
      } else {
         return false;
      }

      // 충돌 확인: 새 일정의 시작이 기존 일정 종료 전이고, 새 일정의 종료가 기존 일정 시작 후
      return newStart < eventEnd && newEnd > eventStart;
   });

   return {
      hasConflict: conflicts.length > 0,
      conflicts
   };
};

// 🔍 빈 시간 찾기 함수 (충돌한 시간 근처 우선 추천)
export const findAvailableTimeSlots = (targetDate, events, duration = 60, requestedTimeHour = null) => {
   const date = new Date(targetDate);
   const dateStr = formatDate(date);

   console.log('🔍 [빈시간찾기] 시작:', { targetDate, duration, requestedTimeHour });

   // 해당 날짜의 이벤트만 필터링
   const dayEvents = events.filter(event => {
      let eventStart;
      if (event.start) {
         eventStart = new Date(event.start.dateTime || event.start.date);
      } else if (event.startTime) {
         eventStart = new Date(event.startTime);
      } else if (event.date && event.time) {
         // 나의 일정 형식
         eventStart = new Date(`${event.date}T${event.time}:00+09:00`);
      } else {
         return false;
      }
      return formatDate(eventStart) === dateStr;
   });

   console.log(`🔍 [빈시간찾기] ${dateStr} 날짜의 이벤트 ${dayEvents.length}개 발견`);

   // 이벤트를 시간순으로 정렬
   dayEvents.sort((a, b) => {
      let aStart, bStart;
      if (a.start) {
         aStart = new Date(a.start.dateTime || a.start.date);
      } else if (a.startTime) {
         aStart = new Date(a.startTime);
      } else if (a.date && a.time) {
         aStart = new Date(`${a.date}T${a.time}:00+09:00`);
      }

      if (b.start) {
         bStart = new Date(b.start.dateTime || b.start.date);
      } else if (b.startTime) {
         bStart = new Date(b.startTime);
      } else if (b.date && b.time) {
         bStart = new Date(`${b.date}T${b.time}:00+09:00`);
      }

      return aStart - bStart;
   });

   // 이벤트 목록 출력
   dayEvents.forEach((event, idx) => {
      let start, end;
      if (event.start) {
         start = new Date(event.start.dateTime || event.start.date);
         end = new Date(event.end.dateTime || event.end.date);
      } else if (event.startTime) {
         start = new Date(event.startTime);
         end = new Date(event.endTime);
      } else if (event.date && event.time) {
         const duration = event.duration || 60;
         start = new Date(`${event.date}T${event.time}:00+09:00`);
         end = new Date(start.getTime() + duration * 60 * 1000);
      }
      console.log(`   ${idx+1}. "${event.summary || event.title || '제목없음'}" ${start.getHours()}:${start.getMinutes().toString().padStart(2,'0')} - ${end.getHours()}:${end.getMinutes().toString().padStart(2,'0')}`);
   });

   const availableSlots = [];
   const workStart = 9; // 오전 9시
   const workEnd = 22; // 오후 10시
   const bufferMinutes = 60; // 이벤트 직후 버퍼 시간 (1시간) - 현실적인 간격

   let currentHour = workStart;

   for (const event of dayEvents) {
      let eventStart, eventEnd;
      if (event.start) {
         eventStart = new Date(event.start.dateTime || event.start.date);
         eventEnd = new Date(event.end.dateTime || event.end.date);
      } else if (event.startTime) {
         eventStart = new Date(event.startTime);
         eventEnd = new Date(event.endTime);
      } else if (event.date && event.time) {
         const duration = event.duration || 60;
         eventStart = new Date(`${event.date}T${event.time}:00+09:00`);
         eventEnd = new Date(eventStart.getTime() + duration * 60 * 1000);
      }
      const eventStartHour = eventStart.getHours() + eventStart.getMinutes() / 60;
      const eventEndHour = eventEnd.getHours() + eventEnd.getMinutes() / 60;

      // 현재 시간부터 다음 이벤트 시작까지가 duration 이상이면 빈 시간
      const availableDuration = (eventStartHour - currentHour) * 60; // 분 단위

      console.log(`   ⏰ ${currentHour.toFixed(1)}시 ~ ${eventStartHour.toFixed(1)}시 = ${availableDuration.toFixed(0)}분 (필요: ${duration}분)`);

      if (availableDuration >= duration) {
         const slotEndHour = currentHour + (duration / 60);
         const slot = {
            start: `${Math.floor(currentHour).toString().padStart(2, '0')}:${Math.round((currentHour % 1) * 60).toString().padStart(2, '0')}`,
            end: `${Math.floor(slotEndHour).toString().padStart(2, '0')}:${Math.round((slotEndHour % 1) * 60).toString().padStart(2, '0')}`,
            date: dateStr,
            duration: duration,
            slotStartHour: currentHour
         };
         availableSlots.push(slot);
         console.log(`   ✅ 빈시간 추가: ${slot.start} - ${slot.end}`);
      }

      // 이벤트 종료 후 버퍼 시간 추가 (이동/휴식 시간 고려)
      currentHour = eventEndHour + (bufferMinutes / 60);
      console.log(`   ➡️ 다음 체크 시작: ${currentHour.toFixed(1)}시 (${bufferMinutes}분 버퍼)`);
   }

   // 마지막 이벤트 이후부터 workEnd까지
   const remainingDuration = (workEnd - currentHour) * 60;
   console.log(`   ⏰ ${currentHour.toFixed(1)}시 ~ ${workEnd}시 = ${remainingDuration.toFixed(0)}분 (필요: ${duration}분)`);

   if (remainingDuration >= duration) {
      const slotEndHour = currentHour + (duration / 60);
      const slot = {
         start: `${Math.floor(currentHour).toString().padStart(2, '0')}:${Math.round((currentHour % 1) * 60).toString().padStart(2, '0')}`,
         end: `${Math.floor(slotEndHour).toString().padStart(2, '0')}:${Math.round((slotEndHour % 1) * 60).toString().padStart(2, '0')}`,
         date: dateStr,
         duration: duration,
         slotStartHour: currentHour
      };
      availableSlots.push(slot);
      console.log(`   ✅ 마지막 빈시간 추가: ${slot.start} - ${slot.end}`);
   }

   console.log(`🔍 [빈시간찾기] 총 ${availableSlots.length}개 발견`);

   // 요청한 시간이 있으면 그 시간에 가까운 순서로 정렬
   if (requestedTimeHour !== null) {
      console.log(`🔍 [빈시간찾기] ${requestedTimeHour}시 기준 정렬`);
      availableSlots.sort((a, b) => {
         const distanceA = Math.abs(a.slotStartHour - requestedTimeHour);
         const distanceB = Math.abs(b.slotStartHour - requestedTimeHour);
         return distanceA - distanceB;
      });
      console.log('   정렬 결과:', availableSlots.map(s => `${s.start}(거리:${Math.abs(s.slotStartHour - requestedTimeHour).toFixed(1)}시간)`).join(', '));
   }

   return availableSlots;
};
