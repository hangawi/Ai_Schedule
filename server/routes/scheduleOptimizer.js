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

    // 검증: 너무 많이 삭제된 경우 경고
    const deletionRate = (schedules.length - parsedResult.schedule.length) / schedules.length;
    if (deletionRate > 0.5) {
      console.warn(`⚠️ 경고: ${Math.round(deletionRate * 100)}% 삭제됨 (${schedules.length} → ${parsedResult.schedule.length})`);
      console.warn('원본 스케줄 반환');

      return res.json({
        success: true,
        optimizedSchedule: schedules,
        alternatives: [],
        explanation: '죄송해요, 최적화 중 문제가 발생했습니다. 😊\n\n현재 시간표를 그대로 유지할게요.\n\n수동으로 수정하시겠어요? 예: "금요일 공연반 삭제"',
        conflictsResolved: 0
      });
    }

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

  return `스케줄 충돌 ${conflicts.length}건 해결

## 현재 시간표 (${schedules.length}개)
${schedules.map((s, i) => `${i+1}. ${s.title} | ${s.days?.join(',')} | ${s.startTime}-${s.endTime}`).join('\n')}

## 충돌 상세
${conflicts.map((c, i) => `${i+1}. ${getDayName(c.day)}: ${c.schedule1.title}(${c.schedule1.startTime}) vs ${c.schedule2.title}(${c.schedule2.startTime})`).join('\n')}

## 해결 규칙

1. **최소 삭제 원칙**: 충돌 해결에 필요한 최소한만 삭제
   - ${conflicts.length}건 충돌 → 최소 ${conflicts.length}개만 삭제
   - 나머지 ${schedules.length - conflicts.length}개는 **반드시 유지**

2. **삭제 우선순위**:
   - 중복 수업 (같은 수업이 여러 요일) → 하나만 남기고 삭제
   - 짧은 수업 > 긴 수업
   - 예체능 > 공부 (학업 우선)

3. **절대 금지**:
   - 새 수업 추가 금지
   - 없는 시간대에 배치 금지
   - 50% 이상 삭제 금지

## JSON 응답

\`\`\`json
{
  "schedule": [{title, days, startTime, endTime, duration, type}],
  "explanation": "어떤 수업을 왜 삭제했는지 설명",
  "conflictsResolved": ${conflicts.length}
}
\`\`\`

예시:
"주니어A가 월요일과 화요일에 중복되어서 화요일 것만 남기고 월요일 것을 삭제했어요. 나머지 수업들은 그대로 유지했습니다! 😊"`;
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
  console.log('\n🔍 [필터 시작] 메시지:', message);
  console.log('📋 현재 스케줄:', currentSchedule.length, '개');
  currentSchedule.forEach((item, idx) => {
    const daysStr = Array.isArray(item.days) ? item.days.join(',') : item.days;
    console.log(`  ${idx + 1}. ${item.title} (${daysStr}) ${item.startTime}-${item.endTime}`);
  });

  // 1. "수요일 공연반까지만" 패턴 (까지만 = 그 이후 삭제)
  // 주의: "금요일에 좀 피곤할거같은데 금요일 6시까지만" 같은 긴 문장은 제외
  const untilMatch = message.match(/(월|화|수|목|금|토|일|월요일|화요일|수요일|목요일|금요일|토요일|일요일)\s*([가-힣a-zA-Z0-9]+)까지만/);
  if (untilMatch && untilMatch[2].length < 10) { // 수업 이름은 보통 10자 이하
    const dayCode = parseDayName(untilMatch[1]);
    const untilTitle = untilMatch[2].trim();

    console.log(`\n🎯 [코드 필터] "${untilMatch[1]} ${untilTitle}까지만" 패턴 감지`);
    console.log(`   → ${dayCode}의 "${untilTitle}" 이후 수업들만 삭제`);

    // 해당 요일의 시간표를 시간순으로 정렬
    const daySchedules = currentSchedule
      .filter(item => item.days?.includes(dayCode))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    console.log(`\n  ${dayCode} 시간표 (${daySchedules.length}개):`);
    daySchedules.forEach((s, i) => {
      console.log(`    ${i + 1}. ${s.title} ${s.startTime}-${s.endTime}`);
    });

    // "까지만" 기준 찾기
    const untilIndex = daySchedules.findIndex(item =>
      item.title?.toLowerCase().includes(untilTitle.toLowerCase())
    );

    if (untilIndex === -1) {
      console.log(`\n  ❌ "${untilTitle}" 수업을 찾을 수 없음`);
      return { filtered: false };
    }

    const untilTime = daySchedules[untilIndex].endTime;
    console.log(`\n  ✂️ ${untilTitle} 종료 시간: ${untilTime}`);
    console.log(`  → 이 시간 이후 ${dayCode} 수업들 삭제`);

    const filtered = currentSchedule.filter(item => {
      const isTargetDay = item.days?.includes(dayCode);

      if (!isTargetDay) {
        console.log(`  ✅ 유지: ${item.title} (다른 요일)`);
        return true; // 다른 요일은 유지
      }

      const isAfter = item.startTime > untilTime;

      if (isAfter) {
        console.log(`  ✂️ 삭제: ${item.title} (${item.startTime} > ${untilTime})`);
        return false;
      } else {
        console.log(`  ✅ 유지: ${item.title} (${item.startTime} <= ${untilTime})`);
        return true;
      }
    });

    console.log(`\n✅ 필터링 완료: ${currentSchedule.length - filtered.length}개 삭제`);

    return {
      filtered: true,
      schedule: filtered,
      understood: `${untilMatch[1]} ${untilTitle}까지만 하고 나머지 삭제`,
      explanation: `${untilMatch[1]} ${untilTitle}까지만 남기고 ${currentSchedule.length - filtered.length}개를 삭제했어요! 😊`
    };
  }

  // 2. "금요일 6시까지만" 패턴 (시간 기반)
  const timeUntilMatch = message.match(/(월|화|수|목|금|토|일|월요일|화요일|수요일|목요일|금요일|토요일|일요일)\s*(\d{1,2})시까지만/);
  if (timeUntilMatch) {
    const dayCode = parseDayName(timeUntilMatch[1]);
    const untilHour = parseInt(timeUntilMatch[2]);
    const untilTime = `${untilHour.toString().padStart(2, '0')}:00`;

    console.log(`\n🎯 [코드 필터] "${timeUntilMatch[1]} ${untilHour}시까지만" 패턴 감지`);
    console.log(`   → ${dayCode}의 ${untilTime} 이후 수업들만 삭제`);

    const filtered = currentSchedule.filter(item => {
      const isTargetDay = item.days?.includes(dayCode);

      if (!isTargetDay) {
        console.log(`  ✅ 유지: ${item.title} (다른 요일)`);
        return true; // 다른 요일은 유지
      }

      // 시작 시간이 기준 시간 이후인지 체크
      const startHour = parseInt(item.startTime.split(':')[0]);
      const isAfter = startHour >= untilHour;

      if (isAfter) {
        console.log(`  ✂️ 삭제: ${item.title} (${item.startTime} >= ${untilTime})`);
        return false;
      } else {
        console.log(`  ✅ 유지: ${item.title} (${item.startTime} < ${untilTime})`);
        return true;
      }
    });

    console.log(`\n✅ 필터링 완료: ${currentSchedule.length - filtered.length}개 삭제`);

    return {
      filtered: true,
      schedule: filtered,
      understood: `${timeUntilMatch[1]} ${untilHour}시까지만 하고 나머지 삭제`,
      explanation: `${timeUntilMatch[1]} ${untilHour}시 이후 수업 ${currentSchedule.length - filtered.length}개를 삭제했어요! 😊`
    };
  }

  // 3. "수요일 주니어B만 남기고 삭제" 패턴
  const keepOnlyMatch = message.match(/(월|화|수|목|금|토|일|월요일|화요일|수요일|목요일|금요일|토요일|일요일)\s*([가-힣a-zA-Z0-9\s]+)만/);
  if (keepOnlyMatch) {
    const dayCode = parseDayName(keepOnlyMatch[1]);
    const keepTitle = keepOnlyMatch[2].trim();

    console.log(`\n🎯 [코드 필터] "${keepOnlyMatch[1]} ${keepTitle}만" 패턴 감지`);
    console.log(`   → ${dayCode}의 "${keepTitle}"만 남기고 나머지 삭제`);

    const filtered = currentSchedule.filter(item => {
      const matchesDay = item.days?.includes(dayCode);
      const matchesTitle = item.title?.toLowerCase().includes(keepTitle.toLowerCase());
      const keep = matchesDay && matchesTitle;

      console.log(`\n  검사: ${item.title} (${item.days?.join(',')})`);
      console.log(`    - days 포함 ${dayCode}? ${matchesDay}`);
      console.log(`    - title 포함 "${keepTitle}"? ${matchesTitle}`);
      console.log(`    - 결과: ${keep ? '✅ 유지' : '✂️ 삭제'}`);

      return keep;
    });

    console.log(`\n✅ 필터링 완료: ${filtered.length}개 남음 (${currentSchedule.length - filtered.length}개 삭제)`);

    return {
      filtered: true,
      schedule: filtered,
      understood: `${keepOnlyMatch[1]} ${keepTitle}만 남기기`,
      explanation: `${keepOnlyMatch[1]} ${keepTitle}만 남기고 ${currentSchedule.length - filtered.length}개를 삭제했어요! 😊`
    };
  }

  // 4. "금요일 공연반 삭제" 패턴 (요일 + 키워드 + 삭제)
  const dayDeleteMatch = message.match(/(월|화|수|목|금|토|일|월요일|화요일|수요일|목요일|금요일|토요일|일요일)\s+([가-힣a-zA-Z0-9\s]+?)\s*(과목\s*)?(삭제|빼|없애|제거)/);
  if (dayDeleteMatch) {
    const dayCode = parseDayName(dayDeleteMatch[1]);
    const keyword = dayDeleteMatch[2].trim();

    console.log(`\n🎯 [코드 필터] "${dayDeleteMatch[1]} ${keyword} 삭제" 패턴 감지`);
    console.log(`   → ${dayCode}에서 "${keyword}" 포함된 수업만 삭제`);

    const filtered = currentSchedule.filter(item => {
      const matchesDay = item.days?.includes(dayCode);
      const matchesTitle = item.title?.toLowerCase().includes(keyword.toLowerCase());
      const shouldDelete = matchesDay && matchesTitle;

      console.log(`\n  검사: ${item.title} (${item.days?.join(',')})`);
      console.log(`    - days 포함 ${dayCode}? ${matchesDay}`);
      console.log(`    - title 포함 "${keyword}"? ${matchesTitle}`);
      console.log(`    - 결과: ${shouldDelete ? '✂️ 삭제' : '✅ 유지'}`);

      return !shouldDelete;
    });

    console.log(`\n✅ 필터링 완료: ${currentSchedule.length - filtered.length}개 삭제`);

    if (filtered.length === currentSchedule.length) {
      console.warn(`\n⚠️ 아무것도 삭제 안됨 - "${keyword}" 수업을 못 찾음`);
      return {
        filtered: true,
        schedule: currentSchedule,
        understood: `${dayDeleteMatch[1]} ${keyword} 삭제 시도`,
        explanation: `${dayDeleteMatch[1]}에 "${keyword}" 수업을 찾을 수 없어요. 😊\n\n현재 ${dayCode} 수업:\n${currentSchedule.filter(s => s.days?.includes(dayCode)).map(s => `- ${s.title}`).join('\n')}`
      };
    }

    return {
      filtered: true,
      schedule: filtered,
      understood: `${dayDeleteMatch[1]} ${keyword} 삭제`,
      explanation: `${dayDeleteMatch[1]} ${keyword} 수업 ${currentSchedule.length - filtered.length}개를 삭제했어요! 😊`
    };
  }

  // 5. "금요일 6시 공연반 삭제" 패턴 (요일 + 시간 + 키워드)
  const dayTimeDeleteMatch = message.match(/(월|화|수|목|금|토|일|월요일|화요일|수요일|목요일|금요일|토요일|일요일)\s+(\d{1,2})시\s*(?:에\s*)?(?:있는\s*)?([가-힣a-zA-Z0-9\s]+?)\s*(과목\s*)?(삭제|빼|없애|제거)/);
  if (dayTimeDeleteMatch) {
    const dayCode = parseDayName(dayTimeDeleteMatch[1]);
    const targetHour = parseInt(dayTimeDeleteMatch[2]);
    const keyword = dayTimeDeleteMatch[3].trim();

    console.log(`\n🎯 [코드 필터] "${dayTimeDeleteMatch[1]} ${targetHour}시 ${keyword} 삭제" 패턴 감지`);
    console.log(`   → ${dayCode} + ${targetHour}시 + "${keyword}" 조건 모두 만족하는 것만 삭제`);

    const filtered = currentSchedule.filter(item => {
      const matchesDay = item.days?.includes(dayCode);
      const startHour = parseInt(item.startTime?.split(':')[0] || '0');
      const matchesTime = startHour === targetHour;
      const matchesTitle = item.title?.toLowerCase().includes(keyword.toLowerCase());
      const shouldDelete = matchesDay && matchesTime && matchesTitle;

      console.log(`\n  검사: ${item.title} (${item.days?.join(',')}) ${item.startTime}`);
      console.log(`    - days 포함 ${dayCode}? ${matchesDay}`);
      console.log(`    - startTime ${targetHour}시? ${matchesTime}`);
      console.log(`    - title 포함 "${keyword}"? ${matchesTitle}`);
      console.log(`    - 결과: ${shouldDelete ? '✂️ 삭제' : '✅ 유지'}`);

      return !shouldDelete;
    });

    console.log(`\n✅ 필터링 완료: ${currentSchedule.length - filtered.length}개 삭제`);

    if (filtered.length === currentSchedule.length) {
      console.warn(`\n⚠️ 아무것도 삭제 안됨 - 조건에 맞는 수업 없음`);
      return {
        filtered: true,
        schedule: currentSchedule,
        understood: `${dayTimeDeleteMatch[1]} ${targetHour}시 ${keyword} 삭제 시도`,
        explanation: `${dayTimeDeleteMatch[1]} ${targetHour}시에 "${keyword}" 수업을 찾을 수 없어요. 😊`
      };
    }

    return {
      filtered: true,
      schedule: filtered,
      understood: `${dayTimeDeleteMatch[1]} ${targetHour}시 ${keyword} 삭제`,
      explanation: `${dayTimeDeleteMatch[1]} ${targetHour}시 ${keyword} 수업을 삭제했어요! 😊`
    };
  }

  // 3. "KPOP 삭제" 패턴 (키워드만)
  const keywordDeleteMatch = message.match(/([가-힣a-zA-Z0-9]+)\s*(삭제|빼|없애|제거)/);
  if (keywordDeleteMatch && !message.includes('만')) {
    const keyword = keywordDeleteMatch[1];

    console.log(`\n🎯 [코드 필터] "${keyword} 삭제" 패턴 감지`);

    const filtered = currentSchedule.filter(item => {
      const matchesTitle = item.title?.toLowerCase().includes(keyword.toLowerCase());

      console.log(`\n  검사: ${item.title}`);
      console.log(`    - title 포함 "${keyword}"? ${matchesTitle}`);
      console.log(`    - 결과: ${matchesTitle ? '✂️ 삭제' : '✅ 유지'}`);

      return !matchesTitle;
    });

    console.log(`\n✅ 필터링 완료: ${currentSchedule.length - filtered.length}개 삭제`);

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

    console.log(`\n🎯 [코드 필터] "${targetHour}시 겹치는 삭제" 패턴 감지`);

    const filtered = currentSchedule.filter(item => {
      const startHour = parseInt(item.startTime?.split(':')[0] || '0');
      const endHour = parseInt(item.endTime?.split(':')[0] || '0');
      const overlaps = startHour <= targetHour && targetHour < endHour;

      console.log(`\n  검사: ${item.title} (${item.startTime}-${item.endTime})`);
      console.log(`    - ${targetHour}시와 겹침? ${overlaps}`);
      console.log(`    - 결과: ${overlaps ? '✂️ 삭제' : '✅ 유지'}`);

      return !overlaps;
    });

    console.log(`\n✅ 필터링 완료: ${currentSchedule.length - filtered.length}개 삭제`);

    return {
      filtered: true,
      schedule: filtered,
      understood: `${targetHour}시 겹치는 수업 삭제`,
      explanation: `${targetHour}시에 겹치는 수업들을 삭제했어요! 😊`
    };
  }

  console.log('\nℹ️ 코드 필터 패턴 없음 - AI 호출 필요');
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

    console.log('\n💬 채팅 요청:', message);

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

    // 코드 기반 필터링 비활성화 - AI가 모든 것을 처리하도록
    console.log('🤖 AI에게 모든 처리 위임')

    // 프롬프트 생성 - 인간 수준의 이해력
    const prompt = `당신은 친근하고 똑똑한 스케줄 비서입니다. 사람과 대화하듯이 자연스럽게 응답하세요.

**중요한 태도**:
- 추천을 요청하면 구체적인 방안을 제시하세요 (막연한 안내 금지)
- "어떻게 할까요?"라고 되묻지 말고, 직접 분석해서 최선의 방법을 추천하세요
- 겹치는 수업을 발견하면 구체적으로 어떤 수업이 어느 시간에 겹치는지 알려주세요
- 이유와 근거를 함께 제시하세요

**🔥 대화 맥락 유지 (매우 중요!):**
- 이전 대화에서 사용자가 요청한 삭제 명령을 **절대 잊지 마세요**
- 새로운 명령이 오면 이전 명령과 **합쳐서** 실행하세요
- 예: "A 삭제하자" → "B도 삭제해" = A + B 모두 삭제
- 요일 지정이 없으면 **문맥상 요일**을 파악하세요
- 예: "수요일 점심 후..." 대화 중 "국어 삭제" = **수요일 국어만** 삭제

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
사용자 요청: "${message}"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 현재 시간표 (총 ${currentSchedule.length}개)
${currentSchedule.map((s, i) => {
  const daysStr = Array.isArray(s.days) ? s.days.join(',') : s.days;
  return `${i + 1}. ${s.title} | 요일: ${daysStr} | 시간: ${s.startTime}-${s.endTime}`;
}).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 자연어 이해 (사람처럼 생각하세요!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**핵심: 사용자의 진짜 의도를 파악하세요!**

### 예시 1: "금요일 오후 6시까지만 하고 나머지 삭제"
**의도**: 금요일에서 6시(18:00) 이후 시작하는 수업 전부 삭제
**행동**:
- FRI이면서 startTime >= "18:00"인 것 모두 삭제
- 다른 요일은 100% 유지
**결과**: 금요일 18:00 이후만 삭제, 월~목/토/일은 그대로

### 예시 2: "목요일 6시 이후 일정 전부 삭제"
**의도**: 목요일에서 6시(18:00) 이후 시작하는 수업 전부 삭제
**행동**:
- THU이면서 startTime >= "18:00"인 것 모두 삭제
**결과**: 목요일 18:00 이후만 삭제

### 예시 3: "매일 오후 6시에 밥 먹어야 하니까 일정 정리해줘"
**의도**: 18:00 시간대에 겹치는 수업들 처리 필요
**행동**: action: "question"
**응답**: "18:00에 시작하는 수업이 5개 있네요! 저녁 식사 시간을 확보하려면 이 수업들을 삭제하는 게 좋을 것 같아요. 삭제해드릴까요? 아니면 특정 수업만 남기고 싶으신가요?"
**schedule**: 원본 그대로 반환

### 예시 5: "추천좀 해줘" (이전 질문의 후속 대화)
**의도**: 사용자가 구체적인 추천을 원함
**행동**: action: "question"
**응답**: 구체적이고 실용적인 추천 제시. 예를 들어:
- "18:00 수업 5개를 모두 삭제하는 걸 추천드려요. 그러면 매일 저녁 6시에 여유롭게 식사하실 수 있어요!"
- 또는 "월/수/금만 삭제하고 화/목은 늦게 드시는 건 어때요?"
**schedule**: 원본 그대로 반환 (추천만 하고 실행은 안함)

### 예시 7: "추천 2로 하자" / "1번으로 해줘" (사용자가 선택)
**의도**: 사용자가 추천안 중 하나를 선택해서 실행 명령
**행동**: action: "delete"
**응답**: "네! 주니어 A만 삭제했어요. 다른 수업들은 그대로 유지했습니다! 😊"
**schedule**: 실제로 삭제된 배열 반환

### 예시 8: "8시까지만 하자" (8시 10분까지 수업이 있는 경우)
**의도**: 8시 이후 수업 삭제 원함
**행동**: action: "question"
**응답**: "8시 넘어가는 수업들이 있어요! 월요일 8:00-8:10 영어, 화요일 8:00-8:30 수학이 있는데, 이 수업들도 삭제하는 게 어떨까요? 8시까지만 하시려면 이 수업들도 빼는 게 좋을 것 같아요!"
**schedule**: 원본 그대로 반환

### 예시 9: "응, 그것들도 삭제해" (후속 확인)
**의도**: 이전에 AI가 제안한 것을 승인
**행동**: action: "delete"
**응답**: "네! 8시 넘어가는 수업 2개를 삭제했어요!"
**schedule**: 실제로 삭제된 배열 반환

### 예시 10: "주니어 A만 삭제하자. 아 그런데 수요일에는 학교가 일찍 끝나서 점심먹고 집에갈거같애"
**의도**: 주니어 A 삭제 + 수요일 관련 추가 정보 제공 (즉시 실행 아님!)
**행동**: action: "question"
**응답**: "주니어 A를 삭제하고, 수요일은 점심 먹고 집에 가시려면 수요일 점심시간(13:50) 이후 수업들도 삭제할까요?

현재 수요일 점심 이후 수업:
• 국어 (13:50-14:40)
• 사회 (14:50-15:40)
• 주니어A (15:00-16:00)
• 키즈KPOP (16:10-17:00)
• 주니어B (17:00-18:00)
• 공연반 (18:00-19:00)
• KPOP (19:10-20:10)
• 팝핀 (20:20-21:30)

함께 삭제해드릴까요?"
**schedule**: 원본 그대로 반환

### 예시 11: "국어랑 사회만 삭제해" (맥락: 위 대화 이어짐, 수요일 얘기 중)
**의도**:
1. 주니어 A 전체 삭제 (이전 명령 유지!)
2. 수요일 국어만 삭제 (수요일 얘기 중이므로)
3. 수요일 사회만 삭제 (수요일 얘기 중이므로)
**행동**: action: "delete"
**응답**: "네! 주니어 A 5개(월/화/수/목/금)와 수요일 국어, 수요일 사회를 삭제했어요!"
**schedule**: 실제로 삭제된 배열 반환
**주의**: 목요일/금요일 국어, 사회는 **삭제하지 마세요!** 수요일만!

### 예시 12: "웅 그건 아니고 학교만 일찍가는거니까 나머지는 냅둬" (거절 + 수정)
**의도**:
- 수요일 점심 이후는 삭제 안함 (학원은 정상 다님)
- 하지만 주니어 A는 **여전히 삭제해야 함** (첫 명령 유지!)
**행동**: action: "delete"
**응답**: "네! 알겠어요. 주니어 A만 삭제하고 수요일 수업들은 그대로 둘게요!

삭제된 수업:
• 주니어A (월요일 15:00-16:00)
• 주니어A (화요일 15:00-16:00)
• 주니어A (수요일 15:00-16:00)
• 주니어A (목요일 15:00-16:00)
• 주니어A (금요일 15:00-16:00)

총 5개 삭제 완료!"
**schedule**: 주니어 A만 삭제된 배열 반환

### 예시 13: "응 함께 삭제해줘" (확인 후 실행)
**의도**: 주니어 A + 수요일 점심 이후 모두 삭제
**행동**: action: "delete"
**응답**: "네! 주니어 A 5개와 수요일 점심 이후 수업 8개를 삭제했어요!"
**schedule**: 실제로 삭제된 배열 반환

### 예시 6: "주니어 A가 겹쳐있는데 어떻게 하는게 좋을까?"
**의도**: 겹치는 수업에 대한 추천 요청
**행동**: action: "question"
**응답**: "주니어 A가 [요일] [시간]에 [다른수업]과 겹치네요! 주니어 A를 유지하고 [다른수업]을 삭제하는 걸 추천드려요. 주니어 A가 더 중요해 보이거든요. 이렇게 해드릴까요?"
**schedule**: 원본 그대로 반환

### 예시 4: "피곤하니까 오후 6시 이후 삭제"
**의도**: 모든 요일에서 18:00 이후 삭제
**행동**:
- 모든 요일에서 startTime >= "18:00"인 것 삭제
**결과**: 월~일 모든 요일의 18:00 이후 수업 삭제

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 절대 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **시간 표현 이해**:
   - "6시" = 18:00 (오후로 추정)
   - "오후 6시" = 18:00
   - "저녁 6시" = 18:00
   - "18시" = 18:00

2. **"이후" / "까지" 이해**:
   - "6시 이후" = startTime >= "18:00"
   - "6시까지만" = startTime < "18:00"

3. **요일 지정**:
   - "금요일 6시 이후" = FRI이면서 startTime >= "18:00"
   - 요일 없으면 = 모든 요일

4. **질문/추천 요청 처리**:
   - "일정 정리해줘" → 현재 시간표 분석 후 구체적 추천 제시
   - "추천해줘" / "어떻게 하는게 좋을까?" → 구체적인 추천안 2-3개 제시
   - "겹치는데 어떻게 할까?" → 겹치는 수업 찾아서 우선순위 기반 추천
   - **추천 형식**: "○○를 △△하는 걸 추천드려요! 왜냐하면 ~~이기 때문이에요. 이렇게 해드릴까요?"
   - action: "question", schedule: 원본 그대로 (추천만, 실행 안함)

5. **사용자 선택/확인 명령 처리** (매우 중요!):
   - "추천 2로 하자" / "1번으로 해줘" / "그렇게 해줘" / "응 삭제해" / "알았어 해줘"
   - → 즉시 실행! action: "delete", 실제 삭제된 schedule 반환
   - 절대 또 물어보지 마세요!

**주의**: "아 그런데", "참고로", "근데" 같은 추가 정보는 즉시 실행하지 말고 확인 요청!

6. **애매한 시간 표현 처리**:
   - "8시까지만" 했는데 8:10, 8:30 수업이 있으면?
   - → "8시 넘어가는 수업이 있어요: [목록]. 이것들도 삭제할까요?" (확인 요청)
   - action: "question", schedule: 원본 그대로

7. **응답 가독성 (매우 중요!)**:
   - 수업 목록이 3개 이상이면 **반드시 줄바꿈**으로 정리
   - 형식: "• 수업명 (시작시간-종료시간)" 또는 "• 수업명 (요일 시작시간-종료시간)"
   - 예: "• 국어 (13:50-14:40)\n• 사회 (14:50-15:40)"
   - 나쁜 예: "국어(13:50), 사회(14:50), 수학(15:00)..." (읽기 힘듦)

8. **거절/수정 명령 이해**:
   - "그건 아니고", "나머지는 냅둬", "그건 빼고" = 일부만 취소
   - 이전 명령(주니어 A 삭제)은 **여전히 유효**!
   - "학교만 일찍가는거니까" = 학원 수업은 유지

9. **절대 금지**:
   - 빈 배열 [] 반환 금지
   - 사용자가 명확히 삭제 명령하지 않았는데 삭제 금지
   - 사용자가 이미 선택했는데 또 물어보지 마세요!
   - 거절 응답에서 이전 명령까지 취소하지 마세요!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 JSON 응답 형식 (정확히 따르세요!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

\`\`\`json
{
  "understood": "사용자 의도 한 줄 요약",
  "action": "delete|question",
  "schedule": [
    {
      "title": "수업명",
      "days": ["MON", "TUE"],
      "startTime": "15:00",
      "endTime": "16:00",
      "duration": 60,
      "type": "study",
      "gradeLevel": "elementary"
    }
  ],
  "explanation": "친근한 설명"
}
\`\`\`

**schedule 배열 규칙**:
- 각 객체는 반드시 모든 속성을 포함해야 합니다: title, days, startTime, endTime, duration, type, gradeLevel
- 원본 스케줄에서 삭제할 것만 제외하고 나머지는 **원본 그대로** 복사
- 속성 이름을 절대 바꾸지 마세요 (title → name 같은 거 금지)
- days는 반드시 배열 형식 ["MON", "FRI"]

**예시 응답**:
만약 원본에 이런 스케줄이 있다면:
[
  {"title": "A", "days": ["FRI"], "startTime": "14:00", "endTime": "15:00", "duration": 60, "type": "study", "gradeLevel": "elementary"},
  {"title": "B", "days": ["FRI"], "startTime": "18:00", "endTime": "19:00", "duration": 60, "type": "study", "gradeLevel": "elementary"}
]

"금요일 6시 이후 삭제" 요청이 오면:
{
  "understood": "금요일 18:00 이후 시작하는 수업 삭제",
  "action": "delete",
  "schedule": [
    {"title": "A", "days": ["FRI"], "startTime": "14:00", "endTime": "15:00", "duration": 60, "type": "study", "gradeLevel": "elementary"}
  ],
  "explanation": "금요일 6시 이후 수업 1개를 삭제했어요!"
}

**중요**:
- delete이면 → 조건에 맞는 것만 삭제한 배열 반환
- question이면 → 원본 ${currentSchedule.length}개 **그대로** 반환
- 절대 빈 배열 [] 반환하지 마세요!`;

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

    console.log('✅ 처리 완료:', parsed.action, '|', currentSchedule.length, '→', parsed.schedule?.length || 0);

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

    // 스케줄이 모두 삭제된 경우 체크
    if (parsed.schedule.length === 0 && currentSchedule.length > 0) {
      console.error('❌ AI가 빈 배열 반환 - 원본 반환');
      console.error('   액션:', parsed.action);
      console.error('   설명:', parsed.explanation);

      return res.json({
        success: true,
        understood: parsed.understood,
        action: parsed.action || 'question',
        schedule: currentSchedule, // 원본 반환
        explanation: parsed.explanation || '현재 시간표를 유지했어요. 😊'
      });
    }

    // 80% 이상 삭제된 경우 경고
    const deletionRate = (currentSchedule.length - parsed.schedule.length) / currentSchedule.length;
    if (deletionRate > 0.8 && parsed.action !== 'delete') {
      console.warn(`⚠️ 비정상적 삭제: ${Math.round(deletionRate * 100)}% 삭제됨 (${currentSchedule.length} → ${parsed.schedule.length})`);
      console.warn('   액션이 delete가 아닌데 대량 삭제됨 - 원본 반환');

      return res.json({
        success: true,
        understood: parsed.understood,
        action: 'question',
        schedule: currentSchedule, // 원본 반환
        explanation: parsed.explanation || '현재 시간표를 유지했어요. 😊'
      });
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
