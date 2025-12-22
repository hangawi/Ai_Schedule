/**
 * ===================================================================================================
 * scheduleAutoOptimizer.js - AI 기반 지능형 시간표 최적화 엔진
 * ===================================================================================================
 *
 * 📍 위치: 백엔드 > server/utils > scheduleAutoOptimizer.js
 * 🎯 주요 기능:
 *    - OCR로 추출된 여러 장의 시간표 데이터를 통합하여 사용자 맞춤형 최적 시간표 조합 생성.
 *    - 학교 수업(불가분 세트), 공부 학원, 예체능 등 카테고리별 우선순위 기반 배정 전략 수행.
 *    - 사용자의 학년부(초/중/고)를 자동 감지하고 LLM을 활용하여 적합한 수업만 선별적으로 필터링.
 *    - 고정 일정(Fixed Schedules)을 최우선 반영하며, 상호 배타적인 옵션(예: 동일 수업의 다른 시간대) 중 최적안 선택.
 *    - 이미지 제목에서 학원명과 과목명을 추출하여 데이터의 가독성과 의미론적 정확도 향상.
 *    - 복합적인 시간 겹침(Overlap) 체크 알고리즘을 통해 충돌 없는 시간표 구성 보장.
 *
 * 🔗 연결된 파일:
 *    - server/controllers/ocrController.js - 이미지 분석 완료 후 자동 최적화 시 이 모듈 호출.
 *    - server/routes/scheduleOptimizer.js - 채팅 기반 재최적화 시 핵심 엔진으로 활용.
 *
 * ✏️ 수정 가이드:
 *    - 학년부 판별 규칙을 보강하려면 detectStudentGrade 내의 정규식 또는 판단 로직 수정.
 *    - 카테고리별 우선순위나 분류 기준을 변경하려면 categorizeSchedulesBatch 내의 프롬프트 지침 수정.
 *    - 최적화 알고리즘의 선택 전략을 변경하려면 optimizeSchedules 루프 내의 조건식 수정.
 *
 * 📝 참고사항:
 *    - 이 엔진은 단순히 겹침을 제거하는 것을 넘어, 사용자의 상황(학년 등)에 맞는 '실제 수강 가능한' 조합을 찾아줌.
 *
 * ===================================================================================================
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * detectStudentGrade
 * @description 업로드된 이미지 제목이나 내용에서 학생의 현재 학년부(초/중/고) 정보를 추론합니다.
 * @param {Array} allSchedules - 전체 일정 리스트.
 * @param {Array} schedulesByImage - 이미지별 메타데이터 정보.
 * @returns {string|null} 감지된 학년부 명칭 또는 null.
 */
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
        return schedule.gradeLevel;
      }

      // imageTitle에서 학년 정보 추출
      if (imageTitle.includes('초등') || imageTitle.includes('초')) {
        return '초등학생';
      }
      if (imageTitle.includes('중학') || imageTitle.includes('중')) {
        return '중학생';
      }
      if (imageTitle.includes('고등') || imageTitle.includes('고')) {
        return '고등학생';
      }
    }
  }

  // 2. 학교가 없으면 학원 시간표에서 "중등부" 같은 힌트 찾기
  for (const schedule of allSchedules) {
    if (schedule.gradeLevel) {
      return schedule.gradeLevel;
    }
  }
  return null;
}

/**
 * filterSchedulesByGrade
 * @description LLM을 사용하여 추출된 일정들이 학생의 학년 수준에 적합한지 판단하고 부적절한 일정을 필터링합니다.
 * @param {Array} schedules - 분석 대상 일정 배열.
 * @param {string} studentGrade - 학생의 학년부 정보.
 * @returns {Promise<Array>} 학년별 적합성이 검증된 일정 배열.
 */
async function filterSchedulesByGrade(schedules, studentGrade) {
  if (!studentGrade) {
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

    // JSON 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return schedules;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const suitableIndexes = parsed.suitableIndexes || [];

    const filteredSchedules = schedules.filter((_, idx) => suitableIndexes.includes(idx));
    return filteredSchedules;

  } catch (error) {
    return schedules;
  }
}

/**
 * categorizeSchedulesBatch
 * @description 여러 개의 일정을 한 번에 분석하여 각각의 카테고리(학교, 학원 등)와 배정 우선순위를 부여합니다.
 * @param {Array} schedules - 분류할 일정 배열.
 * @param {string} imageTitle - 해당 일정이 속한 이미지의 제목.
 * @returns {Promise<Array>} 카테고리 및 메타데이터가 보강된 일정 배열.
 */
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
    // 에러 시 모든 스케줄을 기본값으로
    return schedules.map(s => ({ ...s, category: '기타', priority: 5, imageTitle }));
  }
}

