const { GoogleGenerativeAI } = require('@google/generative-ai');

// Gemini AI 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * 자연어 텍스트에서 의도(intent)와 엔티티(entities) 추출
 */
exports.parseIntent = async (req, res) => {
  try {
    const { text, contextType, availableIntents } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: '텍스트가 필요합니다.'
      });
    }

    // Gemini 모델 가져오기
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // 컨텍스트별 프롬프트 구성
    const contextPrompts = {
      my_events: `
당신은 일정 관리 AI 어시스턴트입니다. 사용자의 요청을 분석하여 의도와 엔티티를 추출해주세요.

사용 가능한 의도:
- add_event: 새 일정 추가
- edit_event: 기존 일정 수정
- delete_event: 일정 삭제
- find_event: 일정 검색
- list_events: 일정 목록 보기

추출해야 할 엔티티:
- title: 일정 제목
- date: 날짜 (오늘, 내일, 모레, YYYY-MM-DD 형식)
- time: 시간 (HH:MM 형식 또는 "오후 2시" 같은 자연어)
- description: 설명
- color: 색상 (blue, red, green, purple 등)
- eventIdentifier: 수정/삭제할 일정을 식별하는 키워드
- query: 검색 키워드
- filter: 필터 (today, week, month)

현재 날짜: ${new Date().toISOString().split('T')[0]}
`,
      google_calendar: `
당신은 Google 캘린더 관리 AI 어시스턴트입니다.

사용 가능한 의도:
- add_google_event: Google 캘린더에 일정 추가
- edit_google_event: Google 캘린더 일정 수정
- delete_google_event: Google 캘린더 일정 삭제
- find_google_event: Google 캘린더 일정 검색
- sync_calendar: 캘린더 동기화

추출해야 할 엔티티:
- title: 일정 제목
- description: 설명
- startDateTime: 시작 날짜/시간 (ISO 형식)
- endDateTime: 종료 날짜/시간 (ISO 형식)
- eventId: 일정 ID
- query: 검색 키워드

현재 날짜: ${new Date().toISOString().split('T')[0]}
`,
      profile: `
당신은 사용자 프로필 관리 AI 어시스턴트입니다.

사용 가능한 의도:
- add_personal_time: 개인 시간 추가
- edit_personal_time: 개인 시간 수정
- delete_personal_time: 개인 시간 삭제
- view_schedule: 스케줄 보기
- update_preferences: 환경설정 업데이트

추출해야 할 엔티티:
- title: 시간대 제목
- days: 요일 배열 (예: ["월", "수", "금"])
- startTime: 시작 시간 (HH:MM)
- endTime: 종료 시간 (HH:MM)
- personalTimeId: 개인 시간 ID
- preferences: 환경설정 객체

현재 날짜: ${new Date().toISOString().split('T')[0]}
`
    };

    const systemPrompt = contextPrompts[contextType] || contextPrompts.my_events;

    const prompt = `
${systemPrompt}

사용자 입력: "${text}"

다음 JSON 형식으로만 응답해주세요:
{
  "intent": "의도 이름",
  "entities": {
    "엔티티_이름": "값"
  },
  "confidence": 0.0~1.0 사이의 신뢰도
}

중요 규칙:
1. 반드시 유효한 JSON만 반환
2. 주석이나 설명 없이 JSON만 출력
3. 날짜는 자연어(오늘, 내일)를 그대로 반환하거나 ISO 형식으로 변환
4. 시간은 자연어(오후 2시)를 "14:00" 형식으로 변환
5. confidence는 의도 파악의 확신도 (0.0~1.0)

예시:
입력: "내일 오후 2시에 회의 추가해줘"
출력:
{
  "intent": "add_event",
  "entities": {
    "title": "회의",
    "date": "내일",
    "time": "14:00"
  },
  "confidence": 0.95
}

입력: "회의 일정 삭제해줘"
출력:
{
  "intent": "delete_event",
  "entities": {
    "eventIdentifier": "회의"
  },
  "confidence": 0.90
}
`;

    // Gemini API 호출
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text_response = response.text();

    console.log('Gemini 원본 응답:', text_response);

    // JSON 파싱
    let jsonString = '';
    const jsonBlockMatch = text_response.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      jsonString = jsonBlockMatch[1];
    } else {
      const jsonMatch = text_response.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }
    }

    if (!jsonString) {
      throw new Error('JSON 형식을 찾을 수 없음');
    }

    // 주석 제거 및 정제
    jsonString = jsonString.replace(/\/\/.*$/gm, '');
    jsonString = jsonString.replace(/\/\*[\s\S]*?\*\//g, '');
    jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');

    const parsedIntent = JSON.parse(jsonString);

    // 날짜/시간 후처리
    if (parsedIntent.entities) {
      if (parsedIntent.entities.date) {
        parsedIntent.entities.date = normalizeDate(parsedIntent.entities.date);
      }
      if (parsedIntent.entities.time) {
        parsedIntent.entities.time = normalizeTime(parsedIntent.entities.time);
      }
      if (parsedIntent.entities.startDateTime) {
        parsedIntent.entities.startDateTime = normalizeDateTime(parsedIntent.entities.startDateTime);
      }
      if (parsedIntent.entities.endDateTime) {
        parsedIntent.entities.endDateTime = normalizeDateTime(parsedIntent.entities.endDateTime);
      }
    }

    res.json(parsedIntent);

  } catch (error) {
    console.error('Intent parsing error:', error);
    res.status(500).json({
      success: false,
      message: '의도 파싱 중 오류가 발생했습니다.',
      error: error.message,
      intent: 'unknown',
      entities: {},
      confidence: 0
    });
  }
};

