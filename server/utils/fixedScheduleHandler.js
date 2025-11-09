const { GoogleGenerativeAI } = require('@google/generative-ai');
const { FIXED_SCHEDULE_INTENT_PROMPT } = require('../prompts/fixedSchedulePrompts');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * 고정 일정 관련 사용자 입력을 분석하고 처리
 */
async function analyzeFixedScheduleIntent(userInput, availableClasses = []) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    // 수업 목록 문자열 생성 - 강사 이름 포함
    const classList = availableClasses.length > 0
      ? availableClasses.map(c => `- ${c.title} (강사: ${c.instructor || '없음'}) [${c.days?.join(', ')} ${c.startTime}-${c.endTime}]`).join('\n')
      : '(현재 업로드된 시간표 없음)';

    const prompt = FIXED_SCHEDULE_INTENT_PROMPT
      .replace('{{AVAILABLE_CLASSES}}', classList)
      .replace('{{USER_INPUT}}', userInput);

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // JSON 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('❌ JSON 파싱 실패:', text);
      return { intent: 'none' };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    console.log('✅ 고정 일정 인텐트 분석:', parsed);

    return parsed;
  } catch (error) {
    console.error('❌ 고정 일정 인텐트 분석 실패:', error);
    return { intent: 'none' };
  }
}

/**
 * 시간표에서 특정 수업 찾기
 */
function findClassByName(schedules, className) {
  const cleaned = className.replace(/반$|수업$/g, '').trim();
  const normalized = cleaned.toLowerCase().replace(/\s+/g, '');

  console.log('🔍 검색:', `"${className}" → "${normalized}"`);

  // 강사 이름과 수업명 분리 시도
  // 예: "린아 KPOP" → instructor: "린아", title: "kpop"
  const parts = cleaned.toLowerCase().split(/\s+/);
  let searchInstructor = null;
  let searchTitle = null;

  if (parts.length >= 2) {
    // 마지막 단어를 수업명으로, 나머지를 강사명으로 시도
    const lastPart = parts[parts.length - 1];
    const firstParts = parts.slice(0, -1).join('');
    
    // 첫 부분이 한글 2-3자면 강사명으로 간주
    if (firstParts.match(/^[가-힣]{2,3}$/)) {
      searchInstructor = firstParts;
      searchTitle = lastPart;
      console.log(`강사+수업 패턴: "${searchInstructor}" + "${searchTitle}"`);
    } else {
      // 그 외에는 전체를 수업명으로
      searchTitle = normalized;
    }
  } else {
    searchTitle = normalized;
  }

  console.log('분리:', searchInstructor ? `강사="${searchInstructor}" 수업="${searchTitle}"` : `수업="${searchTitle}"`);

  const found = schedules.filter(schedule => {
    const title = (schedule.title || '').toLowerCase().replace(/\s+/g, '');
    const instructor = (schedule.instructor || '').toLowerCase().replace(/\s+/g, '').replace(/t$/i, '');

    // 색상 필드 확인
    if (schedule.title?.includes('주니어B')) {
      console.log(`  📝 주니어B 스케줄 필드:`, {
        title: schedule.title,
        color: schedule.color,
        hasColor: !!schedule.color,
        allKeys: Object.keys(schedule)
      });
    }

    let matches = false;

    if (searchInstructor && searchTitle) {
      // 강사명 + 수업명 모두 있으면 둘 다 매칭해야 함
      const titleMatch = title.includes(searchTitle);
      const instructorMatch = instructor.includes(searchInstructor);

      // 케이스 1: title에 수업명 + instructor에 강사명 (정상 케이스)
      // 예: title="KPOP", instructor="린아T" 또는 "린아"
      const case1 = titleMatch && instructorMatch;

      // 케이스 2: title에 강사명+T 포함 (OCR 파싱 이슈)
      // 예: title="린아T", instructor="린아"
      const case2 = title.includes(searchInstructor + 't') && instructor.includes(searchInstructor);

      // 케이스 3: title 자체가 "강사명T" 형식 (백업 매칭)
      // 예: title="린아T", searchInstructor="린아"
      const case3 = title === (searchInstructor + 't') && instructor.includes(searchInstructor);

      matches = case1 || case2 || case3;

      if (matches) {
        console.log(`    → 매칭 이유: case1=${case1}, case2=${case2}, case3=${case3}`);
      }
    } else if (searchTitle) {
      // 수업명만 있으면 제목만 매칭
      matches = title.includes(searchTitle) || searchTitle.includes(title);
    }

    console.log(`  ${schedule.title} (${schedule.instructor || 'N/A'}) [${schedule.days} ${schedule.startTime}-${schedule.endTime}] ${matches ? '✅' : '❌'}`);

    return matches;
  });

  console.log(`매칭 결과: ${found.length}개\n`);
  return found.length > 0 ? found : null;
}

/**
 * 시간표 수업을 고정 스케줄로 변환
 */
