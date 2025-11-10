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

// 학교 시간표 또는 학원 시간표에서 학년부 감지
function detectStudentGrade(allSchedules, schedulesByImage) {
  // 1. 학교 시간표에서 학년부 찾기 (최우선)
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
        console.log(`📚 학년부 감지 (학교): "${schedule.gradeLevel}" (from: ${imageTitle})`);
        return schedule.gradeLevel;
      }

      // imageTitle에서 학년 정보 추출
      if (imageTitle.includes('초등') || imageTitle.includes('초')) {
        console.log(`📚 학년부 감지 (학교): "초등학생" (from: ${imageTitle})`);
        return '초등학생';
      }
      if (imageTitle.includes('중학') || imageTitle.includes('중')) {
        console.log(`📚 학년부 감지 (학교): "중학생" (from: ${imageTitle})`);
        return '중학생';
      }
      if (imageTitle.includes('고등') || imageTitle.includes('고')) {
        console.log(`📚 학년부 감지 (학교): "고등학생" (from: ${imageTitle})`);
        return '고등학생';
      }
    }
  }

  // 2. 학교가 없으면 학원 시간표에서 "중등부" 같은 힌트 찾기
  for (const schedule of allSchedules) {
    if (schedule.gradeLevel) {
      console.log(`📚 학년부 감지 (학원): "${schedule.gradeLevel}" (from: ${schedule.title})`);
      return schedule.gradeLevel;
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `
당신은 학년별 수업 적합성을 판단하는 전문가입니다.

**학생 정보**: ${studentGrade}

**수업 목록**:
${schedules.map((s, idx) => `${idx}. ${s.title} (gradeLevel: ${s.gradeLevel || 'null'})`).join('\n')}

**지시사항**:
1. 위 학생에게 **적합한 수업의 인덱스(번호)만** 배열로 반환하세요.
2. **gradeLevel 판단 규칙**:
   - **학생이 중학생**이면:
     * gradeLevel: "중등부" → ✅ 포함
     * gradeLevel: "고등부" → ✅ 포함 (중고등 통합 수업)
     * gradeLevel: "초등부" → ❌ 제외 (중학생은 초등부 수업 불가)
     * gradeLevel: null → ✅ 포함 (전체 대상)
   - **학생이 초등학생**이면:
     * gradeLevel: "초등부" → ✅ 포함
     * gradeLevel: "중등부" → ❌ 제외
     * gradeLevel: "고등부" → ❌ 제외
     * gradeLevel: null → ✅ 포함 (전체 대상)
   - **학생이 고등학생**이면:
     * gradeLevel: "고등부" → ✅ 포함
     * gradeLevel: "중등부" → ✅ 포함 (중고등 통합 수업)
     * gradeLevel: "초등부" → ❌ 제외
     * gradeLevel: null → ✅ 포함 (전체 대상)
3. **중요**: "초등부", "Elementary", "초딩", "초등학생" 등은 모두 초등학생
4. **중요**: "중등부", "Middle School", "중딩", "중학생" 등은 모두 중학생
5. **중요**: "고등부", "High School", "고딩", "고등학생" 등은 모두 고등학생

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

// Phase 2: LLM 기반 스케줄 배치 카테고리 판단 (한 번에 여러 스케줄 처리)
async function categorizeSchedulesBatch(schedules, imageTitle) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // 스케줄 목록을 텍스트로 변환
    const scheduleList = schedules.map((s, idx) =>
      `${idx}. ${s.title} (${s.days?.join(',') || ''} ${s.startTime}-${s.endTime})`
    ).join('\n');

    const prompt = `
당신은 학생 시간표 분류 전문가입니다.

**이미지 제목**: ${imageTitle}

**수업 목록**:
${scheduleList}

**카테고리 분류 기준**:
1. **학교** (최우선): 초등학교, 중학교, 고등학교 정규 수업
   - 판단 기준: 이미지 제목이 "○○초", "○○중", "○○고", "초등학교", "중학교", "고등학교", "1학년 3반" 등
   - "학원"이라는 단어가 명확히 있으면 학교가 아님!
   - "축구 아카데미", "댄스 스튜디오" 등은 학교가 아님!

2. **공부학원** (2순위): 영어, 수학, 국어 등 학습 학원
3. **학습지** (3순위): 눈높이, 구몬 등
4. **예체능** (4순위): 피아노, 축구, 댄스, 필라테스, 요가, KPOP, PT 등
   - **중요**: "플라이 풋볼 아카데미" = 축구 학원 = 예체능!
   - **중요**: "댄스 스튜디오" = 예체능!
5. **기타** (5순위)

**출력 형식**: JSON 배열만 반환 (설명 없이)
[
  {"index": 0, "category": "학교", "priority": 1},
  {"index": 1, "category": "예체능", "priority": 4},
  ...
]
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\[[\s\S]*?\]/);

    if (!jsonMatch) {
      console.warn(`⚠️ LLM 배치 분류 실패 (${imageTitle}) - 기본값 사용`);
      return schedules.map(s => ({ ...s, category: '기타', priority: 5, imageTitle }));
    }

    const categorizations = JSON.parse(jsonMatch[0]);

    // 결과를 스케줄에 매핑
    return schedules.map((schedule, idx) => {
      const cat = categorizations.find(c => c.index === idx);
      const category = cat?.category || '기타';

      // ⭐ 학교가 아닌 경우, 이미지 제목에서 학원 풀네임과 과목 추출
      let academyName = '';  // 학원 풀네임
      let subjectName = '';  // 과목명

      if (category !== '학교') {
        // 과목 키워드 정의
        const keywords = ['필라테스', 'pilates', '요가', 'yoga', 'PT', '수학', 'math', '매스',
                         '도담', '영어', 'english', '국어', 'korean', '과학', 'science',
                         '댄스', 'dance', 'KPOP', 'kpop', '케이팝', '힙합', '발레',
                         '음악', 'music', '피아노', '기타', '바이올린', '드럼',
                         '미술', 'art', '그림', '체육', '축구', '농구', '수영',
                         '태권도', '유도', '검도', '코딩', 'coding', '프로그래밍', '컴퓨터'];

        // 1. 과목명 찾기
        let foundSubject = null;
        for (const keyword of keywords) {
          const keywordLower = keyword.toLowerCase();
          const titleLower = imageTitle.toLowerCase();

          if (titleLower.includes(keywordLower)) {
            // 한글이면 그대로, 영어면 첫 글자만 대문자로
            if (/[가-힣]/.test(keyword)) {
              foundSubject = keyword;
            } else {
              foundSubject = keyword.charAt(0).toUpperCase() + keyword.slice(1).toLowerCase();
            }
            subjectName = foundSubject;
            break;
          }
        }

        // 2. 학원 풀네임 추출 (이미지 제목 전체를 학원명으로 사용)
        // "시간표", "schedule" 등의 단어 제거
        academyName = imageTitle
          .replace(/\s*시간표\s*/gi, '')
          .replace(/\s*schedule\s*/gi, '')
          .replace(/\s*timetable\s*/gi, '')
          .trim();

        // 학원명이 비어있으면 원본 제목 사용
        if (!academyName) {
          academyName = imageTitle;
        }
      }

      return {
        ...schedule,
        category: category,
        priority: cat?.priority || 5,
        imageTitle,
        academyName,   // 학원 풀네임 (예: 기구필라테스 야샤야 PT)
        subjectName,   // 과목명 (예: 필라테스)
      };
    });

  } catch (error) {
    console.error(`❌ LLM 배치 분류 오류 (${imageTitle}):`, error.message);
    // 에러 시 모든 스케줄을 기본값으로
    return schedules.map(s => ({ ...s, category: '기타', priority: 5, imageTitle }));
  }
}

