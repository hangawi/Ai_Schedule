const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Gemini AI 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * POST /api/schedule/optimize
 * GPT 기반 스케줄 최적화
 */
router.post('/optimize', auth, async (req, res) => {
  try {
    const { schedules, conflicts, userPreferences } = req.body;

    console.log('📊 스케줄 최적화 요청 받음');
    console.log('- 전체 스케줄:', schedules.length, '개');
    console.log('- 충돌:', conflicts.length, '건');
    console.log('- 사용자 선호도:', userPreferences);

    // 프롬프트 생성
    const prompt = generateOptimizationPrompt(schedules, conflicts, userPreferences);

    // 여러 모델명 시도 (OCR에서 작동하는 모델 우선)
    const modelNames = [
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash',
      'gemini-1.5-flash-002',
      'gemini-1.5-flash-001',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-pro'
    ];

    let aiResponse = null;
    let lastError = null;

    for (const modelName of modelNames) {
      try {
        console.log(`🤖 ${modelName} 모델로 시도 중...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        aiResponse = response.text();
        console.log(`✅ ${modelName} 모델 성공!`);
        break;
      } catch (error) {
        console.log(`❌ ${modelName} 실패: ${error.message}`);
        lastError = error;
        continue;
      }
    }

    if (!aiResponse) {
      throw lastError || new Error('모든 모델 시도 실패');
    }

    console.log('✅ AI 응답 받음');

    // AI 응답 파싱
    const parsedResult = parseAIResponse(aiResponse, schedules);

    res.json({
      success: true,
      optimizedSchedule: parsedResult.schedule,
      alternatives: parsedResult.alternatives,
      explanation: parsedResult.explanation,
      conflictsResolved: parsedResult.conflictsResolved
    });

  } catch (error) {
    console.error('❌ 스케줄 최적화 에러:', error);
    res.status(500).json({
      success: false,
      error: '스케줄 최적화에 실패했습니다',
      details: error.message
    });
  }
});

/**
 * 최적화 프롬프트 생성
 */
function generateOptimizationPrompt(schedules, conflicts, preferences) {
  const {
    school_end_time,
    bedtime,
    travel_time,
    priority_subjects,
    priority_ranking,
    rest_day,
    preferred_rest_days,
    dinner_time,
    homework_time
  } = preferences;

  return `당신은 천재 스케줄 최적화 AI입니다. 충돌을 지능적으로 해결하세요.

**현재 상황**:
- ${conflicts.length}건 충돌 발견
- 총 ${schedules.length}개 수업

**충돌 상세**:
${conflicts.map(c => `• ${c.schedule1.title}(${c.schedule1.startTime}) vs ${c.schedule2.title}(${c.schedule2.startTime}) - ${getDayName(c.day)}`).join('\n')}

**스케줄**:
${schedules.map((s, i) => `${i+1}. ${s.title} | ${s.days?.join(',')} | ${s.startTime}-${s.endTime}`).join('\n')}

## 똑똑한 해결 전략

1. **우선순위 판단**:
   - 학교 공부(수학, 영어, 과학) > 예체능 > 기타
   - 긴 수업 > 짧은 수업
   - 주중 > 주말

2. **해결 방법** (순서대로 시도):
   a) 우선순위 낮은 수업 삭제
   b) 다른 요일로 이동
   c) 시간 조정 (30분 전후)

3. **절대 금지**:
   - 새 수업 추가하지 마세요
   - 없는 시간대에 배치하지 마세요
   - 기존 수업 정보 변조하지 마세요

4. **검증**:
   - 해결 후 충돌 0건 확인
   - 삭제된 수업은 반드시 explanation에 명시

## JSON 응답

다음 형식으로 자연스럽게 대화하듯 답변해주세요:

\`\`\`json
{
  "schedule": [
    {
      "title": "학원/과목명",
      "days": ["MON", "WED"],
      "startTime": "16:00",
      "endTime": "17:00",
      "duration": 60,
      "type": "study|sports|arts|etc",
      "reason": "이 시간을 선택한 이유"
    }
  ],
  "explanation": "😊 친근한 설명 (3-5문장, 자연스러운 대화체)\n\n예: '일정이 정말 빡빡하네요! 월요일이 조금 바빠 보여서 영어 수업을 수요일로 옮겨봤어요. 이렇게 하면 여유가 생겨서 더 집중할 수 있을 거예요. 주말엔 푹 쉬시는 걸 추천드려요~'",
  "conflictsResolved": 5,
  "recommendations": [
    "💡 추천 1: 구체적인 제안과 이유",
    "💡 추천 2: 대안적인 방법",
    "💡 추천 3: 주의사항이나 팁"
  ],
  "alternatives": [
    {
      "option": "다른 방법 1",
      "description": "이렇게도 할 수 있어요",
      "reason": "왜 이 방법이 좋은지"
    }
  ]
}
\`\`\`

**중요**:
1. explanation은 반드시 친근하고 대화하듯이 작성 (이모지 사용 OK)
2. "~해요", "~세요" 말투 사용
3. 구체적인 요일과 시간 언급
4. 아이 입장에서 공감하는 내용 포함
5. JSON 형식 엄수
`;
}

/**
 * AI 응답 파싱
 */
function parseAIResponse(aiResponse, originalSchedules) {
  try {
    // JSON 추출 (```json ... ``` 형식에서)
    const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
    let jsonStr = jsonMatch ? jsonMatch[1] : aiResponse;

    // 파싱
    const parsed = JSON.parse(jsonStr);

    return {
      schedule: parsed.schedule || [],
      explanation: parsed.explanation || '최적화가 완료되었습니다.',
      conflictsResolved: parsed.conflictsResolved || 0,
      alternatives: parsed.alternatives || [],
      weeklyStructure: parsed.weeklyStructure || {},
      tips: parsed.tips || [],
      statistics: calculateStatistics(parsed.schedule || [])
    };
  } catch (error) {
    console.error('AI 응답 파싱 실패:', error);
    console.log('원본 응답:', aiResponse);

    // 파싱 실패 시 기본 응답
    return {
      schedule: originalSchedules,
      explanation: '스케줄을 분석했지만 최적화 결과를 생성하는데 문제가 발생했습니다. 원본 스케줄을 반환합니다.',
      conflictsResolved: 0,
      alternatives: [],
      statistics: calculateStatistics(originalSchedules)
    };
  }
}

/**
 * 스케줄 통계 계산
 */
function calculateStatistics(schedules) {
  const stats = {
    totalClasses: schedules.length,
    totalHoursPerWeek: 0,
    averageHoursPerDay: 0,
    classesByDay: {},
    classesByType: {}
  };

  schedules.forEach(schedule => {
    const duration = schedule.duration || 60;
    stats.totalHoursPerWeek += (duration / 60);

    // 요일별
    (schedule.days || []).forEach(day => {
      stats.classesByDay[day] = (stats.classesByDay[day] || 0) + 1;
    });

    // 타입별
    const type = schedule.type || 'etc';
    stats.classesByType[type] = (stats.classesByType[type] || 0) + 1;
  });

  stats.averageHoursPerDay = stats.totalHoursPerWeek / 7;

  return stats;
}

/**
 * 요일 코드 -> 한글 이름
 */
function getDayName(dayCode) {
  const names = {
    'MON': '월요일',
    'TUE': '화요일',
    'WED': '수요일',
    'THU': '목요일',
    'FRI': '금요일',
    'SAT': '토요일',
    'SUN': '일요일'
  };
  return names[dayCode] || dayCode;
}

/**
 * 요일명 파싱 (한글 → 영어 코드)
 */
function parseDayName(text) {
  const dayMap = {
    '월': 'MON', '월요일': 'MON',
    '화': 'TUE', '화요일': 'TUE',
    '수': 'WED', '수요일': 'WED',
    '목': 'THU', '목요일': 'THU',
    '금': 'FRI', '금요일': 'FRI',
    '토': 'SAT', '토요일': 'SAT',
    '일': 'SUN', '일요일': 'SUN'
  };

  for (const [key, value] of Object.entries(dayMap)) {
    if (text.includes(key)) {
      return value;
    }
  }
  return null;
}

/**
 * 시간 파싱 (텍스트 → HH:MM)
 */
function parseTimeText(text) {
  // "6시", "저녁 6시", "오후 6시" 등
  const timeMatch = text.match(/(\d{1,2})시/);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    if (text.includes('오후') || text.includes('저녁')) {
      if (hour < 12) hour += 12;
    }
    return `${hour.toString().padStart(2, '0')}:00`;
  }
  return null;
}

/**
 * 코드 기반 스케줄 필터링 (AI 의존하지 않음)
 */
function filterScheduleByCode(message, currentSchedule) {
  const lowerMsg = message.toLowerCase().replace(/\s/g, '');

  // 1. "수요일 주니어B만 남기고 삭제" 패턴
  const keepOnlyMatch = message.match(/(월|화|수|목|금|토|일|월요일|화요일|수요일|목요일|금요일|토요일|일요일)\s*([가-힣a-zA-Z0-9\s]+)만/);
  if (keepOnlyMatch) {
    const dayCode = parseDayName(keepOnlyMatch[1]);
    const keepTitle = keepOnlyMatch[2].trim();

    console.log(`🎯 [코드 필터] "${keepOnlyMatch[1]} ${keepTitle}만" 패턴 감지`);
    console.log(`   → ${dayCode}의 "${keepTitle}"만 남기고 나머지 삭제`);

    const filtered = currentSchedule.filter(item => {
      const matchesDay = item.days?.includes(dayCode);
      const matchesTitle = item.title?.includes(keepTitle);
      const keep = matchesDay && matchesTitle;

      if (!keep) {
        console.log(`   ✂️ 삭제: ${item.title} (${item.days?.join(',')})`);
      }

      return keep;
    });

    return {
      filtered: true,
      schedule: filtered,
      understood: `${keepOnlyMatch[1]} ${keepTitle}만 남기기`,
      explanation: `${keepOnlyMatch[1]} ${keepTitle}만 남기고 나머지를 모두 삭제했어요! 😊`
    };
  }

  // 2. "금요일 공연반 삭제" 패턴 (요일 + 키워드)
  const dayDeleteMatch = message.match(/(월|화|수|목|금|토|일|월요일|화요일|수요일|목요일|금요일|토요일|일요일)\s*([가-힣a-zA-Z]+)\s*(삭제|빼|없애|제거)/);
  if (dayDeleteMatch) {
    const dayCode = parseDayName(dayDeleteMatch[1]);
    const keyword = dayDeleteMatch[2];

    console.log(`🎯 [코드 필터] "${dayDeleteMatch[1]} ${keyword} 삭제" 패턴 감지`);

    const filtered = currentSchedule.filter(item => {
      const matchesDay = item.days?.includes(dayCode);
      const matchesTitle = item.title?.includes(keyword);
      const shouldDelete = matchesDay && matchesTitle;

      if (shouldDelete) {
        console.log(`   ✂️ 삭제: ${item.title} (${item.days?.join(',')})`);
      }

      return !shouldDelete;
    });

    return {
      filtered: true,
      schedule: filtered,
      understood: `${dayDeleteMatch[1]} ${keyword} 삭제`,
      explanation: `${dayDeleteMatch[1]} ${keyword} 수업을 삭제했어요! 😊`
    };
  }

  // 3. "KPOP 삭제" 패턴 (키워드만)
  const keywordDeleteMatch = message.match(/([가-힣a-zA-Z0-9]+)\s*(삭제|빼|없애|제거)/);
  if (keywordDeleteMatch && !message.includes('만')) {
    const keyword = keywordDeleteMatch[1];

    console.log(`🎯 [코드 필터] "${keyword} 삭제" 패턴 감지`);

    const filtered = currentSchedule.filter(item => {
      const matchesTitle = item.title?.toLowerCase().includes(keyword.toLowerCase());

      if (matchesTitle) {
        console.log(`   ✂️ 삭제: ${item.title} (${item.days?.join(',')})`);
      }

      return !matchesTitle;
    });

    return {
      filtered: true,
      schedule: filtered,
      understood: `${keyword} 삭제`,
      explanation: `${keyword} 관련 수업을 모두 삭제했어요! 😊`
    };
  }

  // 4. "6시 겹치는 삭제" 패턴
  const timeDeleteMatch = message.match(/(\d{1,2})시\s*(겹치는|겹치|중복)\s*(삭제|빼|없애|제거)/);
  if (timeDeleteMatch) {
    const targetHour = parseInt(timeDeleteMatch[1]);
    const targetTime = `${targetHour.toString().padStart(2, '0')}:00`;

    console.log(`🎯 [코드 필터] "${targetHour}시 겹치는 삭제" 패턴 감지`);

    const filtered = currentSchedule.filter(item => {
      const startHour = parseInt(item.startTime?.split(':')[0] || '0');
      const endHour = parseInt(item.endTime?.split(':')[0] || '0');
      const overlaps = startHour <= targetHour && targetHour < endHour;

      if (overlaps) {
        console.log(`   ✂️ 삭제: ${item.title} (${item.startTime}-${item.endTime})`);
      }

      return !overlaps;
    });

    return {
      filtered: true,
      schedule: filtered,
      understood: `${targetHour}시 겹치는 수업 삭제`,
      explanation: `${targetHour}시에 겹치는 수업들을 삭제했어요! 😊`
    };
  }

  // 필터링 안됨 - AI에게 맡김
  return { filtered: false };
}

/**
 * POST /api/schedule/chat
 * 자연어로 스케줄 수정 요청
 */
router.post('/chat', auth, async (req, res) => {
  try {
    const { message, currentSchedule, originalSchedule } = req.body;

    console.log('💬 채팅 요청:', message);

    // 롤백 요청인지 먼저 확인 (빠른 처리)
    const undoKeywords = ['롤백', '되돌려', '돌려', '이전', '아까', '원래', '취소', 'undo'];
    if (undoKeywords.some(keyword => message.includes(keyword))) {
      console.log('✅ 롤백 요청 감지 - 원본 스케줄로 복원');
      return res.json({
        success: true,
        understood: '원본 시간표로 되돌리기',
        action: 'undo',
        schedule: originalSchedule,
        explanation: '네, 원래 시간표로 되돌려드렸어요! 😊 AI 최적화 전 상태로 복원됐습니다.'
      });
    }

    // 코드 기반 필터링 시도 (AI보다 먼저)
    const codeResult = filterScheduleByCode(message, currentSchedule);
    if (codeResult.filtered) {
      console.log('✅ 코드 기반 필터링 성공 - AI 호출 없이 즉시 처리');
      return res.json({
        success: true,
        understood: codeResult.understood,
        action: 'delete',
        schedule: codeResult.schedule,
        explanation: codeResult.explanation
      });
    }

    console.log('ℹ️ 코드 기반 필터링 불가 - AI 호출')

    // 프롬프트 생성 - 강력하고 똑똑한 AI
    const prompt = `당신은 매우 똑똑한 스케줄 관리 AI입니다. 사용자의 의도를 정확히 파악하세요.

사용자: "${message}"
현재 시간표: ${JSON.stringify(currentSchedule)}

## 요청 이해 가이드

**삭제 요청**:
- "금요일 공연반 삭제", "금 공연반 빼줘" → days에 FRI 포함 AND title에 "공연" 포함된 항목만 삭제
- "6시 겹치는 삭제", "저녁 6시 비우기" → startTime이 17:30~18:30 사이 항목만 삭제
- "KPOP 삭제", "케이팝 없애" → title에 "KPOP" 또는 "케이팝" 포함된 항목 삭제
- "수요일 주니어B만", "수 주니어B만 남기고 삭제" → WED의 주니어B 아닌 것만 제거

**필터 요청**:
- "예체능만", "운동만", "음악만" → type이 sports/arts/music인 것만
- "공부만", "학원만" → type이 study인 것만

**질문/제안 요청** (명확한 명령 아님):
- "쉬고싶은데", "힘든데", "추천해줘" → action: "none" + 구체적 질문/제안

**시간 표현 이해**:
- "6시", "저녁 6시", "오후 6시" = 18:00
- "겹치는" = 해당 시간 ±30분
- "이후", "후" = 해당 시간보다 늦은 것
- "전", "이전" = 해당 시간보다 이른 것

## 절대 규칙 (위반 시 실패)

1. **조건에 정확히 일치하는 것만 처리**
   - "금요일 공연반" → FRI + 공연 둘 다 만족해야 함
   - 조건 하나라도 안 맞으면 건드리지 마세요

2. **다른 항목은 100% 보존**
   - 금요일 공연반 삭제 시 → 월/화/수/목/토/일 모든 수업, 금요일의 다른 수업 유지
   - 절대로 전체 삭제하지 마세요

3. **원본 객체 구조 유지**
   - 각 항목은 {title, days, startTime, endTime, duration, type, gradeLevel} 필드 유지
   - days는 배열 ["MON", "WED"] 형태

## JSON 응답

\`\`\`json
{
  "understood": "사용자 의도 정확히 설명",
  "action": "delete|filter|none",
  "schedule": [수정된 전체 배열],
  "explanation": "친근한 설명 😊"
}
\`\`\`

**예시 1**: "금요일 공연반 삭제"
→ days에 "FRI" 포함 AND title에 "공연" 포함된 것만 제거
→ 다른 모든 수업은 그대로 반환

**예시 2**: "6시 겹치는 삭제"
→ startTime이 "17:30"~"18:30" 사이인 것만 제거
→ 다른 시간대 수업은 그대로 반환`;

    // 여러 모델명 시도
    const modelNames = ['gemini-2.0-flash-exp', 'gemini-2.0-flash', 'gemini-1.5-flash'];

    let aiResponse = null;

    for (const modelName of modelNames) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        aiResponse = response.text();
        break;
      } catch (error) {
        continue;
      }
    }

    if (!aiResponse) {
      throw new Error('AI 응답 실패');
    }

    // JSON 파싱 (여러 형식 시도)
    let parsed = null;

    try {
      // 1. ```json ... ``` 형식
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        // 2. ``` ... ``` 형식
        const codeMatch = aiResponse.match(/```\s*([\s\S]*?)\s*```/);
        if (codeMatch) {
          parsed = JSON.parse(codeMatch[1]);
        } else {
          // 3. 직접 JSON
          parsed = JSON.parse(aiResponse);
        }
      }
    } catch (parseError) {
      console.error('JSON 파싱 실패:', parseError);
      console.log('원본 응답:', aiResponse);

      // 파싱 실패 시 원본 스케줄 반환
      return res.json({
        success: true,
        understood: '요청을 이해했지만 형식 오류가 발생했습니다',
        action: 'none',
        schedule: currentSchedule,
        explanation: aiResponse.substring(0, 200) // 앞 200자만 보여줌
      });
    }

    console.log('✅ 채팅 응답:', parsed.understood);
    console.log('📋 반환 스케줄 수:', parsed.schedule?.length || 0);

    // 스케줄이 비어있거나 잘못된 경우 체크
    if (!parsed.schedule || !Array.isArray(parsed.schedule)) {
      console.error('❌ AI가 잘못된 schedule 반환:', parsed.schedule);
      return res.json({
        success: true,
        understood: parsed.understood,
        action: 'none',
        schedule: currentSchedule, // 원본 유지
        explanation: '죄송해요, 처리 중 문제가 발생했습니다. 시간표는 그대로 유지됩니다. 😊'
      });
    }

    // 스케줄이 모두 삭제된 경우 경고
    if (parsed.schedule.length === 0 && currentSchedule.length > 0) {
      console.warn('⚠️ 모든 스케줄 삭제됨 - 의도적인가?');
    }

    res.json({
      success: true,
      understood: parsed.understood,
      action: parsed.action,
      schedule: parsed.schedule,
      explanation: parsed.explanation
    });

  } catch (error) {
    console.error('❌ 채팅 처리 에러:', error);
    res.status(500).json({
      success: false,
      error: '채팅 처리 실패',
      details: error.message
    });
  }
});

module.exports = router;
