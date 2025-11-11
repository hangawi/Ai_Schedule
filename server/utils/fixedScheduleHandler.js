const { GoogleGenerativeAI } = require('@google/generative-ai');
const { FIXED_SCHEDULE_INTENT_PROMPT } = require('../prompts/fixedSchedulePrompts');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * 고정 일정 관련 사용자 입력을 분석하고 처리
 */
async function analyzeFixedScheduleIntent(userInput, availableClasses = []) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
 * 시간을 분 단위로 변환
 */
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * 두 시간 사이의 차이를 분 단위로 계산
 */
function getTimeDifference(time1, time2) {
  return Math.abs(timeToMinutes(time1) - timeToMinutes(time2));
}

/**
 * 사용자 입력에서 시간 추출
 */
function extractTimeFromInput(userInput) {
  // "17시", "5시", "17:10", "5:10", "17시 반", "5시반" 등의 패턴 감지
  const timePatterns = [
    /(\d{1,2}):(\d{2})/,           // 17:10, 5:10
    /(\d{1,2})시\s*반/,             // 17시 반, 17시반
    /(\d{1,2})시/,                  // 17시, 5시
  ];

  for (const pattern of timePatterns) {
    const match = userInput.match(pattern);
    if (match) {
      let hours = parseInt(match[1]);
      let minutes = match[2] ? parseInt(match[2]) : 0;

      // "반" 키워드가 있으면 30분으로 처리
      if (userInput.includes('반') && !match[2]) {
        minutes = 30;
      }

      // 시간 정규화 (24시간 형식)
      if (hours < 12 && userInput.includes('오후')) {
        hours += 12;
      }

      const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      console.log(`🕐 사용자 입력에서 시간 추출: "${userInput}" → ${timeStr}`);
      return timeStr;
    }
  }

  return null;
}

/**
 * 시간표에서 특정 수업 찾기 (시간 기반 선택 포함)
 */
function findClassByName(schedules, className, userInput = '') {
  // "T", "반", "수업" 제거 (강사명 뒤의 "T"도 제거)
  // "린아T 공연반" → "린아 공연", "공연반" → "공연"
  const cleaned = className
    .replace(/t\s/gi, ' ')  // "T " → " " (강사명 뒤의 T)
    .replace(/반$|수업$/g, '')  // 끝의 "반", "수업" 제거
    .trim();
  const normalized = cleaned.toLowerCase().replace(/\s+/g, '');

  console.log('🔍 검색:', `"${className}" → "${normalized}"`);

  // 강사 이름과 수업명 분리 시도
  // 예: "린아 KPOP" → instructor: "린아", title: "kpop"
  const parts = cleaned.toLowerCase().split(/\s+/);
  let searchInstructor = null;
  let searchTitle = null;

  if (parts.length >= 2) {
    // "주X회" 패턴이 있으면 전체를 수업명으로 처리
    // 예: "초등부 주5회", "초등부 주3회" 등
    const hasWeeklyPattern = normalized.match(/주\d+회/);

    if (hasWeeklyPattern) {
      // 주X회 패턴 → 전체를 수업명으로
      searchTitle = normalized;
      console.log(`주X회 패턴 감지 → 전체를 수업명으로: "${searchTitle}"`);
    } else {
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
      // 수업명만 있으면 제목만 매칭 (instructor 유무 상관없이)
      const titleMatch = title.includes(searchTitle) || searchTitle.includes(title);

      matches = titleMatch;
    }

    console.log(`  ${schedule.title} (${schedule.instructor || 'N/A'}) [${schedule.days} ${schedule.startTime}-${schedule.endTime}] ${matches ? '✅' : '❌'}`);

    return matches;
  });

  console.log(`매칭 결과: ${found.length}개`);

  // 여러 개 발견된 경우 → 시간 기반 선택 또는 사용자에게 물어보기
  if (found.length > 1) {
    console.log(`⚠️ 동일한 수업이 ${found.length}개 발견됨`);

    // 사용자 입력에서 시간 추출
    const userTime = extractTimeFromInput(userInput);

    if (userTime) {
      // 시간이 명시됨 → 가장 가까운 시간 선택
      console.log(`🕐 시간 명시됨: ${userTime} → 가장 가까운 시간표 선택`);

      let closestSchedule = found[0];
      let minDiff = getTimeDifference(userTime, found[0].startTime);

      found.forEach(schedule => {
        const diff = getTimeDifference(userTime, schedule.startTime);
        console.log(`  - ${schedule.title} ${schedule.startTime}: 차이 ${diff}분`);

        if (diff < minDiff) {
          minDiff = diff;
          closestSchedule = schedule;
        }
      });

      console.log(`✅ 가장 가까운 시간표 선택: ${closestSchedule.title} ${closestSchedule.startTime} (차이: ${minDiff}분)\n`);
      return [closestSchedule];
    } else {
      // 시간 없음 → 사용자에게 물어보기
      console.log(`❓ 시간 명시 없음 → 사용자에게 선택 요청\n`);
      return { needsUserChoice: true, options: found };
    }
  }

  console.log('');
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
 * 제목이 명확한지 판단 (학원/과목명인지)
 */
