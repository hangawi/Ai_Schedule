const { DAY_CODE_TO_NAME } = require('../constants/dayMappings');

/**
 * 최적화 프롬프트 생성 (Legacy)
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
${conflicts.map((c, i) => `${i+1}. ${DAY_CODE_TO_NAME[c.day] || c.day}: ${c.schedule1.title}(${c.schedule1.startTime}) vs ${c.schedule2.title}(${c.schedule2.startTime})`).join('\n')}

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

module.exports = {
  generateOptimizationPrompt
};
