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

  return `당신은 친근하고 따뜻한 AI 스케줄 비서입니다. 사용자와 자연스럽게 대화하듯이 스케줄을 추천해주세요.

**중요: 기존 스케줄만 수정하세요. 새로운 스케줄을 추가하거나 없는 시간/과목을 만들지 마세요!**

## 현재 상황
- 전체 학원 수업: ${schedules.length}개
- 시간 충돌: ${conflicts.length}건
${conflicts.map(c => `  • ${c.schedule1.title}와 ${c.schedule2.title}이(가) ${getDayName(c.day)} 같은 시간에 있어요`).join('\n')}

## 사용자 선호도
- 우선순위: ${Array.isArray(priority_ranking) ? priority_ranking.join(' > ') : (priority_ranking || '정보 없음')}
- 취침 시간: ${bedtime || '정보 없음'}
- 쉬는 날: ${Array.isArray(preferred_rest_days) ? preferred_rest_days.join(', ') : (preferred_rest_days || '자동 배치')}
- 이동 시간: ${travel_time || '보통'}분

## 최적화 규칙
1. **충돌 해결 방법**: 겹치는 수업 중 우선순위가 낮은 것을 삭제하거나 시간 이동
2. **절대 금지**: 새로운 수업 추가, 없는 시간대에 배치, 새 과목 생성
3. **허용**: 기존 수업의 삭제, 시간 변경, 요일 변경

## 응답 가이드
1. **친근하게**: "~해요", "~세요" 등 친근한 말투 사용
2. **공감**: "일정이 바쁘시네요", "힘드실 수 있어요" 등
3. **구체적 추천**: "월요일은 이렇게 하시면 어떨까요?"
4. **이유 설명**: 왜 그렇게 추천하는지 설명
5. **격려**: "이렇게 하시면 더 효율적일 거예요"

## 스케줄 데이터
${JSON.stringify(schedules, null, 2)}

## 응답 형식 (JSON)

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

    // 프롬프트 생성 (질문/제안 방식)
    const prompt = `당신은 똑똑한 AI 스케줄 상담사입니다. 사용자가 명확한 명령을 주지 않으면 질문하거나 제안하세요.

사용자 말: "${message}"

현재 시간표 (${currentSchedule.length}개):
${currentSchedule.map((s, i) => `${i+1}. ${s.title} (${s.days?.join(',')}) ${s.startTime}-${s.endTime}`).join('\n')}

원본 시간표 (${originalSchedule.length}개):
${originalSchedule.map((s, i) => `${i+1}. ${s.title} (${s.days?.join(',')}) ${s.startTime}-${s.endTime}`).join('\n')}

## 처리 규칙:

**명확한 명령이 있을 때만 수정**:

**필터 요청**:
- "예체능만", "운동만", "음악만" → type이 sports/arts/music인 것만 남김
- "공부만", "학교공부", "국영수", "학원만" → type이 study이거나 수학/영어/과학/사회/국어 포함된 것만
- "○○만 남겨줘" → ○○가 포함된 것만 남김

**삭제 요청 (중요: 조건에 맞는 것만 삭제, 나머지는 반드시 유지)**:
- "월요일 삭제", "월 비워줘" → days에 MON 포함된 것만 제거, 다른 요일은 유지
- "영어 삭제", "영어 없애" → title에 영어 포함된 것만 제거
- "수요일 3시 이후 삭제", "수요일 ○○ 이후 삭제" → 수요일(WED)에서 특정 시간/수업 이후만 제거
  예: "수요일 공연반 이후 삭제" → 수요일에서 공연반보다 늦은 시간 수업만 제거, 다른 요일은 그대로
- "전부 삭제", "다 지워" → 빈 배열 반환

**주의**: 특정 요일 조건이 있으면 그 요일만 수정하고 다른 요일은 절대 건드리지 마세요!

**추가 요청**:
- "토요일 3시 영어 추가" → 새 항목 추가

**불명확한 요청 (질문이나 제안으로 응답)**:
- "쉬고싶은데", "힘든데", "바쁜데" → action: "none", 현재 시간표 유지 + 질문/제안
  예: "어느 요일을 비우고 싶으세요? 월요일이 가장 바쁜데 월요일 일부를 줄여볼까요?"
- "추천해줘", "어떻게 하면 좋을까" → action: "none", 현재 시간표 유지 + 구체적 제안
  예: "수요일 저녁 시간이 빡빡해 보이는데, 수요일 5시 이후 수업을 줄이시면 어떨까요?"

**일반 대화**:
- "뭐야", "안되네", "왜 안돼" → action: "none", 현재 시간표 그대로 + 공감

## JSON 응답 (반드시 이 형식):
\`\`\`json
{
  "understood": "요청 이해 (한글)",
  "action": "filter|delete|add|none",
  "schedule": [...전체 스케줄 배열...],
  "explanation": "친근한 설명 😊 (2-4문장)"
}
\`\`\`

**중요**:
- action이 "none"이면 schedule은 현재 시간표 그대로 반환
- 불명확한 요청엔 구체적인 질문이나 제안으로 응답 (마음대로 삭제 금지!)

## 처리 예시:
1. "수요일 공연반 이후 삭제" (명확) → action: "delete", 수요일만 수정
2. "쉬고싶은데" (불명확) → action: "none", 현재 유지 + "어느 요일을 비우고 싶으세요?"
3. "추천해줘" (불명확) → action: "none", 현재 유지 + "수요일 저녁을 줄이시면 어떨까요?"`;

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

    res.json({
      success: true,
      understood: parsed.understood,
      action: parsed.action,
      schedule: parsed.schedule || currentSchedule,
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
