/**
 * 스케줄 자동 최적화 유틸리티
 *
 * 새로운 로직:
 * 1. 학교 시간표 = 전체가 1개의 불가분 세트 (중복 제거 절대 안 됨!)
 * 2. 영어학원 = 여러 옵션 중 1개만 선택 (상호 배타적)
 * 3. 우선순위: 학교(1) > 공부학원(2) > 학습지(3) > 예체능(4)
 * 4. Phase 1: 학년부 기반 자동 필터링 (LLM 사용)
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 학교 시간표에서 학년부 감지
function detectStudentGrade(allSchedules, schedulesByImage) {
  // 학교 카테고리 이미지 찾기
  for (const schedule of allSchedules) {
    const imageInfo = schedulesByImage.find(img => img.fileName === schedule.sourceImage);
    if (!imageInfo) continue;

    const imageTitle = imageInfo.imageTitle || '';

    // 학교 패턴 확인
    const schoolPatterns = [/초$/, /중$/, /고$/, /초등학교/, /중학교/, /고등학교/, /\d+학년.*\d+반/];
    const isSchool = schoolPatterns.some(pattern => pattern.test(imageTitle));

    if (isSchool) {
      // gradeLevel이 있으면 반환
      if (schedule.gradeLevel) {
        console.log(`📚 학년부 감지: "${schedule.gradeLevel}" (from: ${imageTitle})`);
        return schedule.gradeLevel;
      }

      // imageTitle에서 학년 정보 추출
      if (imageTitle.includes('초등') || imageTitle.includes('초')) {
        console.log(`📚 학년부 감지: "초등학생" (from: ${imageTitle})`);
        return '초등학생';
      }
      if (imageTitle.includes('중학') || imageTitle.includes('중')) {
        console.log(`📚 학년부 감지: "중학생" (from: ${imageTitle})`);
        return '중학생';
      }
      if (imageTitle.includes('고등') || imageTitle.includes('고')) {
        console.log(`📚 학년부 감지: "고등학생" (from: ${imageTitle})`);
        return '고등학생';
      }
    }
  }

  console.log('📚 학년부 감지 실패 - 필터링 스킵');
  return null;
}

// LLM으로 스케줄이 학생 학년에 적합한지 판단
async function filterSchedulesByGrade(schedules, studentGrade) {
  if (!studentGrade) {
    console.log('ℹ️ 학년부 정보 없음 - 필터링 스킵');
    return schedules;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const prompt = `
당신은 학년별 수업 적합성을 판단하는 전문가입니다.

**학생 정보**: ${studentGrade}

**수업 목록**:
${schedules.map((s, idx) => `${idx}. ${s.title} (gradeLevel: ${s.gradeLevel || 'null'})`).join('\n')}

**지시사항**:
1. 위 학생에게 **적합한 수업의 인덱스(번호)만** 배열로 반환하세요.
2. gradeLevel이 null이면 → 전체 대상이므로 무조건 포함
3. gradeLevel이 명시되어 있으면 → 학생 학년과 일치하는지 판단
   - "초등부", "Elementary", "초딩", "초등학생" 등은 모두 초등학생
   - "중등부", "Middle School", "중딩", "중학생" 등은 모두 중학생
   - "고등부", "High School", "고딩", "고등학생" 등은 모두 고등학생
4. 유연하게 판단하세요 (다양한 표현 인정)

**출력 형식**: JSON만 반환 (설명 없이)
{ "suitableIndexes": [0, 2, 5, ...] }
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    console.log('🤖 LLM 응답:', text);

    // JSON 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('⚠️ LLM 응답 파싱 실패 - 모든 스케줄 포함');
      return schedules;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const suitableIndexes = parsed.suitableIndexes || [];

    const filteredSchedules = schedules.filter((_, idx) => suitableIndexes.includes(idx));

    console.log(`✅ 학년부 필터링: ${schedules.length}개 → ${filteredSchedules.length}개`);
    console.log(`   제외된 수업: ${schedules.filter((_, idx) => !suitableIndexes.includes(idx)).map(s => s.title).join(', ') || '없음'}`);

    return filteredSchedules;

  } catch (error) {
    console.error('❌ 학년부 필터링 실패:', error.message);
    console.warn('⚠️ 필터링 없이 모든 스케줄 사용');
    return schedules;
  }
}

function categorizeSchedule(schedule, imageTitle) {
  const title = (schedule.title || '').toLowerCase();
  const image = (imageTitle || '').toLowerCase();
  const description = (schedule.description || '').toLowerCase();
  const combined = `${title} ${image} ${description}`;

  // 1순위: 학교 (imageTitle 기준으로 우선 판단)
  const schoolPatterns = [
    /초$/,           // "○○초"
    /중$/,           // "미리중", "○○중"
    /고$/,           // "○○고"
    /초등학교/,
    /중학교/,
    /고등학교/,
    /\d+학년.*\d+반/, // "1학년 3반"
  ];

  const hasSchoolPattern = schoolPatterns.some(pattern => pattern.test(image));

  if (
    !combined.includes('학원') &&
    (hasSchoolPattern ||
    combined.includes('학교') ||
    combined.includes('초등부') ||
    combined.includes('중등부') ||
    combined.includes('고등부'))
  ) {
    return { category: '학교', priority: 1 };
  }

  // 2순위: 공부 학원
  const studyKeywords = ['학원', '국어', '영어', '수학', '과학', '사회', '논술', '독서', '토론'];
  if (studyKeywords.some(keyword => combined.includes(keyword))) {
    return { category: '공부학원', priority: 2 };
  }

  // 3순위: 학습지
  if (combined.includes('학습지') || combined.includes('눈높이') || combined.includes('구몬')) {
    return { category: '학습지', priority: 3 };
  }

  // 4순위: 예체능
  const artsKeywords = ['피아노', '바이올린', '기타', '드럼', '음악', '미술', '그림', '태권도', '축구', '농구', '수영', '체육', '댄스', '발레', '필라테스', '요가', 'kpop', 'dance', 'pt', 'studio'];
  if (artsKeywords.some(keyword => combined.includes(keyword))) {
    return { category: '예체능', priority: 4 };
  }

  return { category: '기타', priority: 5 };
}

function hasTimeOverlap(schedule1, schedule2) {
  const days1 = schedule1.days || [];
  const days2 = schedule2.days || [];
  const hasCommonDay = days1.some(day => days2.includes(day));

  if (!hasCommonDay) return false;

  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const start1 = timeToMinutes(schedule1.startTime);
  const end1 = timeToMinutes(schedule1.endTime);
  const start2 = timeToMinutes(schedule2.startTime);
  const end2 = timeToMinutes(schedule2.endTime);

  return (start1 < end2 && end1 > start2);
}

// 이미지 전체가 다른 스케줄들과 겹치는지 확인
function imageHasOverlap(imageSchedules, otherSchedules) {
  for (const schedule1 of imageSchedules) {
    for (const schedule2 of otherSchedules) {
      if (hasTimeOverlap(schedule1, schedule2)) {
        return true;
      }
    }
  }
  return false;
}

async function optimizeSchedules(allSchedules, schedulesByImage) {
  console.log('\n🔍 ========== 새로운 최적화 로직 시작 ==========');
  console.log(`📊 총 ${allSchedules.length}개 스케줄 입력`);

  // 0. Phase 1: 학년부 감지 및 필터링
  const studentGrade = detectStudentGrade(allSchedules, schedulesByImage);
  if (studentGrade) {
    console.log(`\n🎓 Phase 1: 학년부 필터링 시작 (학생: ${studentGrade})`);
    allSchedules = await filterSchedulesByGrade(allSchedules, studentGrade);
    console.log(`✅ 필터링 완료: ${allSchedules.length}개 스케줄\n`);
  }

  // 1. 이미지별로 그룹화
  const imageGroups = {};
  allSchedules.forEach(schedule => {
    const imageFileName = schedule.sourceImage;
    if (!imageGroups[imageFileName]) {
      imageGroups[imageFileName] = [];
    }
    imageGroups[imageFileName].push(schedule);
  });

  console.log(`📸 ${Object.keys(imageGroups).length}개 이미지 발견`);

  // 2. 이미지별로 카테고리 판단 및 옵션 생성
  const imageOptions = [];

  Object.entries(imageGroups).forEach(([fileName, schedules]) => {
    const imageInfo = schedulesByImage.find(img => img.fileName === fileName);
    const imageTitle = imageInfo?.imageTitle || fileName;

    // 모든 스케줄에 카테고리 부여
    const schedulesWithCategory = schedules.map(schedule => {
      const { category, priority } = categorizeSchedule(schedule, imageTitle);
      return { ...schedule, category, priority, imageTitle };
    });

    // 이미지의 카테고리 = 가장 높은 우선순위
    const imagePriority = Math.min(...schedulesWithCategory.map(s => s.priority));
    const imageCategory = schedulesWithCategory.find(s => s.priority === imagePriority)?.category || '기타';

    // ⭐ 학교면 전체가 1개 옵션 (불가분!)
    if (imageCategory === '학교') {
      imageOptions.push({
        type: 'single',
        imageTitle,
        fileName,
        category: imageCategory,
        priority: imagePriority,
        options: [
          {
            name: `${imageTitle} 전체`,
            schedules: schedulesWithCategory
          }
        ]
      });
      console.log(`🏫 [학교] ${imageTitle} - ${schedulesWithCategory.length}개 수업 (불가분 세트)`);
    }
    // ⭐ 학원이면 제목+시간대별로 옵션 분리 (상호 배타적!)
    else {
      // 각 스케줄을 개별 옵션으로 처리 (같은 제목이어도 시간이 다르면 다른 옵션)
      const options = schedulesWithCategory.map(schedule => {
        const timeRange = `${schedule.startTime}-${schedule.endTime}`;
        const daysStr = (schedule.days || []).join(',');
        const title = schedule.title || 'unnamed';

        // 옵션 우선순위 계산 (주5회 > 주3회 > 주2회 > 주1회)
        let optionPriority = 100; // 기본값
        if (title.includes('주5회') || title.includes('주 5회')) optionPriority = 1;
        else if (title.includes('주4회') || title.includes('주 4회')) optionPriority = 2;
        else if (title.includes('주3회') || title.includes('주 3회')) optionPriority = 3;
        else if (title.includes('주2회') || title.includes('주 2회')) optionPriority = 4;
        else if (title.includes('주1회') || title.includes('주 1회')) optionPriority = 5;

        return {
          name: `${title} (${daysStr} ${timeRange})`,
          schedules: [schedule],
          optionPriority  // 옵션 내 우선순위
        };
      });

      // 옵션을 우선순위로 정렬 (주5회가 먼저 시도됨)
      options.sort((a, b) => a.optionPriority - b.optionPriority);

      imageOptions.push({
        type: 'exclusive',  // 상호 배타적
        imageTitle,
        fileName,
        category: imageCategory,
        priority: imagePriority,
        options: options
      });

      console.log(`📚 [${imageCategory}] ${imageTitle} - ${options.length}개 옵션 (상호 배타적):`);
      options.forEach(opt => {
        console.log(`   옵션: ${opt.name} (${opt.schedules.length}개 수업)`);
      });
    }
  });

  // 3. 우선순위로 정렬
  imageOptions.sort((a, b) => a.priority - b.priority);

  // 4. 최적화: 우선순위대로 선택
  const selectedSchedules = [];
  const selectionLog = [];

  console.log('\n🎯 최적화 진행:');

  for (const imageOpt of imageOptions) {
    if (imageOpt.type === 'single') {
      // 학교: 무조건 선택 (최우선순위니까)
      const option = imageOpt.options[0];
      const hasConflict = imageHasOverlap(option.schedules, selectedSchedules);

      if (!hasConflict) {
        console.log(`✅ [${imageOpt.category}] ${imageOpt.imageTitle} - 전체 선택 (${option.schedules.length}개)`);
        selectedSchedules.push(...option.schedules);
        selectionLog.push({
          image: imageOpt.imageTitle,
          selected: option.name,
          count: option.schedules.length
        });
      } else {
        console.log(`❌ [${imageOpt.category}] ${imageOpt.imageTitle} - 시간 겹침으로 제외`);
      }
    } else {
      // 학원: 여러 옵션 중 겹치지 않는 것 1개만 선택
      let selected = false;

      for (const option of imageOpt.options) {
        const hasConflict = imageHasOverlap(option.schedules, selectedSchedules);

        if (!hasConflict) {
          console.log(`✅ [${imageOpt.category}] ${imageOpt.imageTitle} - "${option.name}" 선택 (${option.schedules.length}개)`);

          const timeSlots = option.schedules.map(s =>
            `${s.days?.join(',') || '?'} ${s.startTime}-${s.endTime}`
          ).join(', ');
          console.log(`   ⏰ ${timeSlots}`);

          selectedSchedules.push(...option.schedules);
          selectionLog.push({
            image: imageOpt.imageTitle,
            selected: option.name,
            count: option.schedules.length
          });
          selected = true;
          break; // ⭐ 1개만 선택하고 중단!
        } else {
          console.log(`   ⏭️ "${option.name}" - 시간 겹침으로 건너뜀`);
        }
      }

      if (!selected) {
        console.log(`❌ [${imageOpt.category}] ${imageOpt.imageTitle} - 모든 옵션이 겹쳐서 제외`);
      }
    }
  }

  console.log('\n✨ ========== 최적화 완료 ==========');
  console.log(`✅ 선택된 수업: ${selectedSchedules.length}개`);
  console.log(`✅ 선택 내역:`);
  selectionLog.forEach(log => {
    console.log(`   - ${log.image}: ${log.selected} (${log.count}개)`);
  });
  console.log('=====================================\n');

  return {
    optimizedSchedules: selectedSchedules,  // ⭐ 중복 제거 절대 안 함!
    removedSchedules: [],
    analysis: {
      totalInput: allSchedules.length,
      totalSelected: selectedSchedules.length,
      totalRemoved: allSchedules.length - selectedSchedules.length
    }
  };
}

module.exports = { optimizeSchedules };
