const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { generatePrompt } = require('../prompts/scheduleOptimizer');

// Gemini AI 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * POST /api/schedule/optimize
 * 새로운 자동 최적화 (고정 일정 지원)
 */
const { optimizeSchedules } = require('../utils/scheduleAutoOptimizer');

router.post('/optimize', auth, async (req, res) => {
  try {
    const { schedules, schedulesByImage, fixedSchedules } = req.body;

    // ⭐ 고정 일정이 있으면, schedules에 없어도 원본에서 찾아서 추가
    let allSchedulesForOptimization = schedules || [];

    if (fixedSchedules && fixedSchedules.length > 0) {
      const allSchedulesForSearch = schedulesByImage?.flatMap(img => img.schedules || []) || [];
      const fixedOriginals = fixedSchedules.map(fixed => {
        if (fixed.originalSchedule) return fixed.originalSchedule;
        const found = allSchedulesForSearch.find(s =>
          s.title === fixed.title &&
          s.startTime === fixed.startTime &&
          s.endTime === fixed.endTime
        );
        return found || fixed;
      });

      // schedules에 고정 일정 원본이 없으면 추가
      fixedOriginals.forEach(fixedOrig => {
        const exists = allSchedulesForOptimization.some(s =>
          s.title === fixedOrig.title &&
          s.startTime === fixedOrig.startTime &&
          s.endTime === fixedOrig.endTime
        );
        if (!exists) {
          allSchedulesForOptimization.push(fixedOrig);
        }
      });
    }

    // 새로운 최적화 로직 사용
    const result = await optimizeSchedules(
      allSchedulesForOptimization,
      schedulesByImage || [],
      fixedSchedules || []
    );

    // ⭐ 고정 일정 중 커스텀 일정 범례 생성
    const customSchedules = [];
    if (fixedSchedules && fixedSchedules.length > 0) {
      const customFixed = fixedSchedules.filter(f => f.type === 'custom');
      if (customFixed.length > 0) {
        customFixed.forEach(custom => {
          customSchedules.push({
            fileName: `커스텀 일정`,
            sourceImageIndex: custom.sourceImageIndex,
            title: custom.title,
            isCustom: true
          });
        });
      }
    }

    // result가 { optimizedSchedules: [...] } 형태로 반환되므로 그대로 사용
    res.json({
      success: true,
      optimizedSchedules: result.optimizedSchedules || result,
      customSchedules: customSchedules.length > 0 ? customSchedules : undefined
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/schedule/optimize-legacy
 * GPT 기반 스케줄 최적화 (구버전)
 */
router.post('/optimize-legacy', auth, async (req, res) => {
  try {
    const { schedules, conflicts, userPreferences } = req.body;

    // 프롬프트 생성
    const prompt = generateOptimizationPrompt(schedules, conflicts, userPreferences);

    // 여러 모델명 시도 (OCR에서 작동하는 모델 우선)
    const modelNames = [
      'gemini-2.0-flash',
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
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        aiResponse = response.text();
        break;
      } catch (error) {
        lastError = error;
        continue;
      }
    }

    if (!aiResponse) {
      throw lastError || new Error('모든 모델 시도 실패');
    }

    // AI 응답 파싱
    const parsedResult = parseAIResponse(aiResponse, schedules);

    // 검증: 너무 많이 삭제된 경우 경고
    const deletionRate = (schedules.length - parsedResult.schedule.length) / schedules.length;
    if (deletionRate > 0.5) {
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
 * 겹치는 수업 자동 감지
 */
function detectConflicts(schedules) {
  const conflicts = [];
  const dayNames = {
    'MON': '월요일', 'TUE': '화요일', 'WED': '수요일', 'THU': '목요일',
    'FRI': '금요일', 'SAT': '토요일', 'SUN': '일요일'
  };

  // 요일별로 그룹화
  const byDay = {};
  schedules.forEach((schedule, idx) => {
    const daysArray = Array.isArray(schedule.days) ? schedule.days : [schedule.days];
    daysArray.forEach(day => {
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push({ ...schedule, originalIndex: idx });
    });
  });

  // 각 요일별로 시간 겹침 체크
  Object.keys(byDay).forEach(day => {
    const daySchedules = byDay[day];

    for (let i = 0; i < daySchedules.length; i++) {
      for (let j = i + 1; j < daySchedules.length; j++) {
        const s1 = daySchedules[i];
        const s2 = daySchedules[j];

        // 시간 겹침 체크
        const start1 = s1.startTime;
        const end1 = s1.endTime;
        const start2 = s2.startTime;
        const end2 = s2.endTime;

        const overlaps = (start1 < end2 && start2 < end1);

        if (overlaps) {
          const typeLabel1 = s1.type === 'school' ? '[학교]' : s1.type === 'academy' ? '[학원]' : '';
          const typeLabel2 = s2.type === 'school' ? '[학교]' : s2.type === 'academy' ? '[학원]' : '';

          conflicts.push({
            day: dayNames[day] || day,
            schedule1: {
              title: `${typeLabel1} ${s1.title}`,
              startTime: s1.startTime,
              endTime: s1.endTime,
              type: s1.type
            },
            schedule2: {
              title: `${typeLabel2} ${s2.title}`,
              startTime: s2.startTime,
              endTime: s2.endTime,
              type: s2.type
            }
          });
        }
      }
    }
  });

  return conflicts;
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
  currentSchedule.forEach((item, idx) => {
    const daysStr = Array.isArray(item.days) ? item.days.join(',') : item.days;
  });

  // 1. "수요일 공연반까지만" 패턴 (까지만 = 그 이후 삭제)
  // 주의: "금요일에 좀 피곤할거같은데 금요일 6시까지만" 같은 긴 문장은 제외
  const untilMatch = message.match(/(월|화|수|목|금|토|일|월요일|화요일|수요일|목요일|금요일|토요일|일요일)\s*([가-힣a-zA-Z0-9]+)까지만/);
  if (untilMatch && untilMatch[2].length < 10) { // 수업 이름은 보통 10자 이하
    const dayCode = parseDayName(untilMatch[1]);
    const untilTitle = untilMatch[2].trim();

    // 해당 요일의 시간표를 시간순으로 정렬
    const daySchedules = currentSchedule
      .filter(item => item.days?.includes(dayCode))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));


    // "까지만" 기준 찾기
    const untilIndex = daySchedules.findIndex(item =>
      item.title?.toLowerCase().includes(untilTitle.toLowerCase())
    );

    if (untilIndex === -1) {
      return { filtered: false };
    }

    const untilTime = daySchedules[untilIndex].endTime;

    const filtered = currentSchedule.filter(item => {
      const isTargetDay = item.days?.includes(dayCode);

      if (!isTargetDay) {
        return true; // 다른 요일은 유지
      }

      const isAfter = item.startTime > untilTime;

      if (isAfter) {
        return false;
      } else {
        return true;
      }
    });

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

    const filtered = currentSchedule.filter(item => {
      const isTargetDay = item.days?.includes(dayCode);

      if (!isTargetDay) {
        return true; // 다른 요일은 유지
      }

      // 시작 시간이 기준 시간 이후인지 체크
      const startHour = parseInt(item.startTime.split(':')[0]);
      const isAfter = startHour >= untilHour;

      if (isAfter) {
        return false;
      } else {
        return true;
      }
    });

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

    const filtered = currentSchedule.filter(item => {
      const matchesDay = item.days?.includes(dayCode);
      const matchesTitle = item.title?.toLowerCase().includes(keepTitle.toLowerCase());
      const keep = matchesDay && matchesTitle;

      return keep;
    });

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

    const filtered = currentSchedule.filter(item => {
      const matchesDay = item.days?.includes(dayCode);
      const matchesTitle = item.title?.toLowerCase().includes(keyword.toLowerCase());
      const shouldDelete = matchesDay && matchesTitle;

      return !shouldDelete;
    });

    if (filtered.length === currentSchedule.length) {
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

    const filtered = currentSchedule.filter(item => {
      const matchesDay = item.days?.includes(dayCode);
      const startHour = parseInt(item.startTime?.split(':')[0] || '0');
      const matchesTime = startHour === targetHour;
      const matchesTitle = item.title?.toLowerCase().includes(keyword.toLowerCase());
      const shouldDelete = matchesDay && matchesTime && matchesTitle;

      return !shouldDelete;
    });

    if (filtered.length === currentSchedule.length) {
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

    const filtered = currentSchedule.filter(item => {
      const matchesTitle = item.title?.toLowerCase().includes(keyword.toLowerCase());

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

    const filtered = currentSchedule.filter(item => {
      const startHour = parseInt(item.startTime?.split(':')[0] || '0');
      const endHour = parseInt(item.endTime?.split(':')[0] || '0');
      const overlaps = startHour <= targetHour && targetHour < endHour;

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
    const { message, currentSchedule, originalSchedule, scheduleHistory, lastAiResponse, redoStack, fixedSchedules, schedulesByImage, existingCustomSchedules } = req.body;

    // ⭐ 먼저 일정 이동 요청인지 확인
    const { handleScheduleMoveRequest } = require('../utils/scheduleMoveHandler');
    const moveResult = handleScheduleMoveRequest(message, currentSchedule, fixedSchedules || []);
    if (moveResult.isMoveRequest && moveResult.result) {

      if (moveResult.result.success) {
        // 이동 성공 시 재최적화
        const { optimizeSchedules } = require('../utils/scheduleAutoOptimizer');

        const aiResult = await optimizeSchedules(
          moveResult.result.schedule,
          schedulesByImage || [],
          moveResult.result.fixedSchedules || fixedSchedules || []
        );

        return res.json({
          success: true,
          understood: moveResult.result.understood,
          action: 'move',
          schedule: aiResult.optimizedSchedules || aiResult,
          explanation: moveResult.result.explanation + '\n\n✨ 고정 일정을 반영해서 시간표를 다시 최적화했어요!',
          fixedSchedules: moveResult.result.fixedSchedules
        });
      } else {
        // 이동 실패
        return res.json(moveResult.result);
      }
    }

    // Redo (되돌리기 취소) 키워드 감지
    const redoKeywords = ['되돌리기 취소', '취소 취소', 'redo', '다시 실행', '되살려'];
    const isRedo = redoKeywords.some(keyword => message.includes(keyword));

    if (isRedo && redoStack && redoStack.length > 0) {
      const redoSchedule = redoStack[redoStack.length - 1];
      return res.json({
        success: true,
        understood: '되돌리기 취소',
        action: 'redo',
        schedule: redoSchedule,
        explanation: '되돌리기를 취소했어요! 이전 작업을 다시 실행했습니다.'
      });
    }

    // 되돌리기 요청
    const undoKeywords = ['되돌려', '돌려', '취소', 'undo'];
    const isUndo = undoKeywords.some(keyword => message.includes(keyword));

    // "방금전" 키워드 감지 (한 단계 이전)
    const stepBackKeywords = ['방금전', '방금', '바로 전', '직전', '한 단계 전', '아까'];
    const isStepBack = stepBackKeywords.some(keyword => message.includes(keyword));

    // "맨 처음", "원본", "롤백" 키워드 감지 (맨 처음으로)
    const fullUndoKeywords = ['맨 처음', '맨처음', '원본', '롤백', '처음', '초기', 'reset', '시간표 롤백'];
    const isFullUndo = fullUndoKeywords.some(keyword => message.includes(keyword));

    if (isUndo || isStepBack || isFullUndo) {
      // 1. "방금전" = 한 단계 이전
      if (isStepBack && scheduleHistory && scheduleHistory.length > 0) {
        const previousSchedule = scheduleHistory[scheduleHistory.length - 1];
        return res.json({
          success: true,
          understood: '한 단계 이전 시간표로 되돌리기',
          action: 'step_back',
          schedule: previousSchedule,
          explanation: '네, 방금 전 시간표로 되돌려드렸어요! 😊'
        });
      }

      // 2. "맨 처음" 또는 히스토리 없음 = 원본으로
      return res.json({
        success: true,
        understood: '원본 시간표로 되돌리기',
        action: 'undo',
        schedule: originalSchedule,
        explanation: '네, 원래 시간표로 되돌려드렸어요! 😊 AI 최적화 전 상태로 복원됐습니다.'
      });
    }
    // 겹치는 수업 자동 감지
    const conflicts = detectConflicts(currentSchedule);

    // 확인 응답 체크 (ㅇㅇ, 응, 웅 등)
    const confirmationKeywords = ['ㅇㅇ', '응', '웅', '그래', '해줘', 'ㅇ', 'ㅇㄱ', '오케이', 'ok'];
    const isConfirmation = confirmationKeywords.some(kw => message.trim().toLowerCase() === kw || message.trim() === kw);

    // 프롬프트 생성 - 확인 응답일 때만 직전 AI 응답 포함
    const contextToUse = isConfirmation ? lastAiResponse : null;
    const prompt = generatePrompt(message, currentSchedule, conflicts, contextToUse);

    // 여러 모델명 시도
    const modelNames = ['gemini-2.0-flash', 'gemini-1.5-flash'];

    let aiResponse = null;

    for (const modelName of modelNames) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            maxOutputTokens: 2048,  // 응답 길이 강력 제한 (4096 → 2048)
            temperature: 0.1  // 일관성 향상
          }
        });
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
      // 백틱 제거 (AI가 실수로 포함한 경우)
      let cleanResponse = aiResponse.trim();

      // 1. ```json ... ``` 형식
      const jsonMatch = cleanResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim());
      } else {
        // 2. ``` ... ``` 형식
        const codeMatch = cleanResponse.match(/```\s*([\s\S]*?)\s*```/);
        if (codeMatch) {
          parsed = JSON.parse(codeMatch[1].trim());
        } else {
          // 3. 시작 부분에 백틱이 있으면 제거
          if (cleanResponse.startsWith('```')) {
            cleanResponse = cleanResponse.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
            parsed = JSON.parse(cleanResponse.trim());
          } else {
            // 4. 직접 JSON
            parsed = JSON.parse(cleanResponse);
          }
        }
      }
    } catch (parseError) {

      // 파싱 실패 시 원본 스케줄 반환
      return res.json({
        success: true,
        understood: 'AI 응답 처리 중 오류 발생',
        action: 'none',
        schedule: currentSchedule,
        explanation: '죄송해요, 응답이 너무 길어서 처리하지 못했습니다. 😥\n\n다시 한번 말씀해주시거나, 더 구체적으로 요청해주세요.\n\n예: "금요일 6시 이후 삭제" 대신 "금요일 공연반 삭제"'
      });
    }

    // 인덱스 기반 삭제 처리
    if (parsed.deleteIndices && Array.isArray(parsed.deleteIndices)) {
      parsed.schedule = currentSchedule.filter((_, idx) => !parsed.deleteIndices.includes(idx + 1));
    }

    // ⚠️ explanation에서 JSON 제거 (AI가 실수로 JSON을 포함시킨 경우)
    if (parsed.explanation && typeof parsed.explanation === 'string') {
      // JSON 블록 제거
      let cleanExplanation = parsed.explanation;
      cleanExplanation = cleanExplanation.replace(/```json\s*[\s\S]*?\s*```/g, '');
      cleanExplanation = cleanExplanation.replace(/```\s*[\s\S]*?\s*```/g, '');

      // 단독 JSON 객체 제거 (여러 줄에 걸친 { ... })
      cleanExplanation = cleanExplanation.replace(/\{[\s\S]*?"understood"[\s\S]*?\}/g, '');
      cleanExplanation = cleanExplanation.replace(/\{[\s\S]*?"action"[\s\S]*?\}/g, '');
      cleanExplanation = cleanExplanation.replace(/\{[\s\S]*?"schedule"[\s\S]*?\}/g, '');

      // JSON 필드 라인 제거
      cleanExplanation = cleanExplanation.replace(/"(understood|action|schedule|explanation)":\s*[^\n]*/g, '');

      // 여러 줄 공백 정리
      cleanExplanation = cleanExplanation.replace(/\n{3,}/g, '\n\n').trim();

      // 빈 문자열이 되면 기본 메시지
      if (!cleanExplanation || cleanExplanation.length < 5) {
        cleanExplanation = parsed.understood || '처리했습니다.';
      }

      parsed.explanation = cleanExplanation;
    }

    // 🚨 "ㅇㅇ" 확인 응답 검증 및 보정
    if (isConfirmation && lastAiResponse) {

      // 요일 변환 맵
      const dayNameMap = {
        '월요일': 'MON', '화요일': 'TUE', '수요일': 'WED', '목요일': 'THU',
        '금요일': 'FRI', '토요일': 'SAT', '일요일': 'SUN'
      };

      // 직전 응답에서 대화 맥락 요일 추출
      let contextDay = null;
      for (const [dayName, dayCode] of Object.entries(dayNameMap)) {
        if (lastAiResponse.includes(dayName)) {
          contextDay = dayCode;
          break;
        }
      }

      // [삭제 예정] 목록 추출 (여러 섹션 지원)
      // 정규식: 모든 [삭제 예정...] 섹션부터 [유지됨] 또는 "삭제해드릴까요" 전까지
      const allDeleteSections = lastAiResponse.match(/\[삭제 예정[^\]]*\]([\s\S]*?)(?=\[유지됨|삭제해드릴까요|$)/g);
      if (allDeleteSections && allDeleteSections.length > 0) {
        const deleteSection = allDeleteSections.join('\n');

        // title과 startTime 추출
        const deleteTargets = [];
        const bulletLines = deleteSection.split('\n').filter(line => line.trim().startsWith('•'));

        bulletLines.forEach(line => {
          // 형식 1: "• 월요일: 도덕 (09:00-09:50), 영어 (10:00-10:50)"
          const dayMatch = line.match(/([월화수목금토일]요일):\s*(.+)/);
          if (dayMatch) {
            const items = dayMatch[2].split(/[,，]/);
            items.forEach(item => {
              const timeMatch = item.match(/(.+?)\s*\((\d{2}:\d{2})-/);
              if (timeMatch) {
                deleteTargets.push({
                  title: timeMatch[1].trim(),
                  startTime: timeMatch[2]
                });
              }
            });
          } else {
            // 형식 2: "• 금요일 수학 (13:50-14:40)" 또는 "• 수학 (13:50-14:40)"
            const timeMatch = line.match(/•\s*(?:([월화수목금토일]요일)\s+)?(.+?)\s*\((\d{2}:\d{2})-/);
            if (timeMatch) {
              const day = timeMatch[1]; // 요일 (있으면)
              const title = timeMatch[2].trim();
              const startTime = timeMatch[3];

              // 요일이 명시되지 않았으면 대화 맥락 요일 사용
              const targetDay = day ? dayNameMap[day] : contextDay;

              deleteTargets.push({
                day: targetDay, // 요일 코드 (명시된 요일 또는 맥락 요일, 없으면 null)
                title: title,
                startTime: startTime
              });
            }
          }
        });
        deleteTargets.slice(0, 5).forEach((t, i) => {
        });

        // 원본 스케줄에서 매칭 (title, startTime, day)
        const correctedSchedule = currentSchedule.filter(item => {
          const shouldDelete = deleteTargets.some(target => {
            // title과 startTime이 일치하는지 확인
            const titleMatch = item.title === target.title;
            const timeMatch = item.startTime === target.startTime;

            // 요일 확인 (target.day가 없으면 모든 요일 삭제, 있으면 해당 요일만)
            let dayMatch = true;
            if (target.day) {
              const itemDays = Array.isArray(item.days) ? item.days : [item.days];
              dayMatch = itemDays.includes(target.day);
            }

            return titleMatch && timeMatch && dayMatch;
          });
          return !shouldDelete; // 삭제 대상 아니면 유지
        });

        const deletedCount = currentSchedule.length - correctedSchedule.length;

        // 보정된 스케줄로 교체
        parsed.schedule = correctedSchedule;
      }
    }

    // 스케줄이 비어있거나 잘못된 경우 체크
    if (!parsed.schedule || !Array.isArray(parsed.schedule)) {
      return res.json({
        success: true,
        understood: parsed.understood,
        action: 'none',
        schedule: currentSchedule, // 원본 유지
        explanation: '죄송해요, 처리 중 문제가 발생했습니다. 시간표는 그대로 유지됩니다. 😊'
      });
    }

    // 스케줄이 모두 삭제된 경우 체크 (question이면 OK)
    if (parsed.schedule.length === 0 && currentSchedule.length > 0) {
      if (parsed.action === 'question') {
        // question일 때는 빈 배열이 정상 - 원본 유지
        return res.json({
          success: true,
          understood: parsed.understood,
          action: 'question',
          schedule: currentSchedule, // 원본 유지
          explanation: parsed.explanation
        });
      } else {

        return res.json({
          success: true,
          understood: parsed.understood,
          action: 'question',
          schedule: currentSchedule, // 원본 반환
          explanation: parsed.explanation || '현재 시간표를 유지했어요. 😊'
        });
      }
    }

    // ⚠️⚠️⚠️ add 액션 처리: AI가 새 항목만 반환하므로 기존 스케줄과 합치기 ⚠️⚠️⚠️
    if (parsed.action === 'add') {

      // AI가 새 항목만 반환 (1개 또는 몇 개)
      const newItems = parsed.schedule;

      // 기존 스케줄과 합치기
      const mergedSchedule = [...currentSchedule, ...newItems];
      parsed.schedule = mergedSchedule;
      newItems.slice(0, 10).forEach((item, i) => {
        const dayDisplay = item.days?.join(',') || 'undefined';
      });
    }

    // ⚠️⚠️⚠️ 실제 삭제 검증 (AI 거짓말 방지!) ⚠️⚠️⚠️
    if (parsed.action === 'delete') {
      const deletedItems = currentSchedule.filter(original =>
        !parsed.schedule.some(kept =>
          kept.title === original.title &&
          kept.startTime === original.startTime &&
          JSON.stringify(kept.days) === JSON.stringify(original.days)
        )
      );

      // 🚨 [유지됨] 검증: lastAiResponse에 [유지됨]이 있으면 체크
      if (lastAiResponse && lastAiResponse.includes('[유지됨')) {

        // [유지됨] 섹션 추출 (여러 개일 수 있음)
        const maintainSections = lastAiResponse.match(/\[유지됨[^\]]*\]([\s\S]*?)(?=\[|삭제해드릴까요\?|$)/g);

        if (maintainSections) {
          const shouldBeMaintained = [];

          maintainSections.forEach(section => {
            // • 항목명 (시간) 패턴 추출
            const itemMatches = section.match(/•\s*([가-힣a-zA-Z0-9\s&]+?)\s*\((\d{2}:\d{2})-(\d{2}:\d{2})\)/g);
            if (itemMatches) {
              itemMatches.forEach(match => {
                const titleMatch = match.match(/•\s*([가-힣a-zA-Z0-9\s&]+?)\s*\(/);
                if (titleMatch) {
                  shouldBeMaintained.push(titleMatch[1].trim());
                }
              });
            }
          });

          // 삭제된 항목 중 [유지됨]에 있는 것 찾기
          const wronglyDeleted = deletedItems.filter(item =>
            shouldBeMaintained.some(maintainTitle =>
              item.title.includes(maintainTitle) || maintainTitle.includes(item.title)
            )
          );

          if (wronglyDeleted.length > 0) {
            wronglyDeleted.forEach(item => {
              const daysStr = Array.isArray(item.days) ? item.days.join(',') : item.days;
            });

            parsed.schedule = [...parsed.schedule, ...wronglyDeleted];

            // 설명 업데이트
            const dayKorean = {'MON':'월','TUE':'화','WED':'수','THU':'목','FRI':'금','SAT':'토','SUN':'일'};
            const restoredList = wronglyDeleted.map(item => {
              const daysStr = Array.isArray(item.days) ? item.days.join(',') : item.days;
              const dayDisplay = daysStr.split(',').map(d => dayKorean[d] || d).join(',');
              return `• ${item.title} (${dayDisplay} ${item.startTime}-${item.endTime})`;
            }).join('\n');

            parsed.explanation = `⚠️ AI가 [유지됨] 항목을 잘못 삭제하여 복원했습니다.\n\n복원된 항목:\n${restoredList}\n\n${parsed.explanation}`;
          }
        }
      }

      if (deletedItems.length > 0) {
        deletedItems.forEach((item, idx) => {
          const daysStr = Array.isArray(item.days) ? item.days.join(',') : item.days;
        });

        // explanation에서 실제 삭제 항목 확인
        const explanation = parsed.explanation || '';
        const notMentioned = deletedItems.filter(item => !explanation.includes(item.title));

        if (notMentioned.length > 0) {
          notMentioned.forEach(item => {
            const daysStr = Array.isArray(item.days) ? item.days.join(',') : item.days;
          });

          // 실제 삭제 내역으로 설명 교체
          const dayKorean = {'MON':'월','TUE':'화','WED':'수','THU':'목','FRI':'금','SAT':'토','SUN':'일'};
          const actualDeletionList = deletedItems.map(item => {
            const daysStr = Array.isArray(item.days) ? item.days.join(',') : item.days;
            const dayDisplay = daysStr.split(',').map(d => dayKorean[d] || d).join(',');
            return `• ${item.title} (${dayDisplay} ${item.startTime}-${item.endTime})`;
          }).join('\n');

          parsed.explanation = `⚠️ 실제 삭제된 ${deletedItems.length}개 항목:\n\n${actualDeletionList}\n\n※ AI 응답에 일부 누락이 있어 실제 삭제 내역을 표시합니다.`;
        }
      }
    }

    // 80% 이상 삭제된 경우 경고
    const deletionRate = (currentSchedule.length - parsed.schedule.length) / currentSchedule.length;
    if (deletionRate > 0.8 && parsed.action !== 'delete') {

      return res.json({
        success: true,
        understood: parsed.understood,
        action: 'question',
        schedule: currentSchedule, // 원본 반환
        explanation: parsed.explanation || '현재 시간표를 유지했어요. 😊'
      });
    }

    // ⭐ 고정 일정이 있으면 최종적으로 optimizeSchedules 호출해서 겹침 제거
    let finalSchedule = parsed.schedule;
    if (fixedSchedules && fixedSchedules.length > 0) {

      // AI가 반환한 스케줄 + 고정 일정 원본으로 재최적화
      const allSchedulesForSearch = schedulesByImage?.flatMap(img => img.schedules || []) || [];
      const fixedOriginals = fixedSchedules.map(fixed => {
        if (fixed.originalSchedule) return fixed.originalSchedule;
        const found = allSchedulesForSearch.find(s =>
          s.title === fixed.title &&
          s.startTime === fixed.startTime &&
          s.endTime === fixed.endTime
        );
        return found || fixed;
      });

      // AI 결과 + 고정 원본 합치기 (중복 제거)
      const schedulesForReoptimization = [...parsed.schedule];
      fixedOriginals.forEach(fixedOrig => {
        const exists = schedulesForReoptimization.some(s =>
          s.title === fixedOrig.title &&
          s.startTime === fixedOrig.startTime &&
          s.endTime === fixedOrig.endTime
        );
        if (!exists) {
          schedulesForReoptimization.push(fixedOrig);
        }
      });

      // optimizeSchedules 호출 (Phase 0 겹침 제거 포함)
      const optimizedResult = await optimizeSchedules(
        schedulesForReoptimization,
        schedulesByImage || [],
        fixedSchedules
      );

      finalSchedule = optimizedResult.optimizedSchedules || optimizedResult;

      // 🔍 김다희 강사가 있는지 확인
      const hasDahee = finalSchedule.some(s => s.title?.includes('김다희'));
      if (hasDahee) {
        const daheeSchedules = finalSchedule.filter(s => s.title?.includes('김다희'));
      }
    }

    // ⭐ 새로 추가된 일정의 범례 생성 및 인덱스 할당 (action이 'add'일 때만)
    let customSchedules = [];
    if (parsed.action === 'add') {

      // 새로 추가된 항목들 (AI가 반환한 새 항목들)
      const newItems = parsed.schedule.slice(currentSchedule.length); // 기존 스케줄 이후 항목들

      if (newItems.length > 0) {
        // 기존 schedulesByImage에 있는 과목명들과 인덱스 매핑
        const existingTitleToIndex = new Map();
        if (schedulesByImage && Array.isArray(schedulesByImage)) {
          schedulesByImage.forEach((img, idx) => {
            if (img.schedules && Array.isArray(img.schedules)) {
              img.schedules.forEach(s => {
                if (s.title && !existingTitleToIndex.has(s.title)) {
                  existingTitleToIndex.set(s.title, idx);
                }
              });
            }
          });
        }

        // ⭐ 기존 커스텀 일정의 제목들과 인덱스 매핑 (같은 제목이면 재사용)
        if (existingCustomSchedules && Array.isArray(existingCustomSchedules)) {
          existingCustomSchedules.forEach(custom => {
            if (custom.title && !existingTitleToIndex.has(custom.title)) {
              existingTitleToIndex.set(custom.title, custom.sourceImageIndex);
            }
          });
        }

        // 새로 추가된 항목 중 기존에 없던 과목들
        const newTitles = new Set();
        newItems.forEach(item => {
          if (item.title && !existingTitleToIndex.has(item.title)) {
            newTitles.add(item.title);
          }
        });

        if (newTitles.size > 0) {

          // 새 이미지 인덱스 할당 (기존 이미지 개수부터 시작)
          const existingImageCount = schedulesByImage ? schedulesByImage.length : 0;
          let newImageIndex = existingImageCount;

          // 🔥 기존 커스텀 일정 중 최대 인덱스 찾기
          if (existingCustomSchedules && existingCustomSchedules.length > 0) {
            const maxCustomIndex = Math.max(...existingCustomSchedules.map(c => c.sourceImageIndex));
            newImageIndex = Math.max(newImageIndex, maxCustomIndex + 1);
          }

          // ⭐ 제목 분류 함수 (fixedScheduleHandler와 동일)
          const isSpecificTitle = (title) => {
            const genericTerms = [
              '일정', '약속', '새로운', '개인', '기타', '할일',
              'schedule', 'todo', 'event', '미정', '기록'
            ];
            const titleLower = title.toLowerCase();
            return !genericTerms.some(term => titleLower.includes(term));
          };

          const titleToNewIndex = new Map();
          const hasGeneric = Array.from(newTitles).some(title => !isSpecificTitle(title));
          let genericIndex = null;

          // "기타" 일정이 있으면 인덱스 9999 할당
          if (hasGeneric) {
            genericIndex = 9999;
            customSchedules.push({
              fileName: `커스텀 일정 (기타)`,
              sourceImageIndex: 9999,
              title: '기타',
              isCustom: true,
              isGeneric: true
            });
          }

          Array.from(newTitles).forEach(title => {
            const isSpecific = isSpecificTitle(title);

            if (!isSpecific) {
              // 불명확한 제목은 "기타"로 통합
              titleToNewIndex.set(title, 9999);
            } else {
              // 명확한 제목은 개별 인덱스
              customSchedules.push({
                fileName: `커스텀 일정 ${newImageIndex + 1}`,
                sourceImageIndex: newImageIndex,
                title: title,
                isCustom: true
              });
              titleToNewIndex.set(title, newImageIndex);
              newImageIndex++;
            }
          });

          // ⭐ 새로 추가된 일정에 sourceImageIndex 할당
          newItems.forEach(item => {
            if (item.title) {
              if (titleToNewIndex.has(item.title)) {
                item.sourceImageIndex = titleToNewIndex.get(item.title);
              } else if (existingTitleToIndex.has(item.title)) {
                item.sourceImageIndex = existingTitleToIndex.get(item.title);
              }
            }
          });
        } else {

          // 기존 과목이지만 sourceImageIndex 할당
          newItems.forEach(item => {
            if (item.title && existingTitleToIndex.has(item.title)) {
              item.sourceImageIndex = existingTitleToIndex.get(item.title);
            }
          });
        }
      }
    }
    res.json({
      success: true,
      understood: parsed.understood,
      action: parsed.action,
      schedule: finalSchedule,
      explanation: parsed.explanation,
      customSchedules: customSchedules.length > 0 ? customSchedules : undefined
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: '채팅 처리 실패',
      details: error.message
    });
  }
});

module.exports = router;