function isSpecificTitle(title) {
  const genericTerms = [
    '일정', '약속', '새로운', '개인', '기타', '할일',
    'schedule', 'todo', 'event', '미정', '기록', '시간'
  ];

  // 일반적인 용어가 포함되어 있거나 제목이 비어있으면 불명확
  if (!title || title.trim().length === 0) {
    return false;
  }

  const titleLower = title.toLowerCase().trim();

  // 정확히 일치하는 경우 불명확
  if (genericTerms.includes(titleLower)) {
    return false;
  }

  // 포함되어 있는 경우도 불명확
  return !genericTerms.some(term => titleLower.includes(term));
}

/**
 * 개인 일정을 고정 스케줄로 변환
 * @param {Object} customData - 추가할 커스텀 일정 데이터
 * @param {Array} existingFixedSchedules - 기존 고정 일정 배열 (같은 제목 확인용)
 */
function createCustomFixedSchedule(customData, existingFixedSchedules = []) {
  // ⭐ 제목이 명확한지 확인
  const isSpecific = isSpecificTitle(customData.title);
  const displayTitle = isSpecific ? customData.title : '기타';

  console.log(`📝 제목 분류: "${customData.title}" → ${isSpecific ? '명확 (개별 범례)' : '불명확 (기타로 통합)'}`);

  // ⭐ 같은 제목의 커스텀 일정이 이미 있으면 그 인덱스 재사용
  // 불명확한 제목들은 모두 "기타"로 통합
  const existingCustom = existingFixedSchedules.find(
    f => f.type === 'custom' && (isSpecific ? f.title === customData.title : f.title === '기타' || !isSpecificTitle(f.title))
  );

  let customImageIndex;
  if (existingCustom) {
    // 같은 제목이면 같은 인덱스 재사용
    customImageIndex = existingCustom.sourceImageIndex;
    console.log(`♻️ 같은 범주 발견: "${displayTitle}" → 인덱스 ${customImageIndex} 재사용`);
  } else {
    // 새로운 제목이면 새 인덱스 할당
    const existingCustomCount = existingFixedSchedules.filter(f => f.type === 'custom').length;
    const existingIndices = existingFixedSchedules
      .filter(f => f.type === 'custom')
      .map(f => f.sourceImageIndex);
    const maxIndex = existingIndices.length > 0 ? Math.max(...existingIndices) : 999;

    // ⭐ "기타"는 특별한 인덱스 9999 사용
    if (!isSpecific) {
      customImageIndex = 9999;
      console.log(`🆕 기타 일정: "${customData.title}" → 고정 인덱스 9999 할당`);
    } else {
      customImageIndex = Math.max(1000 + existingCustomCount, maxIndex + 1);
      console.log(`🆕 새로운 제목: "${customData.title}" → 인덱스 ${customImageIndex} 할당`);
    }
  }

  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'custom',
    title: displayTitle, // ⭐ 범례에 표시될 제목 (명확하면 원본, 불명확하면 "기타")
    originalTitle: customData.title, // 원본 제목 보존
    days: customData.days || [],
    startTime: customData.startTime,
    endTime: customData.endTime,
    priority: 0, // 최우선
    userFixed: true,
    isGeneric: !isSpecific, // ⭐ 기타 여부 플래그
    sourceImageIndex: customImageIndex, // ⭐ 범례용 고유 인덱스 (색상은 클라이언트에서 인덱스별 자동 할당)
    academyName: displayTitle // 범례에 표시될 이름
  };
}

/**
 * 고정 일정 처리 메인 함수
 */
async function handleFixedScheduleRequest(userInput, currentSchedules, fixedSchedules) {
  const intent = await analyzeFixedScheduleIntent(userInput, currentSchedules);

  switch (intent.intent) {
    case 'pin_class': {
      // 시간표에서 수업 찾기 (userInput 전달하여 시간 추출)
      const foundResult = findClassByName(currentSchedules, intent.className, userInput);

      // 수업을 못 찾은 경우
      if (!foundResult || foundResult.length === 0) {
        return {
          success: false,
          intent: 'pin_class',
          message: `"${intent.className}" 수업을 찾을 수 없어요. 업로드된 시간표를 다시 확인해주세요! 😅`
        };
      }

      // 사용자 선택이 필요한 경우
      if (foundResult.needsUserChoice) {
        const optionsList = foundResult.options.map((opt, idx) => {
          const daysStr = Array.isArray(opt.days) ? opt.days.join(', ') : opt.days;
          return `${idx + 1}. ${opt.title} (${opt.instructor || 'N/A'}) - ${daysStr} ${opt.startTime}-${opt.endTime}`;
        }).join('\n');

        return {
          success: false,
          intent: 'pin_class',
          needsUserChoice: true,
          options: foundResult.options,
          message: `"${intent.className}" 수업이 여러 개 있어요! 어떤 걸로 추가할까요?\n\n${optionsList}\n\n번호를 말씀해주세요! 😊`
        };
      }

      // 단일 또는 시간 기반 선택된 결과
      const foundClasses = Array.isArray(foundResult) ? foundResult : [foundResult];

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
      // 기존 고정 일정 배열 전달 (같은 제목 확인용)
      const newFixed = createCustomFixedSchedule(intent.schedule, fixedSchedules);

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
