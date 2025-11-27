const { calculateStatistics } = require('../utils/statistics');
const { DAY_NAME_TO_CODE } = require('../constants/dayMappings');

/**
 * AI 응답 파싱 (Legacy 최적화용)
 */
function parseAIResponse(aiResponse, originalSchedules) {
  try {
    // JSON 추출
    const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
    let jsonStr = jsonMatch ? jsonMatch[1] : aiResponse;

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
 * [삭제 예정] 섹션에서 삭제 대상 추출
 */
function extractDeleteTargets(lastAiResponse) {
  const allDeleteSections = lastAiResponse.match(/\[삭제 예정[^\]]*\]([\s\S]*?)(?=\[유지됨|삭제해드릴까요|$)/g);
  if (!allDeleteSections || allDeleteSections.length === 0) {
    return [];
  }

  const deleteSection = allDeleteSections.join('\n');
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
        const day = timeMatch[1];
        const title = timeMatch[2].trim();
        const startTime = timeMatch[3];

        deleteTargets.push({
          day: day ? DAY_NAME_TO_CODE[day] : null,
          title: title,
          startTime: startTime
        });
      }
    }
  });

  return deleteTargets;
}

/**
 * 삭제 대상에 따라 스케줄 필터링
 */
function applyDeleteTargets(currentSchedule, deleteTargets) {
  return currentSchedule.filter(item => {
    const shouldDelete = deleteTargets.some(target => {
      const titleMatch = item.title === target.title;
      const timeMatch = item.startTime === target.startTime;

      let dayMatch = true;
      if (target.day) {
        const itemDays = Array.isArray(item.days) ? item.days : [item.days];
        dayMatch = itemDays.includes(target.day);
      }

      return titleMatch && timeMatch && dayMatch;
    });
    return !shouldDelete;
  });
}

module.exports = {
  parseAIResponse,
  extractDeleteTargets,
  applyDeleteTargets
};