function convertToFixedSchedule(schedule, type = 'pinned-class') {
  console.log('🔄 convertToFixedSchedule:', {
    title: schedule.title,
    hasAcademyName: !!schedule.academyName,
    hasSubjectName: !!schedule.subjectName,
    academyName: schedule.academyName,
    subjectName: schedule.subjectName,
    color: schedule.color
  });

  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    title: schedule.title,
    days: schedule.days || [],
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    floor: schedule.floor,
    instructor: schedule.instructor,
    academyName: schedule.academyName,  // ⭐ 추가: 학원 풀네임
    subjectName: schedule.subjectName,  // ⭐ 추가: 과목명
    color: schedule.color,  // ⭐ 추가: 원본 시간표 색상
    sourceImageIndex: schedule.sourceImageIndex,  // ⭐ 추가: 이미지 인덱스 (색상 할당용)
    priority: 0, // 최우선
    userFixed: true,
    originalSchedule: schedule // 원본 참조 (모든 필드 포함)
  };
}

/**
 * 개인 일정을 고정 스케줄로 변환
 */
function createCustomFixedSchedule(customData) {
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'custom',
    title: customData.title,
    days: customData.days || [],
    startTime: customData.startTime,
    endTime: customData.endTime,
    priority: 0, // 최우선
    userFixed: true,
    color: customData.color || '#FF6B6B'
  };
}

/**
 * 고정 일정 처리 메인 함수
 */
async function handleFixedScheduleRequest(userInput, currentSchedules, fixedSchedules) {
  const intent = await analyzeFixedScheduleIntent(userInput, currentSchedules);

  switch (intent.intent) {
    case 'pin_class': {
      // 시간표에서 수업 찾기
      const foundClasses = findClassByName(currentSchedules, intent.className);

      if (!foundClasses || foundClasses.length === 0) {
        return {
          success: false,
          intent: 'pin_class',
          message: `"${intent.className}" 수업을 찾을 수 없어요. 업로드된 시간표를 다시 확인해주세요! 😅`
        };
      }

      // 이미 고정되어 있는지 확인 (title, instructor, startTime, endTime 모두 확인)
      console.log('🔍 중복 체크:');
      console.log('  - fixedSchedules:', fixedSchedules?.length, '개');
      console.log('  - foundClasses:', foundClasses?.length, '개');

      const alreadyPinned = fixedSchedules.some(fixed => {
        if (fixed.type !== 'pinned-class') return false;

        const isDuplicate = foundClasses.some(fc => {
          const match = fc.title === fixed.title &&
            fc.instructor === fixed.instructor &&
            fc.startTime === fixed.startTime &&
            fc.endTime === fixed.endTime;

          if (match) {
            console.log(`  ⚠️ 중복 발견: ${fc.title} (${fc.instructor}) ${fc.startTime}-${fc.endTime}`);
          }

          return match;
        });

        return isDuplicate;
      });

      console.log('  - 중복 여부:', alreadyPinned);

      if (alreadyPinned) {
        return {
          success: false,
          intent: 'pin_class',
          message: `"${intent.className}"은 이미 고정되어 있어요! ✨`
        };
      }

      // 고정 스케줄로 변환
      const newFixed = foundClasses.map(fc => convertToFixedSchedule(fc));

      return {
        success: true,
        intent: 'pin_class',
        action: 'add',
        schedules: newFixed,
        message: intent.explanation || `"${intent.className}"을 필수 일정으로 고정했습니다! ✨`
      };
    }

    case 'add_custom': {
      // 개인 일정 추가
      const newFixed = createCustomFixedSchedule(intent.schedule);

      return {
        success: true,
        intent: 'add_custom',
        action: 'add',
        schedules: [newFixed],
        message: intent.explanation || `"${intent.schedule.title}" 시간을 고정했어요! 😊`
      };
    }

    case 'remove_fixed': {
      // 키워드로 고정 일정 찾기
      const toRemove = fixedSchedules.filter(fixed =>
        fixed.title.includes(intent.keyword)
      );

      if (toRemove.length === 0) {
        return {
          success: false,
          intent: 'remove_fixed',
          message: `"${intent.keyword}"가 포함된 고정 일정을 찾을 수 없어요! 🤔`
        };
      }

      return {
        success: true,
        intent: 'remove_fixed',
        action: 'remove',
        scheduleIds: toRemove.map(s => s.id),
        message: intent.explanation || `"${intent.keyword}" 고정 일정을 삭제했습니다!`
      };
    }

    case 'list_fixed': {
      if (fixedSchedules.length === 0) {
        return {
          success: true,
          intent: 'list_fixed',
          action: 'list',
          message: '아직 고정된 일정이 없어요! 💬 채팅으로 추가해보세요!'
        };
      }

      const list = fixedSchedules.map((fixed, idx) => {
        const typeLabel = fixed.type === 'custom' ? '🕐 개인' : '📚 수업';
        return `${idx + 1}. ${typeLabel} ${fixed.title} (${fixed.days?.join(', ')} ${fixed.startTime}-${fixed.endTime})`;
      }).join('\n');

      return {
        success: true,
        intent: 'list_fixed',
        action: 'list',
        message: `현재 고정된 일정:\n${list}`
      };
    }

    default:
      return {
        success: false,
        intent: 'none',
        message: null
      };
  }
}

module.exports = {
  analyzeFixedScheduleIntent,
  findClassByName,
  convertToFixedSchedule,
  createCustomFixedSchedule,
  handleFixedScheduleRequest
};