/**
 * 날짜 정규화 함수
 */
function normalizeDate(dateStr) {
  const today = new Date();

  if (dateStr === '오늘' || dateStr === 'today') {
    return today.toISOString().split('T')[0];
  } else if (dateStr === '내일' || dateStr === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  } else if (dateStr === '모레') {
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    return dayAfter.toISOString().split('T')[0];
  } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }

  // 다른 형식의 날짜는 그대로 반환
  return dateStr;
}

/**
 * 시간 정규화 함수
 */
function normalizeTime(timeStr) {
  // 이미 HH:MM 형식이면 그대로 반환
  if (timeStr.match(/^\d{1,2}:\d{2}$/)) {
    return timeStr;
  }

  // "오후 2시", "오전 10시 30분" 등을 파싱
  const ampmMatch = timeStr.match(/(오전|오후)\s*(\d{1,2})시\s*(\d{1,2})?분?/);
  if (ampmMatch) {
    const [, ampm, hour, minute] = ampmMatch;
    let h = parseInt(hour);
    if (ampm === '오후' && h !== 12) h += 12;
    if (ampm === '오전' && h === 12) h = 0;
    const m = minute ? parseInt(minute) : 0;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  return timeStr;
}

/**
 * 날짜/시간 정규화 함수 (ISO DateTime)
 */
function normalizeDateTime(dateTimeStr) {
  // 이미 ISO 형식이면 그대로 반환
  if (dateTimeStr.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)) {
    return dateTimeStr;
  }

  // 날짜와 시간을 분리하여 처리
  const dateMatch = dateTimeStr.match(/(\d{4}-\d{2}-\d{2}|오늘|내일|모레)/);
  const timeMatch = dateTimeStr.match(/(\d{1,2}:\d{2}|오전|오후)/);

  if (dateMatch) {
    const date = normalizeDate(dateMatch[0]);
    let time = '09:00'; // 기본값

    if (timeMatch) {
      time = normalizeTime(dateTimeStr);
    }

    return `${date}T${time}:00`;
  }

  return dateTimeStr;
}

/**
 * 음성 텍스트 변환 (Web Speech API를 통해 클라이언트에서 처리됨)
 */
exports.processVoiceCommand = async (req, res) => {
  try {
    const { text, contextType } = req.body;

    // 음성 명령을 텍스트로 받아서 parseIntent와 동일하게 처리
    req.body.availableIntents = getAvailableIntentsForContext(contextType);

    // parseIntent 재사용
    return exports.parseIntent(req, res);

  } catch (error) {
    console.error('Voice command processing error:', error);
    res.status(500).json({
      success: false,
      message: '음성 명령 처리 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};

function getAvailableIntentsForContext(contextType) {
  const intentMap = {
    my_events: ['add_event', 'edit_event', 'delete_event', 'find_event', 'list_events'],
    google_calendar: ['add_google_event', 'edit_google_event', 'delete_google_event', 'find_google_event', 'sync_calendar'],
    profile: ['add_personal_time', 'edit_personal_time', 'delete_personal_time', 'view_schedule', 'update_preferences']
  };

  return intentMap[contextType] || intentMap.my_events;
}