/**
 * hasTimeOverlap
 * @description 두 일정이 요일과 시간 측면에서 서로 중첩되는지 확인합니다.
 */
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

/**
 * imageHasOverlap
 * @description 한 이미지 그룹의 일정들이 기존에 선택된 일정들과 하나라도 겹치는지 확인합니다.
 */
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

/**
 * optimizeSchedules
 * @description 추출된 대량의 일정 데이터를 분석하여 최적의 비충돌 시간표 조합을 생성하는 메인 함수입니다.
 * @param {Array} allSchedules - 분석할 전체 일정 리스트.
 * @param {Array} schedulesByImage - 이미지별로 그룹화된 일정 데이터.
 * @param {Array} [fixedSchedules=[]] - 사용자가 명시한 고정 일정 리스트.
 * @returns {Promise<Object>} 최적화된 일정 리스트 및 분석 통계.
 */
async function optimizeSchedules(allSchedules, schedulesByImage, fixedSchedules = []) {

  // 0-1. 고정 일정을 먼저 선택 (최우선)
  const selectedSchedules = [];

  if (fixedSchedules.length > 0) {
    fixedSchedules.forEach(fixed => {

      // 고정 일정이 custom이 아니면 allSchedules에서 원본 찾아서 추가
      if (fixed.type === 'pinned-class' && fixed.originalSchedule) {
        selectedSchedules.push(fixed.originalSchedule);
      } else {
        selectedSchedules.push(fixed);
      }
    });

    // 🔍 디버깅: 18-19시 사이 스케줄 확인
    allSchedules.forEach(s => {
      const start = parseInt(s.startTime.split(':')[0]);
      const end = parseInt(s.endTime.split(':')[0]);
    });

    const originalCount = allSchedules.length;

    // ⭐ 전체 스케줄 풀 생성 (schedulesByImage에서 모든 스케줄 추출)
    const fullSchedulePool = [];
    schedulesByImage.forEach(imageInfo => {
      if (imageInfo.schedules && Array.isArray(imageInfo.schedules)) {
        fullSchedulePool.push(...imageInfo.schedules);
      }
    });

    const originalAllSchedules = [...allSchedules]; // 현재 최적화된 스케줄 (30개)
    const removedSchedules = []; // 제거된 스케줄 저장

    // ⭐ 겹치는 스케줄은 전체 제거 (하나의 세트로 취급)
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
          removedSchedules.push(schedule);
        }

        return timeOverlap;
      });

      return !hasOverlap;
    });
    // ⭐ 고정 일정 모드: Phase 1, 2 건너뛰고 바로 반환
    let finalSchedules = [...selectedSchedules, ...allSchedules];

    // 원본 개수를 유지하기 위해 추가 스케줄 선택
    if (finalSchedules.length < originalCount) {
      const needed = originalCount - finalSchedules.length;

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

      // 모든 후보 스케줄 (제거되지 않고, 최종에도 없는 것)
      let candidateSchedules = fullSchedulePool.filter(s => {
        const key = `${s.title}-${s.startTime}-${s.endTime}`;
        const notRemoved = !removedKeys.has(key);
        const notInFinal = !finalKeys.has(key);
        return notRemoved && notInFinal;
      });

      // ⭐ 주차 수 추출 헬퍼 (예: "주 5회" → 5, "주3회" → 3)
      const extractWeeklyCount = (title) => {
        if (!title) return 0;
        const match = title.match(/주\s*(\d+)\s*회/);
        return match ? parseInt(match[1]) : 0;
      };

      // ⭐ 제거된 스케줄의 academyName 추출 (같은 학원의 다른 옵션 찾기)
      const removedAcademyNames = new Set(
        removedSchedules
          .map(s => s.academyName || s.title?.replace(/주\s*\d+\s*회/, '').trim())
          .filter(Boolean)
      );

      // ⭐ 같은 학원의 다른 옵션 우선 정렬
      // 우선순위: 1) 같은 출처 > 2) 주차 수 많은 것 (주5회 > 주3회 > 주2회 > 주1회)
      candidateSchedules.sort((a, b) => {
        const aIsSameSource = removedImageSources.has(a.sourceImage);
        const bIsSameSource = removedImageSources.has(b.sourceImage);

        // 1순위: 같은 출처
        if (aIsSameSource && !bIsSameSource) return -1;
        if (!aIsSameSource && bIsSameSource) return 1;

        // 2순위: 같은 출처 내에서는 주차 수가 많은 것 우선
        if (aIsSameSource && bIsSameSource) {
          const aAcademy = a.academyName || a.title?.replace(/주\s*\d+\s*회/, '').trim();
          const bAcademy = b.academyName || b.title?.replace(/주\s*\d+\s*회/, '').trim();

          // 같은 학원이면 주차 수로 비교
          if (aAcademy === bAcademy) {
            const aWeekly = extractWeeklyCount(a.title);
            const bWeekly = extractWeeklyCount(b.title);
            return bWeekly - aWeekly; // 내림차순 (많은 게 먼저)
          }
        }

        return 0;
      });
      if (candidateSchedules.length > 0) {
        candidateSchedules.slice(0, 10).forEach((s, i) => {
          const isSameSource = removedImageSources.has(s.sourceImage);
          const weeklyCount = extractWeeklyCount(s.title);
          const academy = s.academyName || s.title?.replace(/주\s*\d+\s*회/, '').trim();
          });
      }

      // 겹치지 않는 스케줄 추가
      let added = 0;
      const addedAcademies = new Set(); // ⭐ 같은 학원의 여러 옵션 중복 방지

      for (const candidate of candidateSchedules) {
        if (added >= needed) break;

        // ⭐ 같은 학원 중복 체크 (같은 학원의 다른 옵션 하나만 선택)
        const academy = candidate.academyName || candidate.title?.replace(/주\s*\d+\s*회/, '').trim();

        // 이미 같은 학원의 다른 옵션이 추가되었는지 확인
        if (academy && addedAcademies.has(academy)) {
          continue;
        }

        if (!hasOverlapWith(candidate, finalSchedules)) {
          finalSchedules.push(candidate);
          added++;
          if (academy) {
            addedAcademies.add(academy);
          }
          const weeklyCount = extractWeeklyCount(candidate.title);
          }
      }
    }
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

  // ⭐ 학원 시간표 감지: 한 이미지에 여러 학년부가 있으면 학원 시간표로 판단
  const isAcademySchedule = schedulesByImage.some(imageInfo => {
    const imageSchedules = allSchedules.filter(s => s.sourceImage === imageInfo.fileName);
    const uniqueGradeLevels = new Set(
      imageSchedules
        .map(s => s.gradeLevel)
        .filter(g => g && g !== 'null')
    );

    // 한 이미지에 2개 이상의 학년부가 있으면 학원 시간표
    const hasMultipleGrades = uniqueGradeLevels.size >= 2;

    return hasMultipleGrades;
  });

  // ⭐ 학원 시간표면 학년부 필터링 스킵!
  if (studentGrade && !isAcademySchedule) {
    allSchedules = await filterSchedulesByGrade(allSchedules, studentGrade);
  } else if (isAcademySchedule) {
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

  // 2. Phase 2: LLM 기반 카테고리 판단 및 옵션 생성 (배치 처리)
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
    }
    // ⭐ 학원이면 제목+시간대별로 옵션 분리 (상호 배타적!)
    else {
      // ⭐ "주N회" 그룹별로 옵션 그룹화
      const frequencyGroups = new Map(); // 'weekly_5', 'weekly_3', etc.
      const otherOptions = []; // 주N회가 아닌 일반 옵션들

      schedulesWithCategory.forEach(schedule => {
        const title = schedule.title || 'unnamed';

        // 주N회 패턴 감지
        const weeklyMatch = title.match(/주\s*([1-5])회/);

        if (weeklyMatch) {
          const frequency = weeklyMatch[1]; // '5', '3', etc.
          const groupKey = `weekly_${frequency}`;

          if (!frequencyGroups.has(groupKey)) {
            frequencyGroups.set(groupKey, {
              frequency: parseInt(frequency),
              schedules: []
            });
          }

          frequencyGroups.get(groupKey).schedules.push(schedule);
        } else {
          // 주N회가 아닌 스케줄은 개별 옵션으로
          otherOptions.push(schedule);
        }
      });

      const options = [];

      // 주N회 그룹을 옵션으로 변환 (각 그룹 = 1개 옵션, 그 안에 여러 시간대)
      for (const [groupKey, group] of frequencyGroups.entries()) {
        const freq = group.frequency;
        let optionPriority = 100;

        // 주5회 > 주4회 > 주3회 > 주2회 > 주1회
        if (freq === 5) optionPriority = 1;
        else if (freq === 4) optionPriority = 2;
        else if (freq === 3) optionPriority = 3;
        else if (freq === 2) optionPriority = 4;
        else if (freq === 1) optionPriority = 5;

        // 각 시간대를 별도 옵션으로 추가 (같은 주N회 내에서 선택)
        group.schedules.forEach(schedule => {
          const timeRange = `${schedule.startTime}-${schedule.endTime}`;
          const daysStr = (schedule.days || []).join(',');

          options.push({
            name: `${schedule.title} (${daysStr} ${timeRange})`,
            schedules: [schedule],
            optionPriority,
            frequencyGroup: groupKey  // ⭐ 같은 그룹 표시
          });
        });
      }

      // 주N회가 아닌 일반 옵션들 추가
      otherOptions.forEach(schedule => {
        const timeRange = `${schedule.startTime}-${schedule.endTime}`;
        const daysStr = (schedule.days || []).join(',');
        const title = schedule.title || 'unnamed';

        let optionPriority = 100;

        // 학년부 우선순위
        if (schedule.gradeLevel && (
          title.includes('중등부') || title.includes('초등부') || title.includes('고등부')
        )) {
          optionPriority = 0;
        }
        // O, X 최하위
        else if (title === 'O' || title === 'X' || title === '0' || title.includes('수업준비')) {
          optionPriority = 999;
        }

        options.push({
          name: `${title} (${daysStr} ${timeRange})`,
          schedules: [schedule],
          optionPriority
        });
      });

      // 옵션을 우선순위로 정렬 (주5회가 먼저, 같은 주N회 내에서는 순서 유지)
      options.sort((a, b) => a.optionPriority - b.optionPriority);

      imageOptions.push({
        type: 'exclusive',  // 상호 배타적
        imageTitle,
        fileName,
        category: imageCategory,
        priority: imagePriority,
        options: options
      });

      if (frequencyGroups.size > 0) {
        for (const [groupKey, group] of frequencyGroups.entries()) {
        }
      }
      options.forEach(opt => {
      });
    }
  }

  // 3. 우선순위로 정렬
  imageOptions.sort((a, b) => a.priority - b.priority);

  // ⭐ 3-1. 학교가 없으면 우선순위 재조정 (가장 높은 우선순위를 1로 만듦)
  const hasSchool = imageOptions.some(opt => opt.category === '학교');
  if (!hasSchool && imageOptions.length > 0) {
    const minPriority = Math.min(...imageOptions.map(opt => opt.priority));

    // 모든 우선순위를 상대적으로 조정
    imageOptions.forEach(opt => {
      const originalPriority = opt.priority;
      opt.priority = opt.priority - minPriority + 1;
    });
  }

  // 4. 최적화: 우선순위대로 선택 (고정 일정 다음)
  const selectionLog = [];

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

          return timeOverlap;
        });

        return !hasOverlapWithFixed;
      });

      selectedSchedules.push(...nonOverlappingSchedules);
      selectionLog.push({
        image: imageOpt.imageTitle,
        selected: option.name,
        count: nonOverlappingSchedules.length
      });
    } else {
      // 학원: 여러 옵션 중 **하나만** 선택 (같은 수업의 다른 시간대는 상호 배타적)
      const selectedOptions = [];
      const selectedFrequencyGroups = new Set(); // 이미 선택된 주N회 그룹 추적

      // ⭐ 주N회 그룹별로 하나만 선택, 우선순위 순서대로
      for (const option of imageOpt.options) {
        // 같은 frequencyGroup이 이미 선택되었으면 건너뜀
        if (option.frequencyGroup && selectedFrequencyGroups.has(option.frequencyGroup)) {
          continue;
        }

        const hasConflict = imageHasOverlap(option.schedules, selectedSchedules);

        if (!hasConflict) {
          
          const timeSlots = option.schedules.map(s =>
            `${s.days?.join(',') || '?'} ${s.startTime}-${s.endTime}`
          ).join(', ');

          selectedSchedules.push(...option.schedules);
          selectedOptions.push(option);

          // 이 주N회 그룹을 선택했다고 표시 (같은 그룹의 다른 시간대는 건너뜀)
          if (option.frequencyGroup) {
            selectedFrequencyGroups.add(option.frequencyGroup);
          }

          // ⭐ 주N회가 아니거나, 모든 frequencyGroup을 시도한 경우 중단
          // (주N회가 있는 경우, 다른 주N회 그룹도 시도해야 함)
          // 하지만 하나의 이미지에서 하나의 옵션만 선택하므로 여기서 break
          break;
        } else {
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
      } else {
      }
    }
  }

  // 🔍 디버깅: subjectLabel 확인 (학교 제외)
  selectedSchedules
    .filter(s => s.category !== '학교')
    .slice(0, 10)
    .forEach((s, idx) => {
      console.log(`  ${idx}. ${s.title} - subjectLabel: "${s.subjectLabel || 'null'}" (imageTitle: ${s.imageTitle})`);
    });

  // 고정 일정을 최종 결과에 강제로 포함
  if (fixedSchedules && fixedSchedules.length > 0) {
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
        selectedSchedules.push(scheduleToCheck);
      } else {
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
