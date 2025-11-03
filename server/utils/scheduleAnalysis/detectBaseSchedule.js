/**
 * 기본 베이스 시간표 감지 (학교 시간표 자동 인식)
 *
 * 기준:
 * 1. 평일 (월~금) 오전 시간대 (08:00-16:00)
 * 2. 일반적인 학교 과목명 (국어, 영어, 수학, 과학, 사회 등)
 * 3. 연속적인 시간표 패턴
 */

const SCHOOL_SUBJECTS = [
  '국어', '영어', '수학', '과학', '사회', '도덕', '음악', '미술', '체육',
  '기술', '가정', '한문', '한국사', '역사', '지리', '생물', '화학', '물리',
  '점심시간', '조회', '종례', '자습'
];

const SCHOOL_TIME_RANGE = {
  startHour: 8,
  endHour: 16
};

/**
 * 시간표가 학교 시간표인지 판단
 */
function isSchoolSchedule(schedule) {
  // 1. 과목명 확인
  const isSchoolSubject = SCHOOL_SUBJECTS.some(subject =>
    schedule.title.includes(subject)
  );

  // 2. 시간대 확인 (08:00 - 16:00)
  if (schedule.startTime) {
    const startHour = parseInt(schedule.startTime.split(':')[0]);
    const isSchoolTime = startHour >= SCHOOL_TIME_RANGE.startHour &&
                         startHour < SCHOOL_TIME_RANGE.endHour;

    if (isSchoolSubject && isSchoolTime) {
      return true;
    }
  }

  return false;
}

/**
 * 이미지별 스케줄에서 기본 베이스 감지
 */
function detectBaseScheduleFromImages(schedulesByImage) {
  const results = schedulesByImage.map((imageData, index) => {
    const schedules = imageData.schedules || [];

    // 학교 스케줄 개수 카운트
    const schoolCount = schedules.filter(isSchoolSchedule).length;
    const totalCount = schedules.length;
    const schoolRatio = totalCount > 0 ? schoolCount / totalCount : 0;

    // 70% 이상이 학교 과목이면 기본 베이스로 판단
    const isBase = schoolRatio >= 0.7;

    return {
      imageIndex: index,
      fileName: imageData.fileName,
      isBaseSchedule: isBase,
      schoolCount,
      totalCount,
      schoolRatio: Math.round(schoolRatio * 100),
      schedules: schedules.map(s => ({
        ...s,
        isSchoolSubject: isSchoolSchedule(s)
      }))
    };
  });

  console.log('🔍 기본 베이스 감지 결과:');
  results.forEach(r => {
    console.log(`  이미지 ${r.imageIndex + 1} (${r.fileName}): ${r.isBaseSchedule ? '✅ 기본 베이스' : '⭕ 선택 시간표'} (학교 과목 ${r.schoolRatio}%)`);
  });

  return results;
}

/**
 * 기본 베이스 스케줄만 추출
 */
function extractBaseSchedules(analysisResults) {
  const baseSchedules = [];

  analysisResults.forEach(result => {
    if (result.isBaseSchedule) {
      baseSchedules.push(...result.schedules);
    }
  });

  console.log(`📚 기본 베이스 스케줄: ${baseSchedules.length}개 추출`);
  return baseSchedules;
}

/**
 * 선택 가능한 스케줄만 추출 (기본 베이스 제외)
 */
function extractOptionalSchedules(analysisResults) {
  const optionalSchedules = [];

  analysisResults.forEach(result => {
    if (!result.isBaseSchedule) {
      optionalSchedules.push(...result.schedules);
    }
  });

  console.log(`🎯 선택 가능 스케줄: ${optionalSchedules.length}개 추출`);
  return optionalSchedules;
}

module.exports = {
  isSchoolSchedule,
  detectBaseScheduleFromImages,
  extractBaseSchedules,
  extractOptionalSchedules
};