// Phase 2: 요일별 시간 겹침 체크 (학교는 요일마다 종료 시간이 다를 수 있음)
function hasTimeOverlap(schedule1, schedule2) {
  const days1 = schedule1.days || [];
  const days2 = schedule2.days || [];

  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // 요일 정규화 (한글 → 영어)
  const normalizeDays = (days) => {
    const dayMap = {
      '월': 'MON', '화': 'TUE', '수': 'WED', '목': 'THU',
      '금': 'FRI', '토': 'SAT', '일': 'SUN'
    };
    return days.map(d => dayMap[d] || d);
  };

  const normalizedDays1 = normalizeDays(days1);
  const normalizedDays2 = normalizeDays(days2);

  // 각 요일별로 겹침 체크
  for (const day of normalizedDays1) {
    if (!normalizedDays2.includes(day)) continue;

    // 같은 요일에서 시간 겹침 체크
    const start1 = timeToMinutes(schedule1.startTime);
    const end1 = timeToMinutes(schedule1.endTime);
    const start2 = timeToMinutes(schedule2.startTime);
    const end2 = timeToMinutes(schedule2.endTime);

    if (start1 < end2 && end1 > start2) {
      return true; // 겹침 발견
    }
  }

  return false; // 모든 요일 체크 후 겹침 없음
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

async function optimizeSchedules(allSchedules, schedulesByImage, fixedSchedules = []) {
  console.log('\n🔍 ========== 새로운 최적화 로직 시작 ==========');
  console.log(`📊 총 ${allSchedules.length}개 스케줄 입력`);
  console.log(`📌 고정 일정: ${fixedSchedules.length}개`);

  // 0-1. 고정 일정을 먼저 선택 (최우선)
  const selectedSchedules = [];

  console.log(`🔍 [DEBUG] fixedSchedules.length > 0: ${fixedSchedules.length > 0}`);
  if (fixedSchedules.length > 0) {
    console.log('\n📌 Phase 0: 고정 일정 배치 (최우선)');
    fixedSchedules.forEach(fixed => {
      console.log(`✅ [고정] ${fixed.title} (${fixed.days?.join(', ')} ${fixed.startTime}-${fixed.endTime})`);

      // 고정 일정이 custom이 아니면 allSchedules에서 원본 찾아서 추가
      if (fixed.type === 'pinned-class' && fixed.originalSchedule) {
        selectedSchedules.push(fixed.originalSchedule);
      } else {
        selectedSchedules.push(fixed);
      }
    });

    // 고정 일정과 겹치는 스케줄 제거
    console.log('\n🔍 고정 일정과 겹치는 스케줄 제거 중...');
    console.log(`📋 입력 스케줄: ${allSchedules.length}개`);
    console.log(`📌 고정 일정 정보:`);
    selectedSchedules.forEach(fixed => {
      console.log(`  - ${fixed.title} (${fixed.days} ${fixed.startTime}-${fixed.endTime})`);
    });

    // 🔍 디버깅: 18-19시 사이 스케줄 확인
    console.log(`\n🔍 18-19시 사이 스케줄 확인 (공연반과 겹칠 수 있는 것들):`);
    allSchedules.forEach(s => {
      const start = parseInt(s.startTime.split(':')[0]);
      const end = parseInt(s.endTime.split(':')[0]);
      if ((start >= 17 && start < 20) || (end > 17 && end <= 20)) {
        console.log(`  - ${s.title} (${s.days} ${s.startTime}-${s.endTime})`);
      }
    });

    const originalCount = allSchedules.length;

    // ⭐ 전체 스케줄 풀 생성 (schedulesByImage에서 모든 스케줄 추출)
    const fullSchedulePool = [];
    schedulesByImage.forEach(imageInfo => {
      if (imageInfo.schedules && Array.isArray(imageInfo.schedules)) {
        fullSchedulePool.push(...imageInfo.schedules);
      }
    });
    console.log(`📦 전체 스케줄 풀: ${fullSchedulePool.length}개 (최적화 전 모든 스케줄)`);

    const originalAllSchedules = [...allSchedules]; // 현재 최적화된 스케줄 (30개)
    const removedSchedules = []; // 제거된 스케줄 저장

    allSchedules = allSchedules.filter(schedule => {
      // 고정 일정의 원본인지 확인 (자기 자신은 제거 안 함)
      const isFixedOriginal = selectedSchedules.some(fixed => {
        return fixed.originalSchedule === schedule ||
               (fixed.title === schedule.title &&
                fixed.startTime === schedule.startTime &&
                fixed.endTime === schedule.endTime &&
                JSON.stringify(fixed.days) === JSON.stringify(schedule.days));
      });

      if (isFixedOriginal) {
        console.log(`  ⏭️ 건너뜀 (고정 일정 원본): ${schedule.title} (${schedule.days} ${schedule.startTime}-${schedule.endTime})`);
        // ⭐ removedSchedules에 추가하지 않음 - 이건 원래 있던 것이므로 후보 스케줄 풀에서 제외하면 안됨
        return false; // 고정 일정 원본은 제거 (selectedSchedules에 이미 추가됨)
      }

      // 고정 일정과 겹치는지 확인
      const hasOverlap = selectedSchedules.some(fixed => {
        // 요일 겹침 확인
        const scheduleDays = Array.isArray(schedule.days) ? schedule.days : [schedule.days];
        const fixedDays = Array.isArray(fixed.days) ? fixed.days : [fixed.days];

        // 요일 정규화 (한글 → 영어)
        const normalizeDays = (days) => {
          const dayMap = {
            '월': 'MON', '화': 'TUE', '수': 'WED', '목': 'THU',
            '금': 'FRI', '토': 'SAT', '일': 'SUN'
          };
          return days.map(d => dayMap[d] || d);
        };

        const normalizedScheduleDays = normalizeDays(scheduleDays);
        const normalizedFixedDays = normalizeDays(fixedDays);

        const dayOverlap = normalizedScheduleDays.some(day => normalizedFixedDays.includes(day));

        if (!dayOverlap) return false;

        // 시간 겹침 확인 (시간을 분으로 변환하여 비교)
        const timeToMinutes = (timeStr) => {
          const [hours, minutes] = timeStr.split(':').map(Number);
          return hours * 60 + minutes;
        };

        const scheduleStart = timeToMinutes(schedule.startTime);
        const scheduleEnd = timeToMinutes(schedule.endTime);
        const fixedStart = timeToMinutes(fixed.startTime);
        const fixedEnd = timeToMinutes(fixed.endTime);

        const timeOverlap = scheduleStart < fixedEnd && scheduleEnd > fixedStart;

        if (timeOverlap) {
          console.log(`  ✂️ 제거: ${schedule.title} (${scheduleDays.join(',')} ${schedule.startTime}-${schedule.endTime}) - ${fixed.title}과 겹침`);
          removedSchedules.push(schedule);
        }

        return timeOverlap;
      });

      return !hasOverlap;
    });

    console.log(`✅ 겹치는 스케줄 ${removedSchedules.length}개 제거 완료`);
    console.log(`✅ 고정 일정 ${selectedSchedules.length}개 배치 완료\n`);

    // ⭐ 고정 일정 모드: Phase 1, 2 건너뛰고 바로 반환
    console.log('✅ 고정 일정 모드 활성화 → Phase 1, 2 건너뛰기');
    let finalSchedules = [...selectedSchedules, ...allSchedules];
    console.log(`📊 현재 스케줄 분석:`);
    console.log(`  - 고정 일정: ${selectedSchedules.length}개`);
    console.log(`  - 일반 일정: ${allSchedules.length}개`);
    console.log(`  - 합계: ${finalSchedules.length}개`);
    console.log(`  - 원본: ${originalCount}개`);
    console.log(`  - 제거됨: ${removedSchedules.length}개`);
    console.log(`  - 부족: ${originalCount - finalSchedules.length}개`);

    // 원본 개수를 유지하기 위해 추가 스케줄 선택
    if (finalSchedules.length < originalCount) {
      const needed = originalCount - finalSchedules.length;
      console.log(`🔄 ${needed}개 스케줄 추가 필요`);

      // 시간 변환 헬퍼
      const timeToMinutes = (time) => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
      };

      // 요일 정규화
      const normalizeDays = (days) => {
        const dayMap = {
          '월': 'MON', '화': 'TUE', '수': 'WED', '목': 'THU',
          '금': 'FRI', '토': 'SAT', '일': 'SUN',
          'MON': 'MON', 'TUE': 'TUE', 'WED': 'WED', 'THU': 'THU',
          'FRI': 'FRI', 'SAT': 'SAT', 'SUN': 'SUN'
        };
        const daysArray = Array.isArray(days) ? days : [days];
        return daysArray.map(d => dayMap[d] || d);
      };

      // 겹침 체크
      const hasOverlapWith = (newSchedule, existingSchedules) => {
        const newStart = timeToMinutes(newSchedule.startTime);
        const newEnd = timeToMinutes(newSchedule.endTime);
        const newDays = normalizeDays(newSchedule.days);

        return existingSchedules.some(existing => {
          const existStart = timeToMinutes(existing.startTime);
          const existEnd = timeToMinutes(existing.endTime);
          const existDays = normalizeDays(existing.days);

          const dayOverlap = newDays.some(day => existDays.includes(day));
          if (!dayOverlap) return false;

          return !(newEnd <= existStart || newStart >= existEnd);
        });
      };

      // 제거되지 않은 스케줄 중에서 후보 선택 (⭐ fullSchedulePool 사용!)
      const removedKeys = new Set(removedSchedules.map(s => `${s.title}-${s.startTime}-${s.endTime}`));
      const finalKeys = new Set(finalSchedules.map(s => `${s.title}-${s.startTime}-${s.endTime}`));

      // ⭐ 제거된 스케줄이 속한 이미지 찾기 (같은 학원에서 대체 스케줄 선택)
      const removedImageSources = new Set(removedSchedules.map(s => s.sourceImage));
      console.log(`🔍 제거된 스케줄의 출처 이미지: ${Array.from(removedImageSources).join(', ')}`);

      // 모든 후보 스케줄 (제거되지 않고, 최종에도 없는 것)
      let candidateSchedules = fullSchedulePool.filter(s => {
        const key = `${s.title}-${s.startTime}-${s.endTime}`;
        const notRemoved = !removedKeys.has(key);
        const notInFinal = !finalKeys.has(key);
        return notRemoved && notInFinal;
      });

      // ⭐ 같은 이미지 출처 우선 정렬 (제거된 스케줄과 같은 학원 우선)
      candidateSchedules.sort((a, b) => {
        const aIsSameSource = removedImageSources.has(a.sourceImage);
        const bIsSameSource = removedImageSources.has(b.sourceImage);
        if (aIsSameSource && !bIsSameSource) return -1;
        if (!aIsSameSource && bIsSameSource) return 1;
        return 0;
      });

      console.log(`🔍 후보 스케줄: ${candidateSchedules.length}개`);
      console.log(`  📊 전체 풀: ${fullSchedulePool.length}, 제거된 키: ${removedKeys.size}, 최종 키: ${finalKeys.size}`);
      if (candidateSchedules.length > 0) {
        console.log(`  🎯 우선순위 top 3:`);
        candidateSchedules.slice(0, 3).forEach((s, i) => {
          const isSameSource = removedImageSources.has(s.sourceImage);
          console.log(`    ${i + 1}. ${s.title} (${s.days} ${s.startTime}-${s.endTime}) ${isSameSource ? '✅ 같은 출처' : '❌ 다른 출처'}`);
        });
      }

      // 겹치지 않는 스케줄 추가
      let added = 0;
      for (const candidate of candidateSchedules) {
        if (added >= needed) break;

        if (!hasOverlapWith(candidate, finalSchedules)) {
          finalSchedules.push(candidate);
          added++;
          console.log(`  ➕ 추가: ${candidate.title} (${candidate.days} ${candidate.startTime}-${candidate.endTime})`);
        }
      }

      console.log(`✅ ${added}개 스케줄 추가 완료`);
    }

    console.log(`📊 최종 스케줄: ${finalSchedules.length}개 (고정: ${selectedSchedules.length}, 일반: ${finalSchedules.length - selectedSchedules.length})`);

    return {
      optimizedSchedules: finalSchedules,
      alternatives: [],
      stats: {
        total: finalSchedules.length,
        fixed: selectedSchedules.length,
        removed: removedSchedules.length
      }
    };
  }

  // 0-2. Phase 1: 학년부 감지 및 필터링
  const studentGrade = detectStudentGrade(allSchedules, schedulesByImage);
  if (studentGrade) {
    console.log(`\n🎓 Phase 1: 학년부 필터링 시작 (학생: ${studentGrade})`);
    console.log(`🔍 [DEBUG] 필터링 전 스케줄 개수: ${allSchedules.length}`);
    allSchedules = await filterSchedulesByGrade(allSchedules, studentGrade);
    console.log(`✅ 필터링 완료: ${allSchedules.length}개 스케줄\n`);

    // 🔍 디버깅: 필터링 후 남은 스케줄 확인
    console.log('🔍 [DEBUG] 필터링 후 남은 스케줄 (처음 10개):');
    allSchedules.slice(0, 10).forEach((s, idx) => {
      console.log(`  ${idx}. ${s.title} (${s.sourceImage}) - gradeLevel: "${s.gradeLevel || 'null'}"`);
    });
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

  // 2. Phase 2: LLM 기반 카테고리 판단 및 옵션 생성 (배치 처리)
  console.log('\n🤖 Phase 2: LLM 기반 카테고리 분류 시작 (배치 모드)...');
  const imageOptions = [];
  const allProcessedSchedules = []; // ⭐ academyName, subjectName이 추가된 전체 스케줄

  for (const [fileName, schedules] of Object.entries(imageGroups)) {
    const imageInfo = schedulesByImage.find(img => img.fileName === fileName);
    const imageTitle = imageInfo?.imageTitle || fileName;

    // 모든 스케줄을 한 번에 배치로 LLM에 전달
    const schedulesWithCategory = await categorizeSchedulesBatch(schedules, imageTitle);

    // ⭐ 처리된 스케줄을 전체 목록에 추가 (academyName, subjectName 포함)
    allProcessedSchedules.push(...schedulesWithCategory);

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

        // 옵션 우선순위 계산
        let optionPriority = 100; // 기본값

        // 1순위: 학년부가 명시된 옵션 (중등부, 초등부, 고등부)
        if (schedule.gradeLevel && (
          title.includes('중등부') || title.includes('초등부') || title.includes('고등부')
        )) {
          optionPriority = 0; // 최우선
        }
        // 2순위: 주5회 > 주4회 > 주3회 > 주2회 > 주1회
        else if (title.includes('주5회') || title.includes('주 5회')) optionPriority = 1;
        else if (title.includes('주4회') || title.includes('주 4회')) optionPriority = 2;
        else if (title.includes('주3회') || title.includes('주 3회')) optionPriority = 3;
        else if (title.includes('주2회') || title.includes('주 2회')) optionPriority = 4;
        else if (title.includes('주1회') || title.includes('주 1회')) optionPriority = 5;
        // 3순위: O, X 같은 기호나 수업준비는 최하위
        else if (title === 'O' || title === 'X' || title === '0' || title.includes('수업준비')) {
          optionPriority = 999; // 최하위
        }

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
  }

  console.log('✅ Phase 2: LLM 카테고리 분류 완료\n');

  // 3. 우선순위로 정렬
  imageOptions.sort((a, b) => a.priority - b.priority);

  // ⭐ 3-1. 학교가 없으면 우선순위 재조정 (가장 높은 우선순위를 1로 만듦)
  const hasSchool = imageOptions.some(opt => opt.category === '학교');
  if (!hasSchool && imageOptions.length > 0) {
    const minPriority = Math.min(...imageOptions.map(opt => opt.priority));
    console.log(`📊 학교 없음 - 우선순위 재조정: ${minPriority} → 1`);

    // 모든 우선순위를 상대적으로 조정
    imageOptions.forEach(opt => {
      const originalPriority = opt.priority;
      opt.priority = opt.priority - minPriority + 1;
      console.log(`   ${opt.imageTitle}: ${originalPriority} → ${opt.priority}`);
    });
  }

  // 4. 최적화: 우선순위대로 선택 (고정 일정 다음)
  const selectionLog = [];

  console.log('\n🎯 최적화 진행 (고정 일정 제외):');

  for (const imageOpt of imageOptions) {
    if (imageOpt.type === 'single') {
      // 학교: 전체 선택 (단, 고정 일정과 겹치지 않는 것만!)
      const option = imageOpt.options[0];

      // ⭐ 고정 일정과 겹치는 스케줄은 제외
      const nonOverlappingSchedules = option.schedules.filter(schedule => {
        // 고정 일정(fixedSchedules)과 겹치는지 확인
        const hasOverlapWithFixed = fixedSchedules?.some(fixed => {
          // 요일 겹침 확인
          const scheduleDays = Array.isArray(schedule.days) ? schedule.days : [schedule.days];
          const fixedDays = Array.isArray(fixed.days) ? fixed.days : [fixed.days];

          // 요일 정규화
          const normalizeDays = (days) => {
            const dayMap = {
              '월': 'MON', '화': 'TUE', '수': 'WED', '목': 'THU',
              '금': 'FRI', '토': 'SAT', '일': 'SUN'
            };
            return days.map(d => dayMap[d] || d);
          };

          const normalizedScheduleDays = normalizeDays(scheduleDays);
          const normalizedFixedDays = normalizeDays(fixedDays);
          const dayOverlap = normalizedScheduleDays.some(day => normalizedFixedDays.includes(day));

          if (!dayOverlap) return false;

          // 시간 겹침 확인
          const timeToMinutes = (timeStr) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
          };

          const scheduleStart = timeToMinutes(schedule.startTime);
          const scheduleEnd = timeToMinutes(schedule.endTime);
          const fixedStart = timeToMinutes(fixed.startTime);
          const fixedEnd = timeToMinutes(fixed.endTime);

          const timeOverlap = scheduleStart < fixedEnd && scheduleEnd > fixedStart;

          if (timeOverlap) {
            console.log(`  ✂️ 학교 스케줄 제외: ${schedule.title} (${scheduleDays.join(',')} ${schedule.startTime}-${schedule.endTime}) - 고정 일정 ${fixed.title}과 겹침`);
          }

          return timeOverlap;
        });

        return !hasOverlapWithFixed;
      });

      console.log(`✅ [${imageOpt.category}] ${imageOpt.imageTitle} - 전체 선택 (${nonOverlappingSchedules.length}/${option.schedules.length}개, 고정 일정과 겹침 ${option.schedules.length - nonOverlappingSchedules.length}개 제외)`);
      selectedSchedules.push(...nonOverlappingSchedules);
      selectionLog.push({
        image: imageOpt.imageTitle,
        selected: option.name,
        count: nonOverlappingSchedules.length
      });
    } else {
      // 학원: 여러 옵션 중 **하나만** 선택 (같은 수업의 다른 시간대는 상호 배타적)
      const selectedOptions = [];

      // ⭐ 수정: 첫 번째로 겹치지 않는 옵션 하나만 선택
      for (const option of imageOpt.options) {
        const hasConflict = imageHasOverlap(option.schedules, selectedSchedules);

        if (!hasConflict) {
          console.log(`✅ [${imageOpt.category}] ${imageOpt.imageTitle} - "${option.name}" 선택 (${option.schedules.length}개)`);

          const timeSlots = option.schedules.map(s =>
            `${s.days?.join(',') || '?'} ${s.startTime}-${s.endTime}`
          ).join(', ');
          console.log(`   ⏰ ${timeSlots}`);

          selectedSchedules.push(...option.schedules);
          selectedOptions.push(option);

          // ⭐ 중요: 하나만 선택하고 중단!
          console.log(`   🛑 학원 옵션 선택 완료 - 나머지 옵션 건너뜀`);
          break;
        } else {
          console.log(`   ⏭️ "${option.name}" - 시간 겹침으로 건너뜀`);
        }
      }

      if (selectedOptions.length > 0) {
        const totalCount = selectedOptions.reduce((sum, opt) => sum + opt.schedules.length, 0);
        const optionNames = selectedOptions.map(opt => opt.name).join(', ');
        selectionLog.push({
          image: imageOpt.imageTitle,
          selected: optionNames,
          count: totalCount
        });
        console.log(`   📊 총 ${selectedOptions.length}개 옵션, ${totalCount}개 수업 선택됨`);
      } else {
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

  // 🔍 디버깅: subjectLabel 확인 (학교 제외)
  console.log('\n🔍 [DEBUG] 학원 스케줄 subjectLabel 확인:');
  selectedSchedules
    .filter(s => s.category !== '학교')
    .slice(0, 10)
    .forEach((s, idx) => {
      console.log(`  ${idx}. ${s.title} - subjectLabel: "${s.subjectLabel || 'null'}" (imageTitle: ${s.imageTitle})`);
    });
  console.log('=====================================\n');

  // 고정 일정을 최종 결과에 강제로 포함
  if (fixedSchedules && fixedSchedules.length > 0) {
    console.log('\n📌 고정 일정 최종 포함 확인:');
    fixedSchedules.forEach(fixed => {
      // Phase 0에서 이미 추가했는지 확인
      // Line 325에서 fixed.originalSchedule을 추가했으므로, 그것과 비교
      const scheduleToCheck = fixed.originalSchedule || fixed;
      const alreadyIncluded = selectedSchedules.includes(scheduleToCheck) ||
        selectedSchedules.some(s =>
          s.title === fixed.title &&
          s.startTime === fixed.startTime &&
          s.endTime === fixed.endTime &&
          JSON.stringify(s.days) === JSON.stringify(fixed.days)
        );

      if (!alreadyIncluded) {
        console.log(`  ➕ 추가: ${fixed.title} (${fixed.days} ${fixed.startTime}-${fixed.endTime})`);
        selectedSchedules.push(scheduleToCheck);
      } else {
        console.log(`  ✅ 이미 포함됨: ${fixed.title} (${fixed.days} ${fixed.startTime}-${fixed.endTime})`);
      }
    });
  }

  return {
    optimizedSchedules: selectedSchedules,  // ⭐ 중복 제거 절대 안 함!
    allProcessedSchedules,  // ⭐ academyName, subjectName이 추가된 전체 스케줄
    removedSchedules: [],
    analysis: {
      totalInput: allSchedules.length,
      totalSelected: selectedSchedules.length,
      totalRemoved: allSchedules.length - selectedSchedules.length
    }
  };
}

module.exports = { optimizeSchedules, categorizeSchedulesBatch };
