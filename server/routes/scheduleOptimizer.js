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

    // Gemini 모델 사용 (안정적인 버전)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // 프롬프트 생성
    const prompt = generateOptimizationPrompt(schedules, conflicts, userPreferences);

    console.log('🤖 Gemini AI에 요청 중...');

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiResponse = response.text();

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

  return `당신은 친근하고 따뜻한 학원 상담 선생님입니다. 학부모와 자연스럽게 대화하듯이 스케줄을 추천해주세요.

## 현재 상황
- 전체 학원 수업: ${schedules.length}개
- 시간 충돌: ${conflicts.length}건
${conflicts.map(c => `  • ${c.schedule1.title}와 ${c.schedule2.title}이(가) ${getDayName(c.day)} 같은 시간에 있어요`).join('\n')}

## 학부모님 말씀
- 우선순위: ${Array.isArray(priority_ranking) ? priority_ranking.join(' > ') : (priority_ranking || '정보 없음')}
- 취침 시간: ${bedtime || '정보 없음'}
- 쉬는 날: ${Array.isArray(preferred_rest_days) ? preferred_rest_days.join(', ') : (preferred_rest_days || '자동 배치')}
- 이동 시간: ${travel_time || '보통'}분

## 상담 가이드
1. **친근하게**: "~해요", "~세요" 등 친근한 말투 사용
2. **공감**: "아이가 너무 바쁘시겠어요", "힘들어할 수 있어요" 등
3. **구체적 추천**: "월요일은 이렇게 하시면 어떨까요?"
4. **이유 설명**: 왜 그렇게 추천하는지 설명
5. **선택지 제시**: 2-3가지 대안 제시
6. **격려**: "이렇게 하시면 아이도 더 즐거워할 거예요"

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
  "explanation": "😊 부모님께 드리는 친근한 상담 내용 (3-5문장, 자연스러운 대화체)\n\n예: '아이가 정말 열심히 공부하고 있네요! 다만 월요일이 조금 빡빡해 보여서 영어 수업을 수요일로 옮겨봤어요. 이렇게 하면 아이가 숨 쉴 여유가 생겨서 더 집중할 수 있을 거예요. 그리고 주말엔 가족과의 시간을 꼭 가지시는 걸 추천드려요~'",
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

module.exports = router;
